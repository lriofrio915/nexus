/**
 * sendWA.ts — WhatsApp delivery through the self-hosted Evolution API.
 *
 * Every value comes from the environment; there are deliberately no literal
 * credential fallbacks in this file.
 */

export interface SendWAResult {
  ok: boolean
  error?: string
}

export async function sendWA(phone: string, text: string): Promise<SendWAResult> {
  const baseUrl = process.env.EVOLUTION_API_URL
  const instance = process.env.EVOLUTION_INSTANCE
  const apiKey = process.env.EVOLUTION_API_KEY

  if (!baseUrl || !instance || !apiKey) {
    const missing = [
      !baseUrl && 'EVOLUTION_API_URL',
      !instance && 'EVOLUTION_INSTANCE',
      !apiKey && 'EVOLUTION_API_KEY',
    ]
      .filter(Boolean)
      .join(', ')
    console.error(`[sendWA] Missing env vars: ${missing}`)
    return { ok: false, error: `Missing env vars: ${missing}` }
  }

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/message/sendText/${instance}`,
      {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[sendWA] Evolution ${res.status}: ${body.slice(0, 200)}`)
      return { ok: false, error: `Evolution API returned ${res.status}` }
    }

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sendWA] Request failed:', msg)
    return { ok: false, error: msg }
  }
}
