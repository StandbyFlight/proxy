# STANDBY — Navigation Flow Specification

> This document defines every screen in the app, what triggers navigation to it, what triggers navigation away from it, and what state is required to render it. It is written for Claude Code to implement routing. Screen inventory alone is not sufficient — every transition must have an explicit trigger.

---

## Stack Architecture

```
Root
├── (auth)/          ← unauthenticated stack, no bottom nav
│   ├── splash
│   ├── checkin-phone
│   ├── checkin-otp
│   ├── onboarding-name
│   ├── onboarding-age
│   ├── onboarding-city
│   ├── onboarding-thinking
│   ├── quiz
│   ├── profile-preview
│   └── duty-free
│
└── (app)/           ← authenticated stack, bottom nav always visible
    ├── index              (Home)
    ├── session/
    │   ├── flight
    │   ├── location
    │   ├── intent
    │   ├── event
    │   └── availability
    ├── match/
    │   ├── searching
    │   ├── card
    │   ├── pending
    │   ├── mutual
    │   └── room
    ├── group/
    │   ├── forming
    │   ├── room
    │   └── mutual
    ├── meetup/
    │   ├── setup
    │   ├── active
    │   └── offer
    ├── post-meetup/
    │   ├── confirm
    │   └── complete
    ├── events/
    │   ├── index          (Event browser)
    │   └── [id]           (Event detail)
    └── profile/
        ├── index
        ├── integrations
        ├── history
        └── settings
```

---

## Bottom Nav

Visible on every screen inside `(app)/`. Five tabs:

| Tab | Route | Badge condition |
|---|---|---|
| Home | `(app)/index` | none |
| Session | `(app)/session/flight` | dot if no active session |
| Match | `(app)/match/searching` | number if pending match action |
| Events | `(app)/events/index` | none |
| Profile | `(app)/profile/index` | dot if profile < 80% complete |

**Rule:** tapping a tab always navigates to the root of that tab's stack, not the last visited screen within it — except Match, which deep-links to the current match state.

---

## Auth Stack `(auth)/`

### `splash`
- **Rendered when:** app cold-opens and auth state is unknown
- **On auth state resolved → user exists:** navigate to `(app)/index`, replace stack
- **On auth state resolved → no user:** animate to `checkin-phone`
- **No back gesture**

---

### `checkin-phone`
- **Rendered when:** no authenticated user
- **Required state:** none
- **Primary action:** user submits phone number → call `supabase.auth.signInWithOtp({ phone })` → navigate to `checkin-otp`
- **Error:** invalid phone format → inline error, stay on screen
- **No back gesture**

---

### `checkin-otp`
- **Rendered when:** OTP has been sent to phone
- **Required state:** `phone` in local state from previous screen
- **Primary action:** user submits 6-digit code → call `supabase.auth.verifyOtp()` →
  - **New user** (no `first_name` on user record): navigate to `onboarding-name`
  - **Returning user** (profile complete): navigate to `(app)/index`, replace stack
- **Secondary action:** "Resend code" → re-call signInWithOtp, reset timer
- **Back:** → `checkin-phone`
- **Error:** wrong code → inline error, allow retry (max 5 attempts then lock 10 min)

---

