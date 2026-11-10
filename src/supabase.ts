import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './config'

// VITE_LOCAL_MODE=1 force le mode local (utile pour tester sans toucher aux données du cloud)
export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey) && import.meta.env.VITE_LOCAL_MODE !== '1'

let client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient {
  if (!supabaseEnabled) throw new Error('Supabase non configuré')
  client ??= createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}
