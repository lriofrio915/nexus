/**
 * POST /api/chat — public Nexus agent.
 *
 * Runs a bounded tool-calling loop first, then streams the final answer as
 * plain text. The conversation is persisted so the panel can review it.
 */

import { NextResponse } from 'next/server'
import { callAI, streamAI, type AIMessage } from '@/lib/ai-providers'
import { executeTool, toolSchemas } from '@/lib/agent/tools'
import { getSystemPrompt } from '@/lib/agent/prompt'
import { supabaseAdmin } from '@/lib/supabase-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Requests per minute per IP. */
const RATE_LIMIT = 12
/** Conversation turns kept in the model context. */
const HISTORY_LIMIT = 20
const MAX_MESSAGE_CHARS = 2000
/** Safety bound so a looping model cannot spend credit indefinitely. */
const MAX_TOOL_ROUNDS = 3

interface ChatRequestBody {
  message?: unknown
  conversationId?: unknown
  history?: unknown
}

interface ClientTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`chat:${ip}`, RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados mensajes seguidos. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'El mensaje está vacío.' }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `El mensaje supera los ${MAX_MESSAGE_CHARS} caracteres.` },
      { status: 400 }
    )
  }

  const conversationId =
    typeof body.conversationId === 'string' && /^[a-f0-9-]{36}$/i.test(body.conversationId)
      ? body.conversationId
      : crypto.randomUUID()

  const history = parseHistory(body.history)

  let systemPrompt: string
  try {
    systemPrompt = await getSystemPrompt()
  } catch (err) {
    console.error('[api/chat] prompt load failed:', err)
    return NextResponse.json({ error: 'El agente no está disponible.' }, { status: 503 })
  }

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map<AIMessage>((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: message },
  ]

  // ── Tool loop ───────────────────────────────────────────────────────────────
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await callAI({ messages, tools: toolSchemas(), maxTokens: 500 })
      if (result.toolCalls.length === 0) break

      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      })

      for (const call of result.toolCalls) {
        const output = await executeTool(call.function.name, call.function.arguments, {
          conversationId,
          source: 'web-chat',
        })
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: output,
        })
      }
    }
  } catch (err) {
    console.error('[api/chat] tool loop failed:', err)
    return NextResponse.json(
      { error: 'El agente tuvo un problema. Escríbenos por WhatsApp.' },
      { status: 502 }
    )
  }

  // ── Final streamed answer ───────────────────────────────────────────────────
  let upstream: ReadableStream<Uint8Array>
  try {
    upstream = await streamAI({ messages, maxTokens: 500 })
  } catch (err) {
    console.error('[api/chat] stream failed:', err)
    return NextResponse.json(
      { error: 'El agente tuvo un problema. Escríbenos por WhatsApp.' },
      { status: 502 }
    )
  }

  // Tee the stream so persistence never delays what the visitor sees.
  const [toClient, toStore] = upstream.tee()
  void persist(conversationId, ip, message, toStore)

  return new Response(toClient, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Conversation-Id': conversationId,
    },
  })
}

function parseHistory(raw: unknown): ClientTurn[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (t): t is ClientTurn =>
        !!t &&
        typeof t === 'object' &&
        (t as ClientTurn).role !== undefined &&
        ['user', 'assistant'].includes((t as ClientTurn).role) &&
        typeof (t as ClientTurn).content === 'string'
    )
    .slice(-HISTORY_LIMIT)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }))
}

/** Stores the user turn and the assistant reply once the stream completes. */
async function persist(
  conversationId: string,
  ip: string,
  userMessage: string,
  stream: ReadableStream<Uint8Array>
) {
  let reply = ''
  try {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      reply += decoder.decode(value, { stream: true })
    }
  } catch (err) {
    console.error('[api/chat] failed to drain reply stream:', err)
  }

  try {
    const db = supabaseAdmin()
    await db
      .from('nexus_conversations')
      .upsert(
        { id: conversationId, source: 'web-chat', ip, last_message_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    await db.from('nexus_messages').insert([
      { conversation_id: conversationId, role: 'user', content: userMessage },
      { conversation_id: conversationId, role: 'assistant', content: reply },
    ])
  } catch (err) {
    console.error('[api/chat] failed to persist conversation:', err)
  }
}
