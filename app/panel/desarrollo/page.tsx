import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { ExternalLink } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import { money } from '@/lib/trading-metrics'
import {
  PROJECT_STATUS_LABEL,
  PAYMENT_STATE_LABEL,
  groupBy,
  invoiceTotals,
  paymentStateClass,
  portfolioTotals,
  projectStatusClass,
  shortDate,
  type ClientRow,
  type InvoiceItemRow,
  type InvoiceRow,
  type PaymentRow,
  type ProjectRow,
  type ProjectStatus,
} from '@/lib/dev-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Desarrollo', robots: { index: false, follow: false } }

const STATUSES: ProjectStatus[] = [
  'propuesta',
  'en_curso',
  'entregado',
  'mantenimiento',
  'pausado',
  'cancelado',
]

/** Route-safe handle: lowercase, accent-free, dashes instead of spaces. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function createClient(formData: FormData) {
  'use server'

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const { error } = await supabaseAdmin().from('nexus_dev_clients').insert({
    name,
    company: String(formData.get('company') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    location: String(formData.get('location') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  })

  if (error) {
    console.error('[panel/desarrollo] create client failed:', error.message)
    throw new Error(`No se pudo crear el cliente: ${error.message}`)
  }

  revalidatePath('/panel/desarrollo')
}

async function createProject(formData: FormData) {
  'use server'

  const clientId = String(formData.get('client_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!clientId || !name) return

  // An explicit slug wins; otherwise the name becomes the route segment.
  const slug = slugify(String(formData.get('slug') ?? '').trim() || name)
  if (!slug) return

  const rate = Number(formData.get('hourly_rate'))

  const { error } = await supabaseAdmin().from('nexus_dev_projects').insert({
    client_id: clientId,
    name,
    slug,
    summary: String(formData.get('summary') ?? '').trim() || null,
    site_url: String(formData.get('site_url') ?? '').trim() || null,
    repo_url: String(formData.get('repo_url') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'en_curso'),
    hourly_rate: Number.isFinite(rate) && rate > 0 ? rate : null,
    started_on: String(formData.get('started_on') ?? '').trim() || null,
  })

  if (error) {
    console.error('[panel/desarrollo] create project failed:', error.message)
    throw new Error(`No se pudo crear el proyecto: ${error.message}`)
  }

  revalidatePath('/panel/desarrollo')
  revalidatePath('/panel')
}

export default async function DesarrolloPage() {
  const db = supabaseAdmin()
  const [clientsRes, projectsRes, invoicesRes, itemsRes, paymentsRes] = await Promise.all([
    db.from('nexus_dev_clients').select('*').order('name'),
    db.from('nexus_dev_projects').select('*').order('started_on', { ascending: false }),
    db.from('nexus_dev_invoices').select('*').order('issued_on', { ascending: false }),
    db.from('nexus_dev_invoice_items').select('*').order('position'),
    db.from('nexus_dev_payments').select('*').order('paid_on'),
  ])

  const error =
    clientsRes.error ?? projectsRes.error ?? invoicesRes.error ?? itemsRes.error ?? paymentsRes.error

  const clients = (clientsRes.data ?? []) as ClientRow[]
  const projects = (projectsRes.data ?? []) as ProjectRow[]
  const invoices = (invoicesRes.data ?? []) as InvoiceRow[]
  const items = (itemsRes.data ?? []) as InvoiceItemRow[]
  const payments = (paymentsRes.data ?? []) as PaymentRow[]

  const totals = portfolioTotals(projects, invoices, items, payments, clients)

  const clientById = new Map(clients.map((c) => [c.id, c]))
  const invoicesByProject = groupBy(invoices, (i) => i.project_id)
  const itemsByInvoice = groupBy(items, (i) => i.invoice_id)
  const paymentsByInvoice = groupBy(payments, (p) => p.invoice_id)

  const inputClass =
    'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Desarrollo de software</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Los proyectos que se construyen para clientes: qué incluye cada uno, qué se facturó
          y cuánto se ha cobrado realmente.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Facturado"
          value={money(totals.invoiced)}
          hint="Facturas emitidas, sin borradores"
        />
        <Stat label="Cobrado" value={money(totals.collected)} hint="Pagos y abonos recibidos" />
        <Stat
          label="Por cobrar"
          value={money(totals.outstanding)}
          valueClass={totals.outstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}
          hint="Saldo pendiente de las facturas emitidas"
        />
        <Stat
          label="Recurrente anual"
          value={money(totals.recurringYearly)}
          hint="Mantenimientos contratados, por año"
        />
      </section>

      {/* ── Proyectos ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Proyectos</h2>

        {projects.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay proyectos registrados.</p>
        ) : (
          projects.map((project) => {
            const client = clientById.get(project.client_id)
            const projectInvoices = invoicesByProject.get(project.id) ?? []
            const invoice = projectInvoices[0]
            const totalsForInvoice = invoice
              ? invoiceTotals(
                  invoice,
                  itemsByInvoice.get(invoice.id) ?? [],
                  paymentsByInvoice.get(invoice.id) ?? []
                )
              : null

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/panel/desarrollo/${project.slug}`}
                        className="font-bold text-white hover:text-cyan-400"
                      >
                        {project.name}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${projectStatusClass(project.status)}`}
                      >
                        {PROJECT_STATUS_LABEL[project.status]}
                      </span>
                      {totalsForInvoice && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${paymentStateClass(totalsForInvoice.state)}`}
                        >
                          {PAYMENT_STATE_LABEL[totalsForInvoice.state]}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {client?.name ?? 'Sin cliente'}
                      {client?.company ? ` · ${client.company}` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-white">
                      {totalsForInvoice ? money(totalsForInvoice.total) : '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {totalsForInvoice
                        ? `Saldo ${money(totalsForInvoice.balance)}`
                        : 'Sin factura'}
                    </p>
                  </div>
                </div>

                {project.summary && (
                  <p className="text-sm text-slate-300 mt-3 max-w-3xl">{project.summary}</p>
                )}

                <div className="flex flex-wrap gap-4 mt-4 text-xs">
                  {project.site_url && (
                    <a
                      href={project.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {project.site_url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <Link
                    href={`/panel/desarrollo/${project.slug}`}
                    className="text-slate-400 hover:text-cyan-400"
                  >
                    Ver detalle y factura
                  </Link>
                  <span className="text-slate-500">
                    Inicio {shortDate(project.started_on)} · Entrega{' '}
                    {shortDate(project.delivered_on)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </section>

      {/* ── Alta de proyecto ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
        <h2 className="font-bold mb-4">Agregar proyecto</h2>

        {clients.length === 0 ? (
          <p className="text-sm text-slate-400">
            Primero registra un cliente en el formulario de abajo.
          </p>
        ) : (
          <form action={createProject} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block md:col-span-2">
              <span className="text-xs text-slate-400 block mb-1">Nombre del proyecto</span>
              <input name="name" required className={inputClass} />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Cliente</span>
              <select name="client_id" className={inputClass} required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.name} · ${c.company}` : c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Estado</span>
              <select name="status" className={inputClass} defaultValue="en_curso">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs text-slate-400 block mb-1">Resumen</span>
              <input name="summary" className={inputClass} />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Sitio web</span>
              <input name="site_url" type="url" placeholder="https://" className={inputClass} />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Repositorio</span>
              <input name="repo_url" type="url" placeholder="https://" className={inputClass} />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">
                Ruta en el panel (opcional)
              </span>
              <input name="slug" placeholder="se genera del nombre" className={inputClass} />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Tarifa por hora (USD)</span>
              <input
                type="number"
                name="hourly_rate"
                step="0.01"
                min="0"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">Inicio</span>
              <input type="date" name="started_on" className={inputClass} />
            </label>

            <div className="md:col-span-4">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white"
              >
                Agregar proyecto
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── Clientes ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Clientes</h2>

        {clients.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay clientes registrados.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                <p className="font-bold text-white">{c.name}</p>
                {c.company && <p className="text-sm text-slate-400">{c.company}</p>}
                {c.location && <p className="text-xs text-slate-500 mt-2">{c.location}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {[c.email, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {projects.filter((p) => p.client_id === c.id).length} proyecto(s)
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Alta de cliente ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
        <h2 className="font-bold mb-4">Agregar cliente</h2>
        <form action={createClient} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Nombre</span>
            <input name="name" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Empresa</span>
            <input name="company" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Ubicación</span>
            <input name="location" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Correo</span>
            <input type="email" name="email" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Teléfono</span>
            <input name="phone" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Notas</span>
            <input name="notes" className={inputClass} />
          </label>

          <div className="md:col-span-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
            >
              Agregar cliente
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
