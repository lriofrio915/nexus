import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trading', robots: { index: false, follow: false } }

interface AccountRow {
  name: string
  connection: string | null
  denomination: string | null
  cash_value: number | null
  realized_pnl: number | null
  unrealized_pnl: number | null
  buying_power: number | null
  net_liquidation: number | null
  reported_at: string
}

interface PositionRow {
  account: string
  instrument: string
  market_position: string
  quantity: number
  average_price: number
  reported_at: string
}

interface TradeRow {
  id: string
  account: string
  instrument: string
  direction: string
  quantity: number
  entry_price: number
  exit_price: number
  pnl_points: number | null
  pnl_currency: number | null
  entry_at: string
  exit_at: string
}

interface ExecutionRow {
  id: string
  account: string
  instrument: string
  order_action: string | null
  quantity: number
  price: number
  executed_at: string
}

const money = (v: number | null, ccy: string | null = 'USD') =>
  v === null
    ? '—'
    : new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: ccy === 'UsDollar' || !ccy ? 'USD' : ccy,
        maximumFractionDigits: 2,
      }).format(v)

const when = (iso: string) => new Date(iso).toLocaleString('es-EC')

/** Green above zero, red below, neutral at exactly zero or unknown. */
function pnlClass(v: number | null): string {
  if (v === null || v === 0) return 'text-slate-300'
  return v > 0 ? 'text-emerald-400' : 'text-red-400'
}

export default async function TradingPage() {
  const db = supabaseAdmin()

  const [accountsRes, positionsRes, tradesRes, executionsRes] = await Promise.all([
    db.from('nexus_nt_accounts').select('*').order('name'),
    db.from('nexus_nt_positions').select('*').order('account'),
    db.from('nexus_nt_trades').select('*').order('exit_at', { ascending: false }).limit(50),
    db
      .from('nexus_nt_executions')
      .select('id, account, instrument, order_action, quantity, price, executed_at')
      .order('executed_at', { ascending: false })
      .limit(25),
  ])

  const accounts = (accountsRes.data ?? []) as AccountRow[]
  const positions = (positionsRes.data ?? []) as PositionRow[]
  const trades = (tradesRes.data ?? []) as TradeRow[]
  const executions = (executionsRes.data ?? []) as ExecutionRow[]

  const error =
    accountsRes.error ?? positionsRes.error ?? tradesRes.error ?? executionsRes.error

  const totalRealized = trades.reduce((sum, t) => sum + (t.pnl_currency ?? 0), 0)
  const winners = trades.filter((t) => (t.pnl_currency ?? 0) > 0).length
  const winRate = trades.length > 0 ? Math.round((winners / trades.length) * 100) : null

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Trading</h1>
        <p className="text-slate-400 mt-2">
          Reflejo en vivo de NinjaTrader 8. Los datos llegan del AddOn NexusReporter.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      {!error && accounts.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <p className="text-slate-300 font-medium mb-2">Todavía no llega ningún dato.</p>
          <p className="text-slate-400 text-sm">
            Instala <code className="text-cyan-400">ninjatrader/NexusReporter.cs</code> en
            NinjaTrader 8, configura el token y compila. Las cuentas aparecen aquí en
            cuanto NT8 se conecte.
          </p>
        </div>
      )}

      {/* ── Cuentas ─────────────────────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Cuentas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <div
                key={a.name}
                className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
              >
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-bold text-white">{a.name}</h3>
                  <span className="text-xs text-slate-500">{a.connection ?? '—'}</span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Capital</dt>
                    <dd className="text-white font-medium">
                      {money(a.cash_value, a.denomination)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Liquidación neta</dt>
                    <dd className="text-slate-300">
                      {money(a.net_liquidation, a.denomination)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">P&amp;L realizado</dt>
                    <dd className={pnlClass(a.realized_pnl)}>
                      {money(a.realized_pnl, a.denomination)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">P&amp;L abierto</dt>
                    <dd className={pnlClass(a.unrealized_pnl)}>
                      {money(a.unrealized_pnl, a.denomination)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Poder de compra</dt>
                    <dd className="text-slate-300">
                      {money(a.buying_power, a.denomination)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-slate-500">
                  Actualizado {when(a.reported_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Posiciones abiertas ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Posiciones abiertas</h2>
        {positions.length === 0 ? (
          <p className="text-slate-400 text-sm">Sin posiciones abiertas.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Instrumento</th>
                  <th className="px-4 py-3 font-medium">Dirección</th>
                  <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                  <th className="px-4 py-3 font-medium text-right">Precio promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {positions.map((p) => (
                  <tr key={`${p.account}-${p.instrument}`} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-slate-300">{p.account}</td>
                    <td className="px-4 py-3 text-white">{p.instrument}</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        p.market_position === 'Long' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {p.market_position}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{p.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {p.average_price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Operaciones cerradas ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-6 flex-wrap">
          <h2 className="text-xl font-bold">Operaciones cerradas</h2>
          {trades.length > 0 && (
            <p className="text-sm text-slate-400">
              Últimas {trades.length} ·{' '}
              <span className={pnlClass(totalRealized)}>{money(totalRealized)}</span>
              {winRate !== null && <> · {winRate}% ganadoras</>}
            </p>
          )}
        </div>

        {trades.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay operaciones cerradas.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Cierre</th>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Instrumento</th>
                  <th className="px-4 py-3 font-medium">Dir.</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">Entrada</th>
                  <th className="px-4 py-3 font-medium text-right">Salida</th>
                  <th className="px-4 py-3 font-medium text-right">Puntos</th>
                  <th className="px-4 py-3 font-medium text-right">P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {when(t.exit_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{t.account}</td>
                    <td className="px-4 py-3 text-white">{t.instrument}</td>
                    <td
                      className={
                        t.direction === 'Long'
                          ? 'px-4 py-3 text-emerald-400'
                          : 'px-4 py-3 text-red-400'
                      }
                    >
                      {t.direction}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{t.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{t.entry_price}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{t.exit_price}</td>
                    <td className={`px-4 py-3 text-right ${pnlClass(t.pnl_points)}`}>
                      {t.pnl_points ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${pnlClass(t.pnl_currency)}`}
                    >
                      {money(t.pnl_currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Ejecuciones ─────────────────────────────────────────────────────── */}
      {executions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Últimas ejecuciones</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Hora</th>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Instrumento</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {executions.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {when(e.executed_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{e.account}</td>
                    <td className="px-4 py-3 text-white">{e.instrument}</td>
                    <td className="px-4 py-3 text-slate-300">{e.order_action ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{e.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{e.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
