/**
 * trading-metrics.ts — Business arithmetic for the trading panel.
 *
 * Pure functions over plain rows: no database access, no dates read from the
 * clock unless passed in. That keeps the pages thin and makes every number here
 * reproducible from its inputs.
 *
 * Money is handled in whole cents internally where it is summed repeatedly, so
 * a long run of additions cannot drift the way binary floats do.
 */

// ── Row shapes ───────────────────────────────────────────────────────────────
// These mirror the database columns rather than the camelCase ingest payloads,
// because the panel reads straight from Supabase.

export interface TradeRow {
  id: string
  account: string
  instrument: string
  direction: string
  quantity: number
  pnl_currency: number | null
  exit_at: string
}

export interface ExpenseRow {
  id: string
  concept: string
  category: string
  amount: number
  kind: 'one_time' | 'recurring'
  recurrence: 'monthly' | 'yearly' | null
  starts_on: string
  ends_on: string | null
  account: string | null
}

export interface AccountMapRow {
  account: string
  label: string | null
  prop_firm: string | null
  strategy_id: string | null
  active: boolean
}

export interface StrategyRow {
  id: string
  name: string
  kind: string
}

export type Period = 'day' | 'week' | 'month' | 'all'

// ── Account exclusion ────────────────────────────────────────────────────────

/**
 * True when an account is explicitly switched off in the mapping.
 *
 * NinjaTrader reports every account it can see, including the Sim101 practice
 * account it ships with, whose imaginary balance would otherwise be added to
 * the business capital. Marking one inactive removes it from every figure while
 * keeping its history.
 *
 * An account with no mapping row counts as active: data must never disappear
 * from the totals just because nobody has configured it yet.
 */
export function isExcluded(account: string, accounts: AccountMapRow[]): boolean {
  const m = accounts.find((a) => a.account === account)
  return m ? !m.active : false
}

/** Drops rows belonging to accounts switched off in the mapping. */
export function excludeInactive<T extends { account: string }>(
  rows: T[],
  accounts: AccountMapRow[]
): T[] {
  const off = new Set(accounts.filter((a) => !a.active).map((a) => a.account))
  return off.size === 0 ? rows : rows.filter((r) => !off.has(r.account))
}

// ── Money helpers ────────────────────────────────────────────────────────────

const toCents = (n: number) => Math.round(n * 100)
const fromCents = (c: number) => c / 100

/** Sums a list of dollar amounts without accumulating float error. */
export function sumMoney(values: (number | null | undefined)[]): number {
  let cents = 0
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) cents += toCents(v)
  return fromCents(cents)
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// Everything is bucketed in UTC. Trade timestamps arrive as UTC from the AddOn,
// and expense dates are plain calendar dates, so mixing in a local timezone
// would shift trades across day boundaries for no benefit.

/** `YYYY-MM-DD` for a timestamp or date string. */
export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/** `YYYY-MM` for a timestamp or date string. */
export function monthKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 7)
}

/** Monday of the ISO week containing the date, as `YYYY-MM-DD`. */
export function weekKey(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDay() || 7 // Sunday counts as the 7th day, not the 0th.
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

/** Inclusive start of a period ending now, or null for 'all'. */
export function periodStart(period: Period, now: Date = new Date()): Date | null {
  const d = new Date(now)
  switch (period) {
    case 'day':
      d.setUTCHours(0, 0, 0, 0)
      return d
    case 'week': {
      d.setUTCHours(0, 0, 0, 0)
      const day = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() - day + 1)
      return d
    }
    case 'month':
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(1)
      return d
    case 'all':
      return null
  }
}

export const PERIOD_LABELS: Record<Period, string> = {
  day: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  all: 'Todo',
}

/** Narrows an untrusted query param to a Period, defaulting to 'month'. */
export function parsePeriod(value: unknown): Period {
  return value === 'day' || value === 'week' || value === 'month' || value === 'all'
    ? value
    : 'month'
}

// ── Expense accrual ──────────────────────────────────────────────────────────

export interface AccrualCharge {
  date: string // YYYY-MM-DD
  concept: string
  category: string
  amount: number
  account: string | null
}

