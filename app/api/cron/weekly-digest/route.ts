import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { callGemini } from '@/lib/ai/gemini-client'
import { parseModelJson } from '@/lib/ai/model-contracts'
import { sendWeeklyDigest } from '@/lib/email/send'
import { z } from 'zod'
import {
  getUnifiedPortfolioContext,
  formatUnifiedContextPrompt,
  buildUnifiedDecisionRules,
} from '@/lib/ai/unified-context'

export const maxDuration = 60
const weeklyNarrative = z.object({
  portfolioSummary: z.string().trim().min(1).max(1800),
  newsSummary: z.string().trim().min(1).max(1800),
})

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if ((process.env.NODE_ENV === 'production' && !cronSecret) || (cronSecret && authHeader !== `Bearer ${cronSecret}`)) {
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
        // 1. Calculate holdings & health score with user's default preset targets
        const [holdingsResult, defaultPreset] = await Promise.all([
          calculateUserHoldings(user.id, setting.baseCurrency),
          prisma.investmentPreset.findFirst({
            where: { userId: user.id },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            select: { targetAllocation: true },
          }),
        ])
        const rawTargetAlloc = (defaultPreset?.targetAllocation as Record<string, unknown>) || undefined
        const cleanTargetAlloc = rawTargetAlloc
          ? (Object.fromEntries(
              Object.entries(rawTargetAlloc).filter(
                ([k, v]) => !k.startsWith('_') && typeof v === 'number'
              )
            ) as Record<string, number>)
          : undefined
        const healthScore = calculatePortfolioHealthScore(
          holdingsResult.holdings,
          cleanTargetAlloc && Object.keys(cleanTargetAlloc).length > 0 ? cleanTargetAlloc : undefined
        )

        // 2. Gather news for user's tickers in the past 7 days
        const userTickers = holdingsResult.holdings.map((h) => h.ticker)
        const [recentNews, unifiedCtx] = await Promise.all([
          prisma.newsItem.findMany({
            where: {
              symbol: { in: userTickers },
              publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            take: 5,
            orderBy: { publishedAt: 'desc' },
          }),
          getUnifiedPortfolioContext(user.id, {
            baseCurrency: setting.baseCurrency,
            holdingsResult,
          }).catch(() => null),
        ])

        const newsHeadlines = recentNews.map((n) => `[${n.symbol}] ${n.headline} (${n.sourceName}, ${n.publishedAt.toISOString().slice(0, 10)})`).join('\n')

        // 3. Prompt Gemini
        const prompt = `
สรุปพอร์ตการลงทุนประจำสัปดาห์
- มูลค่าพอร์ตตามระบบ: ${holdingsResult.totalValueBase.toLocaleString()} ${setting.baseCurrency}
- กำไร/ขาดทุนสะสม: ${holdingsResult.unrealizedPnLPercent.toFixed(2)}%
- Health Score: ${healthScore.score}/100
- สินทรัพย์ที่ถือครอง: ${userTickers.join(', ') || 'ยังไม่มี'}

${unifiedCtx ? formatUnifiedContextPrompt(unifiedCtx, { excludeSurface: 'weekly_digest', compact: true }) : ''}

${buildUnifiedDecisionRules('weekly_digest')}

หัวข้อข่าวที่เกี่ยวข้องกับหุ้นที่ถือในสัปดาห์นี้:
${newsHeadlines || 'ไม่มีข่าวเด่น'}

กรุณาสรุป 2 ส่วนสั้นๆ ในภาษาไทย ให้เชื่อมโยงกับจุดยืนตลาดและความเสี่ยงล่าสุด (ตอบเป็น JSON):
{
  "portfolioSummary": "ย่อหน้าเดียว สรุปสถานะพอร์ต แผนสัปดาห์หน้า 1-2-3 ที่สอดคล้องกับ AI หน้าอื่น",
  "newsSummary": "สรุปเฉพาะข่าวที่แนบหรือระบุว่าไม่พบข่าว แยกข้อเท็จจริงจากผลกระทบที่เป็นสมมติฐาน"
}
`

        let parsedAi = {
          portfolioSummary: `สรุปจากข้อมูลระบบ มูลค่าพอร์ต ${holdingsResult.totalValueBase.toLocaleString()} ${setting.baseCurrency} สุขภาพพอร์ตเกรด ${healthScore.grade}`,
          newsSummary: newsHeadlines || 'ไม่พบหัวข้อข่าวที่ตรงกับสินทรัพย์ในช่วง 7 วันที่ตรวจ',
          healthScoreChange: 0,
        }

        try {
          const { text } = await callGemini({
            userId: user.id, prompt, logType: 'weekly_digest',
            validateJson: (value) => weeklyNarrative.safeParse(value).success,
            timeoutMs: 10_000,
          })
          const narrative = weeklyNarrative.parse(parseModelJson(text))
          parsedAi = { ...parsedAi, ...narrative, newsSummary: recentNews.length ? narrative.newsSummary : parsedAi.newsSummary }
        } catch {
          // The database summary is available even when AI is unavailable.
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
          await prisma.weeklyDigest.update({
            where: {
              userId_weekOf: {
                userId: user.id,
                weekOf: monday,
              },
            },
            data: { deliveredAt: new Date() },
          })
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
