'use client'

import { startTransition, useActionState } from 'react'
import { toggleSettled } from '@/app/panel/trading/clientes/actions'
import { IDLE } from '@/lib/form-state'

/** Flips one withdrawal's commission between pending and collected. */
export default function SettleToggleButton({ id, settled }: { id: string; settled: boolean }) {
  const [, formAction, pending] = useActionState(toggleSettled, IDLE)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => formAction(data))
  }

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="settled" value={(!settled).toString()} />
      <button
        type="submit"
        disabled={pending}
        className={`text-xs px-3 py-1 rounded-full border disabled:opacity-50 ${
          settled
            ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
            : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
        }`}
      >
        {settled ? 'Cobrada' : 'Pendiente'}
      </button>
    </form>
  )
}
