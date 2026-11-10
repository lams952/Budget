import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './config'

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey)

let client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient {
  if (!supabaseEnabled) throw new Error('Supabase non configuré')
  client ??= createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}