### `onboarding-name`
- **Rendered when:** new user, post-OTP
- **Primary action:** user types name into flip board → Continue → navigate to `onboarding-age`
- **Validation:** min 1 char, max 30 chars
- **No back gesture** (can't go back to OTP)

---

### `onboarding-age`
- **Primary action:** user enters age → Continue → navigate to `onboarding-city`
- **Validation:** integer 13–99
- **Back:** → `onboarding-name`

---

### `onboarding-city`
- **Primary action:** user selects base city from autocomplete → Continue → navigate to `onboarding-thinking`
- **Back:** → `onboarding-age`

---

### `onboarding-thinking`
- **Primary action:** user enters free text (min 20 chars) → Continue → navigate to `quiz`
- **Back:** → `onboarding-city`

---

### `quiz`
- **Rendered when:** profile basics complete, quiz not yet answered
- **Required state:** none beyond auth
- **Primary action:** user completes 5 branching questions → answers stored to `users.quiz_answers` (JSONB) → navigate to `profile-preview`
- **Back:** between quiz steps only — cannot back out of quiz entirely once started
- **No skip**

---

### `profile-preview`
- **Rendered when:** profile basics + quiz complete
- **Required state:** `first_name`, `age`, `base_city`, `quiz_answers`
- **Primary action:** cinematic manifest board reveals user row → Continue → navigate to `duty-free`
- **No back**

---

### `duty-free`
- **Rendered when:** post profile-preview
- **Primary action (any enrichment):** tap row → expand inline flow (email, school .edu verify, etc.) → `supabase.auth.updateUser()` → cell toggles to `✓`
- **Primary action (done):** "Take me home" → navigate to `(app)/index`, replace entire stack with authenticated stack
- **Back:** → `profile-preview`
- **Skip:** "Take me home" always visible — enrichment is never blocked

---

## App Stack `(app)/`

### `index` (Home)
- **Rendered when:** authenticated user lands
- **Required state:** valid session token
- **Displays:**
  - If no active session: CTA "Start a session" → navigate to `session/flight`
  - If active session, no match: session status pill → navigate to `match/searching` on tap
  - If active match: match room pill → navigate to `match/room` on tap
  - If active group: group pill → navigate to `group/room` on tap
- **Passive:** Ably presence listener runs in background — if new match pushed, badge increments on Match tab

---

## Session Setup Stack `session/`

All session screens share a progress bar (4 steps). Completing step 4 forks into solo or group track.

### `session/flight`
- **Rendered when:** user starts a new session (no active session exists)
- **Entry points:** Home CTA, Session tab tap
- **Primary action (scan):** open camera → decode PDF417 barcode → call `enrich-flight` edge function → on success navigate to `session/location`
- **Primary action (manual):** user types flight number → call `enrich-flight` → on success navigate to `session/location`
- **Error — flight not found:** inline error "Flight not found — try AA1234 format", stay on screen
- **Error — flight cancelled:** inline error with suggestion to re-enter, stay on screen
- **Back:** → `(app)/index`

---

### `session/location`
- **Required state:** `flight_id` from previous step
- **Primary action:** user selects terminal from dropdown + optionally selects lounge → stored to session local state → Continue → navigate to `session/intent`
- **Back:** → `session/flight`

---

### `session/intent`
- **Required state:** `flight_id`, `terminal`
- **Primary action:** user taps one intent (Social / Professional / Open) → optionally selects travel purpose sub-option → Continue → navigate to `session/event`
- **Back:** → `session/location`

---

### `session/event`
- **Required state:** `flight_id`, `terminal`, `intent`
- **Primary action (attach event):** user searches event name → selects from list → event stored to local state → Continue →
  - Call `create-session` edge function with `event_id` attached
  - Navigate to `group/forming`
- **Primary action (skip):** "No event" or Continue with no selection →
  - Call `create-session` edge function with no `event_id`
  - Navigate to `session/availability`
- **Back:** → `session/intent`

---

### `session/availability`
- **Required state:** active session created (solo track only)
- **Primary action:** "I'm open to meeting someone" → call Ably presence.enter with session payload → navigate to `match/searching`
- **Back:** → `session/event` (cancels session creation, soft delete)

---

## Solo Match Stack `match/`

### `match/searching`
- **Required state:** active session, Ably presence entered
- **Rendered when:** user is in pool, no match surfaced yet
- **Passive:** listens on Ably channel for `match.new` event → on receipt, navigate to `match/card`
- **No user-initiated action** (app does the work)
- **Edge case — pool empty:** show "No travelers yet — check back closer to departure" state, keep listening

---

### `match/card`
- **Required state:** `match_id`, `point_of_connection` from Ably event
- **Primary action (accept):** call `matches` update `status = pending_b` → navigate to `match/pending`
- **Primary action (decline):** call `matches` update `status = declined` → decrement `declines_remaining` on session →
  - If `declines_remaining > 0`: navigate back to `match/searching`
  - If `declines_remaining = 0`: navigate to `match/searching` with "session locked" state — no more matches this session
- **Back gesture disabled** — must accept or decline

---

### `match/pending`
- **Required state:** `match_id`, status = `pending_b`
- **Rendered when:** user A accepted, waiting for user B
- **Passive:** listens on `match:{match_id}` Ably channel →
  - On `status = mutual`: navigate to `match/mutual`
  - On `status = declined` (B declined): navigate to `match/searching` with "They passed — looking for someone else" toast
- **No user-initiated action**

---

### `match/mutual`
- **Required state:** `match_id`, status = `mutual`, `first_name` of other user now readable
- **Primary action:** Continue → navigate to `meetup/setup`
- **Displays:** other user's first name · full point of connection · suggested meetup location
- **No back**

---

### `match/room`
- **Alias:** deep-links here from Home pill and Match tab when match is active
- **Required state:** active `match_id` with status = `mutual`
- **Redirects to correct screen** based on match status:
  - `pending_a` or `pending_b` → `match/pending`
  - `mutual`, no meetup confirmed → `meetup/setup`
  - meetup confirmed → `meetup/active`

---

## Group Stack `group/`

### `group/forming`
- **Required state:** active session with `event_id`, group created or being created
- **Rendered when:** user attached an event and session was created
- **Passive:** listens on `group:{group_id}` Ably channel for member joins →
  - Updates live member count on screen
  - On `status = locked` (quorum met + lock time reached): navigate to `group/mutual`
- **Displays:** event name · airport · live member count (e.g. "3 of 8") · first names of members so far
- **Edge case — group hits 8:** screen shows "Group full" · user is already in it if they got one of 8 spots
- **Edge case — user is 9th+:** screen shows waitlist state · if waitlist hits 3, Ably event fires and new `group_id` is pushed → navigate replaces with new `group/forming`

---

### `group/mutual`
- **Required state:** `group_id`, status = `locked`, full member list readable
- **Primary action:** "I'll be there" → write `group_members.confirmed = true` → stay on screen, show confirmed count update
- **Displays:** locked member list (first names) · suggested meetup location · suggested time · confirmed count
- **On all members confirmed OR lock time reached:** navigate to `meetup/setup` (group variant)
- **No back**

---

### `group/room`
- **Alias:** deep-links here from Home pill and Match tab when group is active
- **Redirects** based on group status:
  - `forming` → `group/forming`
  - `locked` → `group/mutual`
  - meetup confirmed → `meetup/active`

---

## Meetup Stack `meetup/`

### `meetup/setup`
- **Required state:** mutual match or locked group
- **Renders two variants:**
  - **Solo:** time slot picker (2 options) · "what I'm wearing" text input · suggested location shown
  - **Group:** single suggested time · "what I'm wearing" text input · suggested location shown
- **Primary action:** confirm slot + wearing description → write to `matches` or `groups` → navigate to `meetup/active`
- **Passive for solo:** if other user picks a different slot, Ably event fires showing conflict → "They preferred [slot B] — switch?" prompt
- **No back**

---

### `meetup/active`
- **Required state:** meetup time + location confirmed
- **Displays:** countdown to meetup · partner user's "what I'm wearing" · map pin of suggested location · logistics chat thread
- **Primary action (chat):** send message → write to `messages` table → real-time via Ably `match:{match_id}` channel
- **Passive:** 30 min before meetup → push notification fires ("You're meeting [name] in 30 minutes")
- **Passive:** at meetup time + 30 min → navigate to `post-meetup/confirm` (push-triggered deep link)
- **Secondary action:** tap partner offer pill → navigate to `meetup/offer`

---

### `meetup/offer`
- **Required state:** active meetup
- **Displays:** partner venue name · discount details · unique code (QR or alphanumeric)
  - Solo: code = `match_id` last 8 chars
  - Group: code = `group_id` last 8 chars
- **Primary action:** "Mark as redeemed" → API call to mark coupon used → navigate back to `meetup/active`
- **Back:** → `meetup/active`

---

## Post-Meetup Stack `post-meetup/`

### `post-meetup/confirm`
- **Entry:** push notification deep link fires 30 min after meetup time
- **Required state:** meetup time passed, match or group status = `meetup_confirmed`
- **Primary action (Yes):** write `user_a_met_confirmed = true` (or group member equivalent) → navigate to `post-meetup/complete`
- **Primary action (No / Didn't work out):** write confirmation = false → navigate to `(app)/index` with session-ended state
- **No back**

---

### `post-meetup/complete`
- **Required state:** both users (solo) or majority (group) confirmed yes
- **Displays:** trust score increment animation · contact exchange opt-in (both must tap yes) · coupon verification unlock
- **Primary action (exchange contacts):** both opt in → reveal phone/email mutually
- **Primary action (done):** → navigate to `(app)/index`, session marked expired
- **Passive:** session auto-expires at flight departure regardless of this screen

---

## Events Stack `events/`

### `events/index`
- **Entry:** Events tab in bottom nav
- **Displays:** curated list of upcoming events pulled from `events` table · search bar
- **Primary action (tap event):** → navigate to `events/[id]`
- **Secondary action:** if user has active session with no event attached → "Attach to your session" CTA visible

---

### `events/[id]`
- **Required state:** valid `event_id`
- **Displays:** event name · dates · location · how many STANDBY users at this airport are going
- **Primary action (attach to session):** only visible if user has active session with no `event_id` → writes `event_id` to session → calls group formation logic → navigate to `group/forming`
- **Primary action (no active session):** "Start a session" → navigate to `session/flight` with event pre-filled in local state
- **Back:** → `events/index`

---

## Profile Stack `profile/`

### `profile/index`
- **Entry:** Profile tab in bottom nav
- **Primary action (edit field):** inline edit → `supabase.auth.updateUser()` or direct `users` table update
- **Secondary action:** tap "Integrations" → navigate to `profile/integrations`
- **Secondary action:** tap "Session history" → navigate to `profile/history`
- **Secondary action:** tap "Settings" → navigate to `profile/settings`

---

### `profile/integrations`
- **Displays:** list of connectable providers (school email, Spotify, LinkedIn, etc.)
- **Primary action (connect):** initiates OAuth or email flow per provider
- **Back:** → `profile/index`

---

### `profile/history`
- **Displays:** list of past sessions (airport · date · session type) — no names, no match details
- **No drill-down at MVP**
- **Back:** → `profile/index`

---

### `profile/settings`
- **Displays:** notification toggles · privacy controls · "Delete my account" destructive action
- **Primary action (delete account):** confirmation modal → `supabase.auth.admin.deleteUser()` → navigate to `(auth)/splash`, clear all local state
- **Back:** → `profile/index`

---

## Global Navigation Rules

1. **No screen inside `(auth)/` is reachable from `(app)/` and vice versa.** Auth state change replaces the entire stack.
2. **Back gestures are disabled** on: splash, checkin-phone, profile-preview, match/card, match/mutual, group/mutual, post-meetup/confirm.
3. **Deep link map** (for push notification routing):
   - `standby://match/{match_id}` → `match/room` (resolves to correct sub-screen)
   - `standby://group/{group_id}` → `group/room` (resolves to correct sub-screen)
   - `standby://meetup/confirm/{match_or_group_id}` → `post-meetup/confirm`
   - `standby://airport` → `(app)/index` with airport-detected prompt
4. **Session expiry:** when `sessions.expires_at` passes, Ably channel is left, match pill disappears from Home, Match tab clears. No redirect — user sees the change passively on next render.
5. **Offline handling:** all accept/decline/confirm actions optimistic via Zustand, queued and retried via TanStack Query on reconnect. Searching and forming screens show "Reconnecting…" banner if Ably drops.