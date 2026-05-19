# Match Algorithm — Deep Diagnostic Bug Report

> Read-only audit of the matching pipeline as it exists in source. No code changed. Reference spec: `matching_algorithm.md`. Reference implementation: `supabase/functions/match-sessions/index.ts`.

---

## 1. Pipeline Map

The actual end-to-end flow is **client-triggered**, not Ably-Reactor-triggered as the spec describes.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ app/(app)/intent.tsx                                                     │
│   - User picks intent + purpose, taps "Find someone"                     │
│   - INSERT into `sessions` (status='active')                  [line 92]  │
│   - lib/pendingMatch.ts::setPendingSession(sessionRow)        [line 117] │
│   - Ably: channel.presence.enter() on flight:{iata}:{date}    [line 127] │
│       ↑ payload is INFORMATIONAL only — no Reactor webhook              │
│   - router.replace('/(app)/match/searching')                  [line 136] │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ app/(app)/match/searching.tsx                                            │
│   useFocusEffect: load profile + activeSession + existingMatch          │
│       - if existing pending/mutual match: replace → /match/room  [86]   │
│       - if no active session: render "no session" state         [91]   │
│   useEffect (Ably subscribe):                                           │
│       - subscribe to user:{userId} channel                      [120]   │
│       - on 'match.created' → router.push /(app)/match           [123]   │
│       - on 'curiosity.match' → render "I'M IN / KEEP WAITING"   [129]   │
│       - on 'pool.exhausted' → render quiet state                [148]   │
│       - takePendingSession() → invoke 'match-sessions' edge fn  [157]   │
│   useEffect (15s curiosity probe):                                      │
│       - ONE-SHOT setTimeout that re-invokes matcher w/         [177]   │
│         { curiosity_mode: true }                                        │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ supabase/functions/match-sessions/index.ts (Deno.serve)                  │
│   Stage 0 — input validation, curiosity-mode wait check [300-335]       │
│   Stage 1 — SQL: SELECT from sessions                                   │
│       WHERE origin_iata = $1                                            │
│         AND status = 'active'                                           │
│         AND user_id != $me                                              │
│         AND id != $session                                              │
│         AND departure_time BETWEEN ($dep - 90min, $dep + 90min)         │
│       ORDER BY created_at DESC LIMIT 200            [line 346-368]      │
│     Then in JS:                                                         │
│       filter intentsCompatible() and terminalsReachable()  [376-379]    │
│   Stage 1.5 — parallel reads:                                           │
│       - myMatches (already paired with me)                              │
│       - pendingMatches (anyone locked in pending at this airport)       │
│       - myUserData (for scoring)                                        │
│       - myFlightData                                       [394-426]    │
│       remove already-paired and pending sessions                        │
│       if available.length === 0: publish pool.exhausted    [447-455]    │
│   Stage 2 — scoreCandidate() per remaining          [114-208, 500-505] │
│       - additive-bonus scoring (NOT spec)                               │
│       - sort by score, tier, recency               [506-515]            │
│       - if best.score < HIGH_CONFIDENCE_THRESHOLD (3) and               │
│         not curiosity → bail with 'matched: false'    [519-529]         │
│   Race check — re-query pair existence                  [535-549]       │
│   Insert match row (status='pending')                  [567-596]        │
│   Claude phrasing call (4s timeout)                    [212-259]        │
│   Publish to BOTH user:{userId} channels               [617-625]        │
│     event: 'match.created' (or 'curiosity.match')                       │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ app/(app)/match.tsx (the decision card)                                  │
│   loadMatch():                                                          │
│       - if status='declined' → home                  [152-156]          │
│       - if status='mutual' → meetup                  [186-189]          │
│       - if status = myPendingStatus → phase='waiting' [193-198]         │
│       - else → phase='deciding'                                         │
│   respond(true):                                                        │
│       - conditional UPDATE status='pending' → myPendingStatus  [252]    │
│         (myPendingStatus = 'pending_b' if iAmA else 'pending_a')        │
│       - if updated rows = 0: re-read; if other is at theirPendingStatus │
│         → UPDATE to 'mutual'                          [285-296]          │
│   Realtime subscription on matches:id=$id              [101-118]         │
│       - waits for OTHER party's accept → status='mutual' → meetup       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Where the flow can silently fail (with file:line):**

1. `intent.tsx:131` — `presence.enter().catch(() => {})` swallows all errors. Presence may never enter.
2. `searching.tsx:160` — `invoke('match-sessions').catch(() => {})` swallows matcher errors. UI shows "Listening…" indefinitely on 500.
3. `searching.tsx:177-181` — 15s curiosity timer is **one-shot per state transition**. If state stays `searching` for 30 min, only ONE probe fires.
4. `match-sessions/index.ts:560-564` — Claude phrasing error is swallowed (`continuing without sentence`). Match still created — fine.
5. `match-sessions/index.ts:617-625` — `publishToAbly()` failure is unhandled; thrown into outer try/catch and returns 500. But match row already inserted, so partner never gets notified yet partner sees DB match next focus.
6. **No subscription on home/profile/events/etc.** Only `match/searching.tsx` subscribes to `user:{userId}`. If the partner is anywhere else, the `match.created` Ably message is **lost** (Ably REST publish, no rewind enabled). The partner only re-discovers the match on next visit to home or searching.

---

## 2. Spec vs. Implementation Gaps

