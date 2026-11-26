import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { refreshPortfolioAndMarketNews } from '@/lib/news/fetch-news'
import {
  generateDailyBrief,
  getTodayBangkokDateString,
  invalidateDailyBriefCache,
} from '@/lib/news/news-analyzer'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    let targetDate: string | undefined = undefined
    try {
      const body = await req.json()
      if (body?.date) targetDate = body.date
    } catch {
      // no body
    }

    if (targetDate !== undefined && targetDate !== getTodayBangkokDateString()) {
      return NextResponse.json({ error: 'สร้างสรุปข่าวใหม่ได้เฉพาะวันที่ปัจจุบัน' }, { status: 400 })
    }
    invalidateDailyBriefCache(userId, targetDate)
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true, geminiApiKeyEncrypted: true },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const activeHoldings = holdingsResult.holdings.filter((h) => h.quantity > 0)

    // 1. Fetch fresh live news for market & all active holdings and prune stale news > 7 days
    await refreshPortfolioAndMarketNews(activeHoldings)

    // 2. Build technical context for holdings
    const userHoldingContexts = activeHoldings.map(({ ticker, assetName, allocationPercent }) => ({ ticker, assetName, allocationPercent }))

    // 3. Query only recent news within last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentNews = await prisma.newsItem.findMany({
      where: {
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: { publishedAt: 'desc' },
      take: 45,
    })

    const hasGeminiKey = Boolean(userSettings?.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY)
    const brief = await generateDailyBrief(
      userId,
      userHoldingContexts,
      recentNews,
      hasGeminiKey,
      true,
      targetDate
    )

    return NextResponse.json({ brief, date: targetDate })
  } catch (error: any) {
    console.error('[news brief POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to generate brief' }, { status: 500 })
  }
}
