import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import { money } from '@/lib/trading-metrics'

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

/**
 * Saves one account mapping. The account name is the primary key and comes from
 * NinjaTrader, so this upserts rather than inserts: editing an existing row and
 * claiming a newly detected account are the same operation.
 */
async function saveAccount(formData: FormData) {
  'use server'

  const account = String(formData.get('account') ?? '').trim()
  if (!account) return

  const strategyId = String(formData.get('strategy_id') ?? '')
  const startedOn = String(formData.get('started_on') ?? '').trim()

  const { error } = await supabaseAdmin()
    .from('nexus_biz_accounts')
    .upsert(
      {
        account,
        label: String(formData.get('label') ?? '').trim() || null,
        prop_firm: String(formData.get('prop_firm') ?? '').trim() || null,
        strategy_id: strategyId || null,
        active: formData.get('active') === 'on',
        started_on: startedOn || null,
      },
      { onConflict: 'account' }
    )

  if (error) {
    console.error('[panel/cuentas] save failed:', error.message)
    throw new Error(`No se pudo guardar la cuenta: ${error.message}`)
  }

  revalidatePath('/panel/trading/cuentas')
  revalidatePath('/panel/trading')
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

  // Accounts configured ahead of time (PJ Capital during maintenance) have no
  // NinjaTrader row yet, so the two lists are merged rather than one driving.
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
            Aparecerán en cuanto NinjaTrader reporte, o puedes preparar una manualmente
            más abajo.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {names.map((name) => {
          const nt = ntAccounts.find((a) => a.name === name)
          const m = mappings.find((x) => x.account === name)
          const inactive = m ? !m.active : false
          const assigned = Boolean(m?.strategy_id)

          return (
            <form
              key={name}
              action={saveAccount}
              className={`rounded-2xl border p-5 bg-slate-900/50 ${
                inactive
                  ? 'border-white/5 opacity-60'
                  : assigned
                    ? 'border-white/10'
                    : 'border-amber-500/40'
              }`}
            >
              <input type="hidden" name="account" value={name} />

              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <p className="font-mono text-sm text-white">
                  {name}
                  {inactive && (
                    <span className="ml-2 font-sans text-xs text-slate-500 not-italic">
                      · fuera de las cifras
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {nt
                    ? `${nt.connection ?? 'sin conexión'} · ${money(nt.cash_value)}`
                    : 'Sin datos de NinjaTrader todavía'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Etiqueta</span>
                  <input
                    name="label"
                    defaultValue={m?.label ?? ''}
                    placeholder="Flex, Delta 1, Rapid Daily…"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Prop firm</span>
                  <input
                    name="prop_firm"
                    defaultValue={m?.prop_firm ?? nt?.connection ?? ''}
                    placeholder="FundedNext, PJ Capital…"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Estrategia</span>
                  <select
                    name="strategy_id"
                    defaultValue={m?.strategy_id ?? ''}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">Sin asignar</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Inicio</span>
                  <input
                    type="date"
                    name="started_on"
                    defaultValue={m?.started_on ?? ''}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={m?.active ?? true}
                    className="accent-cyan-500"
                  />
                  Cuenta activa
                </label>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white"
                >
                  Guardar
                </button>
              </div>
            </form>
          )
        })}
      </div>

      {/* ── Preparar una cuenta que aún no reporta ───────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
        <h2 className="font-bold mb-1">Preparar una cuenta</h2>
        <p className="text-sm text-slate-400 mb-4">
          Para dejar listas las cuentas de PJ Capital antes de que NinjaTrader las reporte.
          El nombre debe coincidir exactamente con el que usa la plataforma.
        </p>

        <form action={saveAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block md:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Nombre en NinjaTrader</span>
            <input
              name="account"
              required
              placeholder="APEX-12345"
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Etiqueta</span>
            <input
              name="label"
              placeholder="Delta 1"
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Estrategia</span>
            <select
              name="strategy_id"
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">Sin asignar</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="prop_firm" value="PJ Capital" />
          <input type="hidden" name="active" value="on" />
          <div className="md:col-span-4">
            <button
              type="submit"
              className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
            >
              Agregar
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
