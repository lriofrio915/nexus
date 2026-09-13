import { supabaseAdmin } from '@/lib/supabase-server'
import ClientForm from '@/components/panel/ClientForm'
import AccountClientLink from '@/components/panel/AccountClientLink'
import WithdrawalForm, { type ClientAccountOption } from '@/components/panel/WithdrawalForm'
import SettleToggleButton from '@/components/panel/SettleToggleButton'
import Stat from '@/components/panel/Stat'
import { money, signedMoney } from '@/lib/trading-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clientes', robots: { index: false, follow: false } }

interface ClientRow {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  notes: string | null
}

interface AccountRow {
  account: string
  label: string | null
  active: boolean
  client_id: string | null
  withdrawal_commission_pct: number | null
}

interface WithdrawalRow {
  id: string
  account: string
  client_id: string
  amount: number
  commission_pct: number
  commission_amount: number
  commission_settled: boolean
  withdrawn_on: string
  note: string | null
}

const when = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-EC')

export default async function ClientesPage() {
  const db = supabaseAdmin()

  const [clientsRes, accountsRes, withdrawalsRes] = await Promise.all([
    db.from('nexus_biz_clients').select('*').order('full_name'),
    db
      .from('nexus_biz_accounts')
      .select('account, label, active, client_id, withdrawal_commission_pct')
      .order('account'),
    db
      .from('nexus_biz_client_withdrawals')
      .select('*')
      .order('withdrawn_on', { ascending: false }),
  ])

  const error = clientsRes.error ?? accountsRes.error ?? withdrawalsRes.error
  const clients = (clientsRes.data ?? []) as ClientRow[]
  const accounts = (accountsRes.data ?? []) as AccountRow[]
  const withdrawals = (withdrawalsRes.data ?? []) as WithdrawalRow[]

  const clientName = (id: string) => clients.find((c) => c.id === id)?.full_name ?? '—'
  const accountLabel = (name: string) =>
    accounts.find((a) => a.account === name)?.label ?? name

  const linkedAccounts = accounts.filter((a) => a.client_id)
  const withdrawalOptions: ClientAccountOption[] = linkedAccounts
    .filter((a) => a.active && a.withdrawal_commission_pct !== null)
    .map((a) => ({
      account: a.account,
      label: a.label,
      clientId: a.client_id as string,
      clientName: clientName(a.client_id as string),
      commissionPct: a.withdrawal_commission_pct as number,
    }))

  const pendingTotal = withdrawals
    .filter((w) => !w.commission_settled)
    .reduce((sum, w) => sum + w.commission_amount, 0)
  const collectedTotal = withdrawals
    .filter((w) => w.commission_settled)
    .reduce((sum, w) => sum + w.commission_amount, 0)
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Clientes</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Cuentas que operas para alguien más. No aportan capital propio ni entran al ROI
          del negocio — lo que gana el negocio aquí es el {' '}
          <span className="text-slate-300">% de comisión sobre cada retiro</span> que el
          cliente hace.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat
          label="Comisión pendiente de cobro"
          value={money(pendingTotal)}
          valueClass={pendingTotal > 0 ? 'text-amber-400' : undefined}
        />
        <Stat label="Comisión ya cobrada" value={money(collectedTotal)} valueClass="text-emerald-400" />
        <Stat label="Total retirado por clientes" value={money(totalWithdrawn)} />
      </section>

      {/* ── Clientes ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Nuevo cliente</h2>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <ClientForm />
        </div>

        {clients.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Cuentas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-white font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-slate-400">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {accounts
                        .filter((a) => a.client_id === c.id)
                        .map((a) => a.label ?? a.account)
                        .join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Vincular cuentas ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Vincular cuentas</h2>
          <p className="text-sm text-slate-400 mt-1">
            Marca qué cuenta es de qué cliente y a qué % cobras cada retiro. Una cuenta sin
            cliente es capital propio, como hasta ahora.
          </p>
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-slate-400">Agrega un cliente arriba primero.</p>
        ) : accounts.filter((a) => a.active).length === 0 ? (
          <p className="text-sm text-slate-400">No hay cuentas activas todavía.</p>
        ) : (
          <div className="space-y-3">
            {accounts
              .filter((a) => a.active)
              .map((a) => (
                <AccountClientLink
                  key={a.account}
                  account={a.account}
                  label={a.label}
                  clientId={a.client_id}
                  commissionPct={a.withdrawal_commission_pct}
                  clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
                />
              ))}
          </div>
        )}
      </section>

      {/* ── Retiros ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Registrar retiro</h2>
          <p className="text-sm text-slate-400 mt-1">
            La comisión se calcula sola con la tasa de la cuenta al momento del retiro y
            queda fija aunque la tasa cambie después.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <WithdrawalForm options={withdrawalOptions} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Historial de retiros</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay retiros registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium text-right">Retirado</th>
                  <th className="px-4 py-3 font-medium text-right">%</th>
                  <th className="px-4 py-3 font-medium text-right">Comisión</th>
                  <th className="px-4 py-3 font-medium">Nota</th>
                  <th className="px-4 py-3 font-medium text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-slate-300">{when(w.withdrawn_on)}</td>
                    <td className="px-4 py-3 text-white">{clientName(w.client_id)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{accountLabel(w.account)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{money(w.amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{w.commission_pct}%</td>
                    <td className="px-4 py-3 text-right font-medium text-cyan-400">
                      {signedMoney(w.commission_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{w.note ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <SettleToggleButton id={w.id} settled={w.commission_settled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
