import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversaciones', robots: { index: false, follow: false } }

interface Conversation {
  id: string
  created_at: string
  last_message_at: string | null
  source: string
}

interface Message {
  conversation_id: string
  role: string
  content: string
  created_at: string
}

export default async function ConversacionesPage() {
  const db = supabaseAdmin()

  const { data: convData, error } = await db
    .from('nexus_conversations')
    .select('id, created_at, last_message_at, source')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(25)

  const conversations = (convData ?? []) as Conversation[]

  let messages: Message[] = []
  if (conversations.length > 0) {
    const { data: msgData } = await db
      .from('nexus_messages')
      .select('conversation_id, role, content, created_at')
      .in(
        'conversation_id',
        conversations.map((c) => c.id)
      )
      .order('created_at', { ascending: true })
    messages = (msgData ?? []) as Message[]
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Conversaciones</h1>

      {error && <p className="text-sm text-red-400">Error: {error.message}</p>}
      {!error && conversations.length === 0 && (
        <p className="text-slate-400">Todavía no hay conversaciones.</p>
      )}

      <div className="space-y-4">
        {conversations.map((conv) => {
          const thread = messages.filter((m) => m.conversation_id === conv.id)
          return (
            <details
              key={conv.id}
              className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden"
            >
              <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-400">
                  {new Date(conv.last_message_at ?? conv.created_at).toLocaleString('es-EC')}
                </span>
                <span className="text-cyan-400">{conv.source}</span>
                <span className="text-slate-500">{thread.length} mensajes</span>
              </summary>
              <div className="px-4 py-4 space-y-3 border-t border-white/5">
                {thread.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
