import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase access for the Nexus agent.
 *
 * Only the service-role client is used: the panel authenticates through
 * lib/auth.ts, not Supabase Auth, so there is no cookie-bound client here.
 */

function url() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured')
  return v
}

let adminClient: SupabaseClient | null = null

/**
 * Service-role client. Bypasses RLS — only ever use it in route handlers and
 * server actions, never in anything that reaches the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  adminClient = createClient(url(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}
