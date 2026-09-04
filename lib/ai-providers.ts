/**
 * ai-providers.ts — Centralized AI provider with automatic fallback.
 *
 * Primary: OpenRouter (OPENROUTER_API_KEY + OPENROUTER_MODEL)
 * Fallback: MiniMax (MINIMAX_API_KEY + MINIMAX_MODEL)
 *
 * When OpenRouter returns HTTP 402 (credit exhaustion), automatically
 * switches to MiniMax for the remainder of the request.
 *
 * Ported from liberty-trading-pro, extended with tool-calling and streaming.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AICallOptions {
  messages: AIMessage[]
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
  /** Optional model override (uses env default if not set) */
  model?: string
  /** Tool schemas exposed to the model */
  tools?: ToolSchema[]
}

export interface AICallResult {
  content: string
  toolCalls: ToolCall[]
  provider: 'openrouter' | 'minimax'
  model: string
}

// ── Provider configs ──────────────────────────────────────────────────────────

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-Text-01'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexus-ia.com.es'

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const MINIMAX_ENDPOINT = 'https://api.minimax.chat/v1/text/chatcompletion_v2'

export class OpenRouterCreditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenRouterCreditError'
  }
}

function openRouterHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not configured')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': SITE_URL,
    'X-Title': 'Nexus IA',
  }
}

// ── OpenRouter call ───────────────────────────────────────────────────────────

async function callOpenRouter(opts: AICallOptions): Promise<AICallResult> {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model: opts.model || OPENROUTER_MODEL,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
    }),
    signal: opts.signal ?? AbortSignal.timeout(60_000),
  })

  if (res.status === 402) {
    throw new OpenRouterCreditError('OpenRouter credit exhausted (402)')
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const message = data.choices?.[0]?.message ?? {}
  return {
    content: message.content ?? '',
    toolCalls: message.tool_calls ?? [],
    provider: 'openrouter',
    model: opts.model || OPENROUTER_MODEL,
  }
}

// ── MiniMax call (fallback) ───────────────────────────────────────────────────

async function callMiniMax(opts: AICallOptions): Promise<AICallResult> {
  const key = process.env.MINIMAX_API_KEY
  if (!key) throw new Error('MINIMAX_API_KEY not configured')

  // MiniMax has no tool-calling here; strip tool turns before sending.
  const minimaxMessages = opts.messages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({ role: m.role, content: m.content ?? '' }))

  const res = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: minimaxMessages,
      tokens_to_generate: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
      top_p: 0.95,
    }),
    signal: opts.signal ?? AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`MiniMax ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  return {
    content: data.reply || data.choices?.[0]?.message?.content || '',
    toolCalls: [],
    provider: 'minimax',
    model: MINIMAX_MODEL,
  }
}

// ── Main callAI (with fallback) ───────────────────────────────────────────────

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  try {
    return await callOpenRouter(opts)
  } catch (err) {
    if (err instanceof OpenRouterCreditError) {
      console.warn('[ai-providers] OpenRouter credit exhausted, falling back to MiniMax')
      try {
        const result = await callMiniMax(opts)
        console.log('[ai-providers] MiniMax fallback succeeded')
        return result
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        console.error('[ai-providers] MiniMax fallback also failed:', msg)
        throw new Error(`AI providers exhausted: OpenRouter (402) + MiniMax (${msg})`)
      }
    }
    throw err
  }
}

// ── Streaming ─────────────────────────────────────────────────────────────────

/**
 * Streams the assistant reply as plain text chunks.
 *
 * Falls back to a single non-streamed MiniMax chunk when OpenRouter credit is
 * exhausted, so the caller always gets a readable stream of text.
 */
export async function streamAI(opts: AICallOptions): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model: opts.model || OPENROUTER_MODEL,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
    signal: opts.signal ?? AbortSignal.timeout(60_000),
  })

  if (res.status === 402) {
    const fallback = await callMiniMax(opts)
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(fallback.content))
        controller.close()
      },
    })
  }

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter stream ${res.status}: ${errText.slice(0, 200)}`)
  }

  return parseSSEToText(res.body)
}

/** Converts an OpenAI-style SSE stream into a stream of plain text deltas. */
function parseSSEToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE events are separated by a blank line.
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const event of events) {
            for (const line of event.split('\n')) {
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (!payload || payload === '[DONE]') continue
              try {
                const json = JSON.parse(payload)
                const delta = json.choices?.[0]?.delta?.content
                if (delta) controller.enqueue(encoder.encode(delta))
              } catch {
                // Ignore keep-alives and malformed partial payloads.
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })
}
