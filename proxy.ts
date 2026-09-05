import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value

  // verifySessionToken fails closed on a missing or weak PANEL_SESSION_SECRET,
  // so a misconfigured deployment denies access rather than opening the panel.
  if (await verifySessionToken(token)) {
    return NextResponse.next({ request })
  }

  const loginUrl = new URL('/panel/login', request.url)
  // Come back to the requested page after signing in.
  const target = request.nextUrl.pathname + request.nextUrl.search
  if (target && target !== '/panel') loginUrl.searchParams.set('next', target)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Everything under /panel except the login page itself.
  matcher: ['/panel/((?!login).*)', '/panel'],
}
