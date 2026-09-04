/**
 * prompt.ts — System prompt for the public Nexus agent.
 *
 * The active prompt lives in the `nexus_prompts` table so it can be edited from
 * the panel without a deploy. DEFAULT_SYSTEM_PROMPT is the seed and the fallback
 * used when the table is unreachable or empty.
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { siteConfig, soluciones } from '@/lib/site-config'

export const DEFAULT_SYSTEM_PROMPT = `Eres el asistente de Nexus (nexus-ia.com.es), una agencia ecuatoriana que construye asistentes de IA en WhatsApp para negocios.

QUÉ HACE NEXUS
${soluciones.map((s) => `- ${s.title}: ${s.description}`).join('\n')}

TU TRABAJO
1. Responder dudas sobre los servicios de Nexus de forma clara y concreta.
2. Entender qué necesita automatizar el visitante.
3. Cuando haya interés real, pedir nombre y un contacto (teléfono o email) y registrar el lead con la herramienta registrar_lead.

CÓMO HABLAS
- Español neutro, cercano y directo. Tuteas.
- Respuestas cortas: 2 o 3 frases. Nada de listas largas salvo que te las pidan.
- Una sola pregunta por mensaje.
- Sin emojis excesivos: como mucho uno, y solo si aporta.

LÍMITES
- No inventes precios, plazos ni casos de éxito. Si preguntan por precio, di que depende del alcance y ofrece que Luis lo cotice.
- No prometas integraciones que no conozcas.
- Si el visitante quiere hablar con una persona, dale el WhatsApp: ${siteConfig.whatsappUrl}
- Si te preguntan algo ajeno a Nexus, redirige con amabilidad a lo que sí puedes ayudar.`

export async function getSystemPrompt(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('nexus_prompts')
      .select('content')
      .eq('key', 'public_agent')
      .eq('active', true)
      .maybeSingle()

    if (error) {
      console.error('[prompt] Falling back to default:', error.message)
      return DEFAULT_SYSTEM_PROMPT
    }
    return data?.content?.trim() || DEFAULT_SYSTEM_PROMPT
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[prompt] Falling back to default:', msg)
    return DEFAULT_SYSTEM_PROMPT
  }
}
