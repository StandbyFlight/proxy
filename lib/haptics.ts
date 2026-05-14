import * as ExpoHaptics from 'expo-haptics'
import { Platform } from 'react-native'

const supported = Platform.OS === 'ios' || Platform.OS === 'android'
const noop = () => {}

function impact(style: ExpoHaptics.ImpactFeedbackStyle) {
  if (!supported) return
  ExpoHaptics.impactAsync(style).catch(noop)
}

function notification(type: ExpoHaptics.NotificationFeedbackType) {
  if (!supported) return
  ExpoHaptics.notificationAsync(type).catch(noop)
}

function sel() {
  if (!supported) return
  ExpoHaptics.selectionAsync().catch(noop)
}

// Shared debounced medium for multi-tile settle sequences.
// Each settling tile resets the timer; medium fires only after all tiles are done.
let settleTimer: ReturnType<typeof setTimeout> | null = null
function fireSettle() {
  if (!supported) return
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settleTimer = null
    impact(ExpoHaptics.ImpactFeedbackStyle.Medium)
  }, 180)
}
function cancelSettle() {
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
}

// Throttle for fast-typing input events
let lastTyping = 0
function typingThrottle() {
  const now = Date.now()
  if (now - lastTyping >= 60) { lastTyping = now; sel() }
}

// Global throttle for scramble-phase clicks — collapses simultaneous multi-cell
// ticks into a single felt impact at most once every 65 ms.
let lastScramble = 0
function scrambleTick() {
  if (!supported) return
  const now = Date.now()
  if (now - lastScramble >= 65) {
    lastScramble = now
    impact(ExpoHaptics.ImpactFeedbackStyle.Light)
  }
}

export const haptics = {
  /** Primary CTA button tap */
  buttonTap: () => impact(ExpoHaptics.ImpactFeedbackStyle.Medium),

  /** Subtle selection — list picks, secondary actions */
  selection: sel,

  /** User begins editing a text field (fire once per focus) */
  inputStart: sel,

  /** Input transitions invalid → valid */
  inputValid: () => impact(ExpoHaptics.ImpactFeedbackStyle.Medium),

  /** Single click during the fast random-scramble phase of a flip cell */
  scrambleTick,

  /** Tile starts its settle animation (animation phase 0%) */
  splitFlapFlipStart: () => impact(ExpoHaptics.ImpactFeedbackStyle.Medium),

  /** Tile passes visual midpoint (animation phase ~50%) */
  splitFlapFlipMid: () => impact(ExpoHaptics.ImpactFeedbackStyle.Light),

  /**
   * Tile completes settle (animation phase 100%).
   * Debounced — collapses rapid multi-tile settlements into one medium tap.
   */
  splitFlapFlipSettle: fireSettle,

  /** Full display board resolved — medium then success notification */
  splitFlapComplete() {
    cancelSettle()
    impact(ExpoHaptics.ImpactFeedbackStyle.Medium)
    setTimeout(
      () => notification(ExpoHaptics.NotificationFeedbackType.Success),
      180,
    )
  },

  /** "STANDBY" stamp — two heavy impacts for the airport-board brand payoff */
  standbyStamp() {
    cancelSettle()
    impact(ExpoHaptics.ImpactFeedbackStyle.Heavy)
    setTimeout(() => impact(ExpoHaptics.ImpactFeedbackStyle.Heavy), 110)
    setTimeout(() => notification(ExpoHaptics.NotificationFeedbackType.Success), 260)
  },

  /** Per-character selection throttled for fast typing */
  typingSelection: typingThrottle,

  /** Successful action (verify, accept, parse) */
  success: () => notification(ExpoHaptics.NotificationFeedbackType.Success),

  /** Error / invalid action */
  error: () => notification(ExpoHaptics.NotificationFeedbackType.Error),
}
