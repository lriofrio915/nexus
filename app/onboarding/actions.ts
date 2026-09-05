'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import {
  DOCUMENT_KINDS,
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  FUNDS_SOURCE_LABEL,
  MARITAL_LABEL,
  OBJECTIVE_LABEL,
  RISK_LABEL,
  type DocumentKind,
} from '@/lib/inv-metrics'

/**
 * Public onboarding submission.
 *
 * The form is open to anyone, so the write goes through the service-role client
 * behind a rate limit -- the same shape as the chat agent's lead capture -- and
 * never through an anon RLS policy. It only ever inserts: nothing on this route
 * reads back a client, so a stranger cannot use it to probe for existing rows.
 */

const BUCKET = 'nexus-kyc'
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_FILES = 5
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** Submissions per minute per IP. Generous for a person, useless for a script. */
const MAX_SUBMISSIONS = 3

function text(formData: FormData, field: string, max = 500): string | null {
  const value = String(formData.get(field) ?? '')
    .trim()
    .slice(0, max)
  return value || null
}

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

/** Only values the database check constraints accept; anything else is dropped. */
function option(formData: FormData, field: string, allowed: string[]): string | null {
  const raw = String(formData.get(field) ?? '').trim()
  return allowed.includes(raw) ? raw : null
}

export async function submitApplication(formData: FormData) {
  const ip = clientIp(await headers())
  if (!rateLimit(`onboarding:${ip}`, MAX_SUBMISSIONS).allowed) {
    redirect('/onboarding?error=limite')
  }

  const fullName = text(formData, 'full_name', 200)
  const email = text(formData, 'email', 200)
  const phone = text(formData, 'phone', 40)
  const nationalId = text(formData, 'national_id', 20)

  // The consent checkbox is the legal basis for storing any of this, so it is
  // required alongside the fields that identify the person.
  const consented = formData.get('consent') === 'on'
  if (!fullName || !email || !phone || !nationalId || !consented) {
    redirect('/onboarding?error=campos')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect('/onboarding?error=campos')
  }

  const files: { kind: DocumentKind; file: File }[] = []
  for (const kind of DOCUMENT_KINDS) {
    const entry = formData.get(`doc_${kind}`)
    if (entry instanceof File && entry.size > 0) files.push({ kind, file: entry })
  }
  if (files.length > MAX_FILES) {
    redirect('/onboarding?error=archivo')
  }
  for (const { file } of files) {
    if (!ALLOWED_MIME.includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
      redirect('/onboarding?error=archivo')
    }
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('nexus_inv_clients')
    .insert({
      full_name: fullName,
      email,
      phone,
      national_id: nationalId,
      birth_date: text(formData, 'birth_date'),
      nationality: text(formData, 'nationality', 60),
      marital_status: option(formData, 'marital_status', Object.keys(MARITAL_LABEL)),
      dependents: integer(formData, 'dependents'),
      address_line: text(formData, 'address_line'),
      city: text(formData, 'city', 80),
      province: text(formData, 'province', 80),
      country: text(formData, 'country', 80) ?? 'Ecuador',
      employment_status: option(formData, 'employment_status', Object.keys(EMPLOYMENT_LABEL)),
      occupation: text(formData, 'occupation', 120),
      employer: text(formData, 'employer', 120),
      annual_income_usd: amount(formData, 'annual_income_usd'),
      income_source: text(formData, 'income_source'),
      net_worth_usd: amount(formData, 'net_worth_usd'),
      liquid_assets_usd: amount(formData, 'liquid_assets_usd'),
      other_assets: text(formData, 'other_assets', 1000),
      funds_source: option(formData, 'funds_source', Object.keys(FUNDS_SOURCE_LABEL)),
      objective: option(formData, 'objective', Object.keys(OBJECTIVE_LABEL)),
      risk_tolerance: option(formData, 'risk_tolerance', Object.keys(RISK_LABEL)),
      horizon_years: integer(formData, 'horizon_years'),
      experience_level: option(formData, 'experience_level', Object.keys(EXPERIENCE_LABEL)),
      initial_deposit_usd: amount(formData, 'initial_deposit_usd'),
      is_pep: formData.get('is_pep') === 'on',
      ibkr_related: formData.get('ibkr_related') === 'on',
      tax_country: text(formData, 'tax_country', 80),
      tax_id: text(formData, 'tax_id', 40),
      status: 'solicitud',
      source: 'formulario',
    })
    .select('id')
    .single()

  if (error || !data) {
    // The unique index on national_id makes a resend of the same cédula land
    // here; the message stays generic so the form cannot be used to find out
    // whether a given person is already a client.
    console.error('[onboarding] insert failed:', error?.message)
    redirect('/onboarding?error=guardar')
  }

  const clientId = data.id as string

  for (const { kind, file } of files) {
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin'
    const path = `${clientId}/${kind}-${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      // A failed upload must not lose the answers already saved: the client row
      // stays and the panel asks for the missing document.
      console.error('[onboarding] upload failed:', uploadError.message)
      continue
    }

    const { error: docError } = await db.from('nexus_inv_documents').insert({
      client_id: clientId,
      kind,
      storage_path: path,
      original_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
    })

    if (docError) {
      console.error('[onboarding] document row failed:', docError.message)
      await db.storage.from(BUCKET).remove([path])
    }
  }

  redirect('/onboarding/gracias')
}
