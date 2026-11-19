import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { getBatchTechnicalSignals } from '@/lib/market-data/technical-signals'
import { createFallbackPillars, MarketPillarsData } from '@/app/api/tactical-advisor/route'
import { callGemini, GroundingSource } from '@/lib/ai/gemini-client'
import { sumAccountCashInBaseCurrency } from '@/lib/market-data/frankfurter'
import {
  gatherPortfolioDeepIntelligence,
  computeAdviceOutcomeMetrics,
  formatOutcomeMetricsForPrompt,
  parseUserInvestmentMemory,
  serializeUserInvestmentMemory,
} from '@/lib/ai/portfolio-intelligence'

export const maxDuration = 45

const COPILOT_THREAD_TAG = '[AI_COPILOT_THREAD]'

export interface PersistedCopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  modelUsed?: string
  groundingSources?: GroundingSource[]
}

const MemoryUpdateSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  horizonYears: z.number().int().min(1).max(50).optional(),
  maxSinglePositionPercent: z.number().min(5).max(100).optional(),
  maxDrawdownTolerancePercent: z.number().min(5).max(80).optional(),
  preferredStyle: z.string().min(2).max(120).optional(),
  personalRules: z.string().min(2).max(500).optional(),
})

async function loadSavedCopilotThread(userId: string): Promise<{
  logId: string | null
  messages: PersistedCopilotMessage[]
}> {
  const existingLog = await prisma.aiAdviceLog.findFirst({
    where: {
      userId,
      logType: 'advisor',
      prompt: COPILOT_THREAD_TAG,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, response: true },
  })

  if (!existingLog) {
    return { logId: null, messages: [] }
  }

  try {
    const parsed = JSON.parse(existingLog.response)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      )
      return { logId: existingLog.id, messages: valid }
    }
  } catch {
    // Ignore malformed thread JSON
  }

  return { logId: existingLog.id, messages: [] }
}