| # | Spec (matching_algorithm.md) | Implementation (match-sessions/index.ts) | Severity |
|---|---|---|---|
| 1 | §6 "match_score = best_signal.score" | `score = best.points + additionalBonus` where additionalBonus = min(signals.length-1, 3) [line 204-205] | **Critical** |
| 2 | §6.2 Pool rarity bonus: `K / sqrt(rarity_count)` | **Not implemented at all** | **Critical** |
| 3 | §6.3 Concreteness bonus: +2 for proper-noun fields | **Not implemented** | **Critical** |
| 4 | §6.4 Asymmetry bonus on numeric fields (times_visited, years_in_destination) | Only career_stage asymmetry exists [line 167-177] | High |
| 5 | §6.5 Intent_match_bonus: +2 when intent matches signal type | **Not implemented** | **Critical** |
| 6 | §3 Per-session intent options: "Same world / Different / Open" | Code uses old schema: `professional / social / open` [intent.tsx:15-19] | High |
| 7 | §5 `intentsCompatible` rule: "if either picked 'Same world,' both must have one same-world signal" | Implementation: `open` is wildcard, else strict equality [line 61-64] | High |
| 8 | §2 Pool: ±90 min window | ✓ Implemented (90 \* 60 \* 1000 ms) [line 338] | OK |
| 9 | §5 Terminal reachability: "Airports not in the map fall back to same-terminal only" | `if (!map) return true` — bypasses filter entirely [line 55] | High |
| 10 | §4 Triggered by Ably Reactor webhook on presence.enter | Triggered client-side via `supabase.functions.invoke('match-sessions')` [searching.tsx:160] | High |
| 11 | §7 Wait gating: "both users waited ≥ 90s" before curiosity card | Implementation: 15s, not 90s [line 307] | Medium |
| 12 | §7 "pool stable for >30s" gating | **Not implemented** | Medium |
| 13 | §11 Three integrations matter: Spotify, Twitter/X, Goodreads OR Letterboxd | Only `spotify_top_artists` referenced; column exists but never populated (no OAuth) | Critical |
| 14 | §11.4 Asymmetry fields: `times_visited_destination`, `years_in_destination_city` | Columns don't exist; matcher doesn't reference them | High |
| 15 | §13 Free-text `current_thinking` used at match time for phrasing | Column populated but **not passed to Claude prompt**; LLM only gets `bestSignalLabel + destination` [line 212-259] | High |
| 16 | §15 Match logging: `signal_breakdown` (JSON) + `pool_size_at_match` | ✓ Implemented [line 578-579] | OK |
| 17 | §1 "We're picking a story to tell, not maximizing total overlap" | Implementation actively rewards quantity (additionalBonus) | **Critical** |
| 18 | §6.1 Tier table: same_hometown = tier-1 (+5) | ✓ Implemented [line 137] | OK |
| 19 | §6.1 Tier table: same_destination_city = tier-2 (+3) | Implementation: tier-3 (+2) [line 150] — deliberate downgrade noted in comment | OK (intentional deviation) |
| 20 | §6.1 Tier table: same_base_city = tier-2 (+3) | Implementation: tier-3 (+2) [line 153] — same downgrade | OK (intentional deviation) |
| 21 | §6.1 same_career_stage spec'd as tier-3 (+2) | ✓ matches [line 159] | OK |
| 22 | §6.1 same_age_bracket = tier-4 (+1) | **Not implemented** | Medium |
| 23 | §11.3 LLM "If no good point of connection, return null" sanity check | **Not implemented**; LLM is forced to produce text or matcher continues without it | Medium |

---

## 3. Confirmed Bugs (verified by reading the code)

### Bug C-1 — Scoring formula is wrong; sums signals instead of taking the best [Critical]

**File:** `supabase/functions/match-sessions/index.ts:202-207`

```ts
const sorted = [...signals].sort((a, b) => a.tier - b.tier || b.points - a.points)
const best = sorted[0]
const additionalBonus = Math.min(signals.length - 1, 3)
const score = best.points + additionalBonus
```

The spec (§6.6) explicitly says: *"a candidate with one tier-1 signal beats a candidate with five tier-3 signals. We're picking a story to tell, not maximizing total overlap."* The implementation does the opposite — additional signals push score up by 1 each, capped at +3.

**Concrete failure case:** Candidate X has just one tier-1 signal `same_school` (5 pts) → score = 5. Candidate Y has five tier-3 signals (`same_destination`, `same_base_city`, `same_industry`, `same_career_stage`, `same_music_taste`, all 2 pts) → best = 2, additionalBonus = 3, score = 5. They tie, despite spec saying X should clearly win. Worse: change Y's signals to six and it would beat a one-signal tier-1 candidate (5+3=8 vs the cap).

The threshold check at line 519 (`HIGH_CONFIDENCE_THRESHOLD = 3`) is set assuming a single tier-3 signal alone is not enough. Combined with the additive bug, this means a single tier-3 signal alone scores 2 (no bonus, signals.length-1=0), which is **below threshold**. So the most realistic match for a typical user (only `same_destination` shared) gets silently dropped.

---

### Bug C-2 — Three core scoring components are missing entirely [Critical]

**File:** `supabase/functions/match-sessions/index.ts:114-208` (entire `scoreCandidate` function)

The spec defines five additive components per signal:
```
signal.score = specificity_tier
             + pool_rarity_bonus
             + concreteness_bonus
             + asymmetry_bonus
             + intent_match_bonus
```

