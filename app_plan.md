# Airport Connection App — Unified Build Plan

> A proximity-based connection app for solo travelers at airports. Not a dating app. Not a networking tool. Something quieter — two people who both said yes to something unexpected, sitting down across from each other before a flight.

> **The core question this app must answer:** *Will strangers actually meet through this?* Everything in this plan is designed to answer that as fast as possible at MVP scale, without over-engineering.

---

## Table of Contents
1. [Vision & Philosophy](#1-vision--philosophy)
2. [Core User Flow](#2-core-user-flow)
3. [MVP Features](#3-mvp-features)
4. [Matching Logic](#4-matching-logic)
5. [Profile & Auth](#5-profile--auth)
6. [Flight Verification](#6-flight-verification)
7. [Meet-Up Mechanic](#7-meet-up-mechanic)
8. [Post-Meetup Flow](#8-post-meetup-flow)
9. [Real-Time Layer (Ably)](#9-real-time-layer-ably)
10. [Background Location](#10-background-location)
11. [Design Direction](#11-design-direction)
12. [Tech Stack](#12-tech-stack)
13. [Data Models](#13-data-models)
14. [API Integrations](#14-api-integrations)
15. [Edge Functions](#15-edge-functions)
16. [Notifications](#16-notifications)
17. [Analytics](#17-analytics)
18. [Security & Privacy](#18-security--privacy)
19. [Error States](#19-error-states)
20. [What Not to Build Yet](#20-what-not-to-build-yet)
21. [Go-To-Market](#21-go-to-market)
22. [Open Questions & Future](#22-open-questions--future)

---

## 1. Vision & Philosophy

**The core insight:** Airports are **liminal**. They are transitional spaces — neither home nor destination — where people are temporarily unmoored from their routines, their roles, and the contexts that normally define them. A CEO and a college student are both, in this moment, just waiting for a flight. Status flattens. Everyone is **"available"** in a way they wouldn't be in their normal life — not because they're lonely, but because they're off-duty. The usual reasons people don't talk to strangers — they're in a hurry, they're at work, they have somewhere to be — temporarily don't apply.

That openness goes to waste. Airports concentrate enormous latent richness — people from every industry, every part of the country, every kind of life, all in one terminal with hours of idle time — and there's no infrastructure to act on it. Everyone has their headphones in. Nobody talks. The CEO scrolls through email she'll re-read in the air. The student rewatches a show on their laptop. They never know they were five gates apart.

**STANDBY is built on the premise that this is a missed moment.** Not because anyone is lonely. Because there is real value — practical, intellectual, human — in pausing to learn from a stranger when the conditions for it are this rare: shared time, shared place, shared in-betweenness, and a story you would otherwise never hear. The product is for travelers who already feel this and want a low-friction way to act on it.

**What this app is:**
- A tool for **spontaneous, mutual curiosity** between travelers — the app finds one good reason for two strangers to sit down across from each other, both opt in, they meet.
- **Proximity- and time-bound** — same airport, overlapping departure window, reachable terminal. Tied to the liminal moment itself, not to any persistent social graph. When the flight leaves, the moment closes.
- **Egalitarian by setting** — the gate is the great leveler. The app trusts that and does not surface job titles, follower counts, or trust scores to other users. Importance outside the airport does not exist inside it.
- **Story-first** — every traveler is carrying a story worth hearing briefly. The matching algorithm's only job is to find the single most tellable entry point ([§4.2](#42-optimization-target)).
- **Warm, human, anti-digital in feel** — the product exists to get people *off their phones*, briefly, to look at someone real.

**What this app is NOT:**
- **Not a dating app.** The design, language, and UX must make this unambiguous.
- **Not a networking tool.** It is not LinkedIn-with-flight-data. The premise is "what can I learn from this person," not "what can this person do for me."
- **Not a fix for loneliness.** STANDBY is for travelers who are *interested in other people*, not travelers who are sad about being alone. If positioning or copy ever drifts toward the latter, course-correct immediately.
- **Not a social network.** No feed, no followers, no persistent connection graph. The unit is the moment, not the relationship.

**The philosophy in one sentence:** *The airport is a room full of stories you would otherwise never hear. The app's job is to hand you one good reason to stop and listen.*

> **Operationally:** the app does the work — finds the shared signal, makes the introduction tellable, suggests where and when to meet — so the conversation does not have to start from scratch.

---

## 2. Core User Flow

The primary flow is a solo 1:1 match. Event mode is an additional path available when a user is traveling to a specific event.

```
Open app at airport
        ↓
Create / log into profile (phone OTP; Apple / Google deferred)
        ↓
Verify flight (boarding pass scan or manual flight number entry)
        ↓
Select connection intent:
  [ Professional ]  [ Social ]  [ Open to anything ]
        ↓
(If Professional or Social) → Select travel purpose:
  e.g. conference / work trip / solo travel / leisure / relocating
        ↓
(If conference or event selected) → Attach event to session?
  [ Find one person — solo match ]  [ Meet others going to this event — event mode ]
        ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLO MATCH (primary)         EVENT MODE (additional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signal availability          Enter event pool
        ↓                            ↓
App matches you         Two people matched → seed pair
with one person         30-min join window opens
        ↓                            ↓
Point of connection     Others in event mode can
revealed                join (see headcount + names,
        ↓               get location on commit)
Accept or decline                    ↓
(max 3 declines)        Chat: 1:1 until 3+ join,
        ↓               then group chat
Mutual confirmation              ↓
required                Seed pair sets meetup location
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ↓                            ↓
        ↓←———————————————————————————↓
        ↓
Meetup confirmed:
  - First name(s) revealed
  - Suggested meet-up spot (terminal landmark or café — never the gate)
  - "What I'm wearing" input
  - Temporary messaging thread (logistics fallback)
        ↓
They meet
        ↓
~30 min after meetup time:
  - Push to both / all: "Did you meet?"
  - If yes → trust score increments + optional contact exchange
  - If no → no penalty at MVP, logged
        ↓
After flight departure → connection expires
  - Records archived; messages purged
  - No persistent profile visible to others
```

---

## 3. MVP Features

### 3.1 Flight Verification
- Boarding pass scan (PDF417 / BCBP barcode) → extract flight number, origin, destination, date, name
- Fallback: manual flight number entry
- Query AeroDataBox for real-time gate, terminal, departure time
- Cross-check against OpenSky as a free secondary signal
- User confirms / corrects gate at match-accept step (human backup for gate changes)

### 3.2 Connection Intent + Travel Purpose
Three intent options on session start:
- **Professional** — career-adjacent connections (conference peers, same industry)
- **Social** — travel companions, shared interest conversations
- **Open to anything** — let the app decide

Followed by travel purpose:
- Conference / industry event
- Work trip (no event)
- Solo travel / leisure
- Relocating / moving to a city
- Other (free text)

> Edge case: if a user picks Social intent + Business trip purpose → deprioritize trip purpose in matching, weight personality / interest overlap instead.

### 3.3 Matching
- One match surfaced at a time (no swiping, no browsing, no list)
- Candidate pool is airport-native: same origin airport, departure within roughly ±90 min, and reachable terminal
- Same flight or same destination can be useful signals, but they are not required filters
- Up to 3 declines per airport session; after that, the user can't make a connection for that session
- App presents one curated **point of connection** — not a profile dump, just the strongest shared signal in natural language
- Mutual confirmation required before any identity is revealed
- See [Section 4](#4-matching-logic) for full detail

### 3.4 Meet-Up Mechanic
- On mutual match: suggested meet-up location (terminal café, lounge, landmark — never the gate)
- "What I'm wearing" — short description each user enters so they can find each other (e.g. "navy puffer, red backpack")
- Suggested meeting time slots (before boarding / after landing)
- Optional temporary messaging thread for logistics if they can't find each other
- Messaging dissolves after flight departure

### 3.5 Post-Meetup Flow
- 30 min after meetup time → push to both: "Did you meet [first name]?"
- Both answer independently: Yes / No / It didn't work out
- If both Yes → trust score on each user increments + offer to exchange contact info / save in-app
- If either No → no penalty at MVP, logged for analytics

### 3.6 Connection Expiry
- Session auto-expires at flight departure
- Match record archived (kept for analytics 90 days, then purged)
- Messages purged 30 days post-meetup
- No match history surfaced to other users; no persistent social graph

### 3.7 Event Mode

Events — conferences, hackathons, alumni gatherings — are a special case. When two travelers are both heading to YC Startup School, the app doesn't need to find a connection. The connection is already written. Event mode is built for this.

**The idea:** Instead of surfacing a curated point-of-connection phrase from a pool of signals, event mode uses the shared event itself as the reason to meet. Two people who opt in form a seed match, and others attending the same event can join the growing group within a 30-minute window. It starts as a 1:1 and snowballs.

**How it works:**

- During session setup, a user attending a conference or event can attach it to their session and opt into event mode. The UI makes clear upfront: you may end up in a group, and others can join after you.
- If no one else is in event mode for that event yet, the user waits in standby — same idle state as solo searching.
- When two people in event mode for the same event are waiting, they're matched as a **seed pair**, and a **30-minute join window** opens.
- Other users in event mode for the same event see a prompt: headcount and first names of people already gathered, but not the location yet. They choose to join or stay in the pool as a potential new seed pair.
- On joining: the newcomer receives the meetup location and enters the group.
- **Chat:** 1:1 between the seed pair until a third person joins, then expands to a group chat automatically.
- **Location:** set by the seed pair during meetup setup. Only they can update it. All members see location changes through a passive screen refresh — no push notification.
- **Window closes at 30 minutes** from the seed match confirmation. New arrivals after that point form a fresh seed pair rather than joining the existing group.

**Why 30 minutes:** long enough for people to get across a terminal; short enough to preserve urgency. The flight clock is always running.

**Open question:** When a user selects a conference as their travel purpose, should the app automatically route them into event mode, or prompt them to choose between finding one person (solo match) and gathering with the group (event mode)? The prompt framing needs refinement before launch.

**Future:** GPS-based arrival confirmation to unlock location editing for all members, not just the original seed pair.

---

## 4. Matching Logic

> See `matching_algorithm.md` for the buildable v0 spec. This section captures the product-level contract.

### 4.1 Pool Definition

The MVP pool is deliberately broader than "same flight" or "same destination."

Eligible candidates are:
- At the same origin airport
- Departing within roughly ±90 minutes
- In a reachable terminal, using a small hardcoded reachability map for major airports
- Intent-compatible for the current session
- Not already declined by this user in the current session

Same destination, same flight, or same event may become strong match signals, but they should not define the pool. The broader pool is essential: it turns airports from sparse flight-by-flight silos into living rooms of nearby people with overlapping time.

### 4.2 Optimization Target

The matcher optimizes for **tellability**, not raw similarity.

The app does not ask, "Who is mathematically most similar to this user?" It asks, "What is the strongest single reason we can give these two people to sit down across from each other?"

That means the match score is the best individual shared signal, not the sum of all overlap. One highly specific, explainable signal beats a pile of vague similarities.

### 4.3 Signal Types

| Signal | Source | Role |
|---|---|---|
| Same event / conference | User input + optional verification | Very strong tellable signal |
| Same school / hometown | Self-reported | Strong shared-background signal |
| Same industry / company / career stage | Self-reported or professional integration | Strong for "same world" sessions |
| Shared artists / books / films / follows | Spotify, Goodreads, Letterboxd, Twitter/X, self-reported | Strong for social sessions |
| Same base city | Profile | Useful concrete signal |
| Same destination city / country | Boarding pass or flight enrichment | Useful signal, not a filter |
| Similar travel style | Self-reported | Medium signal |
| Asymmetry signals | Self-reported numeric fields | Strong when the difference is the story |

### 4.4 Algorithm

Two stages:

1. **Hard filters** produce the eligible airport/time/terminal pool.
2. **Tellability scoring** enumerates the shared signals for each candidate and scores each signal by specificity, pool rarity, concreteness, asymmetry, and session intent fit.

For each candidate:

```
signal.score = specificity_tier
             + pool_rarity_bonus
             + concreteness_bonus
             + asymmetry_bonus
             + intent_match_bonus

candidate.best_signal = max(signals, key=score)
candidate.match_score = candidate.best_signal.score
```

Above the quality threshold, the user gets a high-confidence match. If no candidate clears the bar after the pool has stabilized, the user may get a visually distinct curiosity card. If the pool is still thin or changing, the app keeps looking and pings later.

### 4.5 Presentation

Whatever the algorithm, the surface contract is fixed: **one** curated point of connection in natural language. No profile reveal. One reason. The rest is up to them.

Examples of the desired output:
> *"You're both heading to Consensus in Austin"*
> *"You both work in early-stage venture"*
> *"You're both solo traveling Thailand next week"*
> *"You both follow the same three finance accounts"*

---

## 5. Profile & Auth

### 5.1 Auth Methods

**At MVP (as built):**
- **Phone OTP** (Supabase Auth → Twilio under the hood) — the only sign-in path. UI is a two-step `CHECK-IN · 01 / 02` (phone) → `CHECK-IN · 02 / 02` (code) flow with the digits entered into split-flap cells. `+1` is implicit; US-only.

**Deferred until App Store submission:**
- **Apple Sign In** (required for iOS App Store)
- **Google Sign In**
- Both will create / resume sessions via Supabase Auth (`signInWithIdToken`)

> Critical Apple note: Apple only returns name + email on the very first sign-in. Persist them immediately on first auth.

### 5.2 Profile Basics (all required at onboarding)
- **First name** only (last name never shown, even after match). Entered into a flip board that grows with the typed value.
- **Age** — two digit cells, range 13–99. Used as an age-stage signal in matching.
- **Base city** — flip board + autocomplete against a static directory of US metros in `lib/cities.ts`. The matcher derives a primary IATA airport from the city for the profile-preview row.
- **Current thinking** — free-text prompt ("What's been on your mind lately?") in `SIGNAL · 04 / 04`. Deliberately not a flip board; quiet handwritten feel. Min 20 chars.

### 5.3 Profile Enrichment (all optional)

Users can connect any combination of these to enrich matching quality. Nothing is required beyond the basics.

**Social / Interest signals:**
- **Spotify** — music taste as a soft interest signal
- **Goodreads** — reading interests, intellectual overlap
- **Letterboxd** — film taste
- **Beli** — restaurant / food interests (especially useful for suggesting meetup spots)
- **Twitter/X OAuth** — who they follow as a proxy for intellectual interests

**Professional signals:**
- **LinkedIn OAuth** — returns name, headline, and email only (API is limited; use for trust / verification, not data richness)
- **Self-reported:** industry, company name, job title, career stage
- **Conference / event attending** — self-reported, with optional verification (confirmation email forward — flow TBD)

**Travel signals:**
- Destination (from boarding pass)
- Travel purpose (from session input)
- Travel frequency / style (self-reported: frequent traveler, first time, adventure, comfort, etc.)

> **Design note:** Profile enrichment should feel like building something interesting about yourself, not filling out a form. Frame each connection as "this helps us find you someone worth talking to."

**As built (MVP):**
- Enrichment is presented on a `DUTY FREE · OPTIONAL` screen after the profile preview. Each provider is a row with a small flip cell on the left that toggles `─` → `✓` with a haptic clack.
- **Email** is the only enrichment wired to a real flow at MVP: tapping the row expands an inline input, submission triggers `supabase.auth.updateUser({ email })` which sends a magic link, and the email is mirrored onto `users` with `email_verified=false` until the link is clicked.
- All other rows (Spotify, Goodreads, Letterboxd, Beli) render as honest "coming soon" placeholders — the cell animates on tap but the OAuth flow is deferred.

### 5.4 Email Verification (Trust Layer, optional)
- User enters email → Supabase sends verification link → deep link back into app
- `email_verified = true` on user record
- `.edu` domain → surfaced as "Student verified" *post-match only*
- Non-consumer domain (not gmail / yahoo / hotmail) → surfaced as "Work email verified" *post-match only*

---

## 6. Flight Verification

### 6.1 Boarding Pass Scan (Phase 2)
- PDF417 barcode format (IATA BCBP standard)
- Tech: `expo-camera` + barcode scanner library (e.g. `react-native-vision-camera` w/ PDF417)
- Decode → parse fixed-width BCBP fields:
  ```
  raw = "M1KUMAR/SUTHARSIKA  EABC123 JFKSFOAA 1234 133Y012A0025 100"
  name          = raw[2:21].trim()      // "KUMAR/SUTHARSIKA"
  pnr           = raw[23:29].trim()     // "ABC123"
  origin        = raw[30:33]            // "JFK"
  destination   = raw[33:36]            // "SFO"
  carrier       = raw[36:38]            // "AA"
  flight_number = raw[39:44].trim()     // "1234"
  julian_date   = raw[44:47]            // "133" = day of year
  seat          = raw[48:52].trim()     // "012A"
  ```
- Boarding pass does **not** contain gate info — gates are airport-assigned dynamically.
- **Do not OCR the visible text.** Font / print / layout differs per airline; the barcode is reliable, the visual text is not.

### 6.2 Manual Entry (MVP)
- User types flight number (e.g. AA1234, UA 456, DL 89)
- Normalize: strip spaces, uppercase
- Same enrichment path

### 6.3 Enrichment via AeroDataBox
- Call `/flights/number/{flightNumber}/{date}` on AeroDataBox
- Cache result in `flights` table — never call per-user
- Re-query at match-accept time to get latest gate
- User confirms / corrects gate manually as human backup

### 6.4 Cross-Reference via OpenSky
- Use OpenSky `/states/all?icao24={icao24}` to verify the flight is actually airborne when departure time approaches
- Free tier; do not call per-user

### 6.5 Status Polling (no native webhooks on AeroDataBox)
- Cron Edge Function every 5 min
- Re-query AeroDataBox for `flights WHERE status = 'active'`
- Diff old vs new gate / status
- If gate changed → push + SMS to affected users with active matches or confirmed meetups tied to that flight
- If cancelled → dissolve match queue, notify users
- Migrate to FlightAware AeroAPI webhooks at ~500+ DAU when polling latency / cost matter

---

## 7. Meet-Up Mechanic

Once mutual match is confirmed:

1. **Suggested meet-up location** — a specific named place in the terminal (not the gate). Terminal cafés, lounges, or landmarks. Source from terminal data; Beli integration could help long-term.

2. **"What I'm wearing"** — each user enters a short description (e.g. "navy blue puffer, red backpack"). Shown to matched user only. Deliberately human, low-tech.

3. **Suggested meeting time slots** — system pulls 2 slots from flight data:
   - **Slot 1: Before boarding** — `Near Gate {gate}`, time = `departure - 45 min`
   - **Slot 2: After landing** — `Baggage claim area`, time = `arrival + 20 min`
   - Each user picks independently. Same slot → confirmed. Different slots → "They preferred [slot B] — switch?" → user picks. If still mismatched at MVP, default to the earlier slot.

4. **Temporary messaging** — optional fallback thread. Exists only for logistics ("I'm near the Starbucks by gate B12"). Auto-deletes 30 days post-meetup. Not positioned as a chat feature — positioned as "in case you can't find each other."

5. **Contact exchange** — see [Section 8](#8-post-meetup-flow).

---

## 8. Post-Meetup Flow

30 min after the meetup time:

1. Push to both: **"Did you meet [first name]?"**
2. Both answer independently: **Yes / No / It didn't work out**
3. If **both Yes**:
   - Trust score on each user increments
   - Both offered: "Want to exchange contact info / save each other in-app?" — both must opt in for any exchange to happen. Default = no exchange.
4. If **either No**:
   - No penalty at MVP, just logged
   - Future: factor chronic no-shows into trust score

**Trust score** is an integer on the `users` table. Used internally as a tiebreaker / soft filter; not surfaced as a number to other users at MVP.

---

## 9. Real-Time Layer (Ably)

### 9.1 Channels

```
Per-airport pool channel:    airport:{origin_iata}:{departure_date_iso}:{hour_bucket}
                             e.g. airport:JFK:2025-05-12:14
                             Used for presence + new-match push trigger across the broadened pool

Per-match channel:           match:{match_id}
                             Used for messaging + state changes
                             (mutual confirm, meetup slot picks, etc.)

Per-event pool channel:      event:{event_id}:{origin_iata}:{departure_date_iso}
                             e.g. event:abc123:JFK:2025-07-25
                             Used for event mode: presence in event pool, seed match formation,
                             new member joins, location updates, 30-min window state
```

### 9.2 Presence

```
Solo match — user signals availability:
  → subscribe to airport:{origin_iata}:{date}:{hour_bucket}
  → enter presence with payload:
      { user_id, session_id, checked_in_at, departure_time, terminal, intent, travel_purpose }

  Ably Reactor webhook fires on presence.enter
    → POST to Edge Function: generate-next-match
    → Function reads all presence members + active sessions in pool
    → Runs scoring against current user
    → Writes match record (status = pending_a)
    → Pushes notification: "We found someone for you"

Event mode — user opts into event pool:
  → subscribe to event:{event_id}:{origin_iata}:{date}
  → enter presence with payload:
      { user_id, session_id, event_id, departure_time, terminal }

  On second user entering same event presence:
    → POST to Edge Function: create-group
    → Writes group record (status = forming, window_expires_at = now + 30 min)
    → Notifies both users: seed match formed, navigate to meetup setup
    → Window open event broadcast to remaining event pool members
```

### 9.3 Connection Handling (Poor Airport WiFi)
- TanStack Query: stale-while-revalidate for match state
- Zustand: optimistic state for accept / decline actions
- Ably: built-in reconnection with channel reattachment + resume tokens
- Offline-on-accept: queue action locally, retry on reconnect, show "Sending..." state

---

## 10. Background Location

### 10.1 Purpose
Detect when user arrives at an airport, prompt check-in without requiring them to manually open the app.

### 10.2 Implementation

```
expo-location (background mode) → defineTask(BACKGROUND_LOCATION_TASK)

On task fire:
→ Haversine check against local airport coordinate list (top 50 US airports)
→ If inside 1–2 km radius of any airport AND no active session:
    → Push: "Looks like you're at JFK — have a flight today?"
    → Deep link to add-flight screen
→ If inside airport AND active session:
    → No action (already checked in)
```

### 10.3 Airport List (stored locally, no API needed)

```typescript
const AIRPORTS = [
  { iata: 'JFK', name: 'JFK',     lat: 40.6413, lng:  -73.7781, radius_km: 2.0 },
  { iata: 'LAX', name: 'LAX',     lat: 33.9425, lng: -118.4081, radius_km: 2.0 },
  { iata: 'ORD', name: "O'Hare",  lat: 41.9742, lng:  -87.9073, radius_km: 2.0 },
  // ... top 50
]
```

Location data is **never stored server-side** — only used client-side for airport detection.

---

## 11. Design Direction

**Brand:** The app is **STANDBY**. The visual identity is built on the **Solari split-flap board** — the mechanical departure board found in airports and train stations. The board is more than a motif: it's the literal interaction language. Letters flip into place as the user types their name. The user's row appears on the manifest with `STATUS · STANDBY` as the moment that names the entire app. The split-flap evokes airports without feeling like a plane ticket or a tech product.

**Aesthetic:** Editorial minimalism with brutalist touches and a deliberate offline / IRL brand feel. Warm and human enough for social connections, credible and understated enough for business travelers. It should not look like a dating app. It should not look like LinkedIn.

**Type system:**
- **Fraunces** (serif) for headlines and editorial subheads. Italic for emotional / handwritten moments. Carries the "thoughtful person wrote this" voice the philosophy calls for. Loaded via `@expo-google-fonts/fraunces`.
- **Menlo** (system mono) for eyebrows, hints, status, and any technical labels. Read as the board's typography — uppercased with strong letter-spacing.
- Shared `type` tokens live in `lib/typography.ts` (`eyebrow`, `headline`, `subhead`, `hint`, `bodyItalic`).

**Color** (palette in `lib/theme.ts`):
- Page background: `#FFFFFF` — generous whitespace, never grey
- Board surface: `#0A0A0A` (near-black)
- Board text: `#F2F2F0` (warm off-white)
- Accent: `#E4002B` — TWA Hotel red. The only accent. Used sparingly for the primary CTA and for the `STATUS · STANDBY` caption.
- Subtle text: `#6B6B68`

**Interaction primitives** (in `components/`):
- `FlipCell` — single split-flap cell with the random-cycle-then-settle animation. Used for cinematic reveals (splash, manifest row, welcome cycle).
- `InputFlipCell` — driven by an external char prop, animates only when the value changes. Mounts at the dim placeholder so dynamically-added cells flip in instead of appearing instantly.
- `InputFlipBoard` — row of `InputFlipCell`s backed by a hidden TextInput. `minSlots` + `maxLength` API; the row **grows dynamically** as the user types past the minimum, wrapping if needed.
- `FlipBoard` — used for cinematic settle animations (splash STANDBY, welcome cycle lines, section headers).
- `ManifestBoard` — the user's three-column departure row (`FLIGHT · PASSENGER · ORIGIN`) used on the profile-preview screen, with a `STATUS · STANDBY` caption flipping in below in accent red.
- `EnrichmentRow` — single-cell toggle row used in the enrichment list with `expo-haptics` medium impact on tap.
- `OnboardingChrome` — the shared screen frame.

**Shared screen chrome:**
- Dash progress bar at the top
- Tiny mono eyebrow above the headline (e.g. `PASSENGER · 01 / 04`, `ORIGIN · 03 / 04`, `MANIFEST`, `CHECK-IN · 01 / 02`, `DUTY FREE · OPTIONAL`)
- Editorial serif headline (Fraunces SemiBold)
- Italic serif subhead (Fraunces Italic)
- `← Back` / `Continue →` footer. Back is optional (`hideBack`) and overridable (`onBack`); primary is accent-red.

**The onboarding flow as built:**
1. **Splash** — STANDBY flips in on a white field, holds, then either morphs to the section header (returning user) or fades out into the welcome cycle (signed-out user).
2. **Welcome cycle** — TBD.
3. **Check-in** — phone OTP, two steps with flip-cell digit entry.
4. **Onboarding inputs** — Passenger / Age / Origin / Signal (4 steps).
5. **Profile preview** — `MANIFEST` eyebrow; cinematic reveal of the user's row with the STANDBY caption fading in last.
6. **Duty Free (optional)** — enrichment rows; user can tap "Take me home" any time.
7. **Home** (`(app)/index.tsx`).

**Principles:**
- The flip board earns its weight through restraint. It carries moments of identity, declaration, and status. Quiet text moments (the `SIGNAL` prompt screen) deliberately don't use it — the contrast is what gives the board its weight elsewhere.
- Anti-digital feel — the product exists to get people off their phones.
- Minimal chrome, maximum whitespace.
- Typography-forward — let words do the work, not UI decoration.
- Copy should feel like a thoughtful person wrote it, not a startup.

**Sound / haptic:**
- Enrichment row taps fire `Haptics.ImpactFeedbackStyle.Medium`.
- Audible flap "clack": deferred. Would require audio assets and careful tuning; risk of feeling cheap if rushed.

**References:** Solari di Udine boards, TWA Hotel signage and the red TWA accent, Kinfolk magazine, Are.na, Notion's early brand, Robinhood's early minimalism.

---

## 12. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | React Native (Expo, managed workflow) | iOS-first; Android later |
| Auth | Supabase Auth | Apple / Google / Phone OTP |
| Database | Supabase (Postgres) | RLS enforced |
| Backend logic | Supabase Edge Functions (Deno) | All matching / enrichment / cron lives here |
| Real-time | Ably | Presence + per-match channels |
| Push notifications | Expo Push | All non-critical pushes |
| SMS (critical alerts only) | Twilio | Gate change / cancellation / delay > 30 min |
| Flight data (MVP) | AeroDataBox via RapidAPI | $5–30/mo paid tier |
| Flight data (cross-ref) | OpenSky Network | Free; verify departures |
| Flight data (scale) | FlightAware AeroAPI | Migrate at ~500+ DAU |
| Boarding pass scan | `expo-camera` + PDF417 lib | Phase 2 |
| Background location | `expo-location` | Airport geofence detection |
| Local state | Zustand | Optimistic UI |
| Server state | TanStack Query | Stale-while-revalidate |
| Analytics | PostHog | Funnel + event tracking |
| AI (icebreakers / point-of-connection phrasing) | TBD | Pricing eval before commit (Claude / GPT-4o-mini / Gemini) |

---

## 13. Data Models

```sql
-- Core identity
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name            TEXT NOT NULL,
  base_city             TEXT,
  age                   INTEGER,
  phone                 TEXT UNIQUE,
  email                 TEXT UNIQUE,
  email_verified        BOOLEAN DEFAULT false,
  apple_id              TEXT UNIQUE,
  google_id             TEXT UNIQUE,
  trust_score           INTEGER DEFAULT 0,            -- increments on confirmed meetups
  -- Self-reported professional
  industry              TEXT,
  company               TEXT,
  job_title             TEXT,
  career_stage          TEXT,
  -- Self-reported social / travel
  travel_style          TEXT,
  school                TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth integrations (one row per provider per user)
CREATE TABLE user_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,                -- spotify | goodreads | letterboxd | beli | twitter | linkedin
  external_id           TEXT,
  access_token_encrypted    TEXT,
  refresh_token_encrypted   TEXT,
  data                  JSONB,                        -- cached / derived signals (top artists, follows, etc.)
  connected_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Flight data (enriched once per (flight, date), shared across all users)
CREATE TABLE flights (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_iata           TEXT NOT NULL,                -- "AA1234"
  airline_name          TEXT,
  airline_iata          TEXT,
  origin_iata           TEXT,
  origin_name           TEXT,
  origin_city           TEXT,
  destination_iata      TEXT,
  destination_name      TEXT,
  destination_city      TEXT,
  departure_scheduled   TIMESTAMPTZ,
  departure_estimated   TIMESTAMPTZ,
  departure_actual      TIMESTAMPTZ,
  arrival_scheduled     TIMESTAMPTZ,
  arrival_estimated     TIMESTAMPTZ,
  departure_gate        TEXT,
  departure_terminal    TEXT,
  arrival_gate          TEXT,
  status                TEXT,                         -- scheduled | active | landed | cancelled | diverted
  icao24                TEXT,                         -- aircraft mode-S; for OpenSky cross-reference
  last_enriched_at      TIMESTAMPTZ,
  UNIQUE(flight_iata, (departure_scheduled::DATE))
);

-- One per airport visit
CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  flight_id             UUID REFERENCES flights(id),
  -- Denormalized snapshot at session start (for queries / channel routing)
  origin_iata           TEXT,
  destination_iata      TEXT,
  departure_time        TIMESTAMPTZ,
  terminal              TEXT,
  gate                  TEXT,                         -- user-confirmed at match-accept
  -- Session-specific intent
  connection_intent     TEXT NOT NULL,                -- professional | social | open
  travel_purpose        TEXT,                         -- conference | work_trip | solo_travel | leisure | relocating | other
  travel_purpose_detail TEXT,                         -- e.g. conference name
  event_id              UUID REFERENCES events(id),   -- set if user opted into event mode
  status                TEXT DEFAULT 'active',        -- active | matched | expired
  declines_remaining    INTEGER DEFAULT 3,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ                   -- = flight.departure_scheduled
);

-- One match between two sessions
CREATE TABLE matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id_a          UUID REFERENCES sessions(id),
  session_id_b          UUID REFERENCES sessions(id),
  point_of_connection   TEXT,                         -- the curated reason, natural language
  status                TEXT DEFAULT 'pending_a',     -- pending_a | pending_b | mutual | declined | expired
  -- Reveal / meetup data
  wearing_a             TEXT,
  wearing_b             TEXT,
  suggested_meetup_location  TEXT,
  meetup_time           TIMESTAMPTZ,
  meetup_confirmed_at   TIMESTAMPTZ,
  -- Post-meetup
  user_a_met_confirmed  BOOLEAN,                      -- null until prompt answered
  user_b_met_confirmed  BOOLEAN,
  contact_exchange_a    BOOLEAN DEFAULT false,
  contact_exchange_b    BOOLEAN DEFAULT false,
  -- Audit / replay
  candidate_score       FLOAT,                        -- score the matcher gave at creation; for replay
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ
);

-- Events (conferences, hackathons, etc.)
CREATE TABLE events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,                -- "YC AI Startup School"
  start_date            DATE,
  end_date              DATE,
  city                  TEXT,
  primary_airport_iata  TEXT,                         -- closest airport for matching purposes
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Event mode groups
CREATE TABLE groups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID REFERENCES events(id),
  origin_iata           TEXT,
  seed_session_id_a     UUID REFERENCES sessions(id), -- original pair
  seed_session_id_b     UUID REFERENCES sessions(id),
  meetup_location       TEXT,                         -- set by seed pair, updatable by them only
  status                TEXT DEFAULT 'forming',       -- forming | active | expired
  window_expires_at     TIMESTAMPTZ,                  -- seed match confirmed_at + 30 min
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ
);

-- Group members (seed pair + all who joined)
CREATE TABLE group_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID REFERENCES groups(id) ON DELETE CASCADE,
  session_id            UUID REFERENCES sessions(id),
  joined_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Ephemeral messaging (solo match and group)
CREATE TABLE messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              UUID REFERENCES matches(id) ON DELETE CASCADE,  -- set for solo match
  group_id              UUID REFERENCES groups(id) ON DELETE CASCADE,   -- set for group chat
  sender_id             UUID REFERENCES users(id),
  content               TEXT,
  sent_at               TIMESTAMPTZ DEFAULT NOW(),
  read_at               TIMESTAMPTZ,
  CHECK (
    (match_id IS NOT NULL AND group_id IS NULL) OR
    (match_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX ON sessions (origin_iata, departure_time, status);
CREATE INDEX ON sessions (user_id);
CREATE INDEX ON sessions (event_id);
CREATE INDEX ON matches (session_id_a);
CREATE INDEX ON matches (session_id_b);
CREATE INDEX ON flights (flight_iata, departure_scheduled);
CREATE INDEX ON groups (event_id, origin_iata, status);
CREATE INDEX ON group_members (group_id);
CREATE INDEX ON messages (match_id, sent_at);
CREATE INDEX ON messages (group_id, sent_at);
```

---

## 14. API Integrations

### 14.1 Flight Data
- **AeroDataBox** (primary) — scheduled + live flight data, gate, terminal, status
  - Endpoint: `/flights/number/{flightNumber}/{date}`
  - Free tier: ~200–600 calls/mo; paid: ~$10–30/mo for 3,000+
- **OpenSky Network** (cross-reference) — ADS-B verification of departures
  - Endpoints: `/flights/departure`, `/states/all`
  - 15-min delay; free; rate-limited
- **FlightAware AeroAPI** (scale) — webhook-driven gate / status updates
  - Migrate when polling cost or latency becomes the bottleneck

### 14.2 Optional Profile Enrichment (all user-initiated OAuth)
- **Spotify** — interest signal
- **Goodreads** — reading / intellectual signal
- **Letterboxd** — film taste signal
- **Twitter/X** — following graph as interest proxy
- **LinkedIn** — name + headline only (trust signal, not data source)
- **Beli** — food / restaurant interests (nice-to-have)

### 14.3 Boarding Pass Parsing
- PDF417 client-side decode (e.g. `react-native-vision-camera` + PDF417 plugin)
- Parse BCBP per IATA Resolution 792

### 14.4 Notifications & SMS
- **Expo Push** — all in-app push notifications
- **Twilio** — critical SMS only (see [Section 16](#16-notifications))

---

## 15. Edge Functions

| Function | Trigger | Does |
|---|---|---|
| `enrich-flight` | User submits flight number / boarding pass | Calls AeroDataBox, upserts `flights` row, returns enriched data |
| `create-session` | After flight verified + intent / purpose chosen | Creates session, joins Ably presence |
| `generate-next-match` | (a) Ably presence.enter (b) session created (c) user declines current match | Picks next-best candidate from pool, writes `matches` row with `status='pending_a'`, sends push |
| `detect-mutual-match` | `matches.status` updates to `pending_b` accepted | If mutual, set `status='mutual'`, reveal first names, compute meeting slots |
| `compute-meetup-slots` | Mutual match created | Pulls flight data, returns 2 suggested time slots |
| `flight-status-poll` | Cron, every 5 min | Re-fetches all `flights WHERE status='active'`; diffs gate / status; notifies affected users |
| `flight-status-webhook` | (Future) FlightAware webhook | Same as poll, real-time |
| `notify` | Called by other functions | Wraps Expo Push + Twilio SMS dispatch |
| `post-meetup-prompt` | Cron, fires 30 min after `matches.meetup_time` | Sends "Did you meet?" push to both users |
| `purge-expired` | Cron, hourly | Expires sessions past `expires_at`; purges old messages / matches per retention policy |

---

## 16. Notifications

### 16.1 Push (Expo Push)

| Event | Message |
|---|---|
| Match found | "We found someone near you at JFK" |
| Someone accepted you | "Someone nearby wants to meet" |
| Mutual match | "It's a match — pick a time to meet" |
| Meetup confirmed | "Meeting confirmed: 3:45 PM near Gate B22" |
| 30 min before meetup | "You're meeting Alex in 30 minutes" |
| Post-meetup prompt | "Did you meet Alex?" |
| Flight delayed | "AA1234 delayed 40 min — meetup window updated" |
| Gate change | "AA1234 gate changed to B42" |
| Flight cancelled | "AA1234 cancelled — your matches have been notified" |
| Airport detected (background) | "Looks like you're at JFK — have a flight today?" |

### 16.2 SMS (Twilio) — Critical Alerts Only

SMS is expensive and intrusive. Only used for:
- Flight delay > 30 min AND user has an active match
- Gate change AND user has a confirmed meetup
- Flight cancellation AND user has pending or mutual match

---

## 17. Analytics

### 17.1 North Star
`meetup_completed` — both users confirm they met. Everything else is a leading indicator.

### 17.2 Full Funnel

```
session_created
→ availability_signaled        (entered Ably presence)
→ match_surfaced               (matches row created)
→ match_accepted | match_declined
→ mutual_match_created
→ meetup_slots_shown
→ meetup_confirmed
→ meetup_completed             ← NORTH STAR
→ meetup_not_completed
```

### 17.3 Additional Events

```
flight_input_attempted
flight_input_success
flight_input_failed
boarding_pass_scanned          (Phase 2)
profile_completeness_reached   (thresholds: 40, 80, 100)
integration_connected          (which provider)
notification_opened            (which type)
message_sent                   (post-match)
contact_exchange_offered
contact_exchange_completed
```

---

## 18. Security & Privacy

### 18.1 Pre-Match Data Exposed
**Before mutual match, candidates see:**
- The single curated point-of-connection phrase
- Nothing else — no name, no photo, no role, no industry, no integrations, no phone, no email

**After mutual match:**
- First names revealed
- Suggested meetup location + time slots
- Optional "what I'm wearing" + ephemeral messaging unlocked

**After meetup confirmed:**
- Optional contact exchange (mutual opt-in only)

### 18.2 Supabase RLS Policies (sketch)

```sql
-- Users read only their own profile
CREATE POLICY "own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- Sessions: own only
CREATE POLICY "own session" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Matches: only visible to the two participants
CREATE POLICY "own matches" ON matches
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM sessions
      WHERE id IN (matches.session_id_a, matches.session_id_b)
    )
  );

-- Messages: only match participants
CREATE POLICY "match participants" ON messages
  FOR ALL USING (
    match_id IN (
      SELECT m.id FROM matches m
      JOIN sessions s ON s.id IN (m.session_id_a, m.session_id_b)
      WHERE s.user_id = auth.uid()
    )
  );

-- User integrations: own only
CREATE POLICY "own integrations" ON user_integrations
  FOR ALL USING (auth.uid() = user_id);
```

### 18.3 Data Retention
- `sessions`: soft-delete 7 days after flight departure
- `matches`: archived after expiry; analytics-readable for 90 days, then purged
- `messages`: purged 30 days after meetup
- Location data: never stored server-side
- OAuth tokens: encrypted at rest; revocable from profile

---

## 19. Error States

| Scenario | Handling |
|---|---|
| Flight number not found in API | "Flight not found — double-check the number (e.g. AA1234)" |
| Flight cancelled | Match dissolved, user notified, re-prompt to add new flight |
| 0 candidates in pool | "No travelers yet — check back closer to departure" |
| Pool exhausted before 3 declines | Session stays open; new candidate surfaces if someone joins |
| User hits 3 declines | Session locked: "You're done for this session. Catch us next trip." |
| Boarding pass scan fails | Fallback to manual flight number input |
| Network offline on accept | Optimistic UI, queued action, retry on reconnect |
| Meetup time already passed when scheduling | Show only future-valid slots; if none, skip directly to messaging |
| Duplicate active flight entry for a user | Upsert; do not create a second session |
| User declines `contact_exchange` | Default; do not surface partner's contact even if they opted in |

---

## 20. What Not to Build Yet

- ML / vector embeddings for matching (rule-based + light LLM on phrasing is enough)
- Calendar integration for meeting scheduling
- In-app voice / video calls
- Boarding pass OCR (barcode scan only — visual OCR is unreliable)
- Event API integrations (Eventbrite, Lu.ma)
- Web app (mobile-only at MVP)
- Public trust score display
- Kubernetes, microservices, GraphQL

Build these only after answering: **"Will strangers actually meet through this?"**

---

## 21. Go-To-Market

> Full detail in `launch_plan.md`. This section is a summary.

**Phase 1 — Beta**
App Store launch gated behind an access code. Code distributed through the official channels of target events (Discord, Slack, mailing lists). First targets: AI Hackathon @ Berkeley (June 20) and YC AI Startup School (July 25). Goal: validate the core match → meetup loop and generate real `meetup_completed` data for the investor pitch.

**Phase 2 — Funding Bridge**
Use beta data to raise marketing funding. The pitch is built around meetup completion rate and the airport unlock mechanic as a defensible cold-start strategy.

**Phase 3 — Full Launch**
Airport-by-airport unlock. Each airport unlocks once it hits a signup threshold (completed profiles with home airport set), tiered by terminal count. A public progress bar turns the waitlist into a referral mechanic. See `launch_plan.md` for threshold numbers and launch sequence.

**Future marketing**
- Venue and lounge partnerships (airport cafés, terminal lounges) as physical touchpoints
- Campus launches (UNC Chapel Hill and others) with partner venues
- SMS / Bandwidth identity verification for trust at scale

**Positioning:** Always lead with the human story, not the tech. The product is the excuse; the connection is the point.

---

## 22. Open Questions & Future

### Decided
- App name: **STANDBY**
- Visual design system: built — see [§11 Design Direction](#11-design-direction)

### Still To Decide
- [ ] Tune matching thresholds and weights — see [Section 4.4](#44-algorithm) and `matching_algorithm.md`
- [ ] AI provider for icebreaker / point-of-connection phrasing (Claude vs GPT-4o-mini vs Gemini — pricing eval)
- [ ] Conference verification flow (email forward? honor system for MVP?)
- [ ] Map / terminal data source for meet-up spot suggestions
- [ ] Whether "candidates exhausted" sessions can re-open if pool grows
- [ ] Audible "clack" sound for flip animations — defer until audio assets are tuned
- [ ] Boarding-pass styled sign-in (Apple / Google / Phone) — see deferred Track 3

### Future Features
- Venue partnerships — certified airport lounges / cafés trained to facilitate
- SMS / Bandwidth identity verification
- Expansion beyond airports: hackathons, coworking spaces, alumni events, cafés
- Public-facing trust signals (verified-student, verified-frequent-traveler badges)
- FlightAware AeroAPI migration for real-time webhook-driven gate updates
