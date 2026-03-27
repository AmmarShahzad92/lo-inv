import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'session'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

async function hasValidSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return false

  const secret = getSecret()
  if (!secret) return false

  try {
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isPublicApi = pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')
  const isPublicAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico'

  if (isPublicAsset || isPublicApi) {
    return NextResponse.next()
  }

  const valid = await hasValidSession(request)

  if (!valid && !isAuthPage) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  if (valid && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