The implementation only computes `specificity_tier` (as `signal.points`). It does not compute:
- **pool_rarity_bonus** (`K / sqrt(rarity_count)`) — no SQL aggregation, no caching
- **concreteness_bonus** (+2 for proper-noun fields like company/school/event_id/destination_city) — no field-type table, no addition
- **intent_match_bonus** (+2 when intent matches signal type per §6.5 table) — no intent-aware scoring
- **asymmetry_bonus** for numeric fields like `times_visited_destination`, `years_in_destination_city` — those columns don't exist and the matcher never references them

The only asymmetry-like signal that fires is `founder_asymmetry` / `career_asymmetry` (line 167-177), which is a hard-coded categorical comparison, not the numeric-field detection the spec describes.

---

### Bug C-3 — Matcher reads fields the new profile UI no longer writes [Critical]

**Files involved:** `match-sessions/index.ts:68-80` (UserProfile interface), `app/(app)/profile.tsx`, `supabase/migrations/20260517_profile_prompts.sql`

The matcher's scoring uses these columns: `industry`, `company`, `school`, `hometown`, `base_city`, `career_stage`, `travel_style`, `spotify_top_artists`.

Migration `20260517_profile_prompts.sql:2` comment says: *"company and industry remain in the DB for backwards compat but are removed from the UI."*

The new profile UI (`profile.tsx`) writes seven brand-new fields the matcher **ignores**:
- `currently_into`, `ask_me_about`, `next_on_list`, `know_a_lot_about`, `cities_know_well`, `moving_to_city`, `travel_motivations`

Net effect: the user thinks filling out the profile improves their matches; in reality, the new "Right Now" and "About Me" sections do nothing for the matcher.

---

### Bug C-4 — `spotify_top_artists` is referenced but never populated [Critical]

**Files:** `match-sessions/index.ts:79, 180-186`; `supabase/migrations/20260516_spotify.sql`; `app/(onboarding)/extras.tsx:149`

The migration adds `spotify_top_artists jsonb`. The matcher reads it. The UI shows Spotify as a "coming soon" enrichment row that only writes `spotify_interest = true`. No OAuth flow ships, so `spotify_top_artists` is `NULL` for every real user. The `same_music_taste` signal can therefore never fire in production.

---

### Bug C-5 — At airports outside REACHABILITY map, terminal filter is bypassed entirely [High]

**File:** `match-sessions/index.ts:52-59`

```ts
function terminalsReachable(airport: string, tA: string | null, tB: string | null): boolean {
  if (!tA || !tB) return true
  const map = REACHABILITY[airport.toUpperCase()]
  if (!map) return true   // ← BUG: spec says "fall back to same-terminal only"
  const normA = tA.toUpperCase().trim()
  const normB = tB.toUpperCase().trim()
  return (map[normA] ?? [normA]).includes(normB)
}
```

Spec §2: *"Airports not in the map fall back to 'same terminal only.'"* The current behavior is the opposite — at IAD, BWI, MIA, etc. (any airport not in the 10-airport map), the matcher pairs people across unreachable terminals.

The map currently covers: ATL, LAX, ORD, DFW, DEN, JFK, SFO, SEA, LAS, MCO. JFK's entry maps every terminal to a singleton (`'1': ['1']`), which correctly models the spec ("not connected airside") for JFK.

---

### Bug C-6 — Matcher fires only once at session creation; no presence-trigger, no periodic re-run [High]

**Files:** `intent.tsx:117, 136`; `searching.tsx:154-161, 175-183`

The matcher trigger sequence is:
1. `intent.tsx` writes session, calls `setPendingSession(sessionRow)`, navigates to searching.
2. `searching.tsx` calls `takePendingSession()` and invokes matcher.
3. 15 seconds later, ONE curiosity-mode probe fires (`useEffect` setTimeout, cleaned up on unmount/state change).

After that, the matcher never runs again for this user during this session. Consequences:
- If user A creates a session at T=0 and finds no candidates, then user B arrives at T=600s — only B's matcher will run. B will find A and create the match. So far so good.
- If user A creates a session, gets a curiosity probe at T=15s, no match, then user B arrives at T=600s — only B's matcher runs.
- If the user navigates away from searching (e.g. to events, profile) and comes back, the useFocusEffect re-runs but `takePendingSession()` returns null (already consumed), so the matcher does NOT re-fire.

Spec §4: *"Ably Reactor webhook fires on presence.enter → POST to Edge Function: generate-next-match"*. The implementation has presence.enter on the flight channel but no Reactor binding. The matcher is **client-invoked, not presence-triggered**.

---

### Bug C-7 — Realtime `match.created` is lost if the partner isn't on the searching screen [High]

**Files:** `searching.tsx:115-152` (only place that subscribes to `user:{userId}`); `match-sessions/index.ts:617-625` (publishes to both users)

`match-sessions` publishes `match.created` to both `user:{userId_a}` and `user:{userId_b}` channels via Ably REST. The client subscribes to its own `user:{userId}` channel only in `match/searching.tsx`. The home, profile, events, meetup, and post-meetup screens do **not** subscribe.

Default Ably channels have no rewind/history enabled (none requested in `ably-auth/index.ts`). If the partner is not actively on `match/searching.tsx` at the moment `publishToAbly` fires, they miss the event.

The partial mitigation: the home screen `index.tsx` re-queries `matches` on focus and surfaces a "MATCH PENDING" pill. So the partner *eventually* sees they have a match if they happen to land on home. But the immediacy promised by the Ably wiring only works for the user who triggered the match in the first place.

---

