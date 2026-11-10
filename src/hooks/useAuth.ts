import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { getSupabase, supabaseEnabled } from '../supabase'

/** undefined = en cours de chargement, null = déconnecté */
export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(supabaseEnabled ? undefined : null)
  useEffect(() => {
    if (!supabaseEnabled) return
    const sb = getSupabase()
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  return user
}
