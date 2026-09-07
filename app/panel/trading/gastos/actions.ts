'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { SaveState } from '@/lib/form-state'

function refresh() {
  revalidatePath('/panel/trading/gastos')
  revalidatePath('/panel/trading')
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

export async function createExpense(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const row = readExpense(formData)
  if (!row.concept) return { ok: false, message: 'Falta el concepto.' }
  if (!row.starts_on) return { ok: false, message: 'Falta la fecha de inicio.' }

  const { error } = await supabaseAdmin().from('nexus_biz_expenses').insert(row)
  if (error) {
    console.error('[panel/gastos] create failed:', error.message)
    return { ok: false, message: `No se pudo crear: ${error.message}` }
  }

  refresh()
  return { ok: true, message: `Gasto registrado · ${row.concept}` }
}

export async function updateExpense(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Falta el identificador del gasto.' }

  const row = readExpense(formData)
  if (!row.concept) return { ok: false, message: 'Falta el concepto.' }
  if (!row.starts_on) return { ok: false, message: 'Falta la fecha de inicio.' }

  const { error } = await supabaseAdmin()
    .from('nexus_biz_expenses')
    .update(row)
    .eq('id', id)

  if (error) {
    console.error('[panel/gastos] update failed:', error.message)
    return { ok: false, message: `No se pudo actualizar: ${error.message}` }
  }

  refresh()
  return { ok: true, message: 'Cambios guardados' }
}

export async function deleteExpense(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Falta el identificador del gasto.' }

  const { error } = await supabaseAdmin().from('nexus_biz_expenses').delete().eq('id', id)
  if (error) {
    console.error('[panel/gastos] delete failed:', error.message)
    return { ok: false, message: `No se pudo eliminar: ${error.message}` }
  }

  refresh()
  return { ok: true, message: 'Gasto eliminado' }
}
