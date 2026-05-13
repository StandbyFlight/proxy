import { useEffect, useState } from 'react'
import { Stack, useRouter } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return

    if (!session) {
      setTimeout(() => router.replace('/(auth)'), 0)
      return
    }

    async function checkProfile() {
      const { data } = await supabase
        .from('users')
        .select('first_name')
        .eq('id', session!.user.id)
        .single()

      setTimeout(() => {
        router.replace(!data?.first_name ? '/(app)/profile-setup' : '/(app)')
      }, 0)
    }

    checkProfile()
  }, [session])

  return <Stack screenOptions={{ headerShown: false }} />
}