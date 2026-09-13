'use client'

import { startTransition, useActionState, useState } from 'react'
import { linkAccountClient } from '@/app/panel/trading/clientes/actions'
import { IDLE } from '@/lib/form-state'

const inputClass =
  'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

export interface AccountClientLinkProps {
  account: string
  label: string | null
  clientId: string | null
  commissionPct: number | null
  clients: { id: string; full_name: string }[]
}

/** One row: assign an account to a client and set its withdrawal commission,
 * or clear both to hand the account back to being Luis's own capital. */
export default function AccountClientLink(props: AccountClientLinkProps) {
  const [state, formAction, pending] = useActionState(linkAccountClient, IDLE)
  const [clientId, setClientId] = useState(props.clientId ?? '')
  const [pct, setPct] = useState(props.commissionPct?.toString() ?? '')

  const signature = `${props.clientId}:${props.commissionPct}`
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setClientId(props.clientId ?? '')
    setPct(props.commissionPct?.toString() ?? '')
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => formAction(data))
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end"
    >
      <input type="hidden" name="account" value={props.account} />

      <div>
        <p className="text-xs text-slate-500 mb-1">Cuenta</p>
        <p className="text-sm font-mono text-white">{props.label ?? props.account}</p>
      </div>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Cliente</span>
        <select
          name="client_id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={inputClass}
        >
          <option value="">Capital propio (sin cliente)</option>
          {props.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Comisión por retiro (%)</span>
        <input
          type="number"
          name="withdrawal_commission_pct"
          step="0.01"
          min="0"
          max="100"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          disabled={!clientId}
          placeholder="20"
          className={`${inputClass} w-28 disabled:opacity-40`}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
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
