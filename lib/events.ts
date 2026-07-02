import { supabase } from './supabase'

// Single source of truth for events, mirroring lib/session.ts. Events live in
// the `events` table and attach to a session as matching context
// (sessions.event_id).

export type Event = {
  id: string
  name: string
  city: string
  dates_label: string
  blurb: string | null
}

const EVENT_SELECT = 'id, name, city, dates_label, blurb'

export async function listEvents(query?: string): Promise<Event[]> {
  let q = supabase
    .from('events')
    .select(EVENT_SELECT)
    .order('starts_on', { ascending: true })
  const term = query?.trim()
  if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Event[]
}

export async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Event) ?? null
}
