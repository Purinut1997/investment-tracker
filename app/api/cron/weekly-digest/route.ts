import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { callGemini } from '@/lib/ai/gemini-client'
import { sendWeeklyDigest } from '@/lib/email/send'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Monday of the current week
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diffToMonday))
  monday.setUTCHours(0, 0, 0, 0)
  const weekOfStr = monday.toISOString().split('T')[0]

  const results = {
    processedUsers: 0,
    emailsSent: 0,
    errors: [] as string[],
  }

  try {
    // Find users with weekly digest enabled
    const usersWithDigest = await prisma.userSettings.findMany({
      where: { weeklyDigestEnabled: true },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      take: 10, // Batch limit
    })

    for (const setting of usersWithDigest) {
      const user = setting.user
      try {
        // 1. Calculate holdings
        const holdingsResult = await calculateUserHoldings(user.id, setting.baseCurrency)
        const healthScore = calculatePortfolioHealthScore(holdingsResult.holdings)

        // 2. Gather news for user's tickers in the past 7 days
        const userTickers = holdingsResult.holdings.map((h) => h.ticker)
        const recentNews = await prisma.newsItem.findMany({
          where: {
            symbol: { in: userTickers },
            publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          take: 5,
        })

        const newsHeadlines = recentNews.map((n) => `[${n.symbol}] ${n.headline}`).join('\n')

        // 3. Prompt Gemini
        const prompt = `
สรุปพอร์ตการลงทุนประจำสัปดาห์ สำหรับผู้ใช้ ${user.name || user.email}:
- มูลค่าพอร์ตรวม: ฿${holdingsResult.totalValueBase.toLocaleString()}
- กำไร/ขาดทุนสะสม: ${holdingsResult.unrealizedPnLPercent.toFixed(2)}%
- Health Score: ${healthScore.score}/100
- สินทรัพย์ที่ถือครอง: ${userTickers.join(', ') || 'ยังไม่มี'}

หัวข้อข่าวที่เกี่ยวข้องกับหุ้นที่ถือในสัปดาห์นี้:
${newsHeadlines || 'ไม่มีข่าวเด่น'}

กรุณาสรุป 2 ส่วนสั้นๆ ในภาษาไทย (ตอบเป็น JSON):
{
  "portfolioSummary": "ย่อหน้าเดียว สรุปสถานะพอร์ตและคำแนะนำในสัปดาห์นี้",
  "newsSummary": "ย่อหน้าเดียว สรุปประเด็นข่าวที่กระทบหุ้นที่ถือ",
  "healthScoreChange": 0
}
`

        const { text } = await callGemini({
          userId: user.id,
          prompt,
          logType: 'weekly_digest',
          systemInstruction: 'คุณเป็น AI สรุปข่าวและวิเคราะห์พอร์ตประจำสัปดาห์ ตอบเป็น JSON ที่ถูกต้องเท่านั้น',
        })

        let parsedAi = {
          portfolioSummary: `สรุปพอร์ตสัปดาห์นี้ มูลค่ารวม ฿${holdingsResult.totalValueBase.toLocaleString()} สุขภาพพอร์ตเกรด ${healthScore.grade}`,
          newsSummary: 'ตลาดโดยรวมมีความผันผวนตามปัจจัยมหภาค',
          healthScoreChange: 0,
        }

        try {
          const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
          parsedAi = { ...parsedAi, ...JSON.parse(cleanText) }
        } catch {
          // Fallback to text directly
          parsedAi.portfolioSummary = text
        }

        // 4. Save WeeklyDigest record
        const digest = await prisma.weeklyDigest.upsert({
          where: {
            userId_weekOf: {
              userId: user.id,
              weekOf: monday,
            },
          },
          update: {
            portfolioSummaryText: parsedAi.portfolioSummary,
            newsSummaryText: parsedAi.newsSummary,
            healthScoreChange: parsedAi.healthScoreChange,
            generatedAt: new Date(),
          },
          create: {
            userId: user.id,
            weekOf: monday,
            portfolioSummaryText: parsedAi.portfolioSummary,
            newsSummaryText: parsedAi.newsSummary,
            healthScoreChange: parsedAi.healthScoreChange,
            deliveryMethod: setting.weeklyDigestDeliveryMethod as any,
          },
        })

        // 5. Send Email if delivery includes email
        if (
          setting.weeklyDigestDeliveryMethod === 'email' ||
          setting.weeklyDigestDeliveryMethod === 'both'
        ) {
          await sendWeeklyDigest(
            user.email,
            user.name || 'นักลงทุน',
            `${parsedAi.portfolioSummary}\n\n${parsedAi.newsSummary}`,
            weekOfStr
          )
          results.emailsSent++
        }

        results.processedUsers++
      } catch (userErr: any) {
        results.errors.push(`User ${user.id} error: ${userErr.message}`)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('[cron/weekly-digest]', error)
    return NextResponse.json({ error: error.message || 'Weekly digest cron failed' }, { status: 500 })
  }
}
