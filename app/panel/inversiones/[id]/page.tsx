import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ArrowLeft, FileText } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-server'
import Stat from '@/components/panel/Stat'
import { money, percent, pnlClass, signedMoney } from '@/lib/trading-metrics'
import { shortDate } from '@/lib/dev-metrics'
import {
  CASH_FLOW_LABEL,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  FUNDS_SOURCE_LABEL,
  INV_STATUSES,
  INV_STATUS_LABEL,
  MARITAL_LABEL,
  OBJECTIVE_LABEL,
  RISK_LABEL,
  cashFlowClass,
  clientPortfolio,
  fileSize,
  invStatusClass,
  missingForIbkr,
  positionPnl,
  positionReturnPct,
  positionValue,
  profileCompletion,
  type CashFlowKind,
  type DocumentKind,
  type InvCashFlowRow,
  type InvClientRow,
  type InvDocumentRow,
  type InvPositionRow,
} from '@/lib/inv-metrics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cliente', robots: { index: false, follow: false } }

const BUCKET = 'nexus-kyc'
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// ── Form parsing ─────────────────────────────────────────────────────────────

/** Trimmed text, or null when the field was left empty. */
function text(formData: FormData, field: string): string | null {
  return String(formData.get(field) ?? '').trim() || null
}

/** A non-negative number, or null when empty or unparseable. */
function amount(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? '').trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function integer(formData: FormData, field: string): number | null {
  const value = amount(formData, field)
  return value === null ? null : Math.round(value)
}

/**
 * A value that is in the allowed set, or null. The database has the same check
 * constraints, so this turns a bad option into an empty field instead of a
 * thrown constraint violation.
 */
function option<T extends string>(formData: FormData, field: string, allowed: T[]): T | null {
  const raw = String(formData.get(field) ?? '').trim()
  return (allowed as string[]).includes(raw) ? (raw as T) : null
}

function refresh(clientId: string) {
  revalidatePath(`/panel/inversiones/${clientId}`)
  revalidatePath('/panel/inversiones')
  revalidatePath('/panel')
}

function fail(operation: string, message: string): never {
  console.error(`[panel/inversiones] ${operation} failed:`, message)
  throw new Error(`No se pudo ${operation}: ${message}`)
}

// ── Server actions ───────────────────────────────────────────────────────────

async function updateProfile(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!id || !fullName) return

  const { error } = await supabaseAdmin()
    .from('nexus_inv_clients')
    .update({
      full_name: fullName,
      email: text(formData, 'email'),
      phone: text(formData, 'phone'),
      national_id: text(formData, 'national_id'),
      birth_date: text(formData, 'birth_date'),
      nationality: text(formData, 'nationality'),
      marital_status: option(formData, 'marital_status', Object.keys(MARITAL_LABEL)),
      dependents: integer(formData, 'dependents'),
      address_line: text(formData, 'address_line'),
      city: text(formData, 'city'),
      province: text(formData, 'province'),
      country: text(formData, 'country') ?? 'Ecuador',
      employment_status: option(formData, 'employment_status', Object.keys(EMPLOYMENT_LABEL)),
      occupation: text(formData, 'occupation'),
      employer: text(formData, 'employer'),
      annual_income_usd: amount(formData, 'annual_income_usd'),
      income_source: text(formData, 'income_source'),
      net_worth_usd: amount(formData, 'net_worth_usd'),
      liquid_assets_usd: amount(formData, 'liquid_assets_usd'),
      other_assets: text(formData, 'other_assets'),
      funds_source: option(formData, 'funds_source', Object.keys(FUNDS_SOURCE_LABEL)),
      objective: option(formData, 'objective', Object.keys(OBJECTIVE_LABEL)),
      risk_tolerance: option(formData, 'risk_tolerance', Object.keys(RISK_LABEL)),
      horizon_years: integer(formData, 'horizon_years'),
      experience_level: option(formData, 'experience_level', Object.keys(EXPERIENCE_LABEL)),
      initial_deposit_usd: amount(formData, 'initial_deposit_usd'),
      is_pep: formData.get('is_pep') === 'on',
      ibkr_related: formData.get('ibkr_related') === 'on',
      tax_country: text(formData, 'tax_country'),
      tax_id: text(formData, 'tax_id'),
    })
    .eq('id', id)

  if (error) fail('guardar el perfil', error.message)
  refresh(id)
}

