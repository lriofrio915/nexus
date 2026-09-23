/**
 * mirror-bridge-auth.ts — auth for the IBKR mirror bridge endpoint.
 *
 * The bridge is a Python service on the VPS that also holds live IBKR login
 * credentials (see ibkr-bridge/bridge, outside this repo). It must NOT also
 * hold the Supabase service-role key: that key can read/write the entire
 * database, while the bridge only ever needs "what's left to mirror" and
 * "mark this one done". MIRROR_BRIDGE_TOKEN is scoped to exactly that,
 * through /api/trading/mirror-queue — a narrower blast radius if the VPS is
 * ever compromised.
 *
 * Separate from trading-ingest.ts's NT_INGEST_TOKEN on purpose: that one lets
 * NT8 WRITE trading events; this one lets the bridge READ the mirror queue
 * and ACK entries. Different capability, different secret.
 */

export const MIRROR_BRIDGE_HEADER = 'x-mirror-bridge-token'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * True only when the request carries the configured bridge token. Fails
 * closed when MIRROR_BRIDGE_TOKEN is missing or too short, so a
 * half-configured deployment rejects the bridge instead of accepting
 * anything — same convention as authorizeIngest in trading-ingest.ts.
 */
export function authorizeMirrorBridge(headers: Headers): boolean {
  const expected = process.env.MIRROR_BRIDGE_TOKEN
  if (!expected || expected.length < 32) {
    console.error('[mirror-queue] MIRROR_BRIDGE_TOKEN missing or shorter than 32 characters')
    return false
  }
  const provided = headers.get(MIRROR_BRIDGE_HEADER)
  if (!provided) return false
  return timingSafeEqual(provided, expected)
}
