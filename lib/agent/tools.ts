/**
 * tools.ts — Tools the Nexus agent may call.
 *
 * Every tool runs server-side only. Executors receive already-parsed arguments
 * and must never throw: they return a string that goes back to the model.
 */

import type { ToolSchema } from '@/lib/ai-providers'
import { sendWA } from '@/lib/sendWA'
import { supabaseAdmin } from '@/lib/supabase-server'
import { siteConfig } from '@/lib/site-config'

export interface ToolContext {
  conversationId: string
  /** Where the visitor is chatting from, for lead attribution. */
  source: string
}

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>

interface Tool {
  schema: ToolSchema
  execute: Executor
}

// ── registrar_lead ────────────────────────────────────────────────────────────

const registrarLead: Tool = {
  schema: {
    type: 'function',
    function: {
      name: 'registrar_lead',
      description:
        'Registra un prospecto interesado y avisa a Luis por WhatsApp. Úsalo SOLO cuando ya tengas al menos el nombre y una forma de contacto (teléfono o email).',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del prospecto' },
          telefono: {
            type: 'string',
            description: 'Teléfono con código de país, sin espacios ni símbolos',
          },
          email: { type: 'string', description: 'Correo electrónico' },
          negocio: {
            type: 'string',
            description: 'Tipo de negocio o industria del prospecto',
          },
          necesidad: {
            type: 'string',
            description: 'Qué necesita automatizar, en una frase',
          },
        },
        required: ['nombre'],
      },
    },
  },
  async execute(args, ctx) {
    const nombre = String(args.nombre ?? '').trim()
    const telefono = args.telefono ? String(args.telefono).trim() : null
    const email = args.email ? String(args.email).trim() : null

    if (!nombre) return 'Error: falta el nombre del prospecto.'
    if (!telefono && !email) {
      return 'Error: se necesita al menos un teléfono o un email antes de registrar el lead.'
    }

    const lead = {
      conversation_id: ctx.conversationId,
      nombre,
      telefono,
      email,
      negocio: args.negocio ? String(args.negocio) : null,
      necesidad: args.necesidad ? String(args.necesidad) : null,
      source: ctx.source,
    }

    try {
      const { error } = await supabaseAdmin().from('nexus_leads').insert(lead)
      if (error) {
        console.error('[tools/registrar_lead] insert failed:', error.message)
        return `Error al guardar el lead: ${error.message}`
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[tools/registrar_lead] insert threw:', msg)
      return `Error al guardar el lead: ${msg}`
    }

    const resumen = [
      '🔔 Nuevo lead desde nexus-ia.com.es',
      `Nombre: ${nombre}`,
      telefono ? `Teléfono: ${telefono}` : null,
      email ? `Email: ${email}` : null,
      lead.negocio ? `Negocio: ${lead.negocio}` : null,
      lead.necesidad ? `Necesita: ${lead.necesidad}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const wa = await sendWA(siteConfig.whatsappNumber, resumen)
    return wa.ok
      ? 'Lead registrado y notificado por WhatsApp. Confirma al prospecto que Luis lo contactará pronto.'
      : 'Lead registrado en la base de datos, pero la notificación por WhatsApp falló. Confirma al prospecto de todas formas.'
  },
}

// ── disparar_workflow ─────────────────────────────────────────────────────────

const dispararWorkflow: Tool = {
  schema: {
    type: 'function',
    function: {
      name: 'disparar_workflow',
      description:
        'Ejecuta un workflow de automatización de n8n por su nombre. Úsalo solo si el usuario pide explícitamente una acción que corresponda a un workflow disponible.',
      parameters: {
        type: 'object',
        properties: {
          workflow: {
            type: 'string',
            description: 'Nombre del workflow a ejecutar',
            enum: [] as string[], // filled from N8N_ALLOWED_WORKFLOWS at call time
          },
          payload: {
            type: 'object',
            description: 'Datos a enviar al workflow',
            additionalProperties: true,
          },
        },
        required: ['workflow'],
      },
    },
  },
  async execute(args) {
    const baseUrl = process.env.N8N_WEBHOOK_BASE_URL
    if (!baseUrl) return 'Error: N8N_WEBHOOK_BASE_URL no está configurado.'

    const workflow = String(args.workflow ?? '').trim()
    if (!allowedWorkflows().includes(workflow)) {
      return `Error: el workflow "${workflow}" no está en la lista permitida.`
    }

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/${workflow}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.N8N_WEBHOOK_SECRET
            ? { 'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify(args.payload ?? {}),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) return `El workflow respondió ${res.status}.`
      return `Workflow "${workflow}" ejecutado correctamente.`
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error al ejecutar el workflow: ${msg}`
    }
  },
}

/** Workflows the agent is allowed to trigger, from env (comma-separated). */
function allowedWorkflows(): string[] {
  return (process.env.N8N_ALLOWED_WORKFLOWS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry: Record<string, Tool> = {
  registrar_lead: registrarLead,
  disparar_workflow: dispararWorkflow,
}

/** Schemas sent to the model. Workflow tool is omitted when none are allowed. */
export function toolSchemas(): ToolSchema[] {
  const workflows = allowedWorkflows()
  const schemas: ToolSchema[] = [registrarLead.schema]

  if (workflows.length > 0) {
    const schema = structuredClone(dispararWorkflow.schema)
    const params = schema.function.parameters as {
      properties: { workflow: { enum: string[] } }
    }
    params.properties.workflow.enum = workflows
    schemas.push(schema)
  }

  return schemas
}

export async function executeTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext
): Promise<string> {
  const tool = registry[name]
  if (!tool) return `Error: la herramienta "${name}" no existe.`

  let args: Record<string, unknown>
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    return 'Error: los argumentos no son JSON válido.'
  }

  try {
    return await tool.execute(args, ctx)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[tools/${name}] threw:`, msg)
    return `Error al ejecutar ${name}: ${msg}`
  }
}