### Bug C-8 — Most-realistic users will not clear `HIGH_CONFIDENCE_THRESHOLD = 3` [High]

**File:** `match-sessions/index.ts:519` (threshold) + Bug C-1 + Bug C-3 stacked

The required profile fields are: `first_name`, `age`, `base_city`, `current_thinking`. Optional profile fields actually wired into the UI: `school`, `hometown`, `career_stage`, `travel_style`. Session fields: `connection_intent`, `travel_purpose`, `event_id` (event_id only fires if `purpose='conference'` AND the user types a name into the free-text field).

For two strangers in JFK both heading to LAX, with only the required fields filled, the only signals that can fire are:
- `same_destination` → tier 3, 2 pts
- `same_travel_purpose` → tier 4, 1 pt (only if both picked a purpose AND they match)

Best signal = 2 pts. With one additional signal, additionalBonus = 1, score = 3 → exactly threshold. With no second signal, score = 2 → below threshold → **no match surfaced**.

For two strangers heading to different destinations, the only signal at all is maybe `same_travel_purpose` (1 pt) or `same_base_city` (2 pts). Both cases produce no high-confidence match. The realistic positive-match rate is dominated by the same-flight crowd and conference attendees who manually typed the event name — i.e. the people the app least needs to facilitate the introduction for.

---

### Bug C-9 — `point_of_connection` Claude prompt has no access to `current_thinking` [High]

**File:** `match-sessions/index.ts:212-259`

The prompt only receives `bestSignalLabel` and `destination`. The free-text answers from both users (the "highest-information field per second of user time" per spec §11.3) are not used at all. This contradicts both §11.3 and §13 (which lists "Point-of-connection generation" as a use for the free-text answers).

---

### Bug C-10 — Intent scheme has totally diverged from spec [High]

**Files:** `intent.tsx:15-19`; `match-sessions/index.ts:61-64`; `matching_algorithm.md §3`

Spec defines per-session intent as: `Same world | Different | Open`. Implementation uses `professional | social | open`. The `intentsCompatible` function permits any pair where at least one is `open`; otherwise strict equality. The spec's required rule — "if either picked Same world, both must share at least one same-world signal" — is **not implemented**, so a "professional" + "professional" pair can be matched even if they share zero same-world signals (which the spec says should be filtered out at Stage 1).

---

### Bug C-11 — Curiosity probe waits 15s, not the spec's 90s [Medium]

**File:** `match-sessions/index.ts:307` and `searching.tsx:181`

```ts
const CURIOSITY_MIN_WAIT_MS = 15 * 1000
// and client-side:
setTimeout(..., 15_000)
```

Spec §7: *"both users have waited ≥ 90s AND pool stable for >30s"*. Implementation uses 15s for both endpoints. Pool-stability gating doesn't exist. Effect: curiosity matches surface quickly but may not feel like "we looked hard and didn't find anyone" — they feel like the default behavior.

---

### Bug C-12 — Event-mode reveal (§9 group surface "5 other people on your flight") is not implemented anywhere [Medium]

No code reads `event_id` to compute or surface group counts. The `events/` routes are placeholder pages that don't query the sessions table for same-event travelers. So even users who attach an event manually never get the "you're not alone going to this" moment the spec calls out as the most marketable feature.

---

### Bug C-13 — `pending_a` / `pending_b` naming is semantically inverted from intuition [Medium]

**File:** `match.tsx:248-249`

```ts
const myPendingStatus = match.iAmA ? 'pending_b' : 'pending_a'
const theirPendingStatus = match.iAmA ? 'pending_a' : 'pending_b'
```

The convention is "pending_X = X still needs to say yes." So after A accepts, status becomes `pending_b` (waiting on B). After B accepts from that state, status becomes `mutual`. This works correctly in the code, but the naming is the inverse of what most people expect ("pending_A = A accepted"), making the home-screen recovery logic in the old `index.tsx` and the searching gate hard to audit at a glance.

This is not a bug in behavior, but the comment in `match.tsx:299` (*"silent RLS/permission failure"*) suggests the team has hit confusion here before.

---

### Bug C-14 — Matcher silently relies on columns whose existence is not verified by any migration [Medium]

**File:** `match-sessions/index.ts:567-580` inserts into matches with these columns:
- `match_type`, `winning_signal_type`, `winning_signal_score`, `pool_size_at_match`, `signal_breakdown`, `origin_iata`

The migrations folder only contains the `origin_iata` ADD COLUMN (`20260514_match_scalability.sql:3`). The others are presumed to exist (likely added via Supabase dashboard). If any are missing in a fresh deploy, the INSERT throws with a vague error caught by the outer try/catch and returned as a generic 500. No CI check, no schema-as-code asserts this.

---

## 4. Suspected Bugs (structurally likely but require runtime verification)

### Bug S-1 — Realtime UPDATE subscription may be silently disabled [High likelihood]

**File:** `match.tsx:101-118`

