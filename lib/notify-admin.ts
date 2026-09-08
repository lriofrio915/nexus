/**
 * notify-admin.ts — operational notices to Luis, through the OpenClaw bridge.
 *
 * This replaces a direct Evolution API call that had been failing silently.
 * Two things were wrong with it, and only the first was obvious:
 *
 *   1. `EVOLUTION_INSTANCE` pointed at "dr-cmadminlri", which no longer exists
 *      on the server — every send came back 404. The only live instance there
 *      belongs to a different business, so it is not ours to borrow.
 *
 *   2. It sent to `siteConfig.whatsappNumber`, which is the site's *public*
 *      contact number — the one visitors tap in the wa.me link, answered by the
 *      nexus_claw bot. A lead notice reading "Luis will contact you" was being
 *      delivered to the bot's own inbox rather than to Luis. Fixing the instance
 *      alone would have produced a working pipeline to the wrong person.
 *
 * The bridge is the channel that already works: it is reachable from Vercel, it
 * authenticates with a bearer token, and it queues to disk and retries when the
 * WhatsApp session is down, so a lead raised at midnight is not lost to a dead
 * session. Its recipient is fixed to Luis by the bridge's own configuration, so
 * this module deliberately takes no phone number: there is no recipient to get
 * wrong, and nothing here can reach the nexus_claw number.
 */

export interface NotifyResult {
  ok: boolean
  /** The bridge confirmed WhatsApp accepted it. */
  delivered?: boolean
  /** Held in the bridge's on-disk queue; it will keep retrying for 24h. */
  queued?: boolean
  error?: string
}

/**
 * The bridge answers only once the OpenClaw CLI has attempted delivery, which
 * takes about 15 seconds. The timeout has to clear that with room to spare, or
 * the notice is lost to a timeout at precisely the moment it mattered.
 */
const TIMEOUT_MS = 60_000

/**
 * The bridge's payload shape, and it is not `{ text }`.
 *
 * `extractMessage` reads `data.resumen`, then `data.message`, and if neither is
 * there it falls back to `[${event}] ${JSON.stringify(data)}`. A body of
 * `{ text }` therefore leaves `data` empty and is delivered — successfully,
 * reporting `delivered: true` — as the literal string "[unknown] {}". The send
 * succeeds and the message is worthless, which is the worst combination: the
 * caller has no way to tell.
 */
export async function notifyAdmin(text: string, event = 'nexus'): Promise<NotifyResult> {
  const url = process.env.OPENCLAW_WEBHOOK_URL
  const token = process.env.OPENCLAW_WEBHOOK_TOKEN

  if (!url || !token) {
    const missing = [!url && 'OPENCLAW_WEBHOOK_URL', !token && 'OPENCLAW_WEBHOOK_TOKEN']
      .filter(Boolean)
      .join(', ')
    console.error(`[notifyAdmin] Missing env vars: ${missing}`)
    return { ok: false, error: `Missing env vars: ${missing}` }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data: { message: text } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[notifyAdmin] bridge ${res.status}: ${body.slice(0, 200)}`)
      return { ok: false, error: `Bridge returned ${res.status}` }
    }

    // `delivered` is what matters, not the status code: the bridge answers 202
    // with `queued` when WhatsApp is down, which means "not yet", not "lost".
    const body = (await res.json().catch(() => ({}))) as {
      delivered?: boolean
      queued?: boolean
    }

    return { ok: true, delivered: body.delivered === true, queued: body.queued === true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notifyAdmin] Request failed:', msg)
    return { ok: false, error: msg }
  }
}
