import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leads', robots: { index: false, follow: false } }

interface Lead {
  id: string
  created_at: string
  nombre: string
  telefono: string | null
  email: string | null
  negocio: string | null
  necesidad: string | null
}

export default async function LeadsPage() {
  const { data, error } = await supabaseAdmin()
    .from('nexus_leads')
    .select('id, created_at, nombre, telefono, email, negocio, necesidad')
    .order('created_at', { ascending: false })
    .limit(100)

  const leads = (data ?? []) as Lead[]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Leads</h1>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}
      {!error && leads.length === 0 && (
        <p className="text-slate-400">Todavía no hay leads registrados.</p>
      )}

      {leads.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Necesidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleString('es-EC')}
                  </td>
                  <td className="px-4 py-3 text-white">{lead.nombre}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {lead.telefono && (
                      <a
                        href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline block"
                      >
                        {lead.telefono}
                      </a>
                    )}
                    {lead.email && <span className="block">{lead.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{lead.negocio ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{lead.necesidad ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
