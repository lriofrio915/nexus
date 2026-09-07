import { supabaseAdmin } from '@/lib/supabase-server'
import AccountCard from '@/components/panel/AccountCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cuentas', robots: { index: false, follow: false } }

interface NtAccountRow {
  name: string
  connection: string | null
  cash_value: number | null
  reported_at: string
}

interface MapRow {
  account: string
  label: string | null
  prop_firm: string | null
  strategy_id: string | null
  active: boolean
  started_on: string | null
}

interface StrategyRow {
  id: string
  name: string
}

export default async function CuentasPage() {
  const db = supabaseAdmin()
  const [ntRes, mapRes, stratRes] = await Promise.all([
    db.from('nexus_nt_accounts').select('name, connection, cash_value, reported_at').order('name'),
    db.from('nexus_biz_accounts').select('*'),
    db.from('nexus_biz_strategies').select('id, name').order('name'),
  ])

  const error = ntRes.error ?? mapRes.error ?? stratRes.error
  const ntAccounts = (ntRes.data ?? []) as NtAccountRow[]
  const mappings = (mapRes.data ?? []) as MapRow[]
  const strategies = (stratRes.data ?? []) as StrategyRow[]

  // NinjaTrader is the only source of accounts. The mapping is still merged in
  // so an account it stops reporting keeps its card, its history and whatever
  // expenses were charged to it instead of vanishing from the panel.
  const names = [...new Set([...ntAccounts.map((a) => a.name), ...mappings.map((m) => m.account)])]
    .sort()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Cuentas</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Vincula cada cuenta con el bot o portafolio que opera en ella. Sin esta relación
          el resultado no se puede atribuir a una estrategia.
        </p>
        <p className="text-slate-500 text-sm mt-2 max-w-2xl">
          Las cuentas no se crean aquí: aparecen solas en cuanto NinjaTrader las reporta.
          Lo que se edita en esta página es cómo el panel las interpreta.
        </p>
        <p className="text-slate-500 text-sm mt-2 max-w-2xl">
          Al desmarcar <span className="text-slate-300">Cuenta activa</span> la cuenta sale
          de todas las cifras del negocio sin perder su historial. Es lo que corresponde
          para la cuenta de práctica Sim101, cuyo saldo es ficticio.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      {names.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <p className="text-slate-300 font-medium mb-2">No hay cuentas todavía.</p>
          <p className="text-slate-400 text-sm">
            Aparecerán en cuanto NinjaTrader reporte. Si llevas rato esperando, revisa
            que el complemento esté enviando eventos a <code>/api/trading/events</code>.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {names.map((name) => {
          const nt = ntAccounts.find((a) => a.name === name)
          const m = mappings.find((x) => x.account === name)

          return (
            <AccountCard
              key={name}
              account={name}
              label={m?.label ?? null}
              propFirm={m?.prop_firm ?? null}
              strategyId={m?.strategy_id ?? null}
              active={m?.active ?? true}
              startedOn={m?.started_on ?? null}
              nt={nt ? { connection: nt.connection, cash_value: nt.cash_value } : null}
              strategies={strategies}
            />
          )
        })}
      </div>
    </div>
  )
}
