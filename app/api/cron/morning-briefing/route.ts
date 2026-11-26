import { advisorFlags } from '@/lib/ai/advisor-rollout'
import { generateAdvisorBrief, readAdvisorBrief } from '@/lib/ai/advisor-daily'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { formatMarketObservation, getObservationTime } from '@/lib/ai/advisor-evidence'
import { fetchRealHumanSentiment } from '@/lib/market-data/fear-greed'
import { callGemini } from '@/lib/ai/gemini-client'
import { runTacticalAnalysis } from '@/lib/ai/tactical-analysis'
import {
  getUnifiedPortfolioContext,
  formatUnifiedContextPrompt,
  buildUnifiedDecisionRules,
  invalidateUnifiedContextCache,
} from '@/lib/ai/unified-context'

export const maxDuration = 60

function getTodayBangkokDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

export async function GET(req: NextRequest) {
  // 1. Verify CRON_SECRET (fail-closed in production)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if ((process.env.NODE_ENV === 'production' && !cronSecret) || (cronSecret && authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  const todayStr = getTodayBangkokDateString()
  const results = {
    date: todayStr,
    usersChecked: 0,
    briefsGenerated: 0,
    tacticalSnapshotsGenerated: 0,
    skippedAlreadyGenerated: 0,
    errors: [] as string[],
    timestamp: new Date().toISOString(),
  }

  try {
    const now = Date.now()
    const indicators = ['S&P 500', 'NASDAQ', 'VIX', 'SET INDEX', 'XAU']
    const [observations, sentiment] = await Promise.all([
      Promise.all(indicators.map(async (symbol) => {
        const quote = await yahooFinanceProvider.getQuote(symbol).catch(() => null)
        return formatMarketObservation(symbol, quote ? { ...quote, timestamp: quote.observationTimestamp ?? 0 } : null, now)
      })),
      fetchRealHumanSentiment().catch(() => null),
    ])
    const fearGreedSummary = sentiment?.source === 'CNN_LIVE' && getObservationTime(Date.parse(sentiment.timestamp), now)
      && Number.isFinite(sentiment.score) ? `${sentiment.score}/100 (CNN ณ ${sentiment.timestamp})` : 'ยังยืนยันข้อมูล CNN ไม่ได้'
    const benchmarksSummary = observations.join('\n')

    // 3. Find active users with transactions
    const distinctUsers = await prisma.transaction.findMany({
      select: { userId: true },
      distinct: ['userId'],
      take: 10,
    })

    results.usersChecked = distinctUsers.length

    for (const { userId } of distinctUsers) {
      try {
        const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
        const baseCurrency = userSettings?.baseCurrency ?? 'THB'
        const startOfTodayBangkok = new Date(`${todayStr}T00:00:00+07:00`)

        const flags = advisorFlags(userId)
        if (flags.daily || flags.shadow) {
          try {
            const brief = await generateAdvisorBrief(userId, todayStr, false, 'cron')
            if (brief.status === 'generated') results.briefsGenerated++
            else results.skippedAlreadyGenerated++
          } catch (error) {
            results.errors.push(`Advisor brief ${userId}: ${error instanceof Error ? error.message : 'Error'}`)
          }
        }

        if (!flags.daily) {
          const existingBriefLog = await readAdvisorBrief(userId, todayStr)

          if (!existingBriefLog) {
            // Calculate user's current holdings
            const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
            if (holdingsResult.holdings && holdingsResult.holdings.length > 0) {
              // Scan technical triggers for top holdings
              const topHoldings = holdingsResult.holdings.slice(0, 8)
              const triggerLines: string[] = []

              for (const h of topHoldings) {
                try {
                  const marketHint = h.market || (h.currency === 'THB' ? 'TH' : 'US')
                  const signal = await fetchSingleTickerTechnicalSignal(h.ticker, marketHint, false, true)
                  const observedAt = getObservationTime(signal.observationTimestamp, Date.now())
                  if (!observedAt || !(signal.currentPrice > 0)) continue
                  const currSym = h.currency === 'THB' ? '฿' : '$'
                  const s1Str = signal?.supportS1 ? `${currSym}${signal.supportS1}` : 'N/A'
                  triggerLines.push(
                    `- ${h.ticker} (${h.assetName}): ราคา ${currSym}${signal.currentPrice} ณ ${observedAt} | สัดส่วน ${h.allocationPercent.toFixed(1)}% | RSI(14): ${signal.rsi14 ?? 'ไม่มีข้อมูล'} | S1: ${s1Str}`
                  )
                } catch {}
              }

              if (triggerLines.length > 0) {
                const unifiedCtx = await getUnifiedPortfolioContext(userId, {
                  baseCurrency,
                  holdingsResult,
                }).catch(() => null)
                const prompt = `
  [AI Daily Investment Strategist — สรุปเช้าและแผนปฏิบัติการรายวัน]
  [daily-brief:v2]
  คุณคือ Senior Portfolio Strategist สรุปทิศทางตลาดและแผนปฏิบัติการลงทุนรายวัน วันที่ ${todayStr}:

  [ข้อมูลสภาวะตลาดวันนี้]
  - ดัชนีอารมณ์ตลาด: ${fearGreedSummary}
  - ดัชนีหลักชี้นำ: ${benchmarksSummary}

  [ภาพรวมพอร์ตโฟลิโอ]
  - มูลค่าพอร์ตรวม: ${Number(holdingsResult.totalValueBase).toLocaleString()} ${baseCurrency}

  [สินทรัพย์ในพอร์ตที่ส่งสัญญาณเทคนิคัลวันนี้ (Holdings with Technical Signals)]
  ${triggerLines.join('\n')}

  ${unifiedCtx ? formatUnifiedContextPrompt(unifiedCtx, { excludeSurface: 'daily_brief', compact: true }) : ''}

  ${buildUnifiedDecisionRules('daily_brief')}

  [กฎเหล็กการประเมินความเสี่ยงตามความเป็นจริง]:
  - งดตั้งราคา สัดส่วนเงินสด และจุดซื้อขายเพิ่มเมื่อข้อมูลไม่พอ ระบุช่วงเวลาของตลาดและข้อจำกัดให้ชัด

  [กฎเหล็กและข้อห้ามเด็ดขาดเพื่อความกระชับสูงสุด]:
  1. ห้ามใส่คำทักทายเด็ดขาด (ห้ามเขียน "เรียน ท่าน...", "สวัสดีครับ", "ยินดีต้อนรับ") ให้เริ่มต้นที่เนื้อหาส่วนที่ 1 ทันที
  2. ตัดคำฟุ่มเฟือยทิ้งทั้งหมด เขียนกระชับ คม ตรงประเด็น ใช้เวลาอ่านจับใจความไม่เกิน 1 นาที
  3. ต้องระบุชื่อสินทรัพย์ทุกตัวด้วย "สัญลักษณ์ย่อ Ticker Symbol" ตัวพิมพ์ใหญ่เสมอ (เช่น NVDA, AAPL, SCHD, VOO, GOOGL, SCB, PTT)

  รูปแบบบทวิเคราะห์ (แบ่งเป็น 3 ส่วนชัดเจน):
  1. 🧭 **ทิศทางตลาดและบรรยากาศมหภาควันนี้ (Market Regime & Macro Pulse)**: สรุปภาพรวมทิศทางดัชนีหลักและปัจจัยสำคัญใน 1-2 ประโยคสั้นๆ ให้จบใจความทันที
  2. 🎯 **วิเคราะห์เจาะจงสินทรัพย์ในพอร์ต (Key Support & Triggers)**:
  - ขึ้นต้นแต่ละบรรทัดด้วย: - **TICKER ($ราคา หรือ ฿ราคา | RSI: xx | S1: $xx หรือ ฿xx):** [ระบุคำแนะนำสั้นๆ 1 บรรทัดจบ เช่น ช้อนซื้อจุดได้เปรียบ Oversold / ชะลอการไล่ราคาใกล้แนวต้าน / ถือรอจังหวะ]
  3. 📋 **แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้ (Today's 3 Execution Steps)**:
  - 1. **[คำสั่งสั้นๆ เช่น ตั้งรับ GOOGL ที่แนวรับ $301]:** [เหตุผล 1 ประโยค]
  - 2. **[คำสั่งสั้นๆ]:** [เหตุผล 1 ประโยค]
  - 3. **[คำสั่งสั้นๆ]:** [เหตุผล 1 ประโยค]
  `

                await callGemini({
                  userId,
                  prompt,
                  logType: 'advisor',
                  systemInstruction:
                    'คุณเป็น Senior Portfolio Strategist ที่ให้คำแนะนำการลงทุนตามหลักการบริหารความเสี่ยงระดับสถาบัน ชัดเจน ตรงประเด็น ใช้ภาษาไทยเข้าใจง่าย',
                })
                invalidateUnifiedContextCache(userId)

                results.briefsGenerated++
              }
            }
          } else {
            results.skippedAlreadyGenerated++
          }

        }

        // 2. Pre-compute Daily AI Tactical Advisor Snapshot
        try {
          const existingTacticalLog = await prisma.aiAdviceLog.findFirst({
            where: {
              userId,
              logType: 'advisor',
              prompt: { contains: '[tactical-evidence:v2]' },
              createdAt: { gte: startOfTodayBangkok },
            },
          })

          if (!existingTacticalLog) {
            await runTacticalAnalysis(userId, baseCurrency)
            results.tacticalSnapshotsGenerated++
          }
        } catch (tacErr: any) {
          console.warn(`[Cron Tactical Advisor error for ${userId}]`, tacErr)
          results.errors.push(`Tactical User ${userId}: ${tacErr?.message || 'Error'}`)
        }
      } catch (userErr: any) {
        results.errors.push(`User ${userId}: ${userErr.message}`)
      }
    }

    return NextResponse.json(results)
  } catch (err: any) {
    console.error('[CRON morning-briefing error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
