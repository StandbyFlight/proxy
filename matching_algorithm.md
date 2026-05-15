# Matching Algorithm — Design Doc

> Synthesizes the brainstorm into a buildable v0 spec. Replaces / expands Section 4 of `app_plan.md`.

---

## Table of Contents
1. [Optimization Target](#1-optimization-target)
2. [Pool Definition](#2-pool-definition)
3. [Per-Session Inputs](#3-per-session-inputs)
4. [Algorithm Overview](#4-algorithm-overview)
5. [Stage 1 — Hard Filters](#5-stage-1--hard-filters)
6. [Stage 2 — Tellability Scoring](#6-stage-2--tellability-scoring)
7. [Match Quality Threshold & Three Match States](#7-match-quality-threshold--three-match-states)
8. [The Curiosity Card](#8-the-curiosity-card)
9. [Event Mode (v0 minimal)](#9-event-mode-v0-minimal)
10. [LLM Role](#10-llm-role)
11. [Profile Data & Integrations](#11-profile-data--integrations)
12. [Sparse Profile Handling](#12-sparse-profile-handling)
13. [Reveal Sequence](#13-reveal-sequence)
14. [Post-Meetup Feedback](#14-post-meetup-feedback)
15. [Logging for Iteration](#15-logging-for-iteration)
16. [Performance Notes](#16-performance-notes)
17. [Open Questions](#17-open-questions)

---

## 1. Optimization Target

**The matcher does not optimize for similarity. It optimizes for *tellability* — the quality of the single shared reason we can hand the user.**

The product surface contract is fixed: one match, one natural-language point of connection, no profile dump. That means we're not ranking *people*, we're ranking *narratives about pairs of people*. A 0.92 cosine similarity is useless if we can't say something specific about it; "You both follow the same three finance accounts" is gold even if everything else differs.

This reframes the algorithm: for each candidate, find the most tellable shared signal, score the *signal*, take the candidate whose best signal scores highest. **Match score = best individual signal score, not sum of overlap.**

---

## 2. Pool Definition

A pool is the set of users a given user can be matched against right now.

**Membership rules:**
- Same origin airport
- Departure within ±90 min of mine
- Reachable terminals (see below)
- Intent-compatible (see Section 3)
- Haven't declined each other in this session
- *No destination filter* — meeting someone going somewhere else is fine if intent matches

**Terminal reachability (v0):** hardcoded JSON per airport for the top ~10 US airports. Each airport gets a map of `{terminal: [reachable_terminals]}` — walking + tram in <20 min. Airports not in the map fall back to "same terminal only."

```typescript
const REACHABILITY = {
  JFK: { T1: ['T1','T4','T7','T8'], T4: ['T1','T4','T7','T8'], T5: ['T5'], ... },
  LAX: { T1: ['T1','T2','T3','TBIT'], ... },
  // top 10 manually mapped
}
```

**Why not destination-based:** the airport + time-window definition gives us 10–50× the pool size of "same flight." That's the difference between empty pools being the common state vs. the rare state.

---

## 3. Per-Session Inputs

Two questions asked at session start that drive matching:

**Travel purpose** (existing):
- Conference / industry event
- Work trip (no event)
- Solo travel / leisure
- Relocating
- Other

**"What kind of conversation sounds good right now?"** (new — replaces older intent framing):
- Someone in my world — same field, same scene
- Someone completely different from me
- Someone to just talk to — I'll know it when I see it

This is asked **per session, not per profile.** People want different things on different days. Maps directly to algorithm behavior:

| Choice | Algorithm behavior |
|---|---|
| Same world | Weight similarity-type signals up; intent_match bonus on shared industry / school / event |
| Different | Weight asymmetry signals up; intent_match bonus on complementarity |
| Open | No intent bonus, let raw tellability decide; gets the curiosity card by default when matches are thin |

---

## 4. Algorithm Overview

Two stages. The first throws out everyone who can't be matched; the second scores who's left.

```
Stage 1: Hard filters → eligible candidates
Stage 2: Per-candidate tellability score → pick winner
        ├── If winner.score >= QUALITY_THRESHOLD  → high-confidence match
        ├── Elif waited > 2 min AND pool stable    → curiosity card
        └── Else                                   → wait, ping when better
```

Deterministic. Cheap. Debuggable. Logs every signal score so we can replay future algorithms against historical data.

---

## 5. Stage 1 — Hard Filters

Run as a SQL query against `sessions`. Eligible candidates have:

```sql
WHERE airport         = $my_airport
  AND status          = 'active'
  AND ABS(departure_time - $my_departure) <= INTERVAL '90 min'
  AND terminal        IN $reachable_terminals
  AND user_id         != $my_user_id
  AND user_id NOT IN  $my_declined_user_ids
  AND intent_compatible($my_intent, intent)
```

`intent_compatible` is permissive at MVP — most combinations are fine. The one rule: if either user picked "Same world," both must have at least one same-world signal (same industry / school / company / event), otherwise filter out. Don't promise sameness when there is none.

---

## 6. Stage 2 — Tellability Scoring

For each eligible candidate, enumerate every shared signal and score it:

```
signal.score = specificity_tier
             + pool_rarity_bonus
             + concreteness_bonus
             + asymmetry_bonus
             + intent_match_bonus

candidate.best_signal = max(signals, key=score)
candidate.match_score = candidate.best_signal.score
```

### 6.1 Specificity Tiers

The narrower the shared category, the higher the score. **This is a property of the signal type, hardcoded once in config — not computed at runtime.**

| Tier | Score | Examples |
|---|---|---|
| 1 — Very high | +5 | Same event, same school, same specific Spotify artist, same Goodreads / Letterboxd title, same hometown |
| 2 — High | +3 | Same company, same Twitter follow, same destination city, same base city |
| 3 — Medium | +2 | Same broad industry, same destination country, same career stage |
| 4 — Low | +1 | Same age bracket (±3 years), same travel style |
| 5 — Context only | +0 | Same airport, same flight — used as filter, not signal |

The tier is a judgment call made once and tunable. If launch data shows tier-1 same-school matches don't actually convert, bump the tier down. The config *is* the algorithm.

### 6.2 Pool Rarity Bonus

**Most important feature, free to compute.** Two people both going to Consensus is worth a lot more if 2 of 50 people in the pool are going than if 30 of 50 are.

```
rarity_count = SELECT count(*) FROM sessions WHERE airport = $1 AND <attribute matches>
bonus        = K / sqrt(rarity_count)    // K tuned so a 1-of-50 attribute scores ~+3
```

Cache per pool tick — don't recompute "how many people in this pool work in venture" 50 times.

### 6.3 Concreteness Bonus

Structural, not semantic. We don't read the value; we check which field it came from.

| Field type | Bonus |
|---|---|
| Proper-noun field (`company`, `school`, `event_id`, `spotify_artist`, `goodreads_book`, `letterboxd_film`, `destination_city`, `twitter_handle`) | +2 |
| Category field (`industry`, `career_stage`, `travel_style`, `age_bracket`) | 0 |

### 6.4 Asymmetry Bonus

Detect on numeric fields where the gap is the story. Realistic v0 candidates: `times_visited_destination`, `years_in_destination_city`. If `abs(user_a.value - user_b.value) > threshold`, register an `asymmetry_<field>` signal at tier 3 + intent bonus.

Won't fire on most matches because most users won't have these fields. That's fine — when it does fire, it's high quality ("she's lived in NYC 10 years, you're moving there next week").

### 6.5 Intent Match Bonus

| User's session intent | Signal type matches | Bonus |
|---|---|---|
| Same world | same_industry / same_school / same_company / same_event | +2 |
| Different | any asymmetry_* signal | +2 |
| Open | — | 0 |

### 6.6 Match Score = Best Signal, Not Sum

Critical: a candidate with one tier-1 signal beats a candidate with five tier-3 signals. We're picking a *story to tell*, not maximizing total overlap.

---

## 7. Match Quality Threshold & Three Match States

Define a `QUALITY_THRESHOLD` (initial value: best_signal.score must clear tier-2 base, i.e. ~3+). Below the threshold, we don't surface a high-confidence match.

**Three states the user can be in:**

| State | Trigger | Surface |
|---|---|---|
| High-confidence match | top candidate.match_score >= threshold | Standard match card with point-of-connection sentence |
| Curiosity match | **both** users have waited ≥ 90s AND pool stable for >30s AND no candidate cleared threshold | Visually distinct card (see Section 8) |
| Still searching | either user has waited < 90s OR pool still growing | Waiting screen: "Finding the person you would've walked past." |

**Trigger refinement:** The mutual wait is intentional. A curiosity match only makes sense if both people are genuinely in "I haven't found anyone" territory — not one person who's been waiting a while paired with someone who just arrived. Pool stability still matters too: don't fire 30 seconds before a strong candidate might join.

**Honest framing copy throughout:**
- While searching: *"Finding the person you would've walked past."*
- On curiosity card: *"We haven't found someone who fits your criteria yet — but we think you should meet this person anyway. You never know."*

The product promise is *worth it*, not *available*. Protecting that early is more important than juicing match counts.

---

## 8. The Curiosity Card

For when no high-confidence match exists and both users have been waiting ≥ 90 seconds. The framing is openness and serendipity — not "here's your best option," but "be open to something you didn't originally select."

**Trigger logic:**
- Both `session_a.created_at` and `session_b.created_at` are ≥ 90s ago
- Pool has been stable (no new entrants) for ≥ 30s
- No candidate has cleared `QUALITY_THRESHOLD`
- The pair hasn't already been shown to each other

**Surface contract:**
- Visually distinct from the standard match card — different framing so users register this is a different kind of suggestion
- One single interesting fact about the other person, not a connection sentence
- Reciprocal: each user shown a *different* fact about the other, weighted to feel like equal trades
- LLM picks the fact (this is one of the few LLM calls the matcher makes — see Section 10)
- Copy leans into serendipity, not apology: *"We haven't found someone who fits your criteria yet — but we think you should meet this person. You never know who you'll meet."*
- User can **Accept** or **Keep waiting** (decline stays in the pool — does not end the session)
- If **both** users accept → flows into the standard match screen (match.tsx), same as a high-confidence match

**What makes a fact good for the card:** narrative density — concrete > abstract, unusual > common, verb-heavy > noun-heavy. "She was a Peace Corps volunteer in Mongolia" beats "she's based in Denver." The LLM scores fact candidates on this and picks the highest.

**Profile-completeness nudge.** Users with thin profiles see curiosity cards more often. The card itself nudges enrichment: *"Connecting Spotify or telling us what you're thinking about helps us find someone you'd actually want to meet."*

---

## 9. Event Mode (v0 minimal)

Events are the marketing flow (Berkeley AI Hackathon, YC AI Startup School), so event-awareness ships in v0 — but minimally.

**What's in v0:**
- User can attach an event to their session: `sessions.event_id` (free text or autocomplete from a small curated list)
- If 3+ people in the pool are going to the same event → group visibility surface: *"5 other people on your flight to Austin are headed to Startup School"*
- 1:1 matching within the event cohort still flows through the normal matcher; event membership is just a tier-1 specificity signal
- Same-event matches typically win the matcher automatically because tier-1 + pool-rarity + concreteness all stack

**What's NOT in v0:**
- Group chat
- Group meetup logistics / roundtable formation
- Event verification (honor system at MVP)

The group view is a discovery surface, not a new product. *That* is the irreplaceable thing — opening the app at the airport for a hackathon and immediately seeing "you're not alone going to this." That feeling is the marketing.

---

## 10. LLM Role

**The matcher is rule-based. The LLM doesn't rank candidates.** But it earns its cost in three places:

1. **Point-of-connection phrasing** — once per shown match. Input: both users' relevant fields + the winning signal. Output: one warm, natural-language sentence.
2. **Curiosity card fact selection** — pick the highest narrative-density fact about each user.
3. **Quality sanity check (free piggyback)** — extend the phrasing prompt: *"If you don't see a good point of connection, return null."* If the LLM returns null, fall back to the curiosity card. This catches semantic misses the rule-based scorer made (e.g. "she backpacked Patagonia / he's planning a Patagonia trip" — complementarity that needs language understanding to detect).
4. **Personalized icebreakers at meetup** — see Section 13.

LLM cost is bounded by *shown* matches, not candidate evaluations. Cheap.

Provider TBD (Section 22 of the main plan). Pricing eval before commit.

---

## 11. Profile Data & Integrations

### 11.1 Required at signup (≤30 sec target)
- Auth (Apple / Google / Phone)
- First name (Apple/Google return this)
- Age
- Base city
- One free-text prompt: *"What's something you've been thinking about lately?"* / *"Currently nerding out about..."*

That's the entire required profile. Per-session questions (intent, travel purpose, event) come later.

### 11.2 v0 Integrations (post-signup, optional)
- **Spotify** — top artists (cap at top 50)
- **Twitter / X** — follows (cap at top 200)
- **Goodreads or Letterboxd** — pick one for v0; the other deferred

Apple/Google OAuth themselves give us almost nothing useful for matching — name, email, profile photo, locale. The valuable Google scopes (calendar, contacts, YouTube history) require Google's app verification process and are not viable for a small team.

### 11.3 The free-text one-liner — multi-purpose

The single highest-information field per second of user time. Used in three places:

| Use | When | How |
|---|---|---|
| Matching attribute fill-in | Pre-match | Lightweight signal; can match if both answers share concrete nouns / themes the LLM can extract |
| Point-of-connection generation | At match | LLM uses both users' answers as raw material when writing the connection sentence |
| Personalized icebreakers | At meetup | LLM writes 2–3 conversation starters drawing from both answers |

The user's exact text is *not* shown to candidates pre-match — only LLM-generated phrasing. The actual words become a delight-moment at meetup.

### 11.4 Self-reported optional fields (low priority, low friction)
- Industry / company / job title / career stage
- School / hometown
- Travel style
- `times_visited_destination` (for asymmetry)
- `years_in_destination_city` (for asymmetry)

Frame profile enrichment as "this helps us find you someone worth talking to," not as a form. Each field becomes more shots on goal in the matcher.

---

## 12. Sparse Profile Handling

**Most users will have most fields empty. This is fine.**

The rule-based scorer treats each signal independently and additive-only-when-present. Missing data = empty intersection = signal contributes nothing, but doesn't break anything. No imputation, no penalty, no "incomplete" flag.

**Implications:**
- A bare-minimum profile (required fields + boarding pass) still has 6–7 possible signals: same_base_city, same_age_bracket, same_destination_city, same_destination_country, same_travel_purpose, same_event, asymmetry on destination familiarity. Plenty for the matcher to find *something*.
- Richer profiles get *more shots on goal*, not different treatment.
- Users will encounter the curiosity card more often when their profile is thin. That's correct — and it gives them a true, concrete reason to enrich: *"People who connect Spotify get a high-confidence match within their first session ~4× more often."*

**Performance with sparsity:** non-issue. Pools of ~50 × ~15 field comparisons × ~5 cached SQL counts = sub-millisecond per match. The bottleneck of the system is AeroDataBox / Ably costs, not the matcher.

---

## 13. Reveal Sequence

The match isn't a single moment — it's a layered reveal that rewards showing up.

**At match acceptance (mutual confirm):**
- Point-of-connection sentence ("You're both heading to Consensus in Austin")
- First name
- Suggested meetup spot + time slots
- Teaser: *"Meet up to unlock more about each other"* — sets up the next layer

**At meetup confirmation (both pick a slot):**
- "What I'm wearing" descriptions
- Optional logistics-only messaging thread

**At meetup (post-arrival prompt or manual reveal):**
- Both users tap to reveal: each other's free-text prompt answer
- LLM-generated personalized icebreakers (2–3 questions / observations drawing from both profiles)
- Optional: deeper integration data they connected (e.g. "you both have Big Thief in your top 5")

**Why this matters:** the matchmaking moment is fast and warm; the meetup moment is the one with the highest emotional payoff. Designing the reveal in layers gives both moments a payoff *and* gives users a reason to actually meet (not just match).

---

## 14. Post-Meetup Feedback

Two things, kept separate:

### 14.1 Safety flag (always present, not a rating)
- One tap, no required explanation
- Affects flagged user's ability to be matched again pending review
- Non-negotiable for any app that introduces strangers in person

### 14.2 Quality signal (binary, lightweight)
- Single question: *"Glad we introduced you?"* — Yes / Not really
- No follow-up form, no tags, no 1–5 rating
- Star ratings round people into shapes; what we'd get back would mostly track the other person's charisma, not match quality

### 14.3 The signals we actually trust (revealed preference, not self-report)
- **Did they exchange contact info?** — strongest signal
- **Time-to-decline on next match** — quick accept after a meetup is a good sign
- **Returning to the app on next trip** — retention is the real rating

Build the binary question; weight the behavioral signals higher in any future learning loop.

---

## 15. Logging for Iteration

Discipline starts day one. Every match attempt logs:

```
match_id
session_id_a, session_id_b
candidate_score (winning candidate's match_score)
winning_signal_type            ("same_spotify_artist" / "same_event" / etc.)
winning_signal_specificity_tier
winning_signal_pool_rarity_count
winning_signal_full_breakdown  (JSON of every component score)

signal_density_a               (count of non-null matchable fields user A had)
signal_density_b
pool_size_at_match
intent_a, intent_b

outcome events (separate table, joined later):
  - match_accepted_a / declined_a
  - match_accepted_b / declined_b
  - mutual_match_at
  - meetup_confirmed_at
  - meetup_completed (both yes)
  - contact_exchanged
```

This lets us answer the questions that matter:
- Which signal types actually predict meetup completion?
- Is acceptance rate low because the algorithm is bad, or because users have thin profiles?
- Should we tune the QUALITY_THRESHOLD up or down?
- When we eventually try LLM-as-matcher or embedding-based ranking, we can replay against the same historical data.

---

## 16. Performance Notes

- Pool size: realistically 5–50 at MVP, 500 worst case
- Per-candidate cost: ~15 field comparisons + ~5 cached SQL counts + max() — sub-millisecond
- Pool-rarity SQL: cache per pool tick (don't recompute per candidate)
- Integration data: cap at top-N (Spotify top 50, Twitter top 200) — beyond that, signal quality drops anyway and intersection cost grows
- Real bottlenecks are AeroDataBox API calls and Ably presence channels, not the matcher

---

## 17. Open Questions

- [ ] Final values for `QUALITY_THRESHOLD`, `K` in pool-rarity formula, asymmetry threshold per field — tune with launch data
- [ ] LLM provider for phrasing + curiosity-card fact selection (Claude / GPT-4o-mini / Gemini — pricing eval)
- [ ] Goodreads vs Letterboxd for v0 — pick one based on which OAuth is more straightforward
- [ ] Curiosity-card gating: should it be available to all intents or restricted to "open" / "different"?
- [ ] Event source for autocomplete — manual curated list at v0, or scrape Lu.ma / Eventbrite later?
- [ ] How "same world" intent should treat near-misses: someone in adjacent industry, someone at a feeder school. Tunable via specificity tier definitions.
- [ ] Should the free-text one-liner be re-asked per session or set once at profile? Probably once at profile, with optional update prompt before each session.

---

## TL;DR

Two-stage rule-based matcher. Stage 1 hard-filters by airport + time window + reachable terminal + intent compatibility. Stage 2 scores each shared signal on **specificity tier + pool rarity + concreteness + asymmetry + intent match**, picks the candidate whose *best individual signal* scores highest. Above threshold → high-confidence match. Below threshold + waited → curiosity card. Below threshold + still waiting → keep looking.

LLM is used only for phrasing the connection sentence, picking the curiosity-card fact, and writing meetup icebreakers. Not for ranking. Profile data is sparse by design — required fields + one free-text prompt, with Spotify / Twitter / (Goodreads or Letterboxd) as opt-in enrichment.

The whole thing exists to answer: *will strangers actually meet through this?*
