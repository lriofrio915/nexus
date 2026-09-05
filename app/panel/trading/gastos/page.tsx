import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import {
  accrueExpenses,
  money,
  monthlyBurn,
  sumMoney,
  type ExpenseRow,
} from '@/lib/trading-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Gastos', robots: { index: false, follow: false } }

const CATEGORIES = ['infraestructura', 'cuentas', 'datos', 'software', 'otros'] as const

interface AccountOption {
  account: string
  label: string | null
}

/** Shared by the create and update actions: both write the same shape. */
function readExpense(formData: FormData) {
  const kind = formData.get('kind') === 'recurring' ? 'recurring' : 'one_time'
  const amount = Number(formData.get('amount'))

  return {
    concept: String(formData.get('concept') ?? '').trim(),
    category: String(formData.get('category') ?? 'otros'),
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    kind,
    // The database rejects a recurring expense without a period and a one-time
    // one with a period, so the mismatch is normalised here rather than
    // surfacing as a constraint error.
    recurrence: kind === 'recurring' ? String(formData.get('recurrence') || 'monthly') : null,
    starts_on: String(formData.get('starts_on') ?? '').trim(),
    ends_on: String(formData.get('ends_on') ?? '').trim() || null,
    account: String(formData.get('account') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  }
}

async function createExpense(formData: FormData) {
  'use server'

  const row = readExpense(formData)
  if (!row.concept || !row.starts_on) return

  const { error } = await supabaseAdmin().from('nexus_biz_expenses').insert(row)
  if (error) {
    console.error('[panel/gastos] create failed:', error.message)
    throw new Error(`No se pudo crear el gasto: ${error.message}`)
  }

  revalidatePath('/panel/trading/gastos')
  revalidatePath('/panel/trading')
}

async function updateExpense(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const row = readExpense(formData)
  if (!row.concept || !row.starts_on) return

  const { error } = await supabaseAdmin()
    .from('nexus_biz_expenses')
    .update(row)
    .eq('id', id)

  if (error) {
    console.error('[panel/gastos] update failed:', error.message)
    throw new Error(`No se pudo actualizar el gasto: ${error.message}`)
  }

  revalidatePath('/panel/trading/gastos')
  revalidatePath('/panel/trading')
}

async function deleteExpense(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const { error } = await supabaseAdmin().from('nexus_biz_expenses').delete().eq('id', id)
  if (error) {
    console.error('[panel/gastos] delete failed:', error.message)
    throw new Error(`No se pudo eliminar el gasto: ${error.message}`)
  }

  revalidatePath('/panel/trading/gastos')
  revalidatePath('/panel/trading')
}

export default async function GastosPage() {
  const db = supabaseAdmin()
  const [expensesRes, accountsRes] = await Promise.all([
    db
      .from('nexus_biz_expenses')
      .select('*')
      .order('kind')
      .order('starts_on', { ascending: true }),
    db.from('nexus_biz_accounts').select('account, label').order('account'),
  ])

  const error = expensesRes.error ?? accountsRes.error
  const expenses = (expensesRes.data ?? []) as (ExpenseRow & { notes: string | null })[]
  const accounts = (accountsRes.data ?? []) as AccountOption[]

  const now = new Date()
  const accrued = accrueExpenses(expenses, null, now)
  const totalAccrued = sumMoney(accrued.map((c) => c.amount))
  const burn = monthlyBurn(expenses, now)
  const oneTimeTotal = sumMoney(
    expenses.filter((e) => e.kind === 'one_time').map((e) => e.amount)
  )

  const inputClass =
    'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gastos</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Todo lo que cuesta sostener el negocio. Los pagos únicos se cargan en su fecha;
          los recurrentes se devengan cada periodo desde que empiezan.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-5">
        <h2 className="font-bold mb-4">Agregar gasto</h2>
        <form action={createExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block md:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Concepto</span>
            <input name="concept" required placeholder="VPS, pase directo…" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Monto (USD)</span>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              required
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Categoría</span>
            <select name="category" className={inputClass} defaultValue="cuentas">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Tipo</span>
            <select name="kind" className={inputClass} defaultValue="one_time">
              <option value="one_time">Pago único</option>
              <option value="recurring">Recurrente</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Periodicidad</span>
            <select name="recurrence" className={inputClass} defaultValue="monthly">
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Desde</span>
            <input type="date" name="starts_on" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 block mb-1">Hasta (opcional)</span>
            <input type="date" name="ends_on" className={inputClass} />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Cuenta (opcional)</span>
            <select name="account" className={inputClass} defaultValue="">
              <option value="">Gasto general del negocio</option>
              {accounts.map((a) => (
                <option key={a.account} value={a.account}>
                  {a.label ? `${a.label} · ${a.account}` : a.account}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs text-slate-400 block mb-1">Notas</span>
            <input name="notes" className={inputClass} />
          </label>

          <div className="md:col-span-4">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white"
            >
              Agregar gasto
            </button>
          </div>
        </form>
      </section>

      {/* ── Listado editable ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Gastos registrados</h2>

        {expenses.length === 0 ? (
          <p className="text-slate-400 text-sm">Todavía no hay gastos registrados.</p>
        ) : (
          expenses.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
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

              <form action={updateExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input type="hidden" name="id" value={e.id} />

                <label className="block md:col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">Concepto</span>
                  <input
                    name="concept"
                    defaultValue={e.concept}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Monto (USD)</span>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    defaultValue={e.amount}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Categoría</span>
                  <select name="category" defaultValue={e.category} className={inputClass}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Tipo</span>
                  <select name="kind" defaultValue={e.kind} className={inputClass}>
                    <option value="one_time">Pago único</option>
                    <option value="recurring">Recurrente</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Periodicidad</span>
                  <select
                    name="recurrence"
                    defaultValue={e.recurrence ?? 'monthly'}
                    className={inputClass}
                  >
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Desde</span>
                  <input
                    type="date"
                    name="starts_on"
                    defaultValue={e.starts_on}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Hasta</span>
                  <input
                    type="date"
                    name="ends_on"
                    defaultValue={e.ends_on ?? ''}
                    className={inputClass}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">Cuenta</span>
                  <select name="account" defaultValue={e.account ?? ''} className={inputClass}>
                    <option value="">Gasto general del negocio</option>
                    {accounts.map((a) => (
                      <option key={a.account} value={a.account}>
                        {a.label ? `${a.label} · ${a.account}` : a.account}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">Notas</span>
                  <input name="notes" defaultValue={e.notes ?? ''} className={inputClass} />
                </label>

                <div className="md:col-span-4">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5"
                  >
                    Guardar cambios
                  </button>
                </div>
              </form>

              <form action={deleteExpense} className="mt-3">
                <input type="hidden" name="id" value={e.id} />
                <button
                  type="submit"
                  className="text-xs text-red-400 hover:text-red-300 hover:underline"
                >
                  Eliminar este gasto
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
