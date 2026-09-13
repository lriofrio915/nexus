'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { SaveState } from '@/lib/form-state'

/**
 * Saves one account mapping. The account name is the primary key and comes from
 * NinjaTrader, so this upserts rather than inserts: editing an existing row and
 * claiming a newly detected account are the same operation.
 *
 * Strategies are a separate many-to-many table (see 0009): an account can run
 * more than one at once, like Stéfanny Medrano's account running both
 * "Portafolio Cuantitativo" and "Inverbots". This replaces the account's whole
 * set of links with whatever the form submitted, rather than trying to diff --
 * the form always sends the complete checked set, so a full replace can never
 * drift from what is on screen.
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

  const strategyIds = formData.getAll('strategy_ids').map(String).filter(Boolean)
  const startedOn = String(formData.get('started_on') ?? '').trim()

  const db = supabaseAdmin()

  const { error } = await db.from('nexus_biz_accounts').upsert(
    {
      account,
      label: String(formData.get('label') ?? '').trim() || null,
      prop_firm: String(formData.get('prop_firm') ?? '').trim() || null,
      active: formData.get('active') === 'on',
      started_on: startedOn || null,
    },
    { onConflict: 'account' }
  )

  if (error) {
    console.error('[panel/cuentas] save failed:', error.message)
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  const { error: deleteError } = await db
    .from('nexus_biz_account_strategies')
    .delete()
    .eq('account', account)

  if (deleteError) {
    console.error('[panel/cuentas] clearing strategy links failed:', deleteError.message)
    return { ok: false, message: `No se pudieron guardar las estrategias: ${deleteError.message}` }
  }

  if (strategyIds.length > 0) {
    const { error: linkError } = await db
      .from('nexus_biz_account_strategies')
      .insert(strategyIds.map((strategy_id) => ({ account, strategy_id })))

    if (linkError) {
      console.error('[panel/cuentas] linking strategies failed:', linkError.message)
      return { ok: false, message: `No se pudieron guardar las estrategias: ${linkError.message}` }
    }
  }

  revalidatePath('/panel/trading/cuentas')
  revalidatePath('/panel/trading')
  revalidatePath('/panel/trading/gastos')

  return { ok: true, message: `Guardado · ${account}` }
}
