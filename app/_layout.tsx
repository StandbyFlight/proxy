import { useEffect, useRef, useState } from 'react'
import { Slot, useRouter } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const MIN_SPLASH_MS = 4900

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()
  const mountedAt = useRef(Date.now())

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

    const go = (path: string) => {
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAt.current))
      setTimeout(() => router.replace(path as any), wait)
    }

    if (!session) {
      go('/(auth)')
      return
    }

    async function checkProfile() {
      const { data } = await supabase
        .from('users')
        .select('first_name')
        .eq('id', session!.user.id)
        .single()

      go(!data?.first_name ? '/(app)/profile-setup' : '/(app)')
    }

    checkProfile()
  }, [session])

  return <Slot />  
}