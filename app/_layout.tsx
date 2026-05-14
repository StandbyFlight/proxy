import { useEffect } from 'react'
import { Slot, useRouter } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const router = useRouter()

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
    </SafeAreaProvider>
  )
}