async function updateStatus(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const status = option(formData, 'status', INV_STATUSES)
  if (!status) return

  const { error } = await supabaseAdmin()
    .from('nexus_inv_clients')
    .update({
      status,
      ibkr_account_id: text(formData, 'ibkr_account_id'),
      ibkr_opened_on: text(formData, 'ibkr_opened_on'),
      advisor_notes: text(formData, 'advisor_notes'),
    })
    .eq('id', id)

  if (error) fail('actualizar el estado', error.message)
  refresh(id)
}

async function addFlow(formData: FormData) {
  'use server'

  const clientId = String(formData.get('client_id') ?? '')
  const value = amount(formData, 'amount')
  const kind = option<CashFlowKind>(formData, 'kind', ['aporte', 'retiro', 'comision'])
  const occurredOn = text(formData, 'occurred_on')
  if (!clientId || !kind || !occurredOn || value === null || value <= 0) return

  const { error } = await supabaseAdmin().from('nexus_inv_cash_flows').insert({
    client_id: clientId,
    kind,
    amount: value,
    occurred_on: occurredOn,
    note: text(formData, 'note'),
  })

  if (error) fail('registrar el movimiento', error.message)
  refresh(clientId)
}

async function deleteFlow(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const clientId = String(formData.get('client_id') ?? '')
  if (!id || !clientId) return

  const { error } = await supabaseAdmin().from('nexus_inv_cash_flows').delete().eq('id', id)
  if (error) fail('borrar el movimiento', error.message)
  refresh(clientId)
}

async function savePosition(formData: FormData) {
  'use server'

  const clientId = String(formData.get('client_id') ?? '')
  const symbol = String(formData.get('symbol') ?? '').trim().toUpperCase()
  const quantity = amount(formData, 'quantity')
  const avgCost = amount(formData, 'avg_cost')
  if (!clientId || !symbol || quantity === null || avgCost === null) return

  const row = {
    client_id: clientId,
    symbol,
    exchange: text(formData, 'exchange'),
    quantity,
    avg_cost: avgCost,
    last_price: amount(formData, 'last_price'),
    price_updated_on: text(formData, 'price_updated_on'),
    note: text(formData, 'note'),
  }

  const id = String(formData.get('id') ?? '')
  const db = supabaseAdmin()
  // An existing row is edited in place; a new symbol is inserted. The unique
  // (client_id, upper(symbol)) index stops the same holding being added twice.
  const { error } = id
    ? await db.from('nexus_inv_positions').update(row).eq('id', id)
    : await db.from('nexus_inv_positions').insert(row)

  if (error) fail('guardar la posición', error.message)
  refresh(clientId)
}

async function deletePosition(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const clientId = String(formData.get('client_id') ?? '')
  if (!id || !clientId) return

  const { error } = await supabaseAdmin().from('nexus_inv_positions').delete().eq('id', id)
  if (error) fail('borrar la posición', error.message)
  refresh(clientId)
}

async function uploadDocument(formData: FormData) {
  'use server'

  const clientId = String(formData.get('client_id') ?? '')
  const kind = option<DocumentKind>(formData, 'kind', DOCUMENT_KINDS) ?? 'otro'
  const file = formData.get('file')
  if (!clientId || !(file instanceof File) || file.size === 0) return

  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error('Formato no admitido. Sube una imagen JPG, PNG, WEBP o un PDF.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('El archivo supera los 8 MB.')
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin'
  const path = `${clientId}/${kind}-${crypto.randomUUID()}.${extension}`

  const db = supabaseAdmin()
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) fail('subir el documento', uploadError.message)

  const { error } = await db.from('nexus_inv_documents').insert({
    client_id: clientId,
    kind,
    storage_path: path,
    original_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  })

  if (error) {
    // The row is the index into the bucket; without it the object is orphaned.
    await db.storage.from(BUCKET).remove([path])
    fail('registrar el documento', error.message)
  }

  refresh(clientId)
}

