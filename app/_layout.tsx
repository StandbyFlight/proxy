import { useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { Slot, useRouter } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton'
import { supabase } from '../lib/supabase'
import { connectAbly, disconnectAbly } from '../lib/ably'
import { colors } from '../lib/theme'

// Fonts load here before the app renders (the overlay stays up until they're
// ready). Anton comes from @expo-google-fonts; Menlo is an iOS system font.
// Roc Grotesk is licensed — when the .otf files are added under assets/fonts,
// register them in this useFonts call (keys 'RocGrotesk-Regular' /
// 'RocGrotesk-Bold'); until then the body token falls back to the system sans.

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(1)).current
  const [overlayVisible, setOverlayVisible] = useState(true)

  const [fontsLoaded] = useFonts({
    Anton_400Regular,
  })

  // Hide native splash immediately — JS overlay (opacity 1) covers it so the
  // native exit animation is invisible. We then fade the JS overlay separately
  // once fonts are ready, so no text renders in a fallback font first.
  useEffect(() => { SplashScreen.hideAsync() }, [])

  useEffect(() => {
    if (!fontsLoaded) return
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setOverlayVisible(false))
  }, [fontsLoaded])

  // Ably follows the Supabase auth lifecycle: connect only once a valid
  // session exists (initial restore or fresh sign-in), disconnect cleanly on
  // sign-out. connectAbly() no-ops with a single warning when logged out, so
  // nothing loops against the ably-auth edge function unauthorized.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
        connectAbly().catch(() => {})
      }
      if (event === 'SIGNED_OUT') {
        disconnectAbly()
        router.replace('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Slot />
      {overlayVisible ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: colors.bg,
            opacity: fadeAnim,
          }}
        />
      ) : null}
    </SafeAreaProvider>
  )
}
