import { useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { Slot, useRouter } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(1)).current
  const [overlayVisible, setOverlayVisible] = useState(true)

  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
  })

  // Hide native splash immediately — JS overlay (opacity 1) covers it so the
  // native exit animation is invisible. We then fade the JS overlay separately.
  useEffect(() => { SplashScreen.hideAsync() }, [])

  useEffect(() => {
    if (!fontsLoaded) return
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setOverlayVisible(false))
  }, [fontsLoaded])

  useEffect(() => {
    let initialEventSeen = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!initialEventSeen) {
        initialEventSeen = true
        return
      }
      if (event === 'SIGNED_OUT') {
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
