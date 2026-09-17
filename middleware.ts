/**
 * middleware.ts — Next.js middleware for route protection
 * - /admin/* → admin/superadmin only
 * - /superadmin/* → superadmin only
 * - All /api/* routes with user data → requires authenticated session
 * - Public: /login, /register, /forgot-password, /reset-password, /api/auth/*
 */

import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Allow public paths without authentication
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Redirect unauthenticated users to login
  if (!session || !session.user?.id) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const { role } = session.user

  // /superadmin/* → superadmin only
  if (pathname.startsWith('/superadmin')) {
    if (role !== 'superadmin') {
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
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
}
