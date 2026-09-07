'use client'

import { useActionState } from 'react'
import { deleteExpense } from '@/app/panel/trading/gastos/actions'
import { IDLE } from '@/lib/form-state'

export default function DeleteExpenseButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteExpense, IDLE)

  return (
    <form action={formAction} className="mt-3 flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
      >
        {pending ? 'Eliminando…' : 'Eliminar este gasto'}
      </button>
      {!state.ok && state.message && (
        <span role="status" className="text-xs text-red-400">
          {state.message}
        </span>
      )}
    </form>
  )
}