```ts
supabase.channel(`match-status-${match.id}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, ...)
```

This requires Postgres Replication enabled on the `matches` table in the Supabase project settings. If it's not enabled (it's off by default in newer projects), the user who accepted first **never observes** the partner's accept and stays on the "waiting" screen forever. The home screen would eventually pick up the mutual status, but the in-screen real-time transition is silently broken.

There is no fallback polling.

### Bug S-2 — RLS policies probably block the conditional UPDATE in `match.tsx:252` for B-side users [High likelihood]

**File:** `match.tsx:252-274` + comment at line 299 (*"silent RLS/permission failure"*)

The existence of the inline-explained "RLS failure" comment suggests this has happened before. Without seeing the RLS policies, the typical bug pattern is: a SELECT policy that allows reading the match, but no UPDATE policy that scopes to participants — causing the update to succeed-with-zero-rows for one party. The fallback path (`re-read; status still pending → setRespondError`) means the user sees "Could not accept" indefinitely on every accept attempt.

### Bug S-3 — Timezone mismatch between `intent.tsx` writing `expires_at` and matcher reading `departure_time` [Medium likelihood]

**File:** `intent.tsx:107`, `flight.tsx:16-38`

`flight.tsx::buildDepartureISO` constructs the ISO with `new Date(y, mo-1, d, h, m, 0)` — local-time semantics — then calls `.toISOString()` which converts to UTC. The matcher uses these values raw in window math (`new Date(myDepartureTime).getTime() ± 90 min`). This should work, but if a user typed a `time` of "14:30" intending UTC and the device is in PT, the stored value is 9 hours off and the ±90 min window won't overlap with another user typing "14:30" on an east-coast device. Symptom: cross-coast pairs never match even when departure times are the same.

### Bug S-4 — `myMatches` query loads ALL historical matches for this session [Medium likelihood]

**File:** `match-sessions/index.ts:401-404`

```ts
supabase.from('matches')
  .select('session_id_a, session_id_b')
  .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
