/**
 * POST /api/trading/events — NinjaTrader 8 feed.
 *
 * Receives batches from the NexusReporter AddOn and mirrors them into the
 * nexus_nt_* tables. Every write is an upsert keyed on an id the AddOn
 * controls, so a retried batch after a network failure is a no-op rather than
 * a duplicate.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import {
  authorizeIngest,
  validatePayload,
  type IngestPayload,
} from '@/lib/trading-ingest'
import { notifyAdmin } from '@/lib/notify-admin'
import { isMirrorTarget, formatMirrorMessage } from '@/lib/trading-mirror'

export const runtime = 'nodejs'

/**
 * Batches per minute per IP. The AddOn coalesces events and flushes on a
 * timer, so a healthy client sends far fewer than this even during a busy
 * session.
 */
const RATE_LIMIT = 120

export async function POST(req: Request) {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`nt-ingest:${ip}`, RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  if (!authorizeIngest(req.headers)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const validation = validatePayload(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const payload = body as IngestPayload
  const db = supabaseAdmin()
  const applied = { accounts: 0, executions: 0, positions: 0, trades: 0, strategyEvents: 0 }
  // Strategy event ids already stored before this batch. NexusStrategyReporter
  // gives up after 15 s and resends the same batch; since this route awaits
  // the WhatsApp delivery (often >15 s), every resend used to notify again —
  // 2026-09-23: one Overnight Drift opening went out 100+ times, one every 5 s.
  // A resend is still upserted (idempotent) but never notified twice.
  let alreadyStored = new Set<string>()

  try {
    if (payload.accounts?.length) {
      const rows = payload.accounts.map((a) => ({
        name: a.name,
        connection: a.connection ?? null,
        denomination: a.denomination ?? null,
        cash_value: a.cashValue ?? null,
        realized_pnl: a.realizedPnl ?? null,
        unrealized_pnl: a.unrealizedPnl ?? null,
        gross_realized: a.grossRealized ?? null,
        buying_power: a.buyingPower ?? null,
        net_liquidation: a.netLiquidation ?? null,
        reported_at: a.reportedAt,
      }))
      const { error } = await db.from('nexus_nt_accounts').upsert(rows, { onConflict: 'name' })
      if (error) throw new Error(`accounts: ${error.message}`)
      applied.accounts = rows.length
    }

    if (payload.executions?.length) {
      const rows = payload.executions.map((e) => ({
        id: e.id,
        account: e.account,
        instrument: e.instrument,
        order_action: e.orderAction ?? null,
        market_position: e.marketPosition ?? null,
        quantity: e.quantity,
        price: e.price,
        commission: e.commission ?? null,
        order_id: e.orderId ?? null,
        executed_at: e.executedAt,
      }))
      const { error } = await db.from('nexus_nt_executions').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(`executions: ${error.message}`)
      applied.executions = rows.length
    }

    if (payload.trades?.length) {
      const rows = payload.trades.map((t) => ({
        id: t.id,
        account: t.account,
        instrument: t.instrument,
        direction: t.direction,
        quantity: t.quantity,
        entry_price: t.entryPrice,
        exit_price: t.exitPrice,
        point_value: t.pointValue ?? null,
        pnl_points: t.pnlPoints ?? null,
        pnl_currency: t.pnlCurrency ?? null,
        commission: t.commission ?? null,
        entry_at: t.entryAt,
        exit_at: t.exitAt,
      }))
      const { error } = await db.from('nexus_nt_trades').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(`trades: ${error.message}`)
      applied.trades = rows.length
    }

    if (payload.positions?.length) {
      // A flat position is an absence, not a row with quantity 0: deleting it
      // keeps the table equal to what is actually open right now.
      const flat = payload.positions.filter(
        (p) => p.quantity === 0 || p.marketPosition === 'Flat'
      )
      const open = payload.positions.filter(
        (p) => p.quantity > 0 && p.marketPosition !== 'Flat'
      )

      for (const p of flat) {
        const { error } = await db
          .from('nexus_nt_positions')
          .delete()
          .eq('account', p.account)
          .eq('instrument', p.instrument)
        if (error) throw new Error(`positions delete: ${error.message}`)
      }

      if (open.length) {
        const rows = open.map((p) => ({
          account: p.account,
          instrument: p.instrument,
          market_position: p.marketPosition,
          quantity: p.quantity,
          average_price: p.averagePrice,
          unrealized_pnl: p.unrealizedPnl ?? null,
          opened_at: p.openedAt ?? null,
          reported_at: p.reportedAt,
        }))
        const { error } = await db
          .from('nexus_nt_positions')
          .upsert(rows, { onConflict: 'account,instrument' })
        if (error) throw new Error(`positions upsert: ${error.message}`)
      }
      applied.positions = payload.positions.length
    }
    if (payload.strategyEvents?.length) {
      const rows = payload.strategyEvents.map((s) => ({
        id: s.id,
        account: s.account,
        strategy: s.strategy,
        instrument: s.instrument,
        event_type: s.eventType,
        direction: s.direction,
        quantity: s.quantity,
        price: s.price ?? null,
        stop_price: s.stopPrice ?? null,
        pnl_currency: s.pnlCurrency ?? null,
        occurred_at: s.occurredAt,
      }))
      const { data: existing, error: existingError } = await db
        .from('nexus_nt_strategy_events')
        .select('id')
        .in('id', rows.map((r) => r.id))
      if (existingError) throw new Error(`strategyEvents lookup: ${existingError.message}`)
      alreadyStored = new Set((existing ?? []).map((r) => r.id as string))
      const { error } = await db.from('nexus_nt_strategy_events').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(`strategyEvents: ${error.message}`)
      applied.strategyEvents = rows.length
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[trading/events] write failed:', msg)
    // 500 so the AddOn keeps the batch queued and retries it.
    return NextResponse.json({ error: 'No se pudo guardar el lote.' }, { status: 500 })
  }

  // Notificación WhatsApp — solo para la cuenta/estrategias del espejo
  // (TRADING_PLAN_IBKR_MIRROR.md). Fuera del try/catch de arriba: un fallo al
  // avisar no debe hacer que el AddOn reintente un lote ya guardado.
  for (const event of payload.strategyEvents ?? []) {
    if (!isMirrorTarget(event.account, event.strategy)) continue
    if (alreadyStored.has(event.id)) continue
    const message = formatMirrorMessage(event)
    const result = await notifyAdmin(message, 'nexus-trading')
    if (!result.ok) {
      console.error(`[trading/events] notifyAdmin failed for ${event.id}:`, result.error)
    }
  }

  return NextResponse.json({ ok: true, applied })
}
