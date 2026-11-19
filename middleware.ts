/**
 * middleware.ts — Next.js middleware for route protection
 * - /admin/* → admin/superadmin only
 * - /superadmin/* → superadmin only
 * - All /api/* routes with user data → requires authenticated session
 * - Public: /login, /register, /forgot-password, /reset-password, /api/auth/*
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/api/auth',
  '/api/cron',
  '/api/market-data',
  '/api/market-watch',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths without authentication
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Verify JWT session token directly without bundling heavy Node/Prisma modules
  const isSecure =
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https'
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

  let token = await getToken({
    req,
    secret,
    secureCookie: isSecure,
  })

  if (!token) {
    token = await getToken({
      req,
      secret,
      secureCookie: !isSecure,
    })
  }

  // Reject or redirect unauthenticated users
  if (!token || !token.id) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = (token.role as string) || 'user'

  // /superadmin/* & /api/superadmin/* → superadmin only
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    if (role !== 'superadmin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // /admin/* → admin or superadmin only
  if (pathname.startsWith('/admin')) {
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|gif)).*)',
  ],
}
