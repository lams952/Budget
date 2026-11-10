import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { getSupabase, supabaseEnabled } from '../supabase'

/**
 * `user` : undefined = en cours de chargement, null = déconnecté.
 * `recovering` : l'utilisateur arrive d'un lien « mot de passe oublié » et doit en choisir un nouveau.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(supabaseEnabled ? undefined : null)
  const [recovering, setRecovering] = useState(false)
  useEffect(() => {
    if (!supabaseEnabled) return
    const sb = getSupabase()
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      setUser(session?.user ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return { user, recovering, endRecovery: () => setRecovering(false) }
}
