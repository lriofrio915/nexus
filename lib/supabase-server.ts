import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function url() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured')
  return v
}

/** Request-scoped client that carries the visitor's auth cookies. */
export async function createSupabaseServerClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not configured')

  const cookieStore = await cookies()
  return createServerClient(url(), anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch (error) {
          // Called from a Server Component, where cookies are read-only.
          console.error('[Supabase] Cookie set error:', error)
        }
      },
    },
  })
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
