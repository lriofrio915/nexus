'use client'

import { startTransition, useActionState, useState } from 'react'
import { saveAccount } from '@/app/panel/trading/cuentas/actions'
import { IDLE } from '@/lib/form-state'
import { money } from '@/lib/trading-metrics'

export interface AccountCardProps {
  account: string
  label: string | null
  propFirm: string | null
  /** An account can run more than one strategy at once (see 0009). */
  strategyIds: string[]
  active: boolean
  startedOn: string | null
  /** NinjaTrader's own view of the account, absent until it first reports. */
  nt: { connection: string | null; cash_value: number | null } | null
  strategies: { id: string; name: string }[]
}

const inputClass =
  'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

/**
 * One editable account row.
 *
 * Every field is controlled and the action is dispatched from onSubmit rather
 * than from `<form action>`. React resets a form once the Server Action passed
 * to `action` resolves, which reset the DOM behind the controlled state and
 * snapped the strategy back to "Sin asignar" on a perfectly good save. Going
 * through onSubmit skips that reset; the props-changed check below is what lets
 * a freshly revalidated server value take over instead.
 */
export default function AccountCard(props: AccountCardProps) {
  const [state, formAction, pending] = useActionState(saveAccount, IDLE)

  const [label, setLabel] = useState(props.label ?? '')
  const [propFirm, setPropFirm] = useState(props.propFirm ?? props.nt?.connection ?? '')
  const [strategyIds, setStrategyIds] = useState<string[]>(props.strategyIds)
  const [startedOn, setStartedOn] = useState(props.startedOn ?? '')
  const [active, setActive] = useState(props.active)

  // Re-sync when the server sends different saved values for this account.
  const signature = JSON.stringify([
    props.label,
    props.propFirm,
    [...props.strategyIds].sort(),
    props.startedOn,
    props.active,
  ])
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setLabel(props.label ?? '')
    setPropFirm(props.propFirm ?? props.nt?.connection ?? '')
    setStrategyIds(props.strategyIds)
    setStartedOn(props.startedOn ?? '')
    setActive(props.active)
  }

  function toggleStrategy(id: string, checked: boolean) {
    setStrategyIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  const inactive = !active
  const assigned = strategyIds.length > 0

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => formAction(data))
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`rounded-2xl border p-5 bg-slate-900/50 ${
        inactive
          ? 'border-white/5 opacity-60'
          : assigned
            ? 'border-white/10'
            : 'border-amber-500/40'
      }`}
    >
      <input type="hidden" name="account" value={props.account} />

      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <p className="font-mono text-sm text-white">
          {props.account}
          {inactive && (
            <span className="ml-2 font-sans text-xs text-slate-500 not-italic">
              · fuera de las cifras
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {props.nt
            ? `${props.nt.connection ?? 'sin conexión'} · ${money(props.nt.cash_value)}`
            : 'Sin datos de NinjaTrader todavía'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-xs text-slate-400 block mb-1">Etiqueta</span>
          <input
            name="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Flex, Delta 1, Rapid Daily…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-400 block mb-1">Prop firm</span>
          <input
            name="prop_firm"
            value={propFirm}
            onChange={(e) => setPropFirm(e.target.value)}
            placeholder="FundedNext, PJ Capital…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-400 block mb-1">Inicio</span>
          <input
            type="date"
            name="started_on"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="text-xs text-slate-400 block mb-2">
          Estrategias — puede ser más de una
        </span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {props.strategies.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="strategy_ids"
                value={s.id}
                checked={strategyIds.includes(s.id)}
                onChange={(e) => toggleStrategy(s.id, e.target.checked)}
                className="accent-cyan-500"
              />
              {s.name}
            </label>
          ))}
          {props.strategies.length === 0 && (
            <span className="text-sm text-slate-500">No hay estrategias creadas todavía.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            name="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-cyan-500"
          />
          Cuenta activa
        </label>

        <div className="flex items-center gap-3">
          {state.message && (
            <span
              role="status"
              className={`text-xs ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {state.message}
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}