/**
 * Expands expenses into dated charges within [from, to].
 *
 * A one_time expense produces a single charge on its start date. A recurring
 * one repeats on the same day-of-month (or day-of-year) from its start until
 * its end, or until `to` when open-ended. Charges are computed rather than
 * stored, so correcting a start date immediately fixes every past period.
 *
 * A monthly charge starting on the 31st lands on the last day of shorter
 * months rather than spilling into the next one.
 */
export function accrueExpenses(
  expenses: ExpenseRow[],
  from: Date | null,
  to: Date
): AccrualCharge[] {
  const charges: AccrualCharge[] = []
  const toTime = to.getTime()
  const fromTime = from ? from.getTime() : -Infinity

  for (const e of expenses) {
    const start = new Date(`${e.starts_on}T00:00:00Z`)
    if (Number.isNaN(start.getTime())) continue

    const end = e.ends_on ? new Date(`${e.ends_on}T00:00:00Z`) : null
    const limit = end && end.getTime() < toTime ? end.getTime() : toTime

    const push = (when: Date) => {
      const t = when.getTime()
      if (t < fromTime || t > toTime) return
      charges.push({
        date: when.toISOString().slice(0, 10),
        concept: e.concept,
        category: e.category,
        amount: e.amount,
        account: e.account,
      })
    }

    if (e.kind === 'one_time') {
      push(start)
      continue
    }

    const anchorDay = start.getUTCDate()
    let occurrence = new Date(start)

    // Bounded so a corrupt date range cannot spin forever: a century of monthly
    // charges is far beyond any real use, and the loop exits at `limit` anyway.
    for (let i = 0; i < 1200 && occurrence.getTime() <= limit; i++) {
      push(occurrence)

      const next = new Date(occurrence)
      if (e.recurrence === 'yearly') {
        next.setUTCFullYear(next.getUTCFullYear() + 1)
      } else {
        // Move to the first of the next month, then clamp the anchor day to
        // that month's length.
        next.setUTCDate(1)
        next.setUTCMonth(next.getUTCMonth() + 1)
        const daysInMonth = new Date(
          Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
        ).getUTCDate()
        next.setUTCDate(Math.min(anchorDay, daysInMonth))
      }
      occurrence = next
    }
  }

  return charges.sort((a, b) => a.date.localeCompare(b.date))
}

// ── Aggregation ──────────────────────────────────────────────────────────────

export interface Bucket {
  key: string
  label: string
  pnl: number
  trades: number
}

/** Groups trade P&L into day, week or month buckets, oldest first. */
export function aggregateByPeriod(
  trades: TradeRow[],
  granularity: 'day' | 'week' | 'month'
): Bucket[] {
  const keyOf =
    granularity === 'day' ? dayKey : granularity === 'week' ? weekKey : monthKey

  const buckets = new Map<string, { cents: number; trades: number }>()
  for (const t of trades) {
    const key = keyOf(t.exit_at)
    const b = buckets.get(key) ?? { cents: 0, trades: 0 }
    b.cents += toCents(t.pnl_currency ?? 0)
    b.trades += 1
    buckets.set(key, b)
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({
      key,
      label: formatBucketLabel(key, granularity),
      pnl: fromCents(b.cents),
      trades: b.trades,
    }))
}

function formatBucketLabel(key: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    const months = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
    ]
    return `${months[Number(m) - 1] ?? m} ${y}`
  }
  const [, m, d] = key.split('-')
  return granularity === 'week' ? `sem ${d}/${m}` : `${d}/${m}`
}

/** Running total of bucket P&L, for the cumulative curve. */
export function cumulative(buckets: Bucket[]): Bucket[] {
  let cents = 0
  return buckets.map((b) => {
    cents += toCents(b.pnl)
    return { ...b, pnl: fromCents(cents) }
  })
}

// ── Performance stats ────────────────────────────────────────────────────────

export interface Performance {
  pnl: number
  trades: number
  wins: number
  losses: number
  winRate: number | null
  grossProfit: number
  grossLoss: number
  /** Gross profit divided by gross loss. Null when there are no losses yet. */
  profitFactor: number | null
  bestTrade: number | null
  worstTrade: number | null
}

