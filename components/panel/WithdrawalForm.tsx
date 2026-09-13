'use client'

import { startTransition, useActionState, useMemo, useState } from 'react'
import { logWithdrawal } from '@/app/panel/trading/clientes/actions'
import { IDLE } from '@/lib/form-state'

const inputClass =
  'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

export interface ClientAccountOption {
  account: string
  label: string | null
  clientId: string
  clientName: string
  commissionPct: number
}

const today = () => new Date().toISOString().slice(0, 10)

/** Logs a withdrawal against one client-linked account. The account picker
 * doubles as the client picker: an account only ever belongs to one client,
 * so picking the account already answers who it is for. */
export default function WithdrawalForm({ options }: { options: ClientAccountOption[] }) {
  const [state, formAction, pending] = useActionState(logWithdrawal, IDLE)
  const [account, setAccount] = useState(options[0]?.account ?? '')
  const [amount, setAmount] = useState('')
  const [withdrawnOn, setWithdrawnOn] = useState(today())
  const [note, setNote] = useState('')

  const signature = `${state.ok}:${state.message}`
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    if (state.ok) {
      setAmount('')
      setNote('')
      setWithdrawnOn(today())
    }
  }

  const selected = options.find((o) => o.account === account)
  const preview = useMemo(() => {
    const n = Number(amount)
    if (!selected || !amount || Number.isNaN(n) || n <= 0) return null
    return Math.round(n * (selected.commissionPct / 100) * 100) / 100
  }, [amount, selected])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => formAction(data))
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Vincula una cuenta a un cliente arriba antes de registrar retiros.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <input type="hidden" name="client_id" value={selected?.clientId ?? ''} />

      <label className="block sm:col-span-2">
        <span className="text-xs text-slate-400 block mb-1">Cuenta / cliente</span>
        <select
          name="account"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.account} value={o.account}>
              {(o.label ?? o.account)} · {o.clientName} · {o.commissionPct}%
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Monto retirado (USD)</span>
        <input
          type="number"
          name="amount"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Fecha</span>
        <input
          type="date"
          name="withdrawn_on"
          required
          value={withdrawnOn}
          onChange={(e) => setWithdrawnOn(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block sm:col-span-2 lg:col-span-3">
        <span className="text-xs text-slate-400 block mb-1">Nota (opcional)</span>
        <input
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex items-end">
        <p className="text-sm text-slate-400">
          Comisión a cobrar:{' '}
          <span className="text-cyan-400 font-semibold">
            {preview !== null ? `${preview.toFixed(2)} USD` : '—'}
          </span>
        </p>
      </div>

      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? 'Registrando…' : 'Registrar retiro'}
        </button>
        {state.message && (
          <span role="status" className={`text-xs ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}
