/**
 * dev-metrics.ts — Business arithmetic for the software development panel.
 *
 * Same rules as trading-metrics.ts: pure functions over plain rows, no database
 * access, no clock reads unless a date is passed in. Money is summed through
 * sumMoney() so a long run of additions cannot drift the way binary floats do.
 */

import { sumMoney } from '@/lib/trading-metrics'

// ── Row shapes ───────────────────────────────────────────────────────────────
// Mirror the database columns, because the pages read straight from Supabase.

export interface ClientRow {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  location: string | null
  notes: string | null
  active: boolean
}

export type ProjectStatus =
  | 'propuesta'
  | 'en_curso'
  | 'entregado'
  | 'mantenimiento'
  | 'pausado'
  | 'cancelado'

export interface ProjectRow {
  id: string
  client_id: string
  name: string
  slug: string
  summary: string | null
  site_url: string | null
  repo_url: string | null
  invoice_url: string | null
  status: ProjectStatus
  hourly_rate: number | null
  started_on: string | null
  delivered_on: string | null
  maintenance_amount: number | null
  maintenance_period: 'monthly' | 'yearly' | null
  maintenance_starts_on: string | null
  notes: string | null
}

export interface DeliverableRow {
  id: string
  project_id: string
  title: string
  detail: string | null
  done: boolean
  position: number
}

export interface InvoiceRow {
  id: string
  project_id: string
  number: string
  status: 'borrador' | 'enviada' | 'anulada'
  currency: string
  issued_on: string
  due_on: string | null
  tax_rate: number
  notes: string | null
}

export interface InvoiceItemRow {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit: 'h' | 'unidad' | 'mes' | 'año'
  unit_price: number
  position: number
}

export interface PaymentRow {
  id: string
  invoice_id: string
  amount: number
  paid_on: string
  method: string
  reference: string | null
  notes: string | null
}

/** Everything needed to state what one invoice is worth and what is left. */
export interface InvoiceTotals {
  subtotal: number
  tax: number
  total: number
  paid: number
  balance: number
  state: PaymentState
}

export type PaymentState = 'pagada' | 'abonada' | 'pendiente' | 'borrador' | 'anulada'

// ── Invoice arithmetic ───────────────────────────────────────────────────────

