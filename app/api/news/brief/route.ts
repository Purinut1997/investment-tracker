import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { generateDailyBrief } from '@/lib/news/news-analyzer'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true, geminiApiKeyEncrypted: true },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const activeHoldings = holdingsResult.holdings.filter((h) => h.quantity > 0)
    const userTickers = activeHoldings.map((h) => h.ticker.toUpperCase())

    // Fetch recent news
    const recentNews = await prisma.newsItem.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 20,
    })

    const hasGeminiKey = Boolean(userSettings?.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY)
    const brief = await generateDailyBrief(userId, userTickers, recentNews, hasGeminiKey)

    return NextResponse.json({ brief })
  } catch (error: any) {
    console.error('[news brief POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to generate brief' }, { status: 500 })
  }
}