export function performance(trades: TradeRow[]): Performance {
  let profitCents = 0
  let lossCents = 0
  let wins = 0
  let losses = 0
  let best: number | null = null
  let worst: number | null = null

  for (const t of trades) {
    const v = t.pnl_currency ?? 0
    if (v > 0) {
      profitCents += toCents(v)
      wins++
    } else if (v < 0) {
      lossCents += toCents(-v)
      losses++
    }
    if (best === null || v > best) best = v
    if (worst === null || v < worst) worst = v
  }

  const decided = wins + losses
  return {
    pnl: fromCents(profitCents - lossCents),
    trades: trades.length,
    wins,
    losses,
    winRate: decided > 0 ? (wins / decided) * 100 : null,
    grossProfit: fromCents(profitCents),
    grossLoss: fromCents(lossCents),
    profitFactor: lossCents > 0 ? profitCents / lossCents : null,
    bestTrade: best,
    worstTrade: worst,
  }
}

// ── Breakdowns ───────────────────────────────────────────────────────────────

export interface StrategyBreakdown extends Performance {
  strategyId: string | null
  name: string
  accounts: string[]
  /** Costs attributed to this strategy's accounts within the period. */
  expenses: number
  /** P&L minus attributed costs. */
  net: number
}

/**
 * Performance per strategy, with each account's costs folded in.
 *
 * Accounts with no mapping are grouped under "Sin asignar" rather than dropped:
 * a trade that reached the database always belongs somewhere, and hiding it
 * would make the totals disagree with the account table.
 */
export function strategyBreakdown(
  trades: TradeRow[],
  accounts: AccountMapRow[],
  strategies: StrategyRow[],
  charges: AccrualCharge[] = []
): StrategyBreakdown[] {
  const accountToStrategy = new Map(accounts.map((a) => [a.account, a.strategy_id]))
  const strategyName = new Map(strategies.map((s) => [s.id, s.name]))

  const groups = new Map<string, { trades: TradeRow[]; accounts: Set<string> }>()
  const key = (id: string | null | undefined) => id ?? '__unassigned__'

  // Seed every mapped strategy so one with no trades yet still shows up.
  for (const a of accounts) {
    const k = key(a.strategy_id)
    const g = groups.get(k) ?? { trades: [], accounts: new Set<string>() }
    g.accounts.add(a.account)
    groups.set(k, g)
  }

  for (const t of trades) {
    const k = key(accountToStrategy.get(t.account))
    const g = groups.get(k) ?? { trades: [], accounts: new Set<string>() }
    g.trades.push(t)
    g.accounts.add(t.account)
    groups.set(k, g)
  }

  const rows: StrategyBreakdown[] = []
  for (const [k, g] of groups) {
    const perf = performance(g.trades)
    const expenses = sumMoney(
      charges.filter((c) => c.account !== null && g.accounts.has(c.account)).map((c) => c.amount)
    )
    rows.push({
      ...perf,
      strategyId: k === '__unassigned__' ? null : k,
      name: k === '__unassigned__' ? 'Sin asignar' : (strategyName.get(k) ?? 'Desconocida'),
      accounts: [...g.accounts].sort(),
      expenses,
      net: fromCents(toCents(perf.pnl) - toCents(expenses)),
    })
  }

  return rows.sort((a, b) => b.net - a.net)
}

export interface AccountBreakdown extends Performance {
  account: string
  label: string | null
  propFirm: string | null
  strategyName: string | null
  expenses: number
  net: number
}