```

No status filter. Declined matches stay in `excludedByMe`, which is correct — we don't want to re-show a declined candidate. But matches that hit `expired` or any other status also exclude. If there are old matches from a prior debug session or hot-reload artifacts, a user might be pre-excluded from valid candidates and not realize it.

### Bug S-5 — Concurrent invocations from same user during reload [Low likelihood]

**File:** `searching.tsx:154-161`

If `useEffect` re-runs (hot reload, React strict mode double-invoke in dev), `takePendingSession` will return null on the second pass — safe. But if `match-sessions` is somehow invoked twice in quick succession before `pendingMatches` reflects the first INSERT, two race-checks both pass and two matches insert. The unique pair index (migration `20260514_match_scalability.sql:14-15`) catches this with a `23505`. Handled at `match-sessions/index.ts:587-595`. Good.

---

## 5. Data Availability Audit

What columns actually populate vs. what the matcher needs:

| Column | Required at signup | In current UI | Realistically populated | Used by matcher | Tier the spec assigns |
|---|---|---|---|---|---|
| `users.first_name` | ✓ | onboarding/name | **Always** | reveal only | — |
| `users.age` | ✓ | onboarding/age | **Always** | — | tier-4 (age_bracket, unimplemented) |
| `users.base_city` | ✓ | onboarding/city | **Always** | `same_base_city` (tier 3) | tier-2 per spec |
| `users.current_thinking` | ✓ | onboarding/prompt | **Always** | **❌ ignored** | tier-1 entry (per §11.3) |
| `users.school` | ✗ | profile (optional) | sometimes | `same_school` (tier 1) | tier-1 |
| `users.hometown` | ✗ | profile (optional) | sometimes | `same_hometown` (tier 1) | tier-1 |
| `users.career_stage` | ✗ | profile chip | sometimes | `same_career_stage` (tier 3) + asymmetry | tier-3 |
| `users.travel_style` | ✗ | profile chip | sometimes | `same_travel_style` (tier 4) | tier-4 |
| `users.industry` | ✗ | **removed from UI** | **never** | `same_industry` (tier 3) | tier-3 |
| `users.company` | ✗ | **removed from UI** | **never** | `same_company` (tier 2) | tier-2 |
| `users.spotify_top_artists` | ✗ | OAuth not wired | **never** | `same_music_taste` (tier 3) | tier-1 (specific artist) |
| `users.currently_into` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec |
| `users.ask_me_about` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec |
| `users.next_on_list` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec |
| `users.know_a_lot_about` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec |
| `users.cities_know_well` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec |
| `users.moving_to_city` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec (relevant to asymmetry) |
| `users.travel_motivations` | ✗ | profile (new) | sometimes | **❌ not scored** | not in spec |
| `users.times_visited_destination` | — | doesn't exist | never | not referenced | tier-3 asymmetry per §11.4 |
| `users.years_in_destination_city` | — | doesn't exist | never | not referenced | tier-3 asymmetry per §11.4 |
| `sessions.destination_iata` | ✓ | from flight | **always** | `same_destination` (tier 3) | tier-2 (destination_city) |
| `sessions.travel_purpose` | ✗ | intent screen | usually (purpose required for prof/social intent) | `same_travel_purpose` (tier 4) | not explicitly in tier table |
| `sessions.event_id` | ✗ | intent screen, free text under `purpose=conference` | **rarely** | `same_event` (tier 1) | tier-1 |
| `sessions.connection_intent` | ✓ | intent screen | **always** | filter only | — |
| `sessions.terminal` | ✗ | flight screen | sometimes | reachability filter | — |
| `sessions.flight_id → flights.flight_iata` | ✓ | from flight | **always** | `same_flight` (tier 1, +5) | not in original spec (added in code) |

**Net effect for a fresh user with the required-only profile**: signals available to fire are exactly `same_destination`, `same_base_city`, `same_travel_purpose`, `same_flight`. Of these, only `same_flight` clears threshold alone. So in practice, the matcher works for "people on the same flight" and barely anything else — which is the silo the spec was explicitly designed to break out of.

---

## 6. The Likely Root Cause

In plain language:

**The matcher cannot surface matches for real users because the data it scores on is empty and the formula it uses is wrong.**

There are three compounding failures that together produce the silent-match symptom:

1. **The scoring formula doesn't match the spec.** The score is `best_signal.points + min(N-1, 3)` instead of just `best_signal.points`. The pool-rarity, concreteness, and intent-match bonuses don't exist. The threshold of 3 was set assuming the missing bonuses would push real scores well above it, but without them, the only way to clear 3 is to either fire a single tier-2-or-better signal OR fire two+ signals so the additive bonus kicks in.

2. **The profile UI was redesigned and the matcher wasn't updated.** Seven new prompt fields were added that the matcher ignores. Two old fields (`industry`, `company`) the matcher *does* score on were removed from the UI and are now always `NULL`. Spotify enrichment shows as "coming soon" so the music signal can't fire. The matcher's "shots on goal" for a typical user have been reduced from ~8 possible signals to ~3.

3. **The trigger model is fragile.** The matcher fires once at session creation and once at T+15s. After that, the user just sits on the searching screen indefinitely. If a partner shows up an hour later, only the partner's matcher will discover them — and even then, the original user only sees the match if they're still on `match/searching.tsx` when the Ably message lands (other screens don't subscribe, and Ably has no rewind).

**Combining these:** a typical user lands on searching, the matcher checks an empty pool, fires one curiosity probe, then goes silent. When a second user joins later, they get matched to the first user, but the first user's UI almost never sees the match in real-time. The first user discovers the match only when they leave searching, return to home, and see the "MATCH PENDING" pill.

**Where to look first if you're verifying this hypothesis with live data:**
- Run the seed script (`scripts/seed-users.ts`) — it uses the legacy `industry/company/school/career_stage` fields, so scores should clear threshold. If seeded runs produce matches but real users don't, that confirms data starvation (Bug C-3).
- Add a `console.log(`[match] poolSize=${poolSize}, threshold=${HIGH_CONFIDENCE_THRESHOLD}, best.score=${best.result.score}`)` to the function and inspect Supabase logs after a real-user attempt. If `poolSize > 0` and `best.score < 3`, that confirms the scoring/threshold problem.

---

## 7. Raw Code Excerpts

### 7.1 Scoring function (full)

`supabase/functions/match-sessions/index.ts:114-208`

```ts
function scoreCandidate(me: SessionRecord, them: SessionRecord, myFlightIata?: string): ScoreResult {
  const signals: Signal[] = []
  const myUser = me.users
  const theirUser = them.users

  // ── Tier 1 — 5 pts — high specificity proper-noun signals ─────────────────

  // Same physical flight: strongest possible proximity signal. Two users on the
  // exact same aircraft have guaranteed co-presence, so this is tier-1 even
  // though the algorithm generally treats flights as context. Without this
  // signal, two flights leaving at the same time are indistinguishable.
  const theirFlightRecord = Array.isArray(them.flights) ? them.flights[0] : them.flights
  const theirFlightIata = theirFlightRecord?.flight_iata
  if (myFlightIata && theirFlightIata && myFlightIata === theirFlightIata) {
    signals.push({ type: 'same_flight', tier: 1, points: 5, label: `both on flight ${myFlightIata}` })
  }

  if (me.event_id && them.event_id && norm(me.event_id) === norm(them.event_id)) {
    signals.push({ type: 'same_event', tier: 1, points: 5, label: `attending ${me.event_id}` })
  }
  if (norm(myUser.school) && norm(myUser.school) === norm(theirUser.school)) {
    signals.push({ type: 'same_school', tier: 1, points: 5, label: `went to ${myUser.school}` })
  }
  if (norm(myUser.hometown) && norm(myUser.hometown) === norm(theirUser.hometown)) {
    signals.push({ type: 'same_hometown', tier: 1, points: 5, label: `from ${myUser.hometown}` })
  }

  // ── Tier 2 — 3 pts — organization-level specificity ───────────────────────
  if (norm(myUser.company) && norm(myUser.company) === norm(theirUser.company)) {
    signals.push({ type: 'same_company', tier: 2, points: 3, label: `works at ${myUser.company}` })
  }

  // ── Tier 3 — 2 pts — meaningful overlap, not rare enough alone ────────────
  // NOTE: same_destination and same_base_city intentionally moved here from
  // tier 2. At busy hubs (JFK, LAX) these fire too frequently to warrant a
  // high-confidence match on their own — they need at least one other signal.
  if (me.destination_iata && them.destination_iata && me.destination_iata === them.destination_iata) {
    signals.push({ type: 'same_destination', tier: 3, points: 2, label: `both flying to ${me.destination_iata}` })
  }
  if (norm(myUser.base_city) && norm(myUser.base_city) === norm(theirUser.base_city)) {
    signals.push({ type: 'same_base_city', tier: 3, points: 2, label: `based in ${myUser.base_city}` })
  }
  if (norm(myUser.industry) && norm(myUser.industry) === norm(theirUser.industry)) {
    signals.push({ type: 'same_industry', tier: 3, points: 2, label: `both in ${myUser.industry}` })
  }
  if (myUser.career_stage && myUser.career_stage === theirUser.career_stage) {
    signals.push({ type: 'same_career_stage', tier: 3, points: 2, label: `both ${myUser.career_stage}` })
  }

  // Asymmetry signals — interesting cross-pollination.
  // Fix 4: career_asymmetry is skipped when founder_asymmetry fires — both
  // describe the same seniority gap, and stacking them inflates the score by 4pts
  // for a single underlying observation.
  const oneIsFounder = (myUser.career_stage === 'founder') !== (theirUser.career_stage === 'founder')
  if (oneIsFounder) {
    signals.push({ type: 'founder_asymmetry', tier: 3, points: 2, label: 'founder meets operator' })
  } else if (myUser.career_stage && theirUser.career_stage) {
    const seniority = ['student','early','mid','senior','founder','executive']
    const iMe = seniority.indexOf(myUser.career_stage)
    const iThem = seniority.indexOf(theirUser.career_stage)
    if (iMe !== -1 && iThem !== -1 && Math.abs(iMe - iThem) >= 2) {
      signals.push({ type: 'career_asymmetry', tier: 3, points: 2, label: 'different career levels' })
    }
  }

  // ── Tier 3 (continued) — music taste ─────────────────────────────────────
  if (myUser.spotify_top_artists && theirUser.spotify_top_artists) {
    const mySet = new Set<string>(myUser.spotify_top_artists)
    const shared = theirUser.spotify_top_artists.filter(a => mySet.has(a))
    if (shared.length >= 2) {
      signals.push({ type: 'same_music_taste', tier: 3, points: 2, label: `both listen to ${shared[0]}` })
    }
  }

  // ── Tier 4 — 1 pt — soft context signals ──────────────────────────────────
  if (me.travel_purpose && them.travel_purpose && me.travel_purpose === them.travel_purpose) {
    signals.push({ type: 'same_travel_purpose', tier: 4, points: 1, label: `both ${me.travel_purpose}` })
  }
  if (myUser.travel_style && myUser.travel_style === theirUser.travel_style) {
    signals.push({ type: 'same_travel_style', tier: 4, points: 1, label: `both ${myUser.travel_style} travelers` })
  }

  if (signals.length === 0) {
    return { score: 0, best_signal: null, breakdown: [] }
  }

  // Best single signal drives the headline; additional signals add depth bonus.
  // TODO: QUALITY_THRESHOLD may need tuning as signal corpus grows.
  const sorted = [...signals].sort((a, b) => a.tier - b.tier || b.points - a.points)
  const best = sorted[0]
  const additionalBonus = Math.min(signals.length - 1, 3)
  const score = best.points + additionalBonus

  return { score, best_signal: best, breakdown: signals }
}
```

### 7.2 Candidate SQL (Stage 1)

`supabase/functions/match-sessions/index.ts:346-368`

```ts
let candidateQuery = supabase
  .from('sessions')
  .select(`
    id, user_id, origin_iata, destination_iata, departure_time, created_at,
    terminal, connection_intent, travel_purpose, event_id,
    flights!flight_id (flight_iata),
    users (
      id, first_name, current_thinking, industry, company,
      school, hometown, base_city, career_stage, travel_style, spotify_top_artists
    )
  `)
  .eq('origin_iata', originIata)
  .eq('status', 'active')
  .neq('user_id', userId)
  .neq('id', sessionId)
  .order('created_at', { ascending: false })
  .limit(200)

