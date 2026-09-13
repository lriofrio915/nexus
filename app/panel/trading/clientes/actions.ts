'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { SaveState } from '@/lib/form-state'

function revalidateAll() {
  revalidatePath('/panel/trading/clientes')
  revalidatePath('/panel/trading/cuentas')
  revalidatePath('/panel/trading')
}

/**
 * Creates or edits a client. Withdrawals reference the client by id, so
 * editing here never breaks past history the way renaming a text field would.
 */
export async function saveClient(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) return { ok: false, message: 'Falta el nombre del cliente.' }

  const id = String(formData.get('id') ?? '').trim()
  const row = {
    full_name: fullName,
    phone: String(formData.get('phone') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  }

  const db = supabaseAdmin()
  const { error } = id
    ? await db.from('nexus_biz_clients').update(row).eq('id', id)
    : await db.from('nexus_biz_clients').insert(row)

  if (error) {
    console.error('[panel/clientes] saveClient failed:', error.message)
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  revalidateAll()
  return { ok: true, message: `Guardado · ${fullName}` }
}

/**
 * Links (or unlinks) an account to a client and sets its withdrawal
 * commission. Clearing the client also clears the rate: a rate with no owner
 * is meaningless and would silently apply if the account were ever re-linked.
 */
export async function linkAccountClient(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const account = String(formData.get('account') ?? '').trim()
  if (!account) return { ok: false, message: 'Falta la cuenta.' }

  const clientId = String(formData.get('client_id') ?? '').trim()
  const pctRaw = String(formData.get('withdrawal_commission_pct') ?? '').trim()
  const pct = clientId && pctRaw ? Number(pctRaw) : null

  if (clientId && (pct === null || Number.isNaN(pct) || pct < 0 || pct > 100)) {
    return { ok: false, message: 'La comisión debe ser un número entre 0 y 100.' }
  }

  const { error } = await supabaseAdmin()
    .from('nexus_biz_accounts')
    .update({
      client_id: clientId || null,
      withdrawal_commission_pct: clientId ? pct : null,
    })
    .eq('account', account)

  if (error) {
    console.error('[panel/clientes] linkAccountClient failed:', error.message)
    return { ok: false, message: `No se pudo guardar: ${error.message}` }
  }

  revalidateAll()
  return { ok: true, message: clientId ? `Vinculada · ${account}` : `Desvinculada · ${account}` }
}

/**
 * Logs a client withdrawal. commission_pct and commission_amount are computed
 * here, once, from the account's current rate, and stored on the row instead
 * of being derived at read time -- exactly so a later rate change on the
 * account can never rewrite what was actually owed on this withdrawal.
 */
export async function logWithdrawal(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const account = String(formData.get('account') ?? '').trim()
  const clientId = String(formData.get('client_id') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const withdrawnOn = String(formData.get('withdrawn_on') ?? '').trim()

  if (!account || !clientId) return { ok: false, message: 'Falta la cuenta o el cliente.' }
  const amount = Number(amountRaw)
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    return { ok: false, message: 'El monto debe ser mayor a cero.' }
  }
  if (!withdrawnOn) return { ok: false, message: 'Falta la fecha del retiro.' }

  const db = supabaseAdmin()

  const { data: acct, error: acctError } = await db
    .from('nexus_biz_accounts')
    .select('withdrawal_commission_pct, client_id')
    .eq('account', account)
    .single()

  if (acctError || !acct) {
    return { ok: false, message: 'No se encontró la cuenta.' }
  }
  if (acct.client_id !== clientId) {
    return { ok: false, message: 'Esa cuenta no está vinculada a este cliente.' }
  }
  const pct = acct.withdrawal_commission_pct
  if (pct === null || pct === undefined) {
    return { ok: false, message: 'La cuenta no tiene una comisión configurada.' }
  }

  const commissionAmount = Math.round(amount * (pct / 100) * 100) / 100

  const { error } = await db.from('nexus_biz_client_withdrawals').insert({
    account,
    client_id: clientId,
    amount,
    commission_pct: pct,
    commission_amount: commissionAmount,
    withdrawn_on: withdrawnOn,
    note: String(formData.get('note') ?? '').trim() || null,
  })

  if (error) {
    console.error('[panel/clientes] logWithdrawal failed:', error.message)
    return { ok: false, message: `No se pudo registrar: ${error.message}` }
  }

  revalidateAll()
  return { ok: true, message: `Retiro registrado · comisión ${commissionAmount.toFixed(2)} USD` }
}

/** Flips whether a withdrawal's commission has actually been collected. */
export async function toggleSettled(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const id = String(formData.get('id') ?? '').trim()
  const settled = formData.get('settled') === 'true'
  if (!id) return { ok: false, message: 'Falta el retiro.' }

  const { error } = await supabaseAdmin()
    .from('nexus_biz_client_withdrawals')
    .update({ commission_settled: settled })
    .eq('id', id)

  if (error) {
    console.error('[panel/clientes] toggleSettled failed:', error.message)
    return { ok: false, message: `No se pudo actualizar: ${error.message}` }
  }

  revalidateAll()
  return { ok: true, message: settled ? 'Marcada como cobrada' : 'Marcada como pendiente' }
}
