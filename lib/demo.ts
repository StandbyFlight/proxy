import { Alert, Linking } from 'react-native'

// ── Standby Beta Demo — central control ───────────────────────────────────────
//
// One flag gates the ENTIRE demo experience. When EXPO_PUBLIC_DEMO_MODE is not
// exactly "true", every helper here is inert and the app behaves exactly as it
// does in production. Nothing in this file touches real matching, Supabase,
// Ably, sessions, or auth — it is purely additive UI/analytics glue for a
// close-friends UI beta.

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true'

/** True only when the demo build flag is on. Use to gate all demo behavior. */
export function isDemoMode(): boolean {
  return DEMO_MODE
}

/** The single approved banner line. Intentional, never "broken". */
export const DEMO_BANNER_COPY =
  'Demo Mode: This beta uses a simulated match so you can preview the Standby experience.'

// ── Feedback ──────────────────────────────────────────────────────────────────
// Prefer an env-provided URL (form, TestFlight feedback, Notion, etc.). If it's
// absent we show a friendly alert rather than failing — no feedback database.
const FEEDBACK_URL = process.env.EXPO_PUBLIC_FEEDBACK_URL

// ── Lightweight analytics ─────────────────────────────────────────────────────
// No analytics SDK exists in this project, so this is a safe console wrapper.
// It only ever logs when demo mode is on, and never throws.
export type DemoEvent =
  | 'demo_app_opened'
  | 'demo_flight_selected'
  | 'demo_search_started'
  | 'demo_match_shown'
  | 'demo_meetup_opened'
  | 'demo_feedback_clicked'

export function trackDemo(event: DemoEvent, props?: Record<string, unknown>): void {
  if (!DEMO_MODE) return
  try {
    console.log(`[demo] ${event}`, props ?? {})
  } catch {
    // Analytics must never break a screen.
  }
}

/**
 * Open the feedback channel. Uses EXPO_PUBLIC_FEEDBACK_URL when set, otherwise
 * shows a friendly fallback alert. Also emits the demo_feedback_clicked event,
 * so callers just need to invoke this once.
 */
export function openFeedback(): void {
  trackDemo('demo_feedback_clicked')
  if (FEEDBACK_URL) {
    Linking.openURL(FEEDBACK_URL).catch(() => {
      Alert.alert(
        'Send feedback',
        'Couldn’t open the feedback link. Please text or email your notes directly — thank you for testing Standby!',
      )
    })
    return
  }
  Alert.alert(
    'Send feedback',
    'Thanks for testing the Standby beta! Please text or email your notes, confusion, or bugs directly to the team.',
  )
}
