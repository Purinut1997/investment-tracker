import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/auth/logout
 * Bulletproof server-side session termination:
 * Explicitly expires all NextAuth v5 & v4 session and CSRF cookies
 * across both HTTP and HTTPS / Secure variants.
 */
export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' })

  const isSecure =
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https'

  const cookieNames = [
    // NextAuth v5 (Auth.js) session tokens
    'authjs.session-token',
    '__Secure-authjs.session-token',
    // NextAuth v4 legacy session tokens
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    // CSRF tokens
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    // Callback & State tokens
    'authjs.callback-url',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'authjs.pkce.code_verifier',
    'next-auth.pkce.code_verifier',
    'authjs.state',
    'next-auth.state',
  ]

  cookieNames.forEach((name) => {
    // Delete for root path
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
    })

    // Also delete without secure flag to cover all bases
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    })
  })

  return response
}
