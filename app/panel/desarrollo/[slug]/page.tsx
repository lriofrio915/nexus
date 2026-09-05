import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ExternalLink, Github, FileText } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import { money } from '@/lib/trading-metrics'
import {
  PAYMENT_STATE_LABEL,
  PROJECT_STATUS_LABEL,
  billedHours,
  invoiceTotals,
  lineTotal,
  paymentStateClass,
  projectStatusClass,
  shortDate,
  type ClientRow,
  type DeliverableRow,
  type InvoiceItemRow,
  type InvoiceRow,
  type PaymentRow,
  type ProjectRow,
  type ProjectStatus,
} from '@/lib/dev-metrics'

export const dynamic = 'force-dynamic'

const STATUSES: ProjectStatus[] = [
  'propuesta',
  'en_curso',
  'entregado',
  'mantenimiento',
  'pausado',
  'cancelado',
]

const UNITS = ['h', 'unidad', 'mes', 'año'] as const
const METHODS = ['transferencia', 'efectivo', 'zelle', 'paypal', 'cripto', 'otro'] as const

/** Both the detail page and its actions revalidate the same three routes. */
function refresh(slug: string) {
  revalidatePath(`/panel/desarrollo/${slug}`)
  revalidatePath('/panel/desarrollo')
  revalidatePath('/panel')
}

// ── Project ──────────────────────────────────────────────────────────────────

async function updateProject(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id || !slug) return

  const rate = Number(formData.get('hourly_rate'))
  const maintenance = Number(formData.get('maintenance_amount'))

  const { error } = await supabaseAdmin()
    .from('nexus_dev_projects')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      summary: String(formData.get('summary') ?? '').trim() || null,
      site_url: String(formData.get('site_url') ?? '').trim() || null,
      repo_url: String(formData.get('repo_url') ?? '').trim() || null,
      invoice_url: String(formData.get('invoice_url') ?? '').trim() || null,
      status: String(formData.get('status') ?? 'en_curso'),
      hourly_rate: Number.isFinite(rate) && rate > 0 ? rate : null,
      started_on: String(formData.get('started_on') ?? '').trim() || null,
      delivered_on: String(formData.get('delivered_on') ?? '').trim() || null,
      maintenance_amount:
        Number.isFinite(maintenance) && maintenance > 0 ? maintenance : null,
      maintenance_period: String(formData.get('maintenance_period') ?? '') || null,
      maintenance_starts_on: String(formData.get('maintenance_starts_on') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('[panel/desarrollo] update project failed:', error.message)
    throw new Error(`No se pudo actualizar el proyecto: ${error.message}`)
  }

  refresh(slug)
}

// ── Deliverables ─────────────────────────────────────────────────────────────

