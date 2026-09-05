import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  checkPassword,
  createSessionToken,
  sessionCookieOptions,
} from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/** Attempts per minute per IP. Low on purpose: one operator, one password. */
const LOGIN_ATTEMPTS = 5

export async function POST(req: Request) {
  const ip = clientIp(req.headers)
  const limit = rateLimit(`panel-login:${ip}`, LOGIN_ATTEMPTS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  let password: string
  try {
    const body = await req.json()
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 })
  }

  if (!checkPassword(password)) {
    // Deliberately vague: never reveal whether the password store is configured.
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 })
  }

  let token: string
  try {
    token = await createSessionToken()
  } catch (err) {
    console.error('[panel/login] cannot sign session:', err)
    return NextResponse.json({ error: 'El panel no está configurado.' }, { status: 503 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions)
  return res
}
