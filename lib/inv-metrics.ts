/**
 * inv-metrics.ts — Business arithmetic for the managed-accounts panel.
 *
 * Same rules as trading-metrics.ts and dev-metrics.ts: pure functions over
 * plain rows, no database access, no clock reads unless a date is passed in.
 * Money is summed through sumMoney() so a long run of additions cannot drift.
 *
 * Nothing here is stored: contributions, market value and P&L are always
 * recomputed from the cash flows and positions the panel holds.
 */

import { sumMoney } from '@/lib/trading-metrics'

// ── Row shapes ───────────────────────────────────────────────────────────────
// Mirror the nexus_inv_* columns, because the pages read straight from Supabase.

export type InvStatus =
  | 'solicitud'
  | 'en_revision'
  | 'documentos_pendientes'
  | 'enviado_ibkr'
  | 'aprobado'
  | 'rechazado'
  | 'activo'

export type MaritalStatus = 'soltero' | 'casado' | 'union_libre' | 'divorciado' | 'viudo'

export type EmploymentStatus =
  | 'empleado'
  | 'independiente'
  | 'empresario'
  | 'jubilado'
  | 'estudiante'
  | 'desempleado'

export type FundsSource = 'salario' | 'ahorros' | 'negocio' | 'herencia' | 'venta_activos' | 'otro'

export type Objective = 'jubilacion' | 'crecimiento' | 'ingresos' | 'preservacion' | 'especulacion'

export type RiskTolerance = 'baja' | 'media' | 'alta'

export type ExperienceLevel = 'ninguna' | 'basica' | 'media' | 'avanzada'

export type DocumentKind =
  | 'cedula_frente'
  | 'cedula_reverso'
  | 'servicio_basico'
  | 'comprobante_ingresos'
  | 'otro'

export type CashFlowKind = 'aporte' | 'retiro' | 'comision'

export interface InvClientRow {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  national_id: string | null
  birth_date: string | null
  nationality: string | null
  marital_status: MaritalStatus | null
  dependents: number | null
  address_line: string | null
  city: string | null
  province: string | null
  country: string
  employment_status: EmploymentStatus | null
  occupation: string | null
  employer: string | null
  annual_income_usd: number | null
  income_source: string | null
  net_worth_usd: number | null
  liquid_assets_usd: number | null
  other_assets: string | null
  funds_source: FundsSource | null
  objective: Objective | null
  risk_tolerance: RiskTolerance | null
  horizon_years: number | null
  experience_level: ExperienceLevel | null
  initial_deposit_usd: number | null
  is_pep: boolean
  ibkr_related: boolean
  tax_country: string | null
  tax_id: string | null
  status: InvStatus
  source: 'formulario' | 'panel'
  ibkr_account_id: string | null
  ibkr_opened_on: string | null
  advisor_notes: string | null
  created_at: string
}

export interface InvDocumentRow {
  id: string
  client_id: string
  kind: DocumentKind
  storage_path: string
  original_name: string | null
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string
}

export interface InvCashFlowRow {
  id: string
  client_id: string
  kind: CashFlowKind
  amount: number
  occurred_on: string
  note: string | null
}

export interface InvPositionRow {
  id: string
  client_id: string
  symbol: string
  exchange: string | null
  quantity: number
  avg_cost: number
  last_price: number | null
  price_updated_on: string | null
  note: string | null
}

// ── Position arithmetic ──────────────────────────────────────────────────────

/** What the shares cost when they were bought. */
export function positionCost(p: InvPositionRow): number {
  return Math.round(p.quantity * p.avg_cost * 100) / 100
}

/**
 * What the shares are worth at the last loaded price. Falls back to cost when
 * no price has been entered yet, so an unpriced holding reads as flat rather
 * than as a total loss.
 */
export function positionValue(p: InvPositionRow): number {
  const price = p.last_price ?? p.avg_cost
  return Math.round(p.quantity * price * 100) / 100
}

/** Unrealised gain or loss on the holding. */
export function positionPnl(p: InvPositionRow): number {
  return sumMoney([positionValue(p), -positionCost(p)])
}

