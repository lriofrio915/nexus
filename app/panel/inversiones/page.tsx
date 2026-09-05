import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { ExternalLink } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import { money, percent, pnlClass, signedMoney } from '@/lib/trading-metrics'
import { groupBy } from '@/lib/dev-metrics'
import {
  INV_STATUS_LABEL,
  OBJECTIVE_LABEL,
  bookTotals,
  clientPortfolio,
  invStatusClass,
  profileCompletion,
  type InvCashFlowRow,
  type InvClientRow,
  type InvPositionRow,
} from '@/lib/inv-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inversiones', robots: { index: false, follow: false } }

async function createInvClient(formData: FormData) {
  'use server'

  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) return

  const { error } = await supabaseAdmin().from('nexus_inv_clients').insert({
    full_name: fullName,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    national_id: String(formData.get('national_id') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    // Created from the panel, so it starts under review rather than as an
    // untouched public submission.
    status: 'en_revision',
    source: 'panel',
  })

  if (error) {
    console.error('[panel/inversiones] create client failed:', error.message)
    throw new Error(`No se pudo crear el cliente: ${error.message}`)
  }

  revalidatePath('/panel/inversiones')
  revalidatePath('/panel')
}

export default async function InversionesPage() {
  const db = supabaseAdmin()
  const [clientsRes, positionsRes, flowsRes] = await Promise.all([
    db.from('nexus_inv_clients').select('*').order('created_at', { ascending: false }),
    db.from('nexus_inv_positions').select('*').order('symbol'),
    db.from('nexus_inv_cash_flows').select('*').order('occurred_on'),
  ])

  const error = clientsRes.error ?? positionsRes.error ?? flowsRes.error

  const clients = (clientsRes.data ?? []) as InvClientRow[]
  const positions = (positionsRes.data ?? []) as InvPositionRow[]
  const flows = (flowsRes.data ?? []) as InvCashFlowRow[]

  const totals = bookTotals(clients, positions, flows)
  const positionsByClient = groupBy(positions, (p) => p.client_id)
  const flowsByClient = groupBy(flows, (f) => f.client_id)

  const formUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nexus-ia.com.es'}/onboarding`

  const inputClass =
    'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de cuentas</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Los clientes cuyas carteras se administran en IBKR: en qué punto está la apertura
          de cada cuenta, cuánto capital aportaron y cuánto vale su cartera hoy.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Clientes activos"
          value={String(totals.activeClients)}
          hint={`${totals.pendingClients} en proceso de apertura`}
        />
        <Stat
          label="Capital aportado"
          value={money(totals.netContributed)}
          hint="Aportes menos retiros y comisiones"
        />
        <Stat
          label="Valor de cartera"
          value={money(totals.marketValue)}
          hint="Al último precio cargado"
        />
        <Stat
          label="Resultado"
          value={signedMoney(totals.totalReturn)}
          valueClass={pnlClass(totals.totalReturn)}
          hint="Valor de cartera menos capital aportado"
        />
      </section>

      {/* ── Formulario público ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 sm:p-5">
        <h2 className="font-bold">Formulario de apertura</h2>
        <p className="text-sm text-slate-300 mt-1 max-w-2xl">
          Envía este link al cliente para que llene sus datos y suba sus documentos. Las
          respuestas llegan aquí como solicitudes.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <code className="text-sm text-cyan-400 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 break-all">
            {formUrl}
          </code>
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir
          </a>
        </div>
      </section>

      {/* ── Clientes ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Clientes</h2>

        {clients.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay clientes registrados.</p>
        ) : (
          clients.map((client) => {
            const portfolio = clientPortfolio(
              positionsByClient.get(client.id) ?? [],
              flowsByClient.get(client.id) ?? []
            )
            const completion = profileCompletion(client)

            return (
              <div
                key={client.id}
                className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/panel/inversiones/${client.id}`}
                        className="font-bold text-white hover:text-cyan-400"
                      >
                        {client.full_name}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${invStatusClass(client.status)}`}
                      >
                        {INV_STATUS_LABEL[client.status]}
                      </span>
                      {client.source === 'formulario' && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-white/10">
                          Del formulario
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {[client.national_id, client.city, client.email]
                        .filter(Boolean)
                        .join(' · ') || 'Sin datos de contacto'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Perfil {percent(completion, 0)} completo
                      {client.objective ? ` · ${OBJECTIVE_LABEL[client.objective]}` : ''}
                      {client.ibkr_account_id ? ` · IBKR ${client.ibkr_account_id}` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{money(portfolio.marketValue)}</p>
                    <p className={`text-xs ${pnlClass(portfolio.totalReturn)}`}>
                      {signedMoney(portfolio.totalReturn)}
                      {portfolio.returnPct !== null && ` (${percent(portfolio.returnPct)})`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Aportado {money(portfolio.netContributed)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </section>

      {/* ── Alta manual ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
        <h2 className="font-bold mb-4">Nuevo cliente</h2>
        <form action={createInvClient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-slate-400">Nombre completo *</span>
            <input name="full_name" required className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Cédula</span>
            <input name="national_id" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Correo</span>
            <input name="email" type="email" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Teléfono</span>
            <input name="phone" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Ciudad</span>
            <input name="city" className={inputClass} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg px-4 py-2 text-sm"
            >
              Crear cliente
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
