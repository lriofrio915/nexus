import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-server'
import BarChart from '@/components/panel/BarChart'
import LineChart from '@/components/panel/LineChart'
import Stat from '@/components/panel/Stat'
import {
  PERIOD_LABELS,
  accountBreakdown,
  accrueExpenses,
  aggregateByPeriod,
  businessSummary,
  cumulative,
  excludeInactive,
  isExcluded,
  money,
  monthlyBurn,
  parsePeriod,
  percent,
  periodStart,
  pnlClass,
  ratio,
  signedMoney,
  strategyBreakdown,
  type AccountMapRow,
  type ExpenseRow,
  type StrategyRow,
  type TradeRow,
} from '@/lib/trading-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trading', robots: { index: false, follow: false } }

interface NtAccountRow {
  name: string
  connection: string | null
  denomination: string | null
  cash_value: number | null
  realized_pnl: number | null
  unrealized_pnl: number | null
  reported_at: string
}

interface PositionRow {
  account: string
  instrument: string
  market_position: string
  quantity: number
  average_price: number
}

interface EquityRow {
  day: string
  account: string
  equity: number | null
}

const when = (iso: string) => new Date(iso).toLocaleString('es-EC')

export default async function TradingPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const period = parsePeriod((await searchParams).periodo)
  const now = new Date()
  const from = periodStart(period, now)

  const db = supabaseAdmin()

  // Lifetime trades are fetched once and filtered in memory: the period slice
  // and the lifetime figures both come from the same list, so ROI and
  // break-even stay consistent with whatever period is on screen.
  const [tradesRes, ntAccountsRes, positionsRes, mapRes, strategiesRes, expensesRes, equityRes] =
    await Promise.all([
      db
        .from('nexus_nt_trades')
        .select('id, account, instrument, direction, quantity, pnl_currency, exit_at')
        .order('exit_at', { ascending: true }),
      db.from('nexus_nt_accounts').select('*').order('name'),
      db.from('nexus_nt_positions').select('*').order('account'),
      db.from('nexus_biz_accounts').select('account, label, prop_firm, strategy_id, active'),
      db.from('nexus_biz_strategies').select('id, name, kind').order('name'),
      db
        .from('nexus_biz_expenses')
        .select('id, concept, category, amount, kind, recurrence, starts_on, ends_on, account'),
      db
        .from('nexus_biz_equity_daily')
        .select('day, account, equity')
        .order('day', { ascending: true }),
    ])

  const error =
    tradesRes.error ??
    ntAccountsRes.error ??
    positionsRes.error ??
    mapRes.error ??
    strategiesRes.error ??
    expensesRes.error ??
    equityRes.error

  const accountMap = (mapRes.data ?? []) as AccountMapRow[]
  const strategies = (strategiesRes.data ?? []) as StrategyRow[]
  const expenses = (expensesRes.data ?? []) as ExpenseRow[]

  // Accounts switched off in the mapping — NinjaTrader's Sim101 among them —
  // are dropped from every figure here. They stay visible and reactivatable in
  // /panel/trading/cuentas.
  const allTrades = excludeInactive((tradesRes.data ?? []) as TradeRow[], accountMap)
  const positions = excludeInactive((positionsRes.data ?? []) as PositionRow[], accountMap)
  const equity = excludeInactive((equityRes.data ?? []) as EquityRow[], accountMap)
  const allNtAccounts = (ntAccountsRes.data ?? []) as NtAccountRow[]
  const ntAccounts = allNtAccounts.filter((a) => !isExcluded(a.name, accountMap))
  const excludedCount = allNtAccounts.length - ntAccounts.length

  const periodTrades = from
    ? allTrades.filter((t) => new Date(t.exit_at) >= from)
    : allTrades

  const periodCharges = accrueExpenses(expenses, from, now)
  const allCharges = accrueExpenses(expenses, null, now)

  const summary = businessSummary({ periodTrades, periodCharges, allTrades, allCharges })

  // Daily buckets read well up to a few months; beyond that the chart is
  // unreadable, so a full history is grouped by month.
  const granularity = period === 'all' ? 'month' : 'day'
  const buckets = aggregateByPeriod(periodTrades, granularity)
  const curve = cumulative(buckets)

  const byStrategy = strategyBreakdown(periodTrades, accountMap, strategies, periodCharges)
  const byAccount = accountBreakdown(periodTrades, accountMap, strategies, periodCharges)

  // Total equity per day across every account, for the capital curve.
  const equityByDay = new Map<string, number>()
  for (const e of equity) {
    equityByDay.set(e.day, (equityByDay.get(e.day) ?? 0) + (e.equity ?? 0))
  }
  const equityCurve = [...equityByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ label: day.slice(5), value }))

  const burn = monthlyBurn(expenses, now)
  const unassigned = ntAccounts.filter(
    (a) => !accountMap.some((m) => m.account === a.name && m.strategy_id)
  ).length

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trading</h1>
          <p className="text-slate-400 mt-2">
            Estado financiero del negocio. Las operaciones llegan de NinjaTrader; los
            costos los administras en{' '}
            <Link href="/panel/trading/gastos" className="text-cyan-400 hover:underline">
              Gastos
            </Link>
            .
          </p>
        </div>

        <nav className="flex gap-1 rounded-full border border-white/10 bg-slate-900/50 p-1">
          {(['day', 'week', 'month', 'all'] as const).map((p) => (
            <Link
              key={p}
              href={`/panel/trading?periodo=${p}`}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                p === period
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </nav>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      {unassigned > 0 && (
        <p className="text-sm text-amber-400 bg-amber-950/40 border border-amber-500/30 rounded-lg px-4 py-3">
          {unassigned === 1
            ? 'Hay 1 cuenta sin estrategia asignada.'
            : `Hay ${unassigned} cuentas sin estrategia asignada.`}{' '}
          <Link href="/panel/trading/cuentas" className="underline">
            Asignarlas
          </Link>{' '}
          para que su resultado se atribuya al bot correcto.
        </p>
      )}

      {excludedCount > 0 && (
        <p className="text-xs text-slate-500">
          {excludedCount === 1
            ? '1 cuenta marcada como inactiva queda fuera de estas cifras.'
            : `${excludedCount} cuentas marcadas como inactivas quedan fuera de estas cifras.`}
        </p>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label={`Utilidad neta · ${PERIOD_LABELS[period].toLowerCase()}`}
          value={signedMoney(summary.netProfit)}
          valueClass={pnlClass(summary.netProfit)}
          hint={`${money(summary.operatingPnl)} operativo − ${money(summary.expenses)} gastos`}
        />
        <Stat
          label="Resultado operativo"
          value={signedMoney(summary.operatingPnl)}
          valueClass={pnlClass(summary.operatingPnl)}
          hint={`${summary.trades} ${summary.trades === 1 ? 'operación' : 'operaciones'}`}
        />
        <Stat
          label="Invertido a la fecha"
          value={money(summary.totalInvested)}
          hint={`${money(burn)}/mes recurrente`}
        />
        <Stat
          label="Retorno sobre inversión"
          value={percent(summary.roi)}
          valueClass={pnlClass(summary.roi)}
          hint={
            summary.toBreakEven > 0
              ? `Faltan ${money(summary.toBreakEven)} para recuperar`
              : 'Inversión recuperada'
          }
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Ganancia bruta"
          value={money(summary.grossProfit)}
          valueClass="text-emerald-400"
        />
        <Stat
          label="Pérdida bruta"
          value={money(summary.grossLoss)}
          valueClass="text-red-400"
        />
        <Stat
          label="Operaciones ganadoras"
          value={percent(summary.winRate)}
          hint="Sobre operaciones con resultado"
        />
        <Stat
          label="Factor de beneficio"
          value={ratio(summary.profitFactor)}
          hint="Ganancia bruta ÷ pérdida bruta"
        />
      </section>

      {/* ── Curvas ───────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="font-bold mb-1">Resultado acumulado</h2>
          <p className="text-xs text-slate-500 mb-4">
            Suma corrida del P&amp;L en el periodo.
          </p>
          <LineChart
            data={curve.map((b) => ({ label: b.label, value: b.pnl }))}
            reference={0}
            emptyMessage="Todavía no hay operaciones cerradas."
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="font-bold mb-1">Capital total</h2>
          <p className="text-xs text-slate-500 mb-4">
            Saldo sumado de todas las cuentas, un punto por día.
          </p>
          <LineChart
            data={equityCurve}
            emptyMessage="El registro diario empieza esta noche."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="font-bold mb-1">
          Resultado por {granularity === 'month' ? 'mes' : 'día'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Verde para take profit neto, rojo para stop loss neto.
        </p>
        <BarChart
          data={buckets.map((b) => ({ label: b.label, value: b.pnl }))}
          emptyMessage="Todavía no hay operaciones cerradas."
        />
      </section>

      {/* ── Por estrategia ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Aporte por estrategia</h2>
          <p className="text-sm text-slate-400 mt-1">
            Qué bot o portafolio está construyendo el resultado, ya descontados los costos
            de sus cuentas.
          </p>
        </div>

        {byStrategy.length === 0 ? (
          <p className="text-sm text-slate-400">
            Todavía no hay estrategias con cuentas asignadas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Estrategia</th>
                  <th className="px-4 py-3 font-medium">Cuentas</th>
                  <th className="px-4 py-3 font-medium text-right">Ops.</th>
                  <th className="px-4 py-3 font-medium text-right">Aciertos</th>
                  <th className="px-4 py-3 font-medium text-right">Factor</th>
                  <th className="px-4 py-3 font-medium text-right">Operativo</th>
                  <th className="px-4 py-3 font-medium text-right">Costos</th>
                  <th className="px-4 py-3 font-medium text-right">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {byStrategy.map((s) => (
                  <tr key={s.strategyId ?? 'unassigned'} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {s.accounts.length > 0 ? s.accounts.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{s.trades}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {percent(s.winRate, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {ratio(s.profitFactor)}
                    </td>
                    <td className={`px-4 py-3 text-right ${pnlClass(s.pnl)}`}>
                      {signedMoney(s.pnl)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {s.expenses > 0 ? `−${money(s.expenses)}` : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${pnlClass(s.net)}`}>
                      {signedMoney(s.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Cuentas ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-bold">Cuentas</h2>
          <Link
            href="/panel/trading/cuentas"
            className="text-sm text-cyan-400 hover:underline"
          >
            Asignar estrategias
          </Link>
        </div>

        {ntAccounts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <p className="text-slate-300 font-medium mb-2">
              Todavía no llega ningún dato de NinjaTrader.
            </p>
            <p className="text-slate-400 text-sm">
              El AddOn NexusReporter reporta las cuentas en cuanto NT8 se conecta al
              broker.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ntAccounts.map((a) => {
                const m = accountMap.find((x) => x.account === a.name)
                const strat = m?.strategy_id
                  ? strategies.find((s) => s.id === m.strategy_id)?.name
                  : null
                return (
                  <div
                    key={a.name}
                    className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-bold text-white">{m?.label ?? a.name}</h3>
                      <span className="text-xs text-slate-500">
                        {m?.prop_firm ?? a.connection ?? '—'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 font-mono">{a.name}</p>

                    <p className="text-2xl font-bold text-white">
                      {money(a.cash_value, a.denomination === 'UsDollar' ? 'USD' : undefined)}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">Capital actual</p>

                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-400">P&amp;L realizado</dt>
                        <dd className={pnlClass(a.realized_pnl)}>
                          {signedMoney(a.realized_pnl)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">P&amp;L abierto</dt>
                        <dd className={pnlClass(a.unrealized_pnl)}>
                          {signedMoney(a.unrealized_pnl)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Estrategia</dt>
                        <dd className={strat ? 'text-cyan-400' : 'text-amber-400'}>
                          {strat ?? 'Sin asignar'}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-4 text-xs text-slate-500">
                      Actualizado {when(a.reported_at)}
                    </p>
                  </div>
                )
              })}
            </div>

            {byAccount.some((a) => a.trades > 0) && (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cuenta</th>
                      <th className="px-4 py-3 font-medium">Estrategia</th>
                      <th className="px-4 py-3 font-medium text-right">Ops.</th>
                      <th className="px-4 py-3 font-medium text-right">Mejor</th>
                      <th className="px-4 py-3 font-medium text-right">Peor</th>
                      <th className="px-4 py-3 font-medium text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {byAccount.map((a) => (
                      <tr key={a.account} className="hover:bg-slate-900/50">
                        <td className="px-4 py-3 text-white">{a.label ?? a.account}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {a.strategyName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">{a.trades}</td>
                        <td className={`px-4 py-3 text-right ${pnlClass(a.bestTrade)}`}>
                          {signedMoney(a.bestTrade)}
                        </td>
                        <td className={`px-4 py-3 text-right ${pnlClass(a.worstTrade)}`}>
                          {signedMoney(a.worstTrade)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${pnlClass(a.net)}`}>
                          {signedMoney(a.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Posiciones abiertas ──────────────────────────────────────────── */}
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
    </div>
  )
}
