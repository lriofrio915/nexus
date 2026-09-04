/**
 * rate-limit.ts — In-memory sliding-window limiter.
 *
 * Scoped to a single serverless instance, so it is a cost guard rather than a
 * security control: it blunts a single visitor hammering the chat endpoint and
 * burning OpenRouter credit. Swap for a shared store if abuse becomes real.
 */

const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, max: number): RateLimitResult {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

  if (recent.length >= max) {
    hits.set(key, recent)
    const oldest = recent[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    }
  }

  recent.push(now)
  hits.set(key, recent)

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
    }
  }

  return { allowed: true, remaining: max - recent.length, retryAfterSeconds: 0 }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
