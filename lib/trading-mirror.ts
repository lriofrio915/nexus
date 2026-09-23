/**
 * trading-mirror.ts — which NT8 signals qualify for the WhatsApp notice and the
 * IBKR execution bridge, and how to phrase the notice.
 *
 * Scope is a fixed allowlist per account, not "every strategy on every
 * account": TRADING_PLAN_IBKR_MIRROR.md (nexus_claw workspace) lists exactly
 * which bots on which account are mirrored. Anything else NT8 reports is still
 * stored in nexus_nt_strategy_events for the dashboard, but has no side
 * effect — keeping the blast radius of a bug contained to these bots.
 */

/**
 * Account name (Account.Name in NT8) -> NT8 strategy class names
 * (Strategy.Name), exactly as NexusStrategyReporter sends them.
 */
export const MIRROR_TARGETS: Readonly<Record<string, ReadonlySet<string>>> = {
  'PJ Capital Delta 2': new Set([
    'PROD_Bot_NQ_WeekendEffect_1min_ETH',
    'PROD_Bot_NQ_MomentumApertura_30min_RTH',
    'PROD_Bot_NQ_ZigZag_Breakout_5min_RTH',
  ]),
  // Bots que solo corren en la cuenta simulada. No usan stop loss (salen por
  // tiempo o por señal); Luis decidió el 2026-09-23 espejarlos igual en IBKR,
  // sin stop. Ver TRADING_PLAN_IBKR_MIRROR.md.
  Sim101: new Set([
    'PROD_Bot_NQ_OvernightDrift_1min_RTH',
    'PROD_Bot_NQ_RSI2Reversion_1dia_ETH',
    'PROD_Bot_NQ_IBSReversion_5min_RTH',
  ]),
}

export function isMirrorTarget(account: string, strategy: string): boolean {
  return MIRROR_TARGETS[account]?.has(strategy) ?? false
}

const STRATEGY_LABELS: Record<string, string> = {
  PROD_Bot_NQ_WeekendEffect_1min_ETH: 'Weekend Effect',
  PROD_Bot_NQ_MomentumApertura_30min_RTH: 'Momentum Apertura',
  PROD_Bot_NQ_ZigZag_Breakout_5min_RTH: 'ZigZag Breakout',
  PROD_Bot_NQ_OvernightDrift_1min_RTH: 'Overnight Drift',
  PROD_Bot_NQ_RSI2Reversion_1dia_ETH: 'RSI2 Reversion',
  PROD_Bot_NQ_IBSReversion_5min_RTH: 'IBS Reversion',
}

export interface MirrorEvent {
  account: string
  strategy: string
  instrument: string
  eventType: 'opened' | 'stop_moved' | 'closed'
  direction: 'Long' | 'Short'
  quantity: number
  price?: number | null
  stopPrice?: number | null
  pnlCurrency?: number | null
}

/** Plain-language WhatsApp message for one qualifying event. No markdown: WhatsApp has none. */
export function formatMirrorMessage(event: MirrorEvent): string {
  const label = STRATEGY_LABELS[event.strategy] ?? event.strategy
  const dir = event.direction === 'Long' ? 'compra' : 'venta'

  if (event.eventType === 'opened') {
    const stop = event.stopPrice == null ? 'Sin stop (sale por tiempo o señal).' : `Stop en ${event.stopPrice}.`
    return (
      `📈 ${label} (${event.account}) abrió ${dir} de ${event.quantity} ${event.instrument} ` +
      `a ${event.price}. ${stop}`
    )
  }

  if (event.eventType === 'stop_moved') {
    return `🔧 ${label} (${event.account}) movió el stop de ${event.instrument} (${dir}) a ${event.stopPrice}.`
  }

  const pnl = event.pnlCurrency ?? 0
  const emoji = pnl >= 0 ? '✅' : '❌'
  const resultado = pnl >= 0 ? 'ganancia' : 'pérdida'
  return (
    `${emoji} ${label} (${event.account}) cerró ${dir} de ${event.quantity} ${event.instrument} ` +
    `a ${event.price} — ${resultado} de $${Math.abs(pnl).toFixed(2)}.`
  )
}
