import Link from 'next/link'
import { MessageSquare, Users, FileText } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Panel', robots: { index: false, follow: false } }

async function counts() {
  try {
    const db = supabaseAdmin()
    const [conversations, leads] = await Promise.all([
      db.from('nexus_conversations').select('*', { count: 'exact', head: true }),
      db.from('nexus_leads').select('*', { count: 'exact', head: true }),
    ])
    return {
      conversations: conversations.count ?? 0,
      leads: leads.count ?? 0,
      error: conversations.error?.message ?? leads.error?.message ?? null,
    }
  } catch (err) {
    return {
      conversations: 0,
      leads: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export default async function PanelHome() {
  const { conversations, leads, error } = await counts()

  const cards = [
    {
      href: '/panel/conversaciones',
      icon: MessageSquare,
      label: 'Conversaciones',
      value: conversations,
    },
    { href: '/panel/leads', icon: Users, label: 'Leads', value: leads },
    { href: '/panel/prompt', icon: FileText, label: 'Prompt del agente', value: null },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel</h1>

      {error && (
        <p className="text-sm text-amber-400 bg-amber-950/40 border border-amber-500/30 rounded-lg px-4 py-3">
          No se pudo leer la base de datos: {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="p-6 rounded-2xl bg-slate-900 border border-white/10 hover:border-cyan-500/50 transition-colors"
            >
              <Icon className="w-6 h-6 text-cyan-400 mb-4" />
              <p className="text-slate-400 text-sm">{card.label}</p>
              {card.value !== null && (
                <p className="text-3xl font-bold text-white mt-1">{card.value}</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
