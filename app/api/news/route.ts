import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fetchMarketNews, fetchCompanyNews } from '@/lib/news/fetch-news'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') ?? 'portfolio' // 'portfolio' | 'general'
  const symbol = searchParams.get('symbol')

  try {
    let whereClause: any = {}

    // Find user's active holdings tickers
    const userAssets = await prisma.transaction.findMany({
      where: { userId },
      select: { asset: { select: { ticker: true } } },
      distinct: ['assetId'],
    })

    const userTickers = userAssets.map((a) => a.asset.ticker)

    if (symbol) {
      whereClause.symbol = symbol.toUpperCase()
    } else if (category === 'portfolio') {
      if (userTickers.length > 0) {
        whereClause.symbol = { in: userTickers }
      } else {
        whereClause.symbol = { not: null }
      }
    } else {
      // General market
      whereClause.symbol = null
    }

    let items = await prisma.newsItem.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      take: 40,
    })

    // If cache is empty or sparse, trigger fresh fetch and re-query
    if (items.length < 5) {
      if (category === 'general') {
        await fetchMarketNews()
      } else if (userTickers.length > 0) {
        await Promise.all(userTickers.slice(0, 4).map((t) => fetchCompanyNews(t)))
      } else {
        await fetchMarketNews()
      }

      items = await prisma.newsItem.findMany({
        where: whereClause,
        orderBy: { publishedAt: 'desc' },
        take: 40,
      })
    }

    return NextResponse.json({
      items,
      userTickers,
      category,
    })
  } catch (error) {
    console.error('[news GET]', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
