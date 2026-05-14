import { useEffect } from 'react'
import { View } from 'react-native'
import { Slot, useRouter } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

export default function RootLayout() {
  const router = useRouter()

  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
  })

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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Slot />
    </SafeAreaProvider>
  )
}
