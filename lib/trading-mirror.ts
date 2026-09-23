/**
 * trading-mirror.ts — which NT8 signals qualify for the WhatsApp notice (and,
 * later, the IBKR execution bridge), and how to phrase the notice.
 *
 * Scope is a fixed allowlist, not "every strategy on every account":
 * TRADING_PLAN_IBKR_MIRROR.md (nexus_claw workspace) only covers these three
 * strategies on this one funded account. Anything else NT8 reports is still
 * stored in nexus_nt_strategy_events for the dashboard, but has no side
 * effect — keeping the blast radius of a bug contained to this one account.
 */

export const MIRROR_ACCOUNT = 'PJ Capital Delta 2'

/** NT8 strategy class names (Strategy.Name), exactly as NexusStrategyReporter sends them. */
export const MIRROR_STRATEGIES = new Set<string>([
  'PROD_Bot_NQ_WeekendEffect_1min_ETH',
  'PROD_Bot_NQ_MomentumApertura_30min_RTH',
  'PROD_Bot_NQ_ZigZag_Breakout_5min_RTH',
])

export function isMirrorTarget(account: string, strategy: string): boolean {
  return account === MIRROR_ACCOUNT && MIRROR_STRATEGIES.has(strategy)
}

const STRATEGY_LABELS: Record<string, string> = {
  PROD_Bot_NQ_WeekendEffect_1min_ETH: 'Weekend Effect',
  PROD_Bot_NQ_MomentumApertura_30min_RTH: 'Momentum Apertura',
  PROD_Bot_NQ_ZigZag_Breakout_5min_RTH: 'ZigZag Breakout',
}

export interface MirrorEvent {
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
    return (
      `📈 ${label} (${MIRROR_ACCOUNT}) abrió ${dir} de ${event.quantity} ${event.instrument} ` +
      `a ${event.price}. Stop en ${event.stopPrice}.`
    )
  }

  if (event.eventType === 'stop_moved') {
    return `🔧 ${label} (${MIRROR_ACCOUNT}) movió el stop de ${event.instrument} (${dir}) a ${event.stopPrice}.`
  }

  const pnl = event.pnlCurrency ?? 0
  const emoji = pnl >= 0 ? '✅' : '❌'
  const resultado = pnl >= 0 ? 'ganancia' : 'pérdida'
  return (
    `${emoji} ${label} (${MIRROR_ACCOUNT}) cerró ${dir} de ${event.quantity} ${event.instrument} ` +
    `a ${event.price} — ${resultado} de $${Math.abs(pnl).toFixed(2)}.`
  )
}
