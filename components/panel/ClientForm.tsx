'use client'

import { startTransition, useActionState, useState } from 'react'
import { saveClient } from '@/app/panel/trading/clientes/actions'
import { IDLE } from '@/lib/form-state'

const inputClass =
  'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'

export interface ClientFormValues {
  full_name: string
  phone: string
  email: string
  notes: string
}

const EMPTY: ClientFormValues = { full_name: '', phone: '', email: '', notes: '' }

/** Add-client form. Editing an existing client's contact info happens in the
 * clients table directly in Supabase for now -- rare enough that a full edit
 * UI is not worth it yet. */
export default function ClientForm() {
  const [state, formAction, pending] = useActionState(saveClient, IDLE)
  const [v, setV] = useState(EMPTY)

  const signature = `${state.ok}:${state.message}`
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    if (state.ok) setV(EMPTY)
  }

  const set = <K extends keyof ClientFormValues>(k: K, value: ClientFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => formAction(data))
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <label className="block sm:col-span-2">
        <span className="text-xs text-slate-400 block mb-1">Nombre completo</span>
        <input
          name="full_name"
          required
          value={v.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="Nombre del cliente"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Teléfono</span>
        <input
          name="phone"
          value={v.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+593…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 block mb-1">Email</span>
        <input
          type="email"
          name="email"
          value={v.email}
          onChange={(e) => set('email', e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block sm:col-span-2 lg:col-span-4">
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
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Agregar cliente'}
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
