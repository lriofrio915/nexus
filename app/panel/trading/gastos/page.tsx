import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import ExpenseForm, {
  type AccountOption,
  type ExpenseValues,
} from '@/components/panel/ExpenseForm'
import DeleteExpenseButton from '@/components/panel/DeleteExpenseButton'
import {
  accrueExpenses,
  excludeInactiveCharges,
  money,
  monthlyBurn,
  sumMoney,
  type AccountMapRow,
  type ExpenseRow,
} from '@/lib/trading-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Gastos', robots: { index: false, follow: false } }

export default async function GastosPage() {
  const db = supabaseAdmin()
  const [expensesRes, accountsRes, ntRes] = await Promise.all([
    db
      .from('nexus_biz_expenses')
      .select('*')
      .order('kind')
      .order('starts_on', { ascending: true }),
    db
      .from('nexus_biz_accounts')
      .select('account, label, prop_firm, strategy_id, active')
      .order('account'),
    db.from('nexus_nt_accounts').select('name').order('name'),
  ])

  const error = expensesRes.error ?? accountsRes.error ?? ntRes.error
  const expenses = (expensesRes.data ?? []) as (ExpenseRow & { notes: string | null })[]
  const mapped = (accountsRes.data ?? []) as AccountMapRow[]
  const reported = (ntRes.data ?? []) as { name: string }[]

  // NinjaTrader reports accounts the mapping has never been told about, and the
  // mapping keeps accounts NinjaTrader has stopped reporting. A past expense has
  // to stay chargeable to either, so the picker is the union of both sides
  // rather than the mapping alone.
  const labels = new Map(mapped.map((m) => [m.account, m.label]))
  const reportedNames = new Set(reported.map((r) => r.name))
  const accounts: AccountOption[] = [
    ...new Set([...reportedNames, ...labels.keys()]),
  ]
    .sort()
    .map((account) => ({
      account,
      label: labels.get(account) ?? null,
      reported: reportedNames.has(account),
    }))

  // The list below shows every expense so any of them can still be edited, but
  // the totals count only what an active account is costing. An expense charged
  // to an account switched off in /panel/trading/cuentas is out of the figures,
  // exactly like that account's trades.
  const inactive = new Set(mapped.filter((m) => !m.active).map((m) => m.account))
  const counted = excludeInactiveCharges(expenses, mapped)

  const now = new Date()
  const accrued = accrueExpenses(counted, null, now)
  const totalAccrued = sumMoney(accrued.map((c) => c.amount))
  const burn = monthlyBurn(counted, now)
  const oneTimeTotal = sumMoney(
    counted.filter((e) => e.kind === 'one_time').map((e) => e.amount)
  )
  const excludedTotal = sumMoney(
    expenses.filter((e) => e.account && inactive.has(e.account)).map((e) => e.amount)
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Gastos</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Todo lo que cuesta sostener el negocio. Los pagos únicos se cargan en su fecha;
          los recurrentes se devengan cada periodo desde que empiezan.
        </p>
        {excludedTotal > 0 && (
          <p className="text-slate-500 text-sm mt-2 max-w-2xl">
            Las cifras de arriba dejan fuera {money(excludedTotal)} cargado a cuentas
            inactivas. Vuelve a marcarlas activas en Cuentas para que cuenten.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat
          label="Invertido a la fecha"
          value={money(totalAccrued)}
          hint="Pagos únicos más recurrentes devengados"
        />
        <Stat label="Costo fijo mensual" value={money(burn)} hint="Lo que se repite cada mes" />
        <Stat
          label="Inversión inicial"
          value={money(oneTimeTotal)}
          hint="Pagos únicos, sin renovación"
        />
      </section>

      {/* ── Alta ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 sm:p-5">
        <h2 className="font-bold mb-4">Agregar gasto</h2>
        <ExpenseForm accounts={accounts} />
      </section>

      {/* ── Listado editable ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Gastos registrados</h2>

        {expenses.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay gastos registrados.</p>
        ) : (
          expenses.map((e) => {
            const isOut = Boolean(e.account && inactive.has(e.account))
            const initial: ExpenseValues = {
              concept: e.concept,
              category: e.category,
              amount: String(e.amount),
              kind: e.kind,
              recurrence: e.recurrence ?? 'monthly',
              starts_on: e.starts_on,
              ends_on: e.ends_on ?? '',
              account: e.account ?? '',
              notes: e.notes ?? '',
            }

            return (
              <div
                key={e.id}
                className={`rounded-2xl border bg-slate-900/50 p-4 sm:p-5 ${
                  isOut ? 'border-white/5 opacity-60' : 'border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <p className="font-bold text-white">
                    {e.concept}
                    {isOut && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        · cuenta inactiva, fuera de las cifras
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-400">
                    {money(e.amount)}
                    {e.kind === 'recurring' && (
                      <span className="text-cyan-400">
                        {' '}
                        · {e.recurrence === 'yearly' ? 'anual' : 'mensual'}
                      </span>
                    )}
                  </p>
                </div>

                <ExpenseForm id={e.id} initial={initial} accounts={accounts} />
                <DeleteExpenseButton id={e.id} />
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