/** quantity × unit_price for one line. Never stored: correcting a rate fixes every total. */
export function lineTotal(item: Pick<InvoiceItemRow, 'quantity' | 'unit_price'>): number {
  const value = item.quantity * item.unit_price
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

export function invoiceSubtotal(items: InvoiceItemRow[]): number {
  return sumMoney(items.map(lineTotal))
}

/** Total collected against an invoice. Several abonos simply add up. */
export function invoicePaid(payments: PaymentRow[]): number {
  return sumMoney(payments.map((p) => p.amount))
}

/**
 * Every figure for one invoice.
 *
 * The paid/pending state is derived here rather than stored, so a partial
 * payment can never disagree with a status column somebody forgot to update. A
 * draft or voided invoice reports its own state instead: neither is owed.
 */
export function invoiceTotals(
  invoice: Pick<InvoiceRow, 'status' | 'tax_rate'>,
  items: InvoiceItemRow[],
  payments: PaymentRow[]
): InvoiceTotals {
  const subtotal = invoiceSubtotal(items)
  const tax = Math.round(subtotal * (invoice.tax_rate / 100) * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  const paid = invoicePaid(payments)
  const balance = Math.round((total - paid) * 100) / 100

  let state: PaymentState
  if (invoice.status === 'anulada') state = 'anulada'
  else if (invoice.status === 'borrador') state = 'borrador'
  else if (paid <= 0) state = 'pendiente'
  else if (balance <= 0) state = 'pagada'
  else state = 'abonada'

  return { subtotal, tax, total, paid, balance, state }
}

/** True when the invoice is a live claim on the client: sent and not fully paid. */
export function isCollectable(state: PaymentState): boolean {
  return state === 'pendiente' || state === 'abonada'
}

// ── Portfolio roll-up ────────────────────────────────────────────────────────

export interface PortfolioTotals {
  /** Sum of every issued (non-draft, non-void) invoice. */
  invoiced: number
  /** Cash actually received. */
  collected: number
  /** Still owed on issued invoices. */
  outstanding: number
  /** Recurring maintenance normalised to a yearly figure. */
  recurringYearly: number
  activeProjects: number
  clients: number
}

/**
 * Adds up the whole development business.
 *
 * Draft and voided invoices are excluded from "invoiced" for the same reason
 * inactive accounts are excluded from trading capital: a number nobody owes yet
 * must not inflate the headline.
 */
export function portfolioTotals(
  projects: ProjectRow[],
  invoices: InvoiceRow[],
  items: InvoiceItemRow[],
  payments: PaymentRow[],
  clients: ClientRow[]
): PortfolioTotals {
  const itemsByInvoice = groupBy(items, (i) => i.invoice_id)
  const paymentsByInvoice = groupBy(payments, (p) => p.invoice_id)

  const invoiced: number[] = []
  const collected: number[] = []
  const outstanding: number[] = []

  for (const invoice of invoices) {
    const totals = invoiceTotals(
      invoice,
      itemsByInvoice.get(invoice.id) ?? [],
      paymentsByInvoice.get(invoice.id) ?? []
    )
    // Money received is real even on a draft, so it always counts.
    collected.push(totals.paid)
    if (invoice.status !== 'enviada') continue
    invoiced.push(totals.total)
    if (totals.balance > 0) outstanding.push(totals.balance)
  }

  const recurringYearly = sumMoney(
    projects
      .filter((p) => p.status !== 'cancelado' && p.maintenance_amount)
      .map((p) =>
        p.maintenance_period === 'monthly'
          ? (p.maintenance_amount ?? 0) * 12
          : (p.maintenance_amount ?? 0)
      )
  )

  return {
    invoiced: sumMoney(invoiced),
    collected: sumMoney(collected),
    outstanding: sumMoney(outstanding),
    recurringYearly,
    activeProjects: projects.filter(
      (p) => p.status === 'en_curso' || p.status === 'mantenimiento'
    ).length,
    clients: clients.filter((c) => c.active).length,
  }
}

/** Hours billed across an invoice, for projects sold by the hour. */
export function billedHours(items: InvoiceItemRow[]): number {
  const hours = items.filter((i) => i.unit === 'h').reduce((sum, i) => sum + i.quantity, 0)
  return Math.round(hours * 100) / 100
}

// ── Presentation helpers ─────────────────────────────────────────────────────

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  propuesta: 'Propuesta',
  en_curso: 'En curso',
  entregado: 'Entregado',
  mantenimiento: 'Mantenimiento',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
}

/** Tailwind classes for a project status chip. */
export function projectStatusClass(status: ProjectStatus): string {
  switch (status) {
    case 'entregado':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    case 'en_curso':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
    case 'mantenimiento':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    case 'propuesta':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'cancelado':
      return 'bg-red-500/10 text-red-400 border-red-500/30'
    default:
      return 'bg-slate-500/10 text-slate-300 border-white/20'
  }
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  pagada: 'Pagada',
  abonada: 'Abonada',
  pendiente: 'Pendiente de pago',
  borrador: 'Borrador',
  anulada: 'Anulada',
}

/** Tailwind classes for a payment state chip. */
export function paymentStateClass(state: PaymentState): string {
  switch (state) {
    case 'pagada':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    case 'abonada':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'pendiente':
      return 'bg-red-500/10 text-red-400 border-red-500/30'
    default:
      return 'bg-slate-500/10 text-slate-300 border-white/20'
  }
}

/** `14 ago 2026`, or a dash when the date is missing. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-EC', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** Groups rows by a key, keeping input order inside each bucket. */
export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const row of rows) {
    const k = key(row)
    const bucket = out.get(k)
    if (bucket) bucket.push(row)
    else out.set(k, [row])
  }
  return out
}
