import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveMarketQuote } from '@/lib/market-data/resolver'
import { WatchlistType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      orderBy: [{ sortOrder: 'asc' }, { addedAt: 'desc' }],
    })

    if (items.length === 0) {
      return NextResponse.json({ items: [], timestamp: Date.now() })
    }

    // Parallel fetch live quotes for all watchlist items
    const populated = await Promise.all(
      items.map(async (item) => {
        try {
          const resolved = await resolveMarketQuote(item.symbol, item.itemType)
          return {
            ...item,
            quote: resolved.quote,
            market: resolved.market,
          }
        } catch {
          return {
            ...item,
            quote: null,
            market: 'US',
          }
        }
      })
    )

    return NextResponse.json({
      items: populated,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[watchlist GET]', error)
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { symbol: rawSymbol, displayName, itemType, market } = body

    if (!rawSymbol || typeof rawSymbol !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุสัญลักษณ์หรือชื่อย่อหุ้น' }, { status: 400 })
    }

    const cleanSymbol = rawSymbol.trim().toUpperCase()

    // 1. Check if item already exists in user's watchlist
    const existing = await prisma.watchlistItem.findFirst({
      where: {
        userId: session.user.id,
        symbol: cleanSymbol,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `"${cleanSymbol}" อยู่ในรายการที่สนใจของคุณเรียบร้อยแล้ว` },
        { status: 409 }
      )
    }

    // 2. Fetch live quote to validate and get asset name
    const resolved = await resolveMarketQuote(cleanSymbol, itemType, market)

    const finalItemType: WatchlistType =
      itemType && Object.values(WatchlistType).includes(itemType)
        ? itemType
        : resolved.itemType || 'stock'

    const finalDisplayName =
      displayName?.trim() || resolved.quote?.name || cleanSymbol

    // 3. Determine next sortOrder
    const last = await prisma.watchlistItem.findFirst({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    const sortOrder = (last?.sortOrder ?? -1) + 1

    // 4. Create WatchlistItem in database
    const created = await prisma.watchlistItem.create({
      data: {
        userId: session.user.id,
        symbol: cleanSymbol,
        displayName: finalDisplayName,
        itemType: finalItemType,
        sortOrder,
      },
    })

    return NextResponse.json(
      {
        item: {
          ...created,
          quote: resolved.quote,
          market: resolved.market,
        },
        success: true,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[watchlist POST]', error)
    return NextResponse.json({ error: 'Failed to add item to watchlist' }, { status: 500 })
  }
}