export function accountBreakdown(
  trades: TradeRow[],
  accounts: AccountMapRow[],
  strategies: StrategyRow[],
  charges: AccrualCharge[] = []
): AccountBreakdown[] {
  const strategyName = new Map(strategies.map((s) => [s.id, s.name]))
  const byAccount = new Map<string, TradeRow[]>()
  for (const t of trades) {
    const list = byAccount.get(t.account) ?? []
    list.push(t)
    byAccount.set(t.account, list)
  }

  // Union of mapped accounts and accounts that actually traded.
  const names = new Set<string>([...accounts.map((a) => a.account), ...byAccount.keys()])
  const mapped = new Map(accounts.map((a) => [a.account, a]))

  return [...names]
    .map((name) => {
      const perf = performance(byAccount.get(name) ?? [])
      const m = mapped.get(name)
      const expenses = sumMoney(
        charges.filter((c) => c.account === name).map((c) => c.amount)
      )
      return {
        ...perf,
        account: name,
        label: m?.label ?? null,
        propFirm: m?.prop_firm ?? null,
        strategyName: m?.strategy_id ? (strategyName.get(m.strategy_id) ?? null) : null,
        expenses,
        net: fromCents(toCents(perf.pnl) - toCents(expenses)),
      }
    })
    .sort((a, b) => b.net - a.net)
}

// ── Business summary ─────────────────────────────────────────────────────────

export interface BusinessSummary {
  /** Sum of winning trades. */
  grossProfit: number
  /** Sum of losing trades, as a positive number. */
  grossLoss: number
  /** Trading result before costs. */
  operatingPnl: number
  /** Costs accrued within the period. */
  expenses: number
  /** Operating P&L minus expenses: what the business actually made. */
  netProfit: number
  trades: number
  winRate: number | null
  profitFactor: number | null
  /** Every cost ever accrued, regardless of the selected period. */
  totalInvested: number
  /** Lifetime P&L, regardless of the selected period. */
  lifetimePnl: number
  /** Lifetime P&L minus everything invested. */
  lifetimeNet: number
  /** Lifetime net over total invested, as a percentage. Null with no costs. */
  roi: number | null
  /** What is still missing to pay back the investment. Zero once recovered. */
  toBreakEven: number
}

export function businessSummary(args: {
  periodTrades: TradeRow[]
  periodCharges: AccrualCharge[]
  allTrades: TradeRow[]
  allCharges: AccrualCharge[]
}): BusinessSummary {
  const perf = performance(args.periodTrades)
  const expenses = sumMoney(args.periodCharges.map((c) => c.amount))

  const totalInvested = sumMoney(args.allCharges.map((c) => c.amount))
  const lifetimePnl = sumMoney(args.allTrades.map((t) => t.pnl_currency))
  const lifetimeNet = fromCents(toCents(lifetimePnl) - toCents(totalInvested))

  return {
    grossProfit: perf.grossProfit,
    grossLoss: perf.grossLoss,
    operatingPnl: perf.pnl,
    expenses,
    netProfit: fromCents(toCents(perf.pnl) - toCents(expenses)),
    trades: perf.trades,
    winRate: perf.winRate,
    profitFactor: perf.profitFactor,
    totalInvested,
    lifetimePnl,
    lifetimeNet,
    roi: totalInvested > 0 ? (lifetimeNet / totalInvested) * 100 : null,
    toBreakEven: lifetimeNet >= 0 ? 0 : Math.abs(lifetimeNet),
  }
}

/** Monthly cost of everything still recurring on the given date. */
export function monthlyBurn(expenses: ExpenseRow[], on: Date = new Date()): number {
  const t = on.getTime()
  let cents = 0
  for (const e of expenses) {
    if (e.kind !== 'recurring') continue
    if (new Date(`${e.starts_on}T00:00:00Z`).getTime() > t) continue
    if (e.ends_on && new Date(`${e.ends_on}T00:00:00Z`).getTime() < t) continue
    cents += e.recurrence === 'yearly' ? Math.round(toCents(e.amount) / 12) : toCents(e.amount)
  }
  return fromCents(cents)
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function money(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Same as money() but always shows the sign, for deltas. */
export function signedMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const formatted = money(Math.abs(value), currency)
  if (value === 0) return formatted
  return `${value > 0 ? '+' : '−'}${formatted}`
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function ratio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

/** Tailwind text colour for a P&L figure: green up, red down, neutral at zero. */
export function pnlClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return 'text-slate-300'
  return value > 0 ? 'text-emerald-400' : 'text-red-400'
}
