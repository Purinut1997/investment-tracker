/**
 * GET /api/assets/search
 * Search or list assets. Used in transaction form ticker search.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const CreateAssetSchema = z.object({
  ticker: z.string().trim().min(1).max(30),
  assetName: z.string().trim().min(1).max(120),
  assetType: z.enum(['stock', 'fund', 'crypto', 'bond', 'gold']),
  market: z.enum(['US', 'TH', 'CRYPTO']),
  exchange: z.string().trim().max(50).optional().nullable(),
  currency: z.string().trim().max(10).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const market = req.nextUrl.searchParams.get('market')

  if (q.length < 1) {
    return NextResponse.json([])
  }

  const assets = await prisma.asset.findMany({
    where: {
      OR: [
        { ticker: { contains: q.toUpperCase(), mode: 'insensitive' } },
        { assetName: { contains: q, mode: 'insensitive' } },
      ],
      ...(market && { market: market as any }),
    },
    take: 20,
    orderBy: { ticker: 'asc' },
  })

  return NextResponse.json(assets)
}

/**
 * POST /api/assets
 * Create a new asset (admin or system use).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = CreateAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid asset payload' },
        { status: 400 }
      )
    }

    const { ticker, assetName, assetType, market, exchange, currency } = parsed.data
    const normalizedTicker = ticker.toUpperCase()
    const defaultCurrency =
      currency || (market === 'US' || market === 'CRYPTO' ? 'USD' : 'THB')
    const role = (session.user as { role?: string }).role
    const isAdmin = role === 'admin' || role === 'superadmin'

    const asset = await prisma.asset.upsert({
      where: { ticker_market: { ticker: normalizedTicker, market } },
      update: isAdmin
        ? {
            assetName,
            ...(exchange !== undefined ? { exchange } : {}),
            ...(currency ? { currency } : {}),
          }
        : {},
      create: {
        ticker: normalizedTicker,
        assetName,
        assetType,
        market,
        exchange: exchange ?? null,
        currency: defaultCurrency,
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('[assets POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
