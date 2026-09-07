'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { SaveState } from '@/lib/form-state'

/**
 * Saves one account mapping. The account name is the primary key and comes from
 * NinjaTrader, so this upserts rather than inserts: editing an existing row and
 * claiming a newly detected account are the same operation.
 *
 * The result is returned rather than thrown so the form can report it inline;
 * a thrown error would replace the whole page with the error boundary and give
 * the user no idea which field was at fault.
 */
export async function saveAccount(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const account = String(formData.get('account') ?? '').trim()
  if (!account) return { ok: false, message: 'Falta el nombre de la cuenta.' }

  const strategyId = String(formData.get('strategy_id') ?? '')
  const startedOn = String(formData.get('started_on') ?? '').trim()

  const { error } = await supabaseAdmin()
    .from('nexus_biz_accounts')
    .upsert(
      {
        account,
        label: String(formData.get('label') ?? '').trim() || null,
        prop_firm: String(formData.get('prop_firm') ?? '').trim() || null,
        strategy_id: strategyId || null,
        active: formData.get('active') === 'on',
        started_on: startedOn || null,
      },
      { onConflict: 'account' }
    )

  if (error) {
    console.error('[panel/cuentas] save failed:', error.message)
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  revalidatePath('/panel/trading/cuentas')
  revalidatePath('/panel/trading')
  revalidatePath('/panel/trading/gastos')

  return { ok: true, message: `Guardado · ${account}` }
}
