# STANDBY — Build Log · May 14, 2026

**Project:** STANDBY — a mobile app that connects travelers at airports through shared curiosity, not profiles.  
**Stack:** React Native (Expo SDK 54), Supabase (auth + Realtime), Ably (presence channels), TypeScript  
**Team:** 2 engineers

---

## What We're Building

STANDBY is an iOS app for airports. You check in with your flight, describe what's been on your mind lately, and the app quietly looks for someone worth talking to at your gate. No swiping, no profiles visible upfront — just one reason to sit down across from each other. Names are hidden until both people say yes.

The brand is built around the split-flap departure board: the aesthetic of liminality, of being between places. Everything in the UI — the typography, the interactions, the components — is an extension of that moment.

---

## Today's Work

### Session 1 · 11:34 AM — Typography
Swapped the loading screen font from Avenir Next Medium to **Andale Mono**, a system font available on iOS with no bundling overhead. The flip-board cells (`FlipCell.tsx`) use `Platform.select` to resolve the right font at runtime, falling back to the system monospace on Android.

---

### Session 2 · 1:14 PM — Git Conflict Resolution
Merged a diverged branch: one side had added new onboarding screens, the other had added camera-related packages (`expo-camera`, `expo-image-picker`) for boarding pass scanning. Resolved three-way conflicts across `app.json`, `package.json`, and `package-lock.json` manually — keeping both feature sets — and rebased cleanly onto origin.

---

### Session 3 · 2:00 PM – midnight — Core Product Engineering

This was the main build session. The focus was on two things: **brand cohesion** and **the full check-in flow**.

#### Brand system: three objects, three jobs

Early in the session we identified that the split-flap board alone wasn't enough to carry the whole UI. We needed secondary visual languages for different moments. We settled on a three-object hierarchy:

| Object | Moment | Where it lives |
|--------|--------|----------------|
| **Split-flap board** | Identity, waiting, discovery | Onboarding preview, waiting screen |
| **Boarding pass** | Your artifact, your commitment | Flight entry, profile, match confirmation |
| **Rubber stamp** | Approval, mutual yes | Match accepted, profile verified |

This gave every screen a clear visual register rather than defaulting to generic UI patterns.

---

#### Components built

**`BoardingPass.tsx`**  
A paper-feel card with a TWA-red top band, cream background (`#FAF8F3`), mono field labels, large IATA codes, hairline separators, a perforated dashed edge, and a faint barcode strip. Accepts a `stampSlot` prop for composing the rubber stamp on top. Missing fields render dim `──` placeholders. Used on the flight entry screen, profile screen, and the match waiting state.

**`StandbyStamp.tsx`**  
An animated rubber stamp that scales in from 2.2× to 1×, rotates to a slight angle, and fades in — all in 220ms with an out-cubic easing curve. Fires a haptic "thunk" on land. Props: `label`, `color`, `delayMs`, `angle`. Used to stamp "STANDBY" on a complete boarding pass and "PENDING" on the match waiting state.

**`ChurningStatusText.tsx`**  
A `scaleY` flip animation that re-flips the same text every 6 seconds in place — like a departure board updating a gate that hasn't changed. Used in the `STATUS · STANDBY` caption below the manifest board on the waiting screen.

---

#### Screens built / rebuilt

**Flight entry (`app/(app)/flight.tsx`)**  
Three phases: `landing` (blank pass + scan or fill-by-hand CTAs), `capturing` (camera view via `BoardingPassCapture`), and `edit` (live boarding pass that fills in as you type). The stamp appears on the pass the moment the minimum required fields are valid. Saves to Supabase `flights` table, then pushes to the intent screen with flight params.

**Waiting screen (`app/(app)/index.tsx`)**  
Rewrote to a proper product screen. Key elements:
- Live clock in the eyebrow, ticking every 30 seconds
- `ManifestBoard` in `static` mode (cells pre-settled, no re-animation on load)
- Session gate: if no active flight session exists, redirects to flight entry
- The user's initial rendered as an `InputFlipCell` (a single flip-board cell) — tapping it goes to profile/settings
- When a match arrives via Ably: a stranger row slides into the manifest board, a reason to meet appears in italic, and MEET THEM / KEEP LOOKING actions appear
- "You've met the gate" exhausted state when the match pool is empty

**Match screen (`app/(app)/match.tsx`)**  
Full two-sided accept state machine (`pending → pending_b/pending_a → mutual/declined`) with Supabase Realtime subscription. Three phases:
- **Deciding:** The point of connection flips in word-by-word on the board, with staggered cell-by-cell timing per line
- **Waiting:** A `BoardingPass` stamped PENDING — visible confirmation that you said yes, waiting for the other side
- **Mutual:** Routes to meetup screen

**Settings (`app/(app)/settings.tsx`)**  
Minimal screen: YOUR PASS → profile, SIGN OUT, DEV TOOLS. Replaced a generic gear icon with the user's initial rendered as an `InputFlipCell` — the most on-brand touch point for accessing settings.

**Prompt screen (`app/(onboarding)/prompt.tsx`)**  
Added cycling example placeholders that fade in and out every ~3 seconds while the field is empty and unfocused. Each example is a concrete, specific phrase ("the rise of independent bookstores") to set the right expectation for the free-response field. Uses `Animated.sequence` with a cleanup-safe cycling pattern.

---

#### Flow wired end-to-end

```
Onboarding → extras → flight entry → intent (connection type) → waiting screen
                                                                      ↓
                                                              match arrives (Ably)
                                                                      ↓
                                                              match screen → meetup
```

The session gate on the waiting screen ensures no one lands there without a live flight session. The manifest board now pulls `origin_iata` and `flight_iata` from the active session so the board reflects the user's real flight, not a placeholder.

---

## What's Left (Near-term)

- Restyle the intent screen (connection type picker) to match the new brand register  
- `meetup.tsx` — the "set a time and what I'm wearing" screen — needs the boarding pass treatment  
- Add the mutual-acceptance stamp animation as a beat before routing to meetup  
- Push notifications for match events when app is backgrounded  
- Profile fields (`company`, `school`, `career_stage`, `travel_style`) need to be confirmed in the Supabase schema

---

*Built with Claude Code (Anthropic) as a coding assistant throughout.*