async function addDeliverable(formData: FormData) {
  'use server'

  const projectId = String(formData.get('project_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  if (!projectId || !title) return

  const position = Number(formData.get('position'))

  const { error } = await supabaseAdmin().from('nexus_dev_deliverables').insert({
    project_id: projectId,
    title,
    detail: String(formData.get('detail') ?? '').trim() || null,
    position: Number.isFinite(position) ? position : 0,
  })

  if (error) {
    console.error('[panel/desarrollo] add deliverable failed:', error.message)
    throw new Error(`No se pudo agregar el entregable: ${error.message}`)
  }

  refresh(slug)
}

async function toggleDeliverable(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return

  const { error } = await supabaseAdmin()
    .from('nexus_dev_deliverables')
    .update({ done: formData.get('done') !== 'true' })
    .eq('id', id)

  if (error) {
    console.error('[panel/desarrollo] toggle deliverable failed:', error.message)
    throw new Error(`No se pudo actualizar el entregable: ${error.message}`)
  }

  refresh(slug)
}

async function deleteDeliverable(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return

  const { error } = await supabaseAdmin().from('nexus_dev_deliverables').delete().eq('id', id)
  if (error) {
    console.error('[panel/desarrollo] delete deliverable failed:', error.message)
    throw new Error(`No se pudo eliminar el entregable: ${error.message}`)
  }

  refresh(slug)
}

// ── Invoice ──────────────────────────────────────────────────────────────────

async function createInvoice(formData: FormData) {
  'use server'

  const projectId = String(formData.get('project_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const number = String(formData.get('number') ?? '').trim()
  const issuedOn = String(formData.get('issued_on') ?? '').trim()
  if (!projectId || !number || !issuedOn) return

  const { error } = await supabaseAdmin().from('nexus_dev_invoices').insert({
    project_id: projectId,
    number,
    issued_on: issuedOn,
    due_on: String(formData.get('due_on') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'borrador'),
    notes: String(formData.get('notes') ?? '').trim() || null,
  })

  if (error) {
    console.error('[panel/desarrollo] create invoice failed:', error.message)
    throw new Error(`No se pudo crear la factura: ${error.message}`)
  }

  refresh(slug)
}

async function updateInvoice(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return

  const tax = Number(formData.get('tax_rate'))

  const { error } = await supabaseAdmin()
    .from('nexus_dev_invoices')
    .update({
      number: String(formData.get('number') ?? '').trim(),
      status: String(formData.get('status') ?? 'borrador'),
      issued_on: String(formData.get('issued_on') ?? '').trim(),
      due_on: String(formData.get('due_on') ?? '').trim() || null,
      tax_rate: Number.isFinite(tax) && tax >= 0 ? tax : 0,
      notes: String(formData.get('notes') ?? '').trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('[panel/desarrollo] update invoice failed:', error.message)
    throw new Error(`No se pudo actualizar la factura: ${error.message}`)
  }

  refresh(slug)
}

async function addItem(formData: FormData) {
  'use server'

  const invoiceId = String(formData.get('invoice_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  if (!invoiceId || !description) return

  const quantity = Number(formData.get('quantity'))
  const unitPrice = Number(formData.get('unit_price'))
  const position = Number(formData.get('position'))

  const { error } = await supabaseAdmin().from('nexus_dev_invoice_items').insert({
    invoice_id: invoiceId,
    description,
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 1,
    unit: String(formData.get('unit') ?? 'unidad'),
    unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
    position: Number.isFinite(position) ? position : 0,
  })

  if (error) {
    console.error('[panel/desarrollo] add invoice item failed:', error.message)
    throw new Error(`No se pudo agregar la línea: ${error.message}`)
  }

  refresh(slug)
}

async function deleteItem(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return

  const { error } = await supabaseAdmin().from('nexus_dev_invoice_items').delete().eq('id', id)
  if (error) {
    console.error('[panel/desarrollo] delete invoice item failed:', error.message)
    throw new Error(`No se pudo eliminar la línea: ${error.message}`)
  }

  refresh(slug)
}

// ── Payments ─────────────────────────────────────────────────────────────────

async function addPayment(formData: FormData) {
  'use server'

  const invoiceId = String(formData.get('invoice_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const amount = Number(formData.get('amount'))
  const paidOn = String(formData.get('paid_on') ?? '').trim()
  if (!invoiceId || !paidOn || !Number.isFinite(amount) || amount <= 0) return

  const { error } = await supabaseAdmin().from('nexus_dev_payments').insert({
    invoice_id: invoiceId,
    amount,
    paid_on: paidOn,
    method: String(formData.get('method') ?? 'otro'),
    reference: String(formData.get('reference') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  })

  if (error) {
    console.error('[panel/desarrollo] add payment failed:', error.message)
    throw new Error(`No se pudo registrar el pago: ${error.message}`)
  }

  refresh(slug)
}

async function deletePayment(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!id) return

  const { error } = await supabaseAdmin().from('nexus_dev_payments').delete().eq('id', id)
  if (error) {
    console.error('[panel/desarrollo] delete payment failed:', error.message)
    throw new Error(`No se pudo eliminar el pago: ${error.message}`)
  }

  refresh(slug)
}

/** Shortcut for "ya me pagó todo": one payment for the whole outstanding balance. */
async function markPaid(formData: FormData) {
  'use server'

  const invoiceId = String(formData.get('invoice_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const balance = Number(formData.get('balance'))
  if (!invoiceId || !Number.isFinite(balance) || balance <= 0) return

  const { error } = await supabaseAdmin().from('nexus_dev_payments').insert({
    invoice_id: invoiceId,
    amount: balance,
    paid_on: new Date().toISOString().slice(0, 10),
    method: 'otro',
    notes: 'Saldo liquidado desde el panel.',
  })

  if (error) {
    console.error('[panel/desarrollo] mark paid failed:', error.message)
    throw new Error(`No se pudo marcar como pagada: ${error.message}`)
  }

  refresh(slug)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProyectoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = supabaseAdmin()

  const { data: projectData, error: projectError } = await db
    .from('nexus_dev_projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (projectError) throw new Error(`No se pudo leer el proyecto: ${projectError.message}`)
  if (!projectData) notFound()

  const project = projectData as ProjectRow

  const [clientRes, deliverablesRes, invoicesRes] = await Promise.all([
    db.from('nexus_dev_clients').select('*').eq('id', project.client_id).maybeSingle(),
    db.from('nexus_dev_deliverables').select('*').eq('project_id', project.id).order('position'),
    db
      .from('nexus_dev_invoices')
      .select('*')
      .eq('project_id', project.id)
      .order('issued_on', { ascending: false }),
  ])

  const client = (clientRes.data ?? null) as ClientRow | null
  const deliverables = (deliverablesRes.data ?? []) as DeliverableRow[]
  const invoices = (invoicesRes.data ?? []) as InvoiceRow[]
  const invoiceIds = invoices.map((i) => i.id)

  // Only fetch lines and payments once there is an invoice to hang them on.
  const [itemsRes, paymentsRes] = invoiceIds.length
    ? await Promise.all([
        db.from('nexus_dev_invoice_items').select('*').in('invoice_id', invoiceIds).order('position'),
        db.from('nexus_dev_payments').select('*').in('invoice_id', invoiceIds).order('paid_on'),
      ])
    : [{ data: [] }, { data: [] }]

  const allItems = (itemsRes.data ?? []) as InvoiceItemRow[]
  const allPayments = (paymentsRes.data ?? []) as PaymentRow[]

  const inputClass =
    'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

  const done = deliverables.filter((d) => d.done).length

  return (
    <div className="space-y-8">
      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div>
        <Link href="/panel/desarrollo" className="text-sm text-slate-400 hover:text-cyan-400">
          ← Desarrollo
        </Link>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{project.name}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${projectStatusClass(project.status)}`}
          >
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>

        {client && (
          <p className="text-slate-400 mt-2">
            {client.name}
            {client.company ? ` · ${client.company}` : ''}
            {client.location ? ` · ${client.location}` : ''}
          </p>
        )}

        {project.summary && (
          <p className="text-slate-300 mt-3 max-w-3xl">{project.summary}</p>
        )}

        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          {project.site_url && (
            <a
              href={project.site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white"
            >
              <ExternalLink className="w-4 h-4" />
              Ver la página
            </a>
          )}
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white hover:bg-white/5"
            >
              <Github className="w-4 h-4" />
              Repositorio
            </a>
          )}
          {project.invoice_url && (
            <a
              href={project.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white hover:bg-white/5"
            >
              <FileText className="w-4 h-4" />
              Factura para el cliente
            </a>
          )}
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Inicio" value={shortDate(project.started_on)} />
        <Stat label="Entrega" value={shortDate(project.delivered_on)} />
        <Stat
          label="Tarifa"
          value={project.hourly_rate ? `${money(project.hourly_rate)} / h` : '—'}
          hint="Una sola tarifa para todo el proyecto"
        />
        <Stat
          label="Mantenimiento"
          value={project.maintenance_amount ? money(project.maintenance_amount) : '—'}
          hint={
            project.maintenance_amount
              ? `${project.maintenance_period === 'monthly' ? 'Mensual' : 'Anual'} desde ${shortDate(project.maintenance_starts_on)}`
              : 'Sin plan contratado'
          }
        />
      </section>

      {/* ── Entregables ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Detalle del proyecto</h2>
          <p className="text-sm text-slate-400">
            {done} de {deliverables.length} entregados
          </p>
        </div>

        {deliverables.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay entregables registrados.</p>
        ) : (
          <ul className="space-y-2">
            {deliverables.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4"
              >
                <form action={toggleDeliverable}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="done" value={String(d.done)} />
                  <button
                    type="submit"
                    aria-label={d.done ? 'Marcar como pendiente' : 'Marcar como entregado'}
                    className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                      d.done
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'border-white/20 text-transparent hover:border-cyan-500/50'
                    }`}
                  >
                    ✓
                  </button>
                </form>

                <div className="flex-1">
                  <p className={d.done ? 'text-white' : 'text-slate-300'}>{d.title}</p>
                  {d.detail && <p className="text-xs text-slate-500 mt-1">{d.detail}</p>}
                </div>

                <form action={deleteDeliverable}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                  >
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addDeliverable}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-slate-900/30 p-4 sm:p-5"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="position" value={deliverables.length + 1} />

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Entregable</span>
            <input name="title" required className={inputClass} />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Descripción</span>
            <input name="detail" className={inputClass} />
          </label>

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
            >
              Agregar entregable
            </button>
          </div>
        </form>
      </section>

      {/* ── Facturas ─────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold">Facturación y cobros</h2>

        {invoices.map((invoice) => {
          const items = allItems.filter((i) => i.invoice_id === invoice.id)
          const payments = allPayments.filter((p) => p.invoice_id === invoice.id)
          const totals = invoiceTotals(invoice, items, payments)
          const hours = billedHours(items)

          return (
            <div
              key={invoice.id}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="font-bold text-white">Factura {invoice.number}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${paymentStateClass(totals.state)}`}
                  >
                    {PAYMENT_STATE_LABEL[totals.state]}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  Emitida {shortDate(invoice.issued_on)}
                  {invoice.due_on ? ` · Vence ${shortDate(invoice.due_on)}` : ''}
                </p>
              </div>

              {/* Líneas */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-white/10">
                      <th className="text-left py-2 font-normal">Concepto</th>
                      <th className="text-right py-2 font-normal">Cantidad</th>
                      <th className="text-right py-2 font-normal">Precio</th>
                      <th className="text-right py-2 font-normal">Importe</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-slate-400">
                          Sin líneas todavía.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="border-b border-white/5">
                          <td className="py-2 text-slate-300">{item.description}</td>
                          <td className="py-2 text-right text-slate-400">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 text-right text-slate-400">
                            {money(item.unit_price)}
                          </td>
                          <td className="py-2 text-right text-white">{money(lineTotal(item))}</td>
                          <td className="py-2 text-right">
                            <form action={deleteItem}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="slug" value={slug} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat
                  label="Total"
                  value={money(totals.total)}
                  hint={hours > 0 ? `${hours} h facturadas` : undefined}
                />
                <Stat label="Cobrado" value={money(totals.paid)} />
                <Stat
                  label="Saldo"
                  value={money(totals.balance)}
                  valueClass={totals.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}
                />
                <Stat
                  label="Impuesto"
                  value={invoice.tax_rate > 0 ? money(totals.tax) : 'Sin impuesto'}
                  hint={invoice.tax_rate > 0 ? `${invoice.tax_rate}%` : undefined}
                />
              </div>

              {invoice.notes && <p className="text-sm text-slate-400">{invoice.notes}</p>}

              {/* Agregar línea */}
              <form action={addItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="position" value={items.length + 1} />

                <label className="block sm:col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">Concepto</span>
                  <input name="description" required className={inputClass} />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Cantidad</span>
                  <input
                    type="number"
                    name="quantity"
                    step="0.01"
                    min="0"
                    defaultValue={1}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Unidad</span>
                  <select name="unit" className={inputClass} defaultValue="h">
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Precio unitario</span>
                  <input
                    type="number"
                    name="unit_price"
                    step="0.01"
                    min="0"
                    defaultValue={project.hourly_rate ?? undefined}
                    required
                    className={inputClass}
                  />
                </label>

                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
                  >
                    Agregar línea
                  </button>
                </div>
              </form>

              {/* Pagos y abonos */}
              <div className="space-y-3 border-t border-white/10 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-white">Pagos y abonos</h3>
                  {totals.balance > 0 && invoice.status === 'enviada' && (
                    <form action={markPaid}>
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="balance" value={totals.balance} />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-sm font-bold text-emerald-300 hover:bg-emerald-600/30"
                      >
                        Marcar como pagada ({money(totals.balance)})
                      </button>
                    </form>
                  )}
                </div>

                {payments.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Sin pagos registrados. Esta factura sigue pendiente.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3"
                      >
                        <span className="text-sm text-white font-bold">{money(p.amount)}</span>
                        <span className="text-xs text-slate-400">
                          {shortDate(p.paid_on)} · {p.method}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </span>
                        <form action={deletePayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <button
                            type="submit"
                            className="text-xs text-red-400 hover:text-red-300 hover:underline"
                          >
                            Eliminar
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                <form action={addPayment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <input type="hidden" name="slug" value={slug} />

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Monto del abono</span>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0.01"
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Fecha</span>
                    <input type="date" name="paid_on" required className={inputClass} />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Método</span>
                    <select name="method" className={inputClass} defaultValue="transferencia">
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Referencia</span>
                    <input name="reference" className={inputClass} />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Notas</span>
                    <input name="notes" className={inputClass} />
                  </label>

                  <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
                    >
                      Registrar abono
                    </button>
                  </div>
                </form>
              </div>

              {/* Datos de la factura */}
              <details className="border-t border-white/10 pt-5">
                <summary className="text-sm text-slate-400 cursor-pointer hover:text-cyan-400">
                  Editar datos de la factura
                </summary>
                <form action={updateInvoice} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <input type="hidden" name="id" value={invoice.id} />
                  <input type="hidden" name="slug" value={slug} />

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Número</span>
                    <input
                      name="number"
                      defaultValue={invoice.number}
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Estado</span>
                    <select name="status" defaultValue={invoice.status} className={inputClass}>
                      <option value="borrador">Borrador</option>
                      <option value="enviada">Enviada al cliente</option>
                      <option value="anulada">Anulada</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Emisión</span>
                    <input
                      type="date"
                      name="issued_on"
                      defaultValue={invoice.issued_on}
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Vencimiento</span>
                    <input
                      type="date"
                      name="due_on"
                      defaultValue={invoice.due_on ?? ''}
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">Impuesto (%)</span>
                    <input
                      type="number"
                      name="tax_rate"
                      step="0.01"
                      min="0"
                      defaultValue={invoice.tax_rate}
                      className={inputClass}
                    />
                  </label>

                  <label className="block sm:col-span-2 lg:col-span-3">
                    <span className="text-xs text-slate-400 block mb-1">Notas</span>
                    <input name="notes" defaultValue={invoice.notes ?? ''} className={inputClass} />
                  </label>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
                    >
                      Guardar factura
                    </button>
                  </div>
                </form>
              </details>
            </div>
          )
        })}

        {/* Nueva factura */}
        <form
          action={createInvoice}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-2xl border border-white/10 bg-slate-900/30 p-4 sm:p-5"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="slug" value={slug} />

          <div className="sm:col-span-2 lg:col-span-4">
            <h3 className="font-bold">Nueva factura</h3>
          </div>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Número</span>
            <input name="number" required placeholder="HPF-2026-002" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Emisión</span>
            <input type="date" name="issued_on" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Vencimiento</span>
            <input type="date" name="due_on" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Estado</span>
            <select name="status" defaultValue="borrador" className={inputClass}>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada al cliente</option>
            </select>
          </label>

          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="text-xs text-slate-400 block mb-1">Notas</span>
            <input name="notes" className={inputClass} />
          </label>

          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white"
            >
              Crear factura
            </button>
          </div>
        </form>
      </section>

      {/* ── Datos del proyecto ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 sm:p-5">
        <h2 className="font-bold mb-4">Datos del proyecto</h2>
        <form action={updateProject} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="slug" value={slug} />

          <label className="block sm:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Nombre</span>
            <input name="name" defaultValue={project.name} required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Estado</span>
            <select name="status" defaultValue={project.status} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Tarifa por hora (USD)</span>
            <input
              type="number"
              name="hourly_rate"
              step="0.01"
              min="0"
              defaultValue={project.hourly_rate ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="text-xs text-slate-400 block mb-1">Resumen</span>
            <input name="summary" defaultValue={project.summary ?? ''} className={inputClass} />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Sitio web</span>
            <input
              name="site_url"
              type="url"
              defaultValue={project.site_url ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Repositorio</span>
            <input
              name="repo_url"
              type="url"
              defaultValue={project.repo_url ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="text-xs text-slate-400 block mb-1">
              Documento de factura para el cliente
            </span>
            <input
              name="invoice_url"
              type="url"
              defaultValue={project.invoice_url ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Inicio</span>
            <input
              type="date"
              name="started_on"
              defaultValue={project.started_on ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Entrega</span>
            <input
              type="date"
              name="delivered_on"
              defaultValue={project.delivered_on ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Mantenimiento (USD)</span>
            <input
              type="number"
              name="maintenance_amount"
              step="0.01"
              min="0"
              defaultValue={project.maintenance_amount ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Periodicidad</span>
            <select
              name="maintenance_period"
              defaultValue={project.maintenance_period ?? 'yearly'}
              className={inputClass}
            >
              <option value="yearly">Anual</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Mantenimiento desde</span>
            <input
              type="date"
              name="maintenance_starts_on"
              defaultValue={project.maintenance_starts_on ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="text-xs text-slate-400 block mb-1">Notas internas</span>
            <input name="notes" defaultValue={project.notes ?? ''} className={inputClass} />
          </label>

          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
