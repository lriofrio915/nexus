import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Only these emails may reach the panel. Comma-separated in PANEL_ALLOWED_EMAILS. */
function allowedEmails(): string[] {
  return (process.env.PANEL_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function proxy(request: NextRequest) {
  const loginUrl = new URL('/panel/login', request.url)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fail closed: without Supabase configured nobody can be authenticated,
  // so deny rather than throwing a 500 that would leave the guard undefined.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[proxy] Supabase env vars missing; denying panel access')
    loginUrl.searchParams.set('error', 'sin-configurar')
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(loginUrl)
  }

  const allowed = allowedEmails()
  const email = user.email?.toLowerCase() ?? ''
  if (allowed.length === 0 || !allowed.includes(email)) {
    await supabase.auth.signOut()
    loginUrl.searchParams.set('error', 'no-autorizado')
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // Everything under /panel except the login page itself.
  matcher: ['/panel/((?!login).*)', '/panel'],
}