if (windowStart && windowEnd) {
  candidateQuery = candidateQuery
    .gte('departure_time', windowStart)
    .lte('departure_time', windowEnd)
}
```

Note: terminal reachability and intent compatibility are filtered in JS *after* this query (lines 376-379), not in SQL.

### 7.3 Threshold check + match creation

`supabase/functions/match-sessions/index.ts:517-596`

```ts
const best = scored[0]
// TODO: QUALITY_THRESHOLD may need tuning as real-world signal corpus grows
const HIGH_CONFIDENCE_THRESHOLD = 3

console.log(`[match] best candidate score=${best.result.score} threshold=${HIGH_CONFIDENCE_THRESHOLD} curiosity=${isCuriosityMode}`)

if (!isCuriosityMode && best.result.score < HIGH_CONFIDENCE_THRESHOLD) {
  console.log(`[match] score ${best.result.score} below threshold ${HIGH_CONFIDENCE_THRESHOLD} — no match`)
  return new Response(
    JSON.stringify({ matched: false, reason: 'score below threshold', score: best.result.score }),
    { status: 200 }
  )
}

// ── Race condition guard ──────────────────────────────────────────────────
const partner = best.session
const { data: existingPair } = await supabase
  .from('matches')
  .select('id')
  .or(
    `and(session_id_a.eq.${sessionId},session_id_b.eq.${partner.id}),` +
    `and(session_id_a.eq.${partner.id},session_id_b.eq.${sessionId})`
  )
  .maybeSingle()

if (existingPair) {
  return new Response(
    JSON.stringify({ matched: false, reason: 'match already created by concurrent invocation' }),
    { status: 200 }
  )
}

// ── Create match ─────────────────────────────────────────────────────────
const bestSignal = best.result.best_signal
const matchType = isCuriosityMode ? 'curiosity' : 'high_confidence'

let pointOfConnection: string | null = null
if (bestSignal && !isCuriosityMode) {
  try {
    pointOfConnection = await generatePointOfConnection(
      bestSignal.label,
      partner.destination_iata ?? null,
    )
  } catch (e) {
    console.error('Claude API failed, continuing without sentence:', e)
  }
}