/** Percentage return on the holding, or null when there is no cost to divide by. */
export function positionReturnPct(p: InvPositionRow): number | null {
  const cost = positionCost(p)
  if (cost === 0) return null
  return (positionPnl(p) / cost) * 100
}

// ── Client portfolio ─────────────────────────────────────────────────────────

export interface ClientPortfolio {
  /** Money the client put in. */
  contributed: number
  /** Money the client took out. */
  withdrawn: number
  /** Management fees charged. */
  fees: number
  /** contributed - withdrawn - fees: the capital actually entrusted today. */
  netContributed: number
  costBasis: number
  marketValue: number
  /** marketValue - costBasis. */
  unrealized: number
  /** marketValue - netContributed: the whole result, fees included. */
  totalReturn: number
  /** totalReturn over netContributed, as a percentage. */
  returnPct: number | null
  positions: number
}

export function clientPortfolio(
  positions: InvPositionRow[],
  flows: InvCashFlowRow[]
): ClientPortfolio {
  const contributed = sumMoney(flows.filter((f) => f.kind === 'aporte').map((f) => f.amount))
  const withdrawn = sumMoney(flows.filter((f) => f.kind === 'retiro').map((f) => f.amount))
  const fees = sumMoney(flows.filter((f) => f.kind === 'comision').map((f) => f.amount))
  const netContributed = sumMoney([contributed, -withdrawn, -fees])

  const costBasis = sumMoney(positions.map(positionCost))
  const marketValue = sumMoney(positions.map(positionValue))
  const unrealized = sumMoney([marketValue, -costBasis])
  const totalReturn = sumMoney([marketValue, -netContributed])

  return {
    contributed,
    withdrawn,
    fees,
    netContributed,
    costBasis,
    marketValue,
    unrealized,
    totalReturn,
    returnPct: netContributed > 0 ? (totalReturn / netContributed) * 100 : null,
    positions: positions.length,
  }
}

// ── Book totals ──────────────────────────────────────────────────────────────

export interface BookTotals {
  /** Clients whose IBKR account is open and funded. */
  activeClients: number
  /** Applications still working their way to an open account. */
  pendingClients: number
  netContributed: number
  marketValue: number
  unrealized: number
  totalReturn: number
  fees: number
}

/** A client counts as pending while the IBKR account is not yet open. */
export function isPending(status: InvStatus): boolean {
  return status === 'solicitud' || status === 'en_revision' || status === 'documentos_pendientes' || status === 'enviado_ibkr'
}

export function bookTotals(
  clients: InvClientRow[],
  positions: InvPositionRow[],
  flows: InvCashFlowRow[]
): BookTotals {
  const book = clientPortfolio(positions, flows)

  return {
    activeClients: clients.filter((c) => c.status === 'activo').length,
    pendingClients: clients.filter((c) => isPending(c.status)).length,
    netContributed: book.netContributed,
    marketValue: book.marketValue,
    unrealized: book.unrealized,
    totalReturn: book.totalReturn,
    fees: book.fees,
  }
}

// ── Onboarding completeness ──────────────────────────────────────────────────
// What still has to be answered before the IBKR application can be sent. The
// panel shows this so a half-filled public submission is obvious at a glance.

const REQUIRED_FOR_IBKR: { field: keyof InvClientRow; label: string }[] = [
  { field: 'email', label: 'Correo' },
  { field: 'phone', label: 'Teléfono' },
  { field: 'national_id', label: 'Cédula' },
  { field: 'birth_date', label: 'Fecha de nacimiento' },
  { field: 'address_line', label: 'Dirección' },
  { field: 'city', label: 'Ciudad' },
  { field: 'employment_status', label: 'Situación laboral' },
  { field: 'occupation', label: 'Ocupación' },
  { field: 'annual_income_usd', label: 'Ingresos anuales' },
  { field: 'net_worth_usd', label: 'Patrimonio neto' },
  { field: 'liquid_assets_usd', label: 'Activos líquidos' },
  { field: 'funds_source', label: 'Origen de los fondos' },
  { field: 'objective', label: 'Objetivo de inversión' },
  { field: 'risk_tolerance', label: 'Tolerancia al riesgo' },
  { field: 'experience_level', label: 'Experiencia' },
]

