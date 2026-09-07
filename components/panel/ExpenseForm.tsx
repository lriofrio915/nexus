'use client'

import { startTransition, useActionState, useState } from 'react'
import { createExpense, updateExpense } from '@/app/panel/trading/gastos/actions'
import { IDLE, type SaveState } from '@/lib/form-state'

export const CATEGORIES = ['infraestructura', 'cuentas', 'datos', 'software', 'otros'] as const

export interface AccountOption {
  account: string
  label: string | null
  /** False once NinjaTrader stops reporting an account the panel still knows. */
  reported: boolean
}

export interface ExpenseValues {
  concept: string
  category: string
  amount: string
  kind: 'one_time' | 'recurring'
  recurrence: 'monthly' | 'yearly'
  starts_on: string
  ends_on: string
  account: string
  notes: string
}

const EMPTY: ExpenseValues = {
  concept: '',
  category: 'cuentas',
  amount: '',
  kind: 'one_time',
  recurrence: 'monthly',
  starts_on: '',
  ends_on: '',
  account: '',
  notes: '',
}

const inputClass =
  'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

function accountLabel(a: AccountOption) {
  const base = a.label ? `${a.label} · ${a.account}` : a.account
  return a.reported ? base : `${base} (NinjaTrader ya no la reporta)`
}

/**
 * The add and edit forms for an expense, which take the same fields.
 *
 * Fields are controlled and the action is dispatched from onSubmit rather than
 * from `<form action>`, because React resets a form once the Server Action
 * passed to `action` resolves. On an edit row that reset wiped the DOM behind
 * the controlled state and made a successful save look like a failed one. The
 * add form still clears itself, but on its own terms: only after the expense
 * was actually created.
 */
export default function ExpenseForm({
  id,
  initial,
  accounts,
}: {
  /** Absent when adding a new expense. */
  id?: string
  initial?: ExpenseValues
  accounts: AccountOption[]
}) {
  const editing = Boolean(id)
  const base = initial ?? EMPTY

  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    editing ? updateExpense : createExpense,
    IDLE
  )
  const [v, setV] = useState(base)

  // Re-sync an edit row when the server sends different saved values, and clear
  // the add form once its expense has been created.
  const signature = editing ? JSON.stringify(base) : `new:${state.ok}:${state.message}`
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    if (editing) setV(base)
    else if (state.ok) setV(EMPTY)
  }

  const set = <K extends keyof ExpenseValues>(k: K, value: ExpenseValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => formAction(data))
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {id && <input type="hidden" name="id" value={id} />}

      <label className="block sm:col-span-2">
        <span className="text-xs text-slate-400 block mb-1">Concepto</span>
        <input
          name="concept"
          required
          value={v.concept}
          onChange={(e) => set('concept', e.target.value)}
          placeholder="VPS, pase directo…"
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
          required
          value={v.amount}
          onChange={(e) => set('amount', e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Categoría</span>
        <select
          name="category"
          value={v.category}
          onChange={(e) => set('category', e.target.value)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Tipo</span>
        <select
          name="kind"
          value={v.kind}
          onChange={(e) => set('kind', e.target.value as ExpenseValues['kind'])}
          className={inputClass}
        >
          <option value="one_time">Pago único</option>
          <option value="recurring">Recurrente</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Periodicidad</span>
        <select
          name="recurrence"
          value={v.recurrence}
          onChange={(e) => set('recurrence', e.target.value as ExpenseValues['recurrence'])}
          disabled={v.kind !== 'recurring'}
          className={`${inputClass} disabled:opacity-40`}
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
          required
          value={v.starts_on}
          onChange={(e) => set('starts_on', e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Hasta (opcional)</span>
        <input
          type="date"
          name="ends_on"
          value={v.ends_on}
          onChange={(e) => set('ends_on', e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="text-xs text-slate-400 block mb-1">Cuenta (opcional)</span>
        <select
          name="account"
          value={v.account}
          onChange={(e) => set('account', e.target.value)}
          className={inputClass}
        >
          <option value="">Gasto general del negocio</option>
          {accounts.map((a) => (
            <option key={a.account} value={a.account}>
              {accountLabel(a)}
            </option>
          ))}
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className="text-xs text-slate-400 block mb-1">Notas</span>
        <input
          name="notes"
          value={v.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={
            editing
              ? 'px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50'
              : 'px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white disabled:opacity-50'
          }
        >
          {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar gasto'}
        </button>
        {state.message && (
          <span
            role="status"
            className={`text-xs ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}
