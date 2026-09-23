/**
 * GET/POST /api/trading/mirror-queue — the IBKR mirror bridge's only window
 * into Supabase.
 *
 * The bridge (Python, VPS, holds live IBKR login credentials) must not also
 * hold the Supabase service-role key — see lib/mirror-bridge-auth.ts. This
 * route holds that key instead, scoped down to exactly two operations:
 * list what's left to mirror, and mark one entry done.
 *
 * GET  -> unmirrored strategyEvents for the mirror allowlist (isMirrorTarget),
 *         oldest first, so the bridge processes opened/stop_moved/closed in
 *         the order they actually happened.
 * POST -> { id } marks that event's mirrored_at = now(). Called once the
 *         bridge has placed/modified/closed the IBKR order for it (or
 *         decided, per its own risk caps, not to) — either way it is "done",
 *         so a retry of the same event is not attempted again.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { authorizeMirrorBridge } from '@/lib/mirror-bridge-auth'
import { MIRROR_TARGETS } from '@/lib/trading-mirror'

export const runtime = 'nodejs'

const RATE_LIMIT = 120
const MAX_BATCH = 50

/** PostgREST quoting: names like "PJ Capital Delta 2" carry spaces. */
const quote = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * Exact (account, strategy) pairs from MIRROR_TARGETS as one PostgREST `or`.
 * Filtering by "any listed account" x "any listed strategy" would also match a
 * PJ bot run on Sim101; that row would never be acked and would sit in the
 * first MAX_BATCH forever, starving the queue.
 */
const MIRROR_PAIRS_FILTER = Object.entries(MIRROR_TARGETS)
  .map(([account, strategies]) =>
    `and(account.eq.${quote(account)},strategy.in.(${Array.from(strategies).map(quote).join(',')}))`
  )
  .join(',')

export async function GET(req: Request) {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`mirror-queue-get:${ip}`, RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  if (!authorizeMirrorBridge(req.headers)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('nexus_nt_strategy_events')
    .select('id, account, strategy, instrument, event_type, direction, quantity, price, stop_price, pnl_currency, occurred_at')
    .or(MIRROR_PAIRS_FILTER)
    .is('mirrored_at', null)
    .order('occurred_at', { ascending: true })
    .limit(MAX_BATCH)

  if (error) {
    console.error('[mirror-queue] GET failed:', error.message)
    return NextResponse.json({ error: 'No se pudo leer la cola.' }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`mirror-queue-post:${ip}`, RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  if (!authorizeMirrorBridge(req.headers)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const id = (body as Record<string, unknown> | null)?.id
  if (typeof id !== 'string' || id.length === 0) {
    return NextResponse.json({ error: '"id" requerido.' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { error } = await db
    .from('nexus_nt_strategy_events')
    .update({ mirrored_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[mirror-queue] POST failed:', error.message)
    return NextResponse.json({ error: 'No se pudo marcar el evento.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
