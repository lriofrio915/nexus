import Link from 'next/link'
import { Cpu, ShieldCheck } from 'lucide-react'
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  FUNDS_SOURCE_LABEL,
  MARITAL_LABEL,
  OBJECTIVE_LABEL,
  RISK_LABEL,
} from '@/lib/inv-metrics'
import { submitApplication } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Apertura de cuenta IBKR',
  description: 'Formulario para abrir una cuenta de inversión en Interactive Brokers con Nexus.',
  // Public, but there is no reason for it to be indexed.
  robots: { index: false, follow: false },
}

const ERROR_MESSAGE: Record<string, string> = {
  campos: 'Faltan datos obligatorios o el correo no es válido. Revisa y vuelve a enviar.',
  archivo: 'Algún archivo no es válido: solo JPG, PNG, WEBP o PDF de hasta 8 MB, máximo 5 archivos.',
  limite: 'Demasiados envíos seguidos. Espera un minuto e inténtalo de nuevo.',
  guardar: 'No se pudo guardar la solicitud. Escríbenos por WhatsApp y lo resolvemos.',
}

const inputClass =
  'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500'
const spanClass = 'text-xs text-slate-400'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-6">
      <h2 className="font-bold text-lg">{title}</h2>
      {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">{children}</div>
    </section>
  )
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = error ? ERROR_MESSAGE[error] ?? ERROR_MESSAGE.guardar : null

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <span className="font-bold tracking-wider">NEXUS</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Apertura de cuenta en Interactive Brokers</h1>
          <p className="text-slate-400 mt-2">
            Completa este formulario para iniciar la apertura de tu cuenta de inversión. Son los
            mismos datos que el bróker exige; mientras más completo lo envíes, más rápido avanza.
          </p>
        </div>

        {message && (
          <p className="rounded-lg border border-red-500/30 bg-red-950/30 text-red-300 text-sm px-4 py-3">
            {message}
          </p>
        )}

        <form action={submitApplication} className="space-y-6">
          <Section title="Datos personales">
            <label className="block">
              <span className={spanClass}>Nombre completo *</span>
              <input name="full_name" required className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Cédula de identidad *</span>
              <input name="national_id" required className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Correo electrónico *</span>
              <input name="email" type="email" required className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Teléfono (con código de país) *</span>
              <input name="phone" required placeholder="+593..." className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Fecha de nacimiento</span>
              <input name="birth_date" type="date" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Nacionalidad</span>
              <input name="nationality" defaultValue="Ecuatoriana" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Estado civil</span>
              <select name="marital_status" defaultValue="" className={inputClass}>
                <option value="">Selecciona</option>
                {Object.entries(MARITAL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={spanClass}>Personas que dependen de ti</span>
              <input name="dependents" type="number" min="0" className={inputClass} />
            </label>
          </Section>

          <Section title="Domicilio">
            <label className="block sm:col-span-2">
              <span className={spanClass}>Dirección</span>
              <input name="address_line" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Ciudad</span>
              <input name="city" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Provincia</span>
              <input name="province" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>País</span>
              <input name="country" defaultValue="Ecuador" className={inputClass} />
            </label>
          </Section>

          <Section title="Trabajo e ingresos">
            <label className="block">
              <span className={spanClass}>Situación laboral</span>
              <select name="employment_status" defaultValue="" className={inputClass}>
                <option value="">Selecciona</option>
                {Object.entries(EMPLOYMENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={spanClass}>Profesión u ocupación</span>
              <input name="occupation" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Empresa o lugar de trabajo</span>
              <input name="employer" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Ingresos anuales (USD)</span>
              <input name="annual_income_usd" type="number" step="0.01" min="0" className={inputClass} />
            </label>
            <label className="block sm:col-span-2">
              <span className={spanClass}>¿De dónde vienen tus ingresos?</span>
              <input
                name="income_source"
                placeholder="Sueldo como médico, consultorio propio, arriendos..."
                className={inputClass}
              />
            </label>
          </Section>

          <Section title="Patrimonio">
            <label className="block">
              <span className={spanClass}>Patrimonio neto aproximado (USD)</span>
              <input name="net_worth_usd" type="number" step="0.01" min="0" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Dinero disponible / líquido (USD)</span>
              <input name="liquid_assets_usd" type="number" step="0.01" min="0" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Origen de los fondos a invertir</span>
              <select name="funds_source" defaultValue="" className={inputClass}>
                <option value="">Selecciona</option>
                {Object.entries(FUNDS_SOURCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={spanClass}>Depósito inicial previsto (USD)</span>
              <input name="initial_deposit_usd" type="number" step="0.01" min="0" className={inputClass} />
            </label>
            <label className="block sm:col-span-2">
              <span className={spanClass}>Otros bienes (terrenos, vehículos, inmuebles)</span>
              <textarea name="other_assets" rows={2} className={inputClass} />
            </label>
          </Section>

          <Section title="Tu perfil de inversión">
            <label className="block">
              <span className={spanClass}>Objetivo principal</span>
              <select name="objective" defaultValue="" className={inputClass}>
                <option value="">Selecciona</option>
                {Object.entries(OBJECTIVE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={spanClass}>¿Cuánto riesgo aceptas?</span>
              <select name="risk_tolerance" defaultValue="" className={inputClass}>
                <option value="">Selecciona</option>
                {Object.entries(RISK_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={spanClass}>¿Por cuántos años piensas invertir?</span>
              <input name="horizon_years" type="number" min="0" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>Experiencia invirtiendo en acciones</span>
              <select name="experience_level" defaultValue="" className={inputClass}>
                <option value="">Selecciona</option>
                {Object.entries(EXPERIENCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </Section>

          <Section
            title="Cumplimiento"
            hint="Interactive Brokers exige estas dos respuestas antes de abrir cualquier cuenta."
          >
            <label className="block">
              <span className={spanClass}>País de residencia fiscal</span>
              <input name="tax_country" defaultValue="Ecuador" className={inputClass} />
            </label>
            <label className="block">
              <span className={spanClass}>RUC o identificación tributaria</span>
              <input name="tax_id" className={inputClass} />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-300 sm:col-span-2">
              <input type="checkbox" name="is_pep" className="mt-1" />
              <span>
                Soy o he sido funcionario público de alto nivel, o soy familiar cercano de alguien
                que lo es (persona políticamente expuesta).
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-300 sm:col-span-2">
              <input type="checkbox" name="ibkr_related" className="mt-1" />
              <span>Trabajo en una casa de valores, bróker o bolsa de valores, o tengo un familiar que lo hace.</span>
            </label>
          </Section>

          <Section
            title="Documentos"
            hint="JPG, PNG, WEBP o PDF, hasta 8 MB por archivo. Puedes enviarlos después si no los tienes a mano."
          >
            {DOCUMENT_KINDS.filter((kind) => kind !== 'otro').map((kind) => (
              <label key={kind} className="block">
                <span className={spanClass}>{DOCUMENT_KIND_LABEL[kind]}</span>
                <input
                  name={`doc_${kind}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className={inputClass}
                />
              </label>
            ))}
          </Section>

          <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input type="checkbox" name="consent" required className="mt-1" />
                <span>
                  Autorizo a Nexus a usar estos datos y documentos únicamente para tramitar la
                  apertura y la gestión de mi cuenta en Interactive Brokers. *
                </span>
              </label>
            </div>
            <button
              type="submit"
              className="mt-5 w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg px-6 py-3 text-sm"
            >
              Enviar solicitud
            </button>
          </section>
        </form>
      </main>
    </div>
  )
}