async function saveCopilotThread(
  userId: string,
  messages: PersistedCopilotMessage[],
  modelUsed: string,
  existingLogId?: string | null
) {
  const trimmed = messages.slice(-30)
  const payload = JSON.stringify(trimmed)

  if (existingLogId) {
    await prisma.aiAdviceLog.update({
      where: { id: existingLogId },
      data: { response: payload, modelUsed },
    })
    return
  }

  await prisma.aiAdviceLog.create({
    data: {
      userId,
      logType: 'advisor',
      prompt: COPILOT_THREAD_TAG,
      response: payload,
      modelUsed,
    },
  })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const [thread, userSettings, holdingsRes, pastLogs] = await Promise.all([
      loadSavedCopilotThread(userId),
      prisma.userSettings.findUnique({
        where: { userId },
        select: { baseCurrency: true, defaultRiskProfile: true },
      }),
      calculateUserHoldings(userId, 'THB', false).catch(() => null),
      prisma.aiAdviceLog.findMany({
        where: {
          userId,
          logType: 'advisor',
          prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { createdAt: true, response: true },
      }),
    ])

    const memory = parseUserInvestmentMemory(userSettings?.defaultRiskProfile)
    const livePriceMap = new Map(
      (holdingsRes?.holdings || []).map((h) => [h.ticker.toUpperCase(), Number(h.currentPrice || 0)])
    )
    const outcomeMetrics = computeAdviceOutcomeMetrics(pastLogs, livePriceMap)

    return NextResponse.json({
      messages: thread.messages,
      memory,
      outcomeMetrics,
    })
  } catch (error: any) {
    console.error('[tactical-advisor chat GET]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load chat history' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = MemoryUpdateSchema.safeParse(body?.memory ?? body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid memory profile' },
        { status: 400 }
      )
    }

    const currentSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { defaultRiskProfile: true },
    })
    const merged = {
      ...parseUserInvestmentMemory(currentSettings?.defaultRiskProfile),
      ...parsed.data,
    }
    const serialized = serializeUserInvestmentMemory(merged)

    await prisma.userSettings.upsert({
      where: { userId },
      update: { defaultRiskProfile: serialized },
      create: { userId, defaultRiskProfile: serialized },
    })

    return NextResponse.json({
      success: true,
      memory: parseUserInvestmentMemory(serialized),
    })
  } catch (error: any) {
    console.error('[tactical-advisor chat PATCH]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save memory profile' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.aiAdviceLog.deleteMany({
      where: {
        userId: session.user.id,
        logType: 'advisor',
        prompt: COPILOT_THREAD_TAG,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[tactical-advisor chat DELETE]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reset chat history' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({}))
    const { question, messages, tacticalContext, skipPersist } = body

    let activeQuestion = ''
    let messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (Array.isArray(messages) && messages.length > 0) {
      messageHistory = messages.filter((m) => m && m.role && m.content)
      const lastUserMsg = [...messageHistory].reverse().find((m) => m.role === 'user')
      activeQuestion = lastUserMsg?.content?.trim() || ''
    } else if (typeof question === 'string' && question.trim()) {
      activeQuestion = question.trim()
      messageHistory = [{ role: 'user', content: activeQuestion }]
    }

    if (!activeQuestion) {
      return NextResponse.json({ error: 'Missing question or messages' }, { status: 400 })
    }

    // 1. Gather Internal Portfolio DNA
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)

    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, currency: true },
    })

    const totalCash = await sumAccountCashInBaseCurrency(accounts, baseCurrency)

    const totalPortfolioValue = holdingsResult.totalValueBase
    const totalWealth = totalPortfolioValue + totalCash
    const cashPercent = totalWealth > 0 ? (totalCash / totalWealth) * 100 : 0

    // Compute Thematic & Sector Concentration dynamically
    const techAiTickers = new Set([
      'QQQ',
      'QQQM',
      'GOOGL',
      'GOOG',
      'NVDA',
      'AAPL',
      'MSFT',
      'META',
      'AMZN',
      'TSM',
      'AVGO',
      'AMD',
      'SNDK',
      'CHPY',
      'PLTR',
      'SMCI',
      'ARM',
    ])

    let techAiAllocationPercent = 0
    holdingsResult.holdings.forEach((h) => {
      if (techAiTickers.has(h.ticker.toUpperCase())) {
        techAiAllocationPercent += h.allocationPercent || 0
      }
    })

    const holdingsToAnalyze = holdingsResult.holdings.slice(0, 15)
    const userSymbols = holdingsToAnalyze.map((h) => h.ticker.toUpperCase())

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // 2. Fetch Technicals, News, Deep Portfolio Intelligence, Past Advice, and Existing Thread in parallel
    const [
      technicalSignals,
      portfolioNews,
      generalMarketNews,
      deepIntel,
      pastAdvisorLogs,
      savedThread,
    ] = await Promise.all([
      getBatchTechnicalSignals(
        holdingsToAnalyze.map((h) => ({
          ticker: h.ticker,
          market:
            h.market ||
            (h.ticker.endsWith('.BK') ||
            ['SCB', 'PTT', 'KBANK', 'CPALL', 'AOT', 'BDMS', 'DELTA'].includes(h.ticker.toUpperCase())
              ? 'TH'
              : 'US'),
        }))
      ),
      prisma.newsItem.findMany({
        where: {
          symbol: { in: userSymbols },
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: 'desc' },
        take: 12,
      }),
      prisma.newsItem.findMany({
        where: {
          symbol: null,
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: 'desc' },
        take: 8,
      }),
      gatherPortfolioDeepIntelligence({
        userId,
        baseCurrency,
        holdings: holdingsResult.holdings,
        txns: holdingsResult.txns,
      }).catch(() => null),
      prisma.aiAdviceLog.findMany({
        where: {
          userId,
          logType: 'advisor',
          prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { createdAt: true, response: true },
      }),
      loadSavedCopilotThread(userId),
    ])

    // Fallback if recent 7-day filter yields too few items
    let allNews = [...portfolioNews, ...generalMarketNews]
    if (allNews.length < 5) {
      allNews = await prisma.newsItem.findMany({
        where: {
          OR: [{ symbol: { in: userSymbols } }, { symbol: null }],
        },
        orderBy: { publishedAt: 'desc' },
        take: 15,
      })
    }

    const externalNewsText =
      allNews.length > 0
        ? allNews
            .slice(0, 15)
            .map((n) => {
              const symTag = n.symbol ? `[หุ้น ${n.symbol}]` : '[ข่าวเศรษฐกิจโลก & การเงิน]'
              const sentimentTag = n.sentiment ? ` (ทิศทางข่าว: ${n.sentiment})` : ''
              const timeStr = n.publishedAt
                ? new Date(n.publishedAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : ''
              const summarySnippet = n.summary ? `\n    สรุปเนื้อหา: ${n.summary.slice(0, 240)}...` : ''
              return `- ${symTag} "${n.headline}" (แหล่งข่าว: ${n.sourceName} | วันที่: ${timeStr})${sentimentTag}${summarySnippet}`
            })
            .join('\n')
        : 'ไม่มีข่าวล่าสุดในระบบ'

    // Compile Detailed Technical Chart Profiles & Support/Resistance Levels
    const detailedHoldingsText = holdingsToAnalyze
      .map((h) => {
        const sig = technicalSignals[h.ticker.toUpperCase()]
        const pnlPrefix = h.unrealizedPnLPercent >= 0 ? '+' : ''
        const currencySymbol = h.currency === 'THB' ? '฿' : '$'

        const rsiDesc = sig?.rsi14
          ? `RSI(14): ${sig.rsi14} (${
              sig.rsi14 <= 35
                ? 'Oversold / ขายมากเกินไป มีโอกาสรีบาวด์'
                : sig.rsi14 >= 68
                ? 'Overbought / ซื้อมากเกินไป ตึงตัว'
                : 'Neutral / พักตัวในกรอบ'
            })`
          : 'RSI: ไม่มีข้อมูล'

        const smaDesc =
          [
            sig?.sma50
              ? `SMA 50: ${currencySymbol}${sig.sma50} (${
                  sig.currentPrice >= sig.sma50 ? 'ราคายืนเหนือแนวรับเส้น 50 วัน' : 'ราคาหลุดต่ำกว่าเส้น 50 วัน'
                })`
              : null,
            sig?.sma200
              ? `SMA 200: ${currencySymbol}${sig.sma200} (${
                  sig.currentPrice >= sig.sma200 ? 'โครงสร้างหลักระยะยาวยังเป็นขาขึ้น' : 'ราคาหลุดต่ำกว่าเส้น 200 วัน'
                })`
              : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'SMA: ไม่มีข้อมูล'

        const pivotDesc =
          [
            sig?.supportS1 ? `แนวรับแรก S1: ${currencySymbol}${sig.supportS1}` : null,
            sig?.supportS2 ? `แนวรับหนีไฟ S2: ${currencySymbol}${sig.supportS2}` : null,
            sig?.resistanceR1 ? `แนวต้านเป้าหมาย R1: ${currencySymbol}${sig.resistanceR1}` : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'Pivots: ไม่มีข้อมูล'

        const rangeDesc = [
          sig?.fiftyTwoWeekHigh ? `จุดสูงสุด 52 สัปดาห์: ${currencySymbol}${sig.fiftyTwoWeekHigh}` : null,
          sig?.fiftyTwoWeekLow ? `จุดต่ำสุด 52 สัปดาห์: ${currencySymbol}${sig.fiftyTwoWeekLow}` : null,
          sig?.pullbackFromHigh !== undefined
            ? `ย่อตัวจากจุดสูงสุด 52W: ${sig.pullbackFromHigh.toFixed(1)}%`
            : null,
        ]
          .filter(Boolean)
          .join(' | ')

        const statusBadge = sig?.badgeText || 'ตามแผน'
        const reason = sig?.technicalReason || 'โครงสร้างราคาและแนวโน้มตามแผนหลัก'

        return `
- [${h.ticker}] ${h.assetName}
  * สัดส่วนในพอร์ต: ${h.allocationPercent.toFixed(1)}% | ต้นทุนเฉลี่ย: ${currencySymbol}${h.avgCost.toFixed(
          2
        )} | ราคาตลาดปัจจุบัน: ${currencySymbol}${h.currentPrice.toFixed(
          2
        )} | กำไร/ขาดทุน: ${pnlPrefix}${h.unrealizedPnLPercent.toFixed(2)}%
  * กราฟและกรอบราคาภายนอก: ${rangeDesc}
  * สัญญาณเทคนิค: ${rsiDesc} | สถานะสัญญาณ: ${statusBadge}
  * ค่าเฉลี่ยเคลื่อนที่ (Trend): ${smaDesc}
  * จุดแนวรับ/แนวต้าน Pivot: ${pivotDesc}
  * บทวิเคราะห์เทคนิค: ${reason}`
      })
      .join('\n')

    // Resolve 4 Pillars Macro Climate Data
    const pillars: MarketPillarsData =
      tacticalContext?.marketRegime?.pillars || createFallbackPillars(tacticalContext || {})

    const macroSummary = `
- สภาวะตลาดห้วงเวลานี้: ${tacticalContext?.marketRegime?.statusLabelTh || 'ผันผวนและควรระมัดระวัง'} (ระดับความเสี่ยง ${
      pillars.formula?.calculatedRiskScore || 4
    }/5: ${pillars.formula?.calculatedRiskLabel || 'ความเสี่ยงระดับสูง'})
- กลยุทธ์ภาพรวมที่แนะนำ: ${pillars.formula?.postureLabelTh || '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)'} (${
      pillars.formula?.postureSubtitleTh || 'แบ่งไม้ทยอยสะสมเฉพาะหุ้นพื้นฐานแกร่งที่ลงมาแนวรับสำคัญ ไม่ไล่ราคา'
    })
- สูตรประเมินสภาวะ (Formula): ${
      pillars.formula?.formulaEquation ||
      'โมเมนตัม S&P 500 ย่อตัว + อารมณ์กังวล + Bond Yield ตึงตัว ➔ ความเสี่ยง 4/5'
    }
- เสาที่ 1 (Sentiment & Volatility): CNN Fear & Greed ${pillars.sentiment.fearGreedScore}/100 (${
      pillars.sentiment.fearGreedLabelTh
    }, การเปลี่ยนแปลง 1 สัปดาห์: ${pillars.sentiment.fearGreed1WDiff > 0 ? '+' : ''}${
      pillars.sentiment.fearGreed1WDiff
    } pts) | CBOE VIX Index: ${pillars.sentiment.vixValue} pts (${pillars.sentiment.vixStatusLabel})
- เสาที่ 2 (Trend & Breadth): S&P 500: ${pillars.momentum.spxPrice.toLocaleString()} pts (${
      pillars.momentum.spxChangePercent > 0 ? '+' : ''
    }${pillars.momentum.spxChangePercent}%, Drawdown จากจุดสูงสุด 52W: ${pillars.momentum.spxDrawdownPercent.toFixed(
      2
    )}%) | NASDAQ: ${pillars.momentum.nasdaqPrice.toLocaleString()} pts (${
      pillars.momentum.nasdaqChangePercent > 0 ? '+' : ''
    }${pillars.momentum.nasdaqChangePercent}%, Drawdown จากจุดสูงสุด 52W: ${pillars.momentum.nasdaqDrawdownPercent.toFixed(
      2
    )}%) | Breadth: ${pillars.momentum.breadthStatus}
- เสาที่ 3 (Macro & Liquidity): US 10Y Bond Yield: ${pillars.macroLiquidity.us10yYield.toFixed(
      2
    )}% (${pillars.macroLiquidity.yieldPressureLabel}) | นโยบาย Fed: ${
      pillars.macroLiquidity.fedPolicyStance
    } | คาดการณ์เงินเฟ้อ CPI/PCE: ${pillars.macroLiquidity.inflationExpectation}
- เสาที่ 4 (Catalysts & Fund Flows): กระแสเงินทุน: ${
      pillars.catalystsAndFlows.safeHavenFlowLabel
    } | ราคาทองคำ: $${pillars.catalystsAndFlows.goldPrice?.toLocaleString()} | ดัชนีดอลลาร์ DXY: ${
      pillars.catalystsAndFlows.dxyPrice?.toFixed(2)
    } | ปัจจัยเร่งตลาด: ${(pillars.catalystsAndFlows.keyCatalysts || []).join('; ')}
`

    const livePriceMap = new Map(
      holdingsResult.holdings.map((h) => [h.ticker.toUpperCase(), Number(h.currentPrice || 0)])
    )
    const outcomeMetrics = computeAdviceOutcomeMetrics(pastAdvisorLogs, livePriceMap)

    // Multi-Turn Conversation Thread (merge client history with DB history if caller only sent 1 turn)
    const effectiveHistory =
      messageHistory.length > 1
        ? messageHistory
        : [
            ...savedThread.messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
            ...messageHistory,
          ]

    const previousHistoryText =
      effectiveHistory.length > 1
        ? `
=== ประวัติการสนทนาก่อนหน้า ===
${effectiveHistory
  .slice(-9, -1)
  .map((m) => `${m.role === 'user' ? 'ผู้ใช้' : 'ที่ปรึกษา AI'}: ${m.content}`)
  .join('\n\n')}
`
        : ''

    const prompt = `
[AI Tactical Wealth Advisor Copilot]
ผู้ใช้ต้องการให้คุณวิเคราะห์และให้คำปรึกษาการลงทุนแบบ "ครอบคลุมรอบด้าน 360 องศา" โดยผสานข้อมูลจากภายนอก (ข่าวล่าสุด + Google Search Grounding + มหภาค + ปัจจัยพื้นฐาน Valuation + ปฏิทินงบ/ปันผล + กราฟเทคนิค) และข้อมูลภายใน (พอร์ต, ต้นทุน FIFO, ภาษี, เป้าหมาย และกฎส่วนตัวของนักลงทุน)

=== 1. ข้อมูลข่าวสารและความเคลื่อนไหวภายนอกล่าสุด (EXTERNAL LIVE NEWS & CATALYSTS) ===
${externalNewsText}
(หมายเหตุ: คุณมี Google Search Grounding เปิดใช้งานอยู่ หากคำถามเกี่ยวข้องกับเหตุการณ์วันนี้ งบการเงินล่าสุด หรือข่าวด่วนรายหุ้น ให้ค้นหาและอ้างอิงข้อเท็จจริงล่าสุดร่วมด้วยเสมอ)

=== 2. ข้อมูลสภาวะตลาดโลก 4 เสาหลัก (EXTERNAL MACRO CLIMATE & SENTIMENT) ===
${macroSummary}

=== 3. ข้อมูลกราฟเทคนิคและกรอบราคาภายนอกรายตัว (EXTERNAL TECHNICAL CHART PROFILES) ===
${detailedHoldingsText || 'ไม่มีหุ้นในพอร์ต'}

=== 4. ปัจจัยพื้นฐาน Valuation & ปฏิทินงบ/ปันผล (FUNDAMENTALS & CATALYSTS) ===
[Valuation Guardrails]
${deepIntel?.fundamentalsPrompt || 'ยังไม่มีข้อมูล Valuation รายตัว'}

[Upcoming Earnings & XD Catalysts]
${deepIntel?.catalystsPrompt || 'ไม่มีกำหนดการงบ/ปันผลใกล้ถึง'}

=== 5. ข้อมูลพอร์ต, ภาษี FIFO และความจำกฎส่วนตัวของผู้ใช้ (INTERNAL PORTFOLIO, TAX & MEMORY) ===
- สกุลเงินหลัก: ${baseCurrency}
- มูลค่าสินทรัพย์รวมในพอร์ต: ${totalPortfolioValue.toLocaleString()} ${baseCurrency}
- เงินสดสำรองรวม (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (${cashPercent.toFixed(1)}% ของความมั่งคั่งรวม)
- การกระจุกตัว: ${
      techAiAllocationPercent > 50
        ? `🚨 พอร์ตมีความเสี่ยงกระจุกตัวสูงมากในกลุ่ม US Tech & AI (${techAiAllocationPercent.toFixed(1)}% ของพอร์ต)`
        : `กระจายตัวปกติ (Tech & AI: ${techAiAllocationPercent.toFixed(1)}%)`
    }

[เป้าหมายแผนลงทุน & กฎส่วนตัวใน AI Memory]
${deepIntel?.goalsAndMemoryPrompt || 'ยังไม่ได้ตั้งเป้าหมายเฉพาะ'}

[บริบทภาษี FIFO]
${deepIntel?.taxContextPrompt || 'ไม่มีข้อมูลภาษี'}

[Track Record คำแนะนำที่ปรึกษา AI ในรอบที่ผ่านมา]
${formatOutcomeMetricsForPrompt(outcomeMetrics)}

${previousHistoryText}

=== คำถามล่าสุดของผู้ใช้ ===
"${activeQuestion}"

=== กฎเหล็กการวิเคราะห์แบบรอบด้าน (360° INSTITUTIONAL ADVISORY STANDARDS) ===
1. ดึงข่าวสารภายนอกล่าสุด + ปฏิทินงบ/XD และ Valuation มาประกอบการตัดสินใจเสมอ: เตือนหากหุ้นติดธง VALUE_TRAP_RISK หรือใกล้วันประกาศงบภายใน 5 วัน
2. วิเคราะห์กราฟเทคนิคจริงครบถ้วน: ระบุราคา, % Drawdown จาก 52W High, RSI(14), SMA 50/200 และ Pivot S1/S2/R1
3. เชื่อมโยงเข้ากับพอร์ต เงินสด ภาษี และกฎส่วนตัวใน AI Memory (เช่น Max Position Cap): ระบุแผนแบ่งไม้ (Tranche Plan), Stop Loss และผลกระทบด้านภาษีให้ชัด
4. จัดหน้าให้อ่านง่าย: แบ่งหัวข้อชัดเจน ใช้ขีด (-) นำหน้ารายการ และหลีกเลี่ยงดอกจัน (**) ซ้ำซ้อนพร่ำเพรื่อ
`

    const aiResult = await callGemini({
      userId,
      prompt,
      logType: 'bucket_chat',
      systemInstruction:
        'คุณคือ Senior Chief Investment Officer (CIO) & Chartered Market Technician (CMT) ผู้เชี่ยวชาญด้านกลยุทธ์การลงทุนระดับสากล วิเคราะห์รอบด้าน 360 องศา ทั้งข่าวสด Google Search + Finnhub/Yahoo ปัจจัยพื้นฐาน (P/E, ROE, D/E, FCF) กราฟเทคนิค (RSI, SMA, Pivots) ปฏิทินงบ/XD และภาษี/กฎส่วนตัวของนักลงทุน ตอบด้วยตัวเลขชัดเจน ตรงไปตรงมา ไม่เดาข้อมูลที่ไม่มี',
      thinkingBudget: 1024,
      enableGoogleSearch: true,
      skipLog: true,
    })

    const cleanedAnswer = (aiResult.text || '')
      .replace(/\*\*\s*\*\*/g, ' ')
      .replace(/\*{3,}/g, '**')

    // Persist thread in AiAdviceLog unless caller explicitly asks to skip
    if (!skipPersist) {
      const nowTimeLabel = new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
      })
      const baseHistory: PersistedCopilotMessage[] =
        Array.isArray(messages) && messages.length > 0
          ? messages
              .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
              .map((m: any, idx: number) => ({
                id: String(m.id || `msg-${Date.now()}-${idx}`),
                role: m.role,
                content: String(m.content),
                timestamp: String(m.timestamp || nowTimeLabel),
                ...(m.modelUsed ? { modelUsed: String(m.modelUsed) } : {}),
                ...(Array.isArray(m.groundingSources) ? { groundingSources: m.groundingSources } : {}),
              }))
          : [
              ...savedThread.messages,
              {
                id: `user-${Date.now()}`,
                role: 'user',
                content: activeQuestion,
                timestamp: nowTimeLabel,
              },
            ]

      const assistantReply: PersistedCopilotMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: cleanedAnswer,
        timestamp: nowTimeLabel,
        modelUsed: aiResult.modelUsed,
        ...(aiResult.groundingSources && aiResult.groundingSources.length > 0
          ? { groundingSources: aiResult.groundingSources }
          : {}),
      }

      try {
        await saveCopilotThread(
          userId,
          [...baseHistory, assistantReply],
          aiResult.modelUsed,
          savedThread.logId
        )
      } catch (persistErr) {
        console.warn('[tactical-advisor chat] Failed to persist thread:', persistErr)
      }
    }

    return NextResponse.json({
      answer: cleanedAnswer,
      modelUsed: aiResult.modelUsed,
      groundingSources: aiResult.groundingSources || [],
      memory: deepIntel?.memory,
      outcomeMetrics,
      portfolioSummary: {
        totalPortfolioValue,
        totalCash,
        baseCurrency,
        cashPercent,
        techAiAllocationPercent,
        holdingsCount: holdingsResult.holdings.length,
      },
      technicalSignals,
      recentNews: allNews.slice(0, 15).map((n) => ({
        id: n.id,
        symbol: n.symbol,
        headline: n.headline,
        sourceName: n.sourceName,
        sourceUrl: n.sourceUrl,
        publishedAt: n.publishedAt.toISOString(),
        sentiment: n.sentiment,
        summary: n.summary,
      })),
    })
  } catch (error: any) {
    console.error('[tactical-advisor chat error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    )
  }
}