const { data: matchRow, error: matchErr } = await supabase
  .from('matches')
  .insert({
    session_id_a: sessionId,
    session_id_b: partner.id,
    origin_iata: originIata,
    status: 'pending',
    match_type: matchType,
    point_of_connection: pointOfConnection,
    winning_signal_type: bestSignal?.type ?? null,
    winning_signal_score: best.result.score,
    pool_size_at_match: poolSize,
    signal_breakdown: best.result.breakdown,
  })
  .select('id')
  .single()
```

### 7.4 Terminal reachability

`supabase/functions/match-sessions/index.ts:52-59`

```ts
function terminalsReachable(airport: string, tA: string | null, tB: string | null): boolean {
  if (!tA || !tB) return true
  const map = REACHABILITY[airport.toUpperCase()]
  if (!map) return true   // ← bypass instead of fall-back to same-terminal
  const normA = tA.toUpperCase().trim()
  const normB = tB.toUpperCase().trim()
  return (map[normA] ?? [normA]).includes(normB)
}

function intentsCompatible(a: string, b: string): boolean {
  if (a === 'open' || b === 'open') return true
  return a === b
}
```

### 7.5 Ably client subscription (only place that listens)

`app/(app)/match/searching.tsx:112-170`

```ts
useEffect(() => {
  let cancelled = false

  async function subscribe() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || cancelled) return

    const ably = getAblyClient(session.user.id)
    const channel = ably.channels.get(userChannelName(session.user.id))
    channelRef.current = channel

    channel.subscribe('match.created', (msg) => {
      const { match_id } = msg.data as { match_id: string }
      console.log('[searching] match.created → match screen', match_id)
      router.push({ pathname: '/(app)/match', params: { match_id } })
    })

    channel.subscribe('curiosity.match', (msg) => {
      const data = msg.data as {
        match_id: string
        winning_signal: string | null
        flight_iata?: string
        origin_iata?: string
      }
      console.log('[searching] curiosity.match', data)
      if (declinedMatchIds.current.has(data.match_id)) return
      setCuriosity({
        match_id: data.match_id,
        winning_signal: data.winning_signal,
        flight_iata: data.flight_iata ?? '',
        origin_iata: data.origin_iata ?? '···',
      })
      setState('curiosity')
      haptics.standbyStamp()
    })

    channel.subscribe('pool.exhausted', () => {
      console.log('[searching] pool.exhausted')
      setState('exhausted')
      setCuriosity(null)
    })

    // Subscriptions are live — safe to fire matching now. takePendingSession
    // is set by intent.tsx after it creates the session row, so the matcher
    // call sees a guaranteed-active session.
    const pending = takePendingSession()
    if (pending) {
      setMatcherBody(pending)
      supabase.functions.invoke('match-sessions', { body: pending }).catch(() => {})
    }
  }

  subscribe()
  return () => {
    cancelled = true
    channelRef.current?.unsubscribe()
    channelRef.current = null
  }
}, [])
```

### 7.6 Ably server-side publish (both users)

`supabase/functions/match-sessions/index.ts:617-625`

```ts
await Promise.all([
  publishToAbly(userId, eventName, payload),
  // Fix 6: send initiator's real flight_iata to partner so their manifest board
  // stranger row shows a flight number instead of a blank string.
  publishToAbly(partner.user_id, eventName, {
    ...payload,
    ...(isCuriosityMode ? { origin_iata: originIata, flight_iata: myFlightIata } : {}),
  }),
])
```

### 7.7 Mutual-match transition (client-side)

`app/(app)/match.tsx:248-296`

```ts
const myPendingStatus = match.iAmA ? 'pending_b' : 'pending_a'
const theirPendingStatus = match.iAmA ? 'pending_a' : 'pending_b'

// Conditional update: only succeeds if status is still 'pending'.
const { data: updated, error: updateErr } = await supabase
  .from('matches')
  .update({ status: myPendingStatus })
  .eq('id', match.id)
  .eq('status', 'pending')
  .select('id')

if (updateErr) {
  console.error('[match] accept update error:', updateErr)
  setRespondError('Could not accept. Please try again.')
  setActing(false)
  return
}

if (updated && updated.length > 0) {
  // I was first to accept — wait for the other side.
  setActing(false)
  setPhase('waiting')
  return
}

// The status was no longer 'pending' when I tried. Read current state.
const { data: current } = await supabase
  .from('matches')
  .select('status')
  .eq('id', match.id)
  .single()

if (current?.status === theirPendingStatus) {
  // Other side already said yes — lock in as mutual.
  const { error: mutualErr } = await supabase
    .from('matches').update({ status: 'mutual' }).eq('id', match.id)
  if (mutualErr) {
    setRespondError('Could not confirm mutual match. Please try again.')
    setActing(false)
    return
  }
  haptics.standbyStamp()
  router.replace({ pathname: '/(app)/meetup', params: { match_id: match.id } })
}
```

### 7.8 Mutual-detection (waiting user's side)

`app/(app)/match.tsx:98-121`

```ts
useEffect(() => {
  if (phase !== 'waiting' || !match) return

  const channel = supabase
    .channel(`match-status-${match.id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
      (payload) => {
        const newStatus = (payload.new as { status: string }).status
        if (newStatus === 'mutual') {
          haptics.standbyStamp()
          router.replace({ pathname: '/(app)/meetup', params: { match_id: match.id } })
        } else if (newStatus === 'declined') {
          router.replace('/(app)/')
        }
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [phase, match?.id])
```

**Requires `postgres_changes` / Realtime to be enabled on the `matches` table in Supabase Project Settings. No polling fallback if it isn't.**

---

*End of report.*