async function deleteDocument(formData: FormData) {
  'use server'

  const id = String(formData.get('id') ?? '')
  const clientId = String(formData.get('client_id') ?? '')
  const path = String(formData.get('storage_path') ?? '')
  if (!id || !clientId || !path) return

  const db = supabaseAdmin()
  const { error: storageError } = await db.storage.from(BUCKET).remove([path])
  if (storageError) fail('borrar el archivo', storageError.message)

  const { error } = await db.from('nexus_inv_documents').delete().eq('id', id)
  if (error) fail('borrar el documento', error.message)

  refresh(clientId)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function InvClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const db = supabaseAdmin()
  const [clientRes, positionsRes, flowsRes, documentsRes] = await Promise.all([
    db.from('nexus_inv_clients').select('*').eq('id', id).maybeSingle(),
    db.from('nexus_inv_positions').select('*').eq('client_id', id).order('symbol'),
    db
      .from('nexus_inv_cash_flows')
      .select('*')
      .eq('client_id', id)
      .order('occurred_on', { ascending: false }),
    db
      .from('nexus_inv_documents')
      .select('*')
      .eq('client_id', id)
      .order('uploaded_at', { ascending: false }),
  ])

  if (clientRes.error) {
    console.error('[panel/inversiones] load client failed:', clientRes.error.message)
  }
  if (!clientRes.data) notFound()

  const client = clientRes.data as InvClientRow
  const positions = (positionsRes.data ?? []) as InvPositionRow[]
  const flows = (flowsRes.data ?? []) as InvCashFlowRow[]
  const documents = (documentsRes.data ?? []) as InvDocumentRow[]

  const portfolio = clientPortfolio(positions, flows)
  const missing = missingForIbkr(client)

  // Signed URLs expire in a minute: long enough to click, short enough that a
  // copied link is useless by the time it leaves the panel.
  const signed = await Promise.all(
    documents.map(async (doc) => {
      const { data } = await db.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60)
      return [doc.id, data?.signedUrl ?? null] as const
    })
  )
  const urlById = new Map(signed)

  const inputClass =
    'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'
  const labelClass = 'block'
  const spanClass = 'text-xs text-slate-400'

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/panel/inversiones"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Clientes
        </Link>
        <div className="flex items-center gap-3 flex-wrap mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{client.full_name}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${invStatusClass(client.status)}`}
          >
            {INV_STATUS_LABEL[client.status]}
          </span>
        </div>
        <p className="text-slate-400 mt-2">
          Perfil {percent(profileCompletion(client), 0)} completo
          {missing.length > 0 && ` · Faltan: ${missing.join(', ')}`}
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Capital aportado"
          value={money(portfolio.netContributed)}
          hint={`Aportes ${money(portfolio.contributed)} · Retiros ${money(portfolio.withdrawn)}`}
        />
        <Stat
          label="Valor de cartera"
          value={money(portfolio.marketValue)}
          hint={`${portfolio.positions} posiciones · Costo ${money(portfolio.costBasis)}`}
        />
        <Stat
          label="No realizado"
          value={signedMoney(portfolio.unrealized)}
          valueClass={pnlClass(portfolio.unrealized)}
          hint="Valor menos costo de las posiciones"
        />
        <Stat
          label="Resultado total"
          value={signedMoney(portfolio.totalReturn)}
          valueClass={pnlClass(portfolio.totalReturn)}
          hint={
            portfolio.returnPct !== null
              ? `${percent(portfolio.returnPct)} sobre el capital aportado`
              : 'Sin capital aportado todavía'
          }
        />
      </section>

      {/* ── Estado y cuenta IBKR ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
        <h2 className="font-bold mb-4">Estado y cuenta IBKR</h2>
        <form action={updateStatus} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input type="hidden" name="id" value={client.id} />
          <label className={labelClass}>
            <span className={spanClass}>Estado</span>
            <select name="status" defaultValue={client.status} className={inputClass}>
              {INV_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INV_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Cuenta IBKR</span>
            <input
              name="ibkr_account_id"
              defaultValue={client.ibkr_account_id ?? ''}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Fecha de apertura</span>
            <input
              name="ibkr_opened_on"
              type="date"
              defaultValue={client.ibkr_opened_on ?? ''}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={spanClass}>Notas internas</span>
            <textarea
              name="advisor_notes"
              rows={2}
              defaultValue={client.advisor_notes ?? ''}
              className={inputClass}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg px-4 py-2 text-sm"
            >
              Guardar estado
            </button>
          </div>
        </form>
      </section>

      {/* ── Perfil KYC ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
        <h2 className="font-bold mb-4">Perfil del cliente</h2>
        <form action={updateProfile} className="space-y-6">
          <input type="hidden" name="id" value={client.id} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className={labelClass}>
              <span className={spanClass}>Nombre completo *</span>
              <input
                name="full_name"
                required
                defaultValue={client.full_name}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Cédula</span>
              <input name="national_id" defaultValue={client.national_id ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Fecha de nacimiento</span>
              <input
                name="birth_date"
                type="date"
                defaultValue={client.birth_date ?? ''}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Correo</span>
              <input name="email" type="email" defaultValue={client.email ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Teléfono</span>
              <input name="phone" defaultValue={client.phone ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Nacionalidad</span>
              <input name="nationality" defaultValue={client.nationality ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Estado civil</span>
              <select
                name="marital_status"
                defaultValue={client.marital_status ?? ''}
                className={inputClass}
              >
                <option value="">Sin especificar</option>
                {Object.entries(MARITAL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Personas a cargo</span>
              <input
                name="dependents"
                type="number"
                min="0"
                defaultValue={client.dependents ?? ''}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block sm:col-span-2">
              <span className={spanClass}>Dirección</span>
              <input name="address_line" defaultValue={client.address_line ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Ciudad</span>
              <input name="city" defaultValue={client.city ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Provincia</span>
              <input name="province" defaultValue={client.province ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>País</span>
              <input name="country" defaultValue={client.country} className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className={labelClass}>
              <span className={spanClass}>Situación laboral</span>
              <select
                name="employment_status"
                defaultValue={client.employment_status ?? ''}
                className={inputClass}
              >
                <option value="">Sin especificar</option>
                {Object.entries(EMPLOYMENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Ocupación</span>
              <input name="occupation" defaultValue={client.occupation ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Empleador</span>
              <input name="employer" defaultValue={client.employer ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Ingresos anuales (USD)</span>
              <input
                name="annual_income_usd"
                type="number"
                step="0.01"
                min="0"
                defaultValue={client.annual_income_usd ?? ''}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={spanClass}>Detalle de los ingresos</span>
              <input name="income_source" defaultValue={client.income_source ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Patrimonio neto (USD)</span>
              <input
                name="net_worth_usd"
                type="number"
                step="0.01"
                min="0"
                defaultValue={client.net_worth_usd ?? ''}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Activos líquidos (USD)</span>
              <input
                name="liquid_assets_usd"
                type="number"
                step="0.01"
                min="0"
                defaultValue={client.liquid_assets_usd ?? ''}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Origen de los fondos</span>
              <select name="funds_source" defaultValue={client.funds_source ?? ''} className={inputClass}>
                <option value="">Sin especificar</option>
                {Object.entries(FUNDS_SOURCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className={spanClass}>Otros bienes (terrenos, vehículos, inmuebles)</span>
              <textarea
                name="other_assets"
                rows={2}
                defaultValue={client.other_assets ?? ''}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className={labelClass}>
              <span className={spanClass}>Objetivo de inversión</span>
              <select name="objective" defaultValue={client.objective ?? ''} className={inputClass}>
                <option value="">Sin especificar</option>
                {Object.entries(OBJECTIVE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Tolerancia al riesgo</span>
              <select name="risk_tolerance" defaultValue={client.risk_tolerance ?? ''} className={inputClass}>
                <option value="">Sin especificar</option>
                {Object.entries(RISK_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Horizonte (años)</span>
              <input
                name="horizon_years"
                type="number"
                min="0"
                defaultValue={client.horizon_years ?? ''}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Experiencia invirtiendo</span>
              <select
                name="experience_level"
                defaultValue={client.experience_level ?? ''}
                className={inputClass}
              >
                <option value="">Sin especificar</option>
                {Object.entries(EXPERIENCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Depósito inicial previsto (USD)</span>
              <input
                name="initial_deposit_usd"
                type="number"
                step="0.01"
                min="0"
                defaultValue={client.initial_deposit_usd ?? ''}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>País de residencia fiscal</span>
              <input name="tax_country" defaultValue={client.tax_country ?? ''} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Identificación tributaria</span>
              <input name="tax_id" defaultValue={client.tax_id ?? ''} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 mt-6">
              <input type="checkbox" name="is_pep" defaultChecked={client.is_pep} />
              Persona políticamente expuesta
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 mt-6">
              <input type="checkbox" name="ibkr_related" defaultChecked={client.ibkr_related} />
              Vinculado a un broker o casa de valores
            </label>
          </div>

          <button
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg px-4 py-2 text-sm"
          >
            Guardar perfil
          </button>
        </form>
      </section>

      {/* ── Documentos ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 space-y-4">
        <h2 className="font-bold">Documentos</h2>

        {documents.length === 0 ? (
          <p className="text-slate-400 text-sm">Sin documentos cargados.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => {
              const url = urlById.get(doc.id)
              return (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-white/10 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {DOCUMENT_KIND_LABEL[doc.kind]}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {doc.original_name ?? doc.storage_path} · {fileSize(doc.size_bytes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-sm text-slate-500">No disponible</span>
                    )}
                    <form action={deleteDocument}>
                      <input type="hidden" name="id" value={doc.id} />
                      <input type="hidden" name="client_id" value={client.id} />
                      <input type="hidden" name="storage_path" value={doc.storage_path} />
                      <button type="submit" className="text-sm text-red-400 hover:underline">
                        Borrar
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <form action={uploadDocument} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <input type="hidden" name="client_id" value={client.id} />
          <label className={labelClass}>
            <span className={spanClass}>Tipo</span>
            <select name="kind" defaultValue="cedula_frente" className={inputClass}>
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DOCUMENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Archivo (JPG, PNG, WEBP o PDF, máx. 8 MB)</span>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg px-4 py-2 text-sm"
          >
            Subir
          </button>
        </form>
      </section>

      {/* ── Posiciones ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 space-y-4">
        <h2 className="font-bold">Cartera</h2>

        {positions.length === 0 ? (
          <p className="text-slate-400 text-sm">Sin posiciones cargadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 text-left">
                  <th className="py-2 pr-4">Símbolo</th>
                  <th className="py-2 pr-4 text-right">Cantidad</th>
                  <th className="py-2 pr-4 text-right">Costo prom.</th>
                  <th className="py-2 pr-4 text-right">Último</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                  <th className="py-2 pr-4 text-right">P&amp;L</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 font-bold text-white whitespace-nowrap">
                      {p.symbol}
                      {p.exchange && <span className="text-slate-500 font-normal"> · {p.exchange}</span>}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.quantity}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(p.avg_cost)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {p.last_price === null ? '—' : money(p.last_price)}
                      {p.price_updated_on && (
                        <span className="block text-xs text-slate-500">
                          {shortDate(p.price_updated_on)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(positionValue(p))}</td>
                    <td className={`py-2 pr-4 text-right tabular-nums ${pnlClass(positionPnl(p))}`}>
                      {signedMoney(positionPnl(p))}
                      <span className="block text-xs">{percent(positionReturnPct(p))}</span>
                    </td>
                    <td className="py-2 text-right">
                      <form action={deletePosition}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="client_id" value={client.id} />
                        <button type="submit" className="text-xs text-red-400 hover:underline">
                          Borrar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={savePosition} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <input type="hidden" name="client_id" value={client.id} />
          <label className={labelClass}>
            <span className={spanClass}>Símbolo *</span>
            <input name="symbol" required className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Mercado</span>
            <input name="exchange" placeholder="NASDAQ" className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Cantidad *</span>
            <input name="quantity" type="number" step="0.00000001" min="0" required className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Costo prom. *</span>
            <input name="avg_cost" type="number" step="0.0001" min="0" required className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Último precio</span>
            <input name="last_price" type="number" step="0.0001" min="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Precio del día</span>
            <input name="price_updated_on" type="date" className={inputClass} />
          </label>
          <div className="col-span-2 sm:col-span-3 lg:col-span-6">
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg px-4 py-2 text-sm"
            >
              Agregar posición
            </button>
          </div>
        </form>
      </section>

      {/* ── Movimientos ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 space-y-4">
        <h2 className="font-bold">Aportes y retiros</h2>

        {flows.length === 0 ? (
          <p className="text-slate-400 text-sm">Sin movimientos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 text-left">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4 text-right">Monto</th>
                  <th className="py-2 pr-4">Nota</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => (
                  <tr key={flow.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 whitespace-nowrap">{shortDate(flow.occurred_on)}</td>
                    <td className="py-2 pr-4">{CASH_FLOW_LABEL[flow.kind]}</td>
                    <td className={`py-2 pr-4 text-right tabular-nums ${cashFlowClass(flow.kind)}`}>
                      {money(flow.amount)}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{flow.note ?? '—'}</td>
                    <td className="py-2 text-right">
                      <form action={deleteFlow}>
                        <input type="hidden" name="id" value={flow.id} />
                        <input type="hidden" name="client_id" value={client.id} />
                        <button type="submit" className="text-xs text-red-400 hover:underline">
                          Borrar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={addFlow} className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
          <input type="hidden" name="client_id" value={client.id} />
          <label className={labelClass}>
            <span className={spanClass}>Tipo</span>
            <select name="kind" defaultValue="aporte" className={inputClass}>
              {(Object.keys(CASH_FLOW_LABEL) as CashFlowKind[]).map((k) => (
                <option key={k} value={k}>
                  {CASH_FLOW_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Monto (USD) *</span>
            <input name="amount" type="number" step="0.01" min="0.01" required className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Fecha *</span>
            <input name="occurred_on" type="date" required className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Nota</span>
            <input name="note" className={inputClass} />
          </label>
          <div className="col-span-2 sm:col-span-4">
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg px-4 py-2 text-sm"
            >
              Registrar movimiento
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
