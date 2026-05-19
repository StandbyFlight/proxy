# STANDBY — Launch Plan

> The core problem this launch plan has to solve: STANDBY only works with density. At least 10–15 people need to be using the app in the same 90-minute departure window at the same airport for matching to feel reliable. Everything in this plan is designed to solve that problem as cheaply and quickly as possible.

---

## The Two-Phase Strategy

**Phase 1 — Beta:** Use events as a density hack. Conferences and hackathons concentrate the right kind of traveler (curious, open, going somewhere together) at the same airports at the same time. Get them using the app through targeted event channels. Validate the core loop and collect feedback.

**Phase 2 — Full Launch:** Use the beta data to raise marketing funding. Then launch city by city, airport by airport, unlocking each airport only once it has enough signups to support real density.

---

## Phase 1: Beta

### How it works
- App is live on the App Store but gated behind an **access code**.
- The code is distributed through the official channels of partner events — Discord servers, Slack workspaces, mailing lists, event apps.
- Anyone with the code can download and use the full app.

### Why a code, not TestFlight
TestFlight creates friction and signals "unfinished." An App Store launch with a code feels real — real reviews, real install flows — while still keeping reach controlled. The code is the velvet rope, not a warning label.

### Target beta events
These events are the right early environment: high density of curious, mobile travelers, already organized into online communities, and likely to share a tool that fits the moment.

| Event | Location | Date | Channel |
|---|---|---|---|
| AI Hackathon @ Berkeley | Berkeley, CA | June 20, 2026 | Event Discord |
| YC AI Startup School | San Francisco, CA | July 25, 2026 | YC community Slack / Discord |
| *(add as identified)* | | | |

### Beta goals
- Validate that the core match → meetup loop actually results in people meeting.
- Test event mode specifically — events are where density is guaranteed, so this is the best environment to confirm the snowball mechanic works.
- Collect qualitative feedback on friction points, copy, and the match card experience.
- Generate the first real `meetup_completed` events (the north star metric).

### What success looks like
No hard number at MVP, but the pitch to investors needs at least a handful of real, confirmed meetups with user quotes. Quality over quantity at this stage.

---

## Phase 2: Funding Bridge

The beta exists to answer one question for investors: *Will strangers actually meet through this?*

Once that question has a yes — documented, with real sessions and at least some confirmed meetups — the ask is: fund the marketing needed to solve the density problem at scale. That means paid distribution, airport-specific campaigns, and the infrastructure to run city launches.

**What to pitch:** Beta conversion rates, meetup completion rate, qualitative feedback, and the airport unlock mechanic as a defensible cold-start strategy.

**Target funding type:** TBD — angels, pre-seed, or YC itself given the event beta overlap.

---

## Phase 3: Full Launch

### The density problem
STANDBY's cold start problem is geographic and temporal: you don't just need users, you need users at the *same airport* in the *same 90-minute window*. A thousand signups spread across the country and six months of inactivity doesn't help anyone make a match.

The solution is to launch one airport at a time, and only unlock an airport once it has enough active signups to support real density.

### What counts as a valid signup
A user counts toward an airport's unlock threshold only if they have:
1. A completed STANDBY profile (name, age, base city, current thinking)
2. A home airport set
3. An answer to the onboarding question: **"How often do you fly?"** *(occasional / a few times a year / frequent / very frequent)*

The fly-frequency answer is collected during onboarding at full launch — not during beta. It is not a gate; anyone can complete the profile regardless of how they answer. It exists to weight the threshold math internally and to give the matching algorithm a lightweight signal.

> **Waitlist signups do not count.** A "notify me when [airport] launches" pre-signup is a valid marketing and demand signal, but it is not a STANDBY account. Only completed profiles count toward the unlock number.

### Airport unlock thresholds
Tiered by number of terminals and physical footprint, which is the best proxy for how dispersed users will actually be at the airport.

| Tier | Terminal count | Example airports | Unlock threshold |
|---|---|---|---|
| Small | 1–2 terminals | OAK, BNA, AUS, RDU, BDL | ~300 signups |
| Medium | 3–4 terminals | SFO, BOS, MIA, SEA, PHL | ~750 signups |
| Large | 5+ terminals | JFK, LAX, ORD, ATL, DFW | ~1,500 signups |

These numbers are a starting point. Tune after beta once there's real session data to calibrate against.

### Progress bar (public-facing)
Every airport's unlock progress is visible. Users can see something like:

> **RDU — 68% of the way to launch**
> *214 of 300 travelers signed up. Know someone flying out of RDU? Tell them.*

This turns the waitlist into a referral mechanic. People share it because they want their airport to unlock. The progress bar lives on a public landing page and optionally in-app for users whose home airport hasn't unlocked yet.

### Pre-launch waitlist
Before an airport unlocks, anyone can join a "notify me" list for that airport. This does not require a full profile and does not count toward the threshold. When the airport unlocks, waitlist users get an email or push prompting them to complete their profile.

The waitlist is a top-of-funnel tool, not a launch signal.

### Launch sequence (proposed)
1. Pick the 2–3 airports most likely to unlock first based on beta event geography (SFO, JFK likely candidates given the beta events).
2. Run airport-specific campaigns to drive signups to threshold.
3. Unlock airport → announce publicly → push to all users with that home airport.
4. Monitor density and meetup completion rate for 30–60 days before expanding.
5. Repeat.

---

## Open Questions

- [ ] Exact funding target and investor type for the Phase 2 bridge
- [ ] Whether the access code is event-specific (one code per event, for tracking) or a single global beta code
- [ ] Public landing page design and copywriting for the progress bar / waitlist flow
- [ ] How to handle users whose home airport is large but they frequently fly through a smaller hub — does their signup count at both?
- [ ] Threshold for "re-locking" an airport if signup activity drops significantly after launch
