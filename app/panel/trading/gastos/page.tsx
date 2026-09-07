import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import ExpenseForm, {
  type AccountOption,
  type ExpenseValues,
} from '@/components/panel/ExpenseForm'
import DeleteExpenseButton from '@/components/panel/DeleteExpenseButton'
import {
  accrueExpenses,
  money,
  monthlyBurn,
  sumMoney,
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
    db.from('nexus_biz_accounts').select('account, label').order('account'),
    db.from('nexus_nt_accounts').select('name').order('name'),
  ])

  const error = expensesRes.error ?? accountsRes.error ?? ntRes.error
  const expenses = (expensesRes.data ?? []) as (ExpenseRow & { notes: string | null })[]
  const mapped = (accountsRes.data ?? []) as { account: string; label: string | null }[]
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

  const now = new Date()
  const accrued = accrueExpenses(expenses, null, now)
  const totalAccrued = sumMoney(accrued.map((c) => c.amount))
  const burn = monthlyBurn(expenses, now)
  const oneTimeTotal = sumMoney(
    expenses.filter((e) => e.kind === 'one_time').map((e) => e.amount)
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Gastos</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Todo lo que cuesta sostener el negocio. Los pagos únicos se cargan en su fecha;
          los recurrentes se devengan cada periodo desde que empiezan.
        </p>
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
                className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <p className="font-bold text-white">{e.concept}</p>
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
