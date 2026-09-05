/**
 * trading-ingest.ts — Shared types and auth for the NinjaTrader 8 feed.
 *
 * The AddOn runs on a machine we do not control and posts over the public
 * internet, so the endpoint authenticates with a shared bearer token rather
 * than the panel cookie: there is no browser session on that side.
 */

export const INGEST_HEADER = 'x-nexus-token'

/** Comparison whose duration does not depend on where the strings differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * True only when the request carries the configured ingest token. Fails closed
 * when NT_INGEST_TOKEN is missing or too short, so a half-configured deployment
 * rejects the feed instead of accepting anything.
 */
export function authorizeIngest(headers: Headers): boolean {
  const expected = process.env.NT_INGEST_TOKEN
  if (!expected || expected.length < 32) {
    console.error('[trading] NT_INGEST_TOKEN missing or shorter than 32 characters')
    return false
  }
  const provided = headers.get(INGEST_HEADER)
  if (!provided) return false
  return timingSafeEqual(provided, expected)
}

// ── Payload shapes ───────────────────────────────────────────────────────────
// Mirrors what NexusReporter.cs sends. Every section is optional: the AddOn
// batches whatever changed since the last flush.

export interface AccountSnapshot {
  name: string
  connection?: string | null
  denomination?: string | null
  cashValue?: number | null
  realizedPnl?: number | null
  unrealizedPnl?: number | null
  grossRealized?: number | null
  buyingPower?: number | null
  netLiquidation?: number | null
  reportedAt: string
}

export interface ExecutionRecord {
  id: string
  account: string
  instrument: string
  orderAction?: string | null
  marketPosition?: string | null
  quantity: number
  price: number
  commission?: number | null
  orderId?: string | null
  executedAt: string
}

export interface PositionRecord {
  account: string
  instrument: string
  marketPosition: string
  quantity: number
  averagePrice: number
  unrealizedPnl?: number | null
  openedAt?: string | null
  reportedAt: string
}

export interface TradeRecord {
  id: string
  account: string
  instrument: string
  direction: 'Long' | 'Short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pointValue?: number | null
  pnlPoints?: number | null
  pnlCurrency?: number | null
  commission?: number | null
  entryAt: string
  exitAt: string
}

export interface IngestPayload {
  accounts?: AccountSnapshot[]
  executions?: ExecutionRecord[]
  positions?: PositionRecord[]
  trades?: TradeRecord[]
}

/** Upper bound per section, so one malformed batch cannot flood the tables. */
export const MAX_ITEMS_PER_SECTION = 500

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !Number.isNaN(Date.parse(v))
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/** Optional numeric field: absent and null are both fine, garbage is not. */
function optionalNumber(v: unknown): boolean {
  return v === undefined || v === null || isFiniteNumber(v)
}

function optionalString(v: unknown): boolean {
  return v === undefined || v === null || typeof v === 'string'
}

export interface ValidationResult {
  ok: boolean
  error?: string
}

/**
 * Validates a decoded payload. Rejects the whole batch on the first bad row:
 * a partially applied batch would leave positions and trades disagreeing, and
 * the AddOn retries on failure anyway.
 */
export function validatePayload(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'El cuerpo debe ser un objeto JSON.' }
  }
  const p = body as Record<string, unknown>

  for (const key of ['accounts', 'executions', 'positions', 'trades']) {
    const section = p[key]
    if (section === undefined) continue
    if (!Array.isArray(section)) {
      return { ok: false, error: `"${key}" debe ser un arreglo.` }
    }
    if (section.length > MAX_ITEMS_PER_SECTION) {
      return { ok: false, error: `"${key}" excede ${MAX_ITEMS_PER_SECTION} elementos.` }
    }
  }

  for (const a of (p.accounts ?? []) as Record<string, unknown>[]) {
    if (!nonEmptyString(a.name)) return { ok: false, error: 'accounts[].name requerido.' }
    if (!isIsoDate(a.reportedAt)) {
      return { ok: false, error: 'accounts[].reportedAt debe ser una fecha ISO.' }
    }
    for (const f of [
      'cashValue',
      'realizedPnl',
      'unrealizedPnl',
      'grossRealized',
      'buyingPower',
      'netLiquidation',
    ]) {
      if (!optionalNumber(a[f])) return { ok: false, error: `accounts[].${f} inválido.` }
    }
    if (!optionalString(a.connection) || !optionalString(a.denomination)) {
      return { ok: false, error: 'accounts[] tiene campos de texto inválidos.' }
    }
  }

  for (const e of (p.executions ?? []) as Record<string, unknown>[]) {
    if (!nonEmptyString(e.id)) return { ok: false, error: 'executions[].id requerido.' }
    if (!nonEmptyString(e.account) || !nonEmptyString(e.instrument)) {
      return { ok: false, error: 'executions[] requiere account e instrument.' }
    }
    if (!Number.isInteger(e.quantity) || (e.quantity as number) <= 0) {
      return { ok: false, error: 'executions[].quantity debe ser un entero positivo.' }
    }
    if (!isFiniteNumber(e.price)) {
      return { ok: false, error: 'executions[].price inválido.' }
    }
    if (!optionalNumber(e.commission)) {
      return { ok: false, error: 'executions[].commission inválido.' }
    }
    if (!isIsoDate(e.executedAt)) {
      return { ok: false, error: 'executions[].executedAt debe ser una fecha ISO.' }
    }
  }

  for (const pos of (p.positions ?? []) as Record<string, unknown>[]) {
    if (!nonEmptyString(pos.account) || !nonEmptyString(pos.instrument)) {
      return { ok: false, error: 'positions[] requiere account e instrument.' }
    }
    if (!nonEmptyString(pos.marketPosition)) {
      return { ok: false, error: 'positions[].marketPosition requerido.' }
    }
    if (!Number.isInteger(pos.quantity) || (pos.quantity as number) < 0) {
      return { ok: false, error: 'positions[].quantity debe ser un entero >= 0.' }
    }
    if (!isFiniteNumber(pos.averagePrice)) {
      return { ok: false, error: 'positions[].averagePrice inválido.' }
    }
    if (!isIsoDate(pos.reportedAt)) {
      return { ok: false, error: 'positions[].reportedAt debe ser una fecha ISO.' }
    }
  }

  for (const t of (p.trades ?? []) as Record<string, unknown>[]) {
    if (!nonEmptyString(t.id)) return { ok: false, error: 'trades[].id requerido.' }
    if (!nonEmptyString(t.account) || !nonEmptyString(t.instrument)) {
      return { ok: false, error: 'trades[] requiere account e instrument.' }
    }
    if (t.direction !== 'Long' && t.direction !== 'Short') {
      return { ok: false, error: 'trades[].direction debe ser Long o Short.' }
    }
    if (!Number.isInteger(t.quantity) || (t.quantity as number) <= 0) {
      return { ok: false, error: 'trades[].quantity debe ser un entero positivo.' }
    }
    if (!isFiniteNumber(t.entryPrice) || !isFiniteNumber(t.exitPrice)) {
      return { ok: false, error: 'trades[] requiere entryPrice y exitPrice numéricos.' }
    }
    if (!isIsoDate(t.entryAt) || !isIsoDate(t.exitAt)) {
      return { ok: false, error: 'trades[] requiere entryAt y exitAt ISO.' }
    }
  }

  return { ok: true }
}
