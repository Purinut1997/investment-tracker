/**
 * GET /api/assets/search
 * Search or list assets. Used in transaction form ticker search.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
    const { ticker, assetName, assetType, market, exchange, currency } = body

    if (!ticker || !assetName || !assetType || !market) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const asset = await prisma.asset.upsert({
      where: { ticker_market: { ticker: ticker.toUpperCase(), market } },
      update: { assetName, exchange, currency },
      create: {
        ticker: ticker.toUpperCase(),
        assetName,
        assetType,
        market,
        exchange,
        currency: currency ?? 'USD',
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('[assets POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
