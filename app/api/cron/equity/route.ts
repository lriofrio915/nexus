/**
 * GET /api/cron/equity — daily capital snapshot.
 *
 * Copies each account's balance from nexus_nt_accounts into
 * nexus_biz_equity_daily so the capital curve has a point every day, including
 * days without trades.
 *
 * Daily P&L is deliberately NOT stored here: it is derived from
 * nexus_nt_trades on read, so a missed run costs a dot on one chart rather than
 * corrupting the business figures.
 *
 * The table used to carry a realized_pnl column as well, and it was always
 * zero. NinjaTrader's AccountItem.RealizedProfitLoss resets when the session
 * opens, and this snapshot is taken hours after that, so it never had anything
 * to copy: Sim101 gained 157 between two snapshots and both recorded 0.00. A
 * column that is structurally always zero is worse than no column, because it
 * reads like a figure. Dropped in migration 0007.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/** Comparison whose duration does not depend on where the strings differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Fails closed on a
 * missing or weak secret so a misconfigured deployment cannot be triggered by
 * anyone who guesses the path.
 */
function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 16) {
    console.error('[cron/equity] CRON_SECRET missing or shorter than 16 characters')
    return false
  }
  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header
  return timingSafeEqual(provided, expected)
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const db = supabaseAdmin()

  const { data, error } = await db
    .from('nexus_nt_accounts')
    .select('name, cash_value')

  if (error) {
    console.error('[cron/equity] read failed:', error.message)
    return NextResponse.json({ error: 'No se pudieron leer las cuentas.' }, { status: 500 })
  }

  const accounts = data ?? []
  if (accounts.length === 0) {
    return NextResponse.json({ ok: true, snapshots: 0 })
  }

  // The cron is scheduled for 23:55 UTC, but Vercel dispatches with drift and
  // in practice has been firing after midnight, which rolled the wall clock
  // into the next day and stamped every snapshot with the wrong date. Anchor
  // the day a couple of hours back so any plausible delay still resolves to
  // the day being closed. Re-running it overwrites rather than duplicating.
  const ANCHOR_OFFSET_MS = 2 * 60 * 60 * 1000
  const day = new Date(Date.now() - ANCHOR_OFFSET_MS).toISOString().slice(0, 10)

  const rows = accounts.map((a) => ({
    day,
    account: a.name,
    equity: a.cash_value,
  }))

  const { error: writeError } = await db
    .from('nexus_biz_equity_daily')
    .upsert(rows, { onConflict: 'day,account' })

  if (writeError) {
    console.error('[cron/equity] write failed:', writeError.message)
    return NextResponse.json({ error: 'No se pudo guardar el corte.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, day, snapshots: rows.length })
}