/** Field labels still empty on the client's profile, in form order. */
export function missingForIbkr(client: InvClientRow): string[] {
  return REQUIRED_FOR_IBKR.filter(({ field }) => {
    const value = client[field]
    return value === null || value === undefined || value === ''
  }).map(({ label }) => label)
}

/** 0-100: how much of the IBKR-required profile is answered. */
export function profileCompletion(client: InvClientRow): number {
  const missing = missingForIbkr(client).length
  return Math.round(((REQUIRED_FOR_IBKR.length - missing) / REQUIRED_FOR_IBKR.length) * 100)
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const INV_STATUS_LABEL: Record<InvStatus, string> = {
  solicitud: 'Solicitud',
  en_revision: 'En revisión',
  documentos_pendientes: 'Faltan documentos',
  enviado_ibkr: 'Enviado a IBKR',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  activo: 'Activo',
}

export const INV_STATUSES = Object.keys(INV_STATUS_LABEL) as InvStatus[]

/** Pill colours: grey while it is paperwork, amber in flight, green once open. */
export function invStatusClass(status: InvStatus): string {
  switch (status) {
    case 'activo':
    case 'aprobado':
      return 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
    case 'enviado_ibkr':
      return 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
    case 'documentos_pendientes':
      return 'bg-amber-900/30 text-amber-400 border-amber-500/30'
    case 'rechazado':
      return 'bg-red-900/30 text-red-400 border-red-500/30'
    default:
      return 'bg-slate-800 text-slate-400 border-white/10'
  }
}

export const MARITAL_LABEL: Record<MaritalStatus, string> = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  union_libre: 'Unión libre',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a',
}

export const EMPLOYMENT_LABEL: Record<EmploymentStatus, string> = {
  empleado: 'Empleado/a',
  independiente: 'Independiente',
  empresario: 'Empresario/a',
  jubilado: 'Jubilado/a',
  estudiante: 'Estudiante',
  desempleado: 'Sin empleo',
}

export const FUNDS_SOURCE_LABEL: Record<FundsSource, string> = {
  salario: 'Salario',
  ahorros: 'Ahorros',
  negocio: 'Negocio propio',
  herencia: 'Herencia',
  venta_activos: 'Venta de activos',
  otro: 'Otro',
}

export const OBJECTIVE_LABEL: Record<Objective, string> = {
  jubilacion: 'Jubilación',
  crecimiento: 'Crecimiento del capital',
  ingresos: 'Generar ingresos',
  preservacion: 'Preservar el capital',
  especulacion: 'Especulación',
}

export const RISK_LABEL: Record<RiskTolerance, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
}

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  ninguna: 'Ninguna',
  basica: 'Básica',
  media: 'Media',
  avanzada: 'Avanzada',
}

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  cedula_frente: 'Cédula (frente)',
  cedula_reverso: 'Cédula (reverso)',
  // Anything that proves name and address together: the broker accepts a
  // utility bill, an internet or mobile plan, or a bank or card statement.
  servicio_basico: 'Comprobante de domicilio',
  comprobante_ingresos: 'Comprobante de ingresos',
  otro: 'Otro documento',
}

export const DOCUMENT_KINDS = Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[]

export const CASH_FLOW_LABEL: Record<CashFlowKind, string> = {
  aporte: 'Aporte',
  retiro: 'Retiro',
  comision: 'Comisión',
}

/** Green for money in, red for money out. */
export function cashFlowClass(kind: CashFlowKind): string {
  return kind === 'aporte' ? 'text-emerald-400' : 'text-red-400'
}

/** Signed amount for a flow: contributions add, withdrawals and fees subtract. */
export function signedFlow(flow: InvCashFlowRow): number {
  return flow.kind === 'aporte' ? flow.amount : -flow.amount
}

/** Human size for a stored document, e.g. `1.4 MB`. */
export function fileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
