/**
 * auth.ts — Single-user session for the private panel.
 *
 * Nexus has exactly one operator, so there is no user table and no identity
 * provider: a shared password grants a signed, expiring cookie. Supabase Auth
 * is deliberately not used here — that project's auth belongs to Liberty's
 * customers, and an admin login for Nexus does not belong in it.
 *
 * The cookie is `<expiresAtMs>.<hmac>`, signed with PANEL_SESSION_SECRET.
 * Nothing secret lives in the cookie: it carries only an expiry, and the HMAC
 * makes it unforgeable. Rotating the secret invalidates every session.
 *
 * Uses Web Crypto so the same code runs in the proxy (edge) and in route
 * handlers (node).
 */

export const SESSION_COOKIE = 'nexus_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  const s = process.env.PANEL_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('PANEL_SESSION_SECRET missing or shorter than 32 characters')
  }
  return s
}

async function hmac(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return base64url(new Uint8Array(sig))
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Comparison whose duration does not depend on where the strings differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Builds a signed session token valid for SESSION_MAX_AGE_SECONDS. */
export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(expiresAt)
  return `${payload}.${await hmac(payload, secret())}`
}

/** True only for a well-formed, correctly signed, unexpired token. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false

  const dot = token.indexOf('.')
  if (dot <= 0) return false

  const payload = token.slice(0, dot)
  const provided = token.slice(dot + 1)
  if (!/^\d+$/.test(payload)) return false

  let expected: string
  try {
    expected = await hmac(payload, secret())
  } catch {
    // Misconfigured secret — fail closed rather than granting access.
    return false
  }

  if (!timingSafeEqual(provided, expected)) return false
  return Number(payload) > Date.now()
}

/** Checks the submitted password against PANEL_PASSWORD. */
export function checkPassword(submitted: string): boolean {
  const expected = process.env.PANEL_PASSWORD
  if (!expected || expected.length < 12) {
    console.error('[auth] PANEL_PASSWORD missing or shorter than 12 characters')
    return false
  }
  return timingSafeEqual(submitted, expected)
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
}
