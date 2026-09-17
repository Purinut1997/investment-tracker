/**
 * auth.ts — NextAuth v5 configuration
 * Supports: Google OAuth + Email/Password (Credentials)
 * Uses: Prisma Adapter, JWT strategy
 */

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  checkLoginRateLimit,
  recordLoginAttempt,
} from '@/lib/auth/rate-limit'
import { promoteSuperadminIfNeeded } from '@/lib/auth/superadmin'
import type { UserRole } from '@prisma/client'

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
      emailVerified?: Date | null
      sessionVersion: number
    }
  }
  interface User {
    role: UserRole
    emailVerified?: Date | null
    sessionVersion: number
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    role: UserRole
    emailVerified?: Date | null
    sessionVersion: number
  }
}

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days

  providers: [
    // ─── Google OAuth ────────────────────────────────────────
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false, // we handle linking ourselves
    }),

    // ─── Email + Password ─────────────────────────────────────
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        ipAddress: { label: 'IP', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = CredentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const ipAddress = (credentials?.ipAddress as string) ?? 'unknown'

        // Rate limit check
        const rateLimit = await checkLoginRateLimit(email, ipAddress)
        if (!rateLimit.allowed) {
          throw new Error(
            `TOO_MANY_ATTEMPTS:${rateLimit.lockoutUntil?.toISOString()}`
          )
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) {
          await recordLoginAttempt(email, ipAddress, false)
          await prisma.auditLog.create({
            data: {
              userId: user?.id,
              action: 'LOGIN_FAILED',
              detail: { email, reason: 'user_not_found_or_no_password' },
              ipAddress,
            },
          })
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordMatch) {
          await recordLoginAttempt(email, ipAddress, false)
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'LOGIN_FAILED',
              detail: { email, reason: 'wrong_password' },
              ipAddress,
            },
          })
          return null
        }

        if (user.status === 'suspended') {
          throw new Error('ACCOUNT_SUSPENDED')
        }

        await recordLoginAttempt(email, ipAddress, true)

        // Auto-promote superadmin if email matches
        await promoteSuperadminIfNeeded(user.id, user.email)

        // Re-fetch after potential promotion
        const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
        return {
          id: freshUser!.id,
          email: freshUser!.email,
          name: freshUser!.name,
          image: freshUser!.avatarUrl,
          role: freshUser!.role,
          emailVerified: freshUser!.emailVerified,
          sessionVersion: freshUser!.sessionVersion,
        }
      },
    }),
  ],

  callbacks: {
    // ─── Account Linking (Google + existing email/password) ───
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Verify Google email is verified
        if (!profile?.email_verified) return false

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (existingUser) {
          // Link Google to existing credentials account
          if (existingUser.authProvider === 'credentials') {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                authProvider: 'both',
                avatarUrl: user.image ?? existingUser.avatarUrl,
                emailVerified: new Date(),
              },
            })
          }
          // Auto-promote superadmin
          await promoteSuperadminIfNeeded(existingUser.id, existingUser.email)
        }
      }
      return true
    },

    // ─── JWT: embed role + sessionVersion ─────────────────────
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id!
        token.role = user.role
        token.emailVerified = user.emailVerified ?? null
        token.sessionVersion = user.sessionVersion
      }

      // Refresh token on update
      if (trigger === 'update') {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        })
        if (freshUser) {
          token.role = freshUser.role
          token.sessionVersion = freshUser.sessionVersion
          token.emailVerified = freshUser.emailVerified
        }
      }

      return token
    },

    // ─── Session: expose role + sessionVersion to client ──────
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.emailVerified = token.emailVerified as Date | null
        session.user.sessionVersion = token.sessionVersion as number
      }

      // Validate session version (for "logout all devices")
      if (session.user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { sessionVersion: true, status: true },
        })
        if (
          !dbUser ||
          dbUser.status === 'suspended' ||
          dbUser.sessionVersion !== session.user.sessionVersion
        ) {
          // Invalidate session by returning a session with empty user
          return { ...session, user: { ...session.user, id: '' } }
        }
      }

      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
})
