import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-server'
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/agent/prompt'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Prompt', robots: { index: false, follow: false } }

async function savePrompt(formData: FormData) {
  'use server'

  const content = String(formData.get('content') ?? '').trim()
  if (!content) return

  const { error } = await supabaseAdmin()
    .from('nexus_prompts')
    .upsert({ key: 'public_agent', content, active: true }, { onConflict: 'key' })

  if (error) {
    console.error('[panel/prompt] save failed:', error.message)
    throw new Error(`No se pudo guardar el prompt: ${error.message}`)
  }

  revalidatePath('/panel/prompt')
}

export default async function PromptPage() {
  const { data } = await supabaseAdmin()
    .from('nexus_prompts')
    .select('content, updated_at')
    .eq('key', 'public_agent')
    .maybeSingle()

  const content = data?.content ?? DEFAULT_SYSTEM_PROMPT

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Prompt del agente</h1>
        <p className="text-slate-400 text-sm mt-2">
          Define cómo responde el asistente del sitio público. Se aplica de inmediato, sin
          necesidad de desplegar.
          {data?.updated_at && (
            <> Última edición: {new Date(data.updated_at).toLocaleString('es-EC')}.</>
          )}
        </p>
      </div>

      <form action={savePrompt} className="space-y-4">
        <textarea
          name="content"
          defaultValue={content}
          rows={24}
          className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 font-mono outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <button
          type="submit"
          className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white"
        >
          Guardar
        </button>
      </form>
    </div>
  )
}
