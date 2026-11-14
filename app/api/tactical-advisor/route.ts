import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { fetchRealHumanSentiment } from '@/lib/market-data/fear-greed'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

export interface TacticalActionItem {
  id: string
  ticker: string
  assetName: string
  market: 'US' | 'TH' | 'CRYPTO'
  action: 'ACCUMULATE' | 'HOLD_WATCH' | 'TRIM_PROFIT' | 'CASH_PRESERVE'
  actionLabel: string
  badgeColor: 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky'
  currentPrice: number
  currency: string
  targetZone: string
  tranchePlan: string
  stopLossPoint: string
  rationale: string
  taxImpactNote?: string
}

export interface TacticalAdvisorPayload {
  asOfDate: string
  asOfDateThai: string
  marketRegime: {
    status: 'VOLATILE_CAUTION' | 'EARLY_ACCUMULATION' | 'BULL_EXPANSION' | 'DEFENSIVE_ROTATION'
    statusLabelTh: string
    summaryTh: string
    riskLevel: number // 1 - 5
    riskLevelLabel: string
    fearGreedScore: number
    fearGreedLabel: string
    macroDrivers: string[]
  }
  portfolioResilience: {
    score: number // 0 - 100
    status: 'STRONG' | 'MODERATE' | 'FRAGILE'
    statusLabelTh: string
    strengths: string[]
    vulnerabilities: string[]
    thematicRiskAlert?: string | null
  }
  tacticalActions: TacticalActionItem[]
  cashStrategy: {
    recommendedCashPercent: number
    currentCashPercent: number
    currentCashTotalBase: number
    baseCurrency: string
    guidanceText: string
  }
  trackRecordReview: Array<{
    period: string
    recommendationSummary: string
    outcomeAssessment: string
    accuracyStatus: 'ACCURATE' | 'NEUTRAL' | 'CAUTION'
  }>
  modelUsed?: string
  generatedAt: string
}

function getTodayBangkokDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function formatThaiDate(date: Date): string {
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  })
}

async function gatherMarketData() {
  const [
    spxRes,
    nasdaqRes,
    setRes,
    btcRes,
    goldRes,
    vixRes,
    fearGreedRes,
    dxyRes,
    tnxRes,
  ] = await Promise.allSettled([
    yahooFinanceProvider.getQuote('S&P 500'),
    yahooFinanceProvider.getQuote('NASDAQ'),
    yahooFinanceProvider.getQuote('SET INDEX', 'TH'),
    coinGeckoProvider.getQuote('BTC'),
    yahooFinanceProvider.getQuote('GOLD'),
    yahooFinanceProvider.getQuote('VIX'),
    fetchRealHumanSentiment(),
    yahooFinanceProvider.getQuote('DXY'),
    yahooFinanceProvider.getQuote('US10Y'),
  ])

  const spx = spxRes.status === 'fulfilled' ? spxRes.value : null
  const nasdaq = nasdaqRes.status === 'fulfilled' ? nasdaqRes.value : null
  const setIndex = setRes.status === 'fulfilled' ? setRes.value : null
  const btc = btcRes.status === 'fulfilled' ? btcRes.value : null
  const gold = goldRes.status === 'fulfilled' ? goldRes.value : null
  const vix = vixRes.status === 'fulfilled' ? vixRes.value : null
  const fearGreed = fearGreedRes.status === 'fulfilled' ? fearGreedRes.value : null
  const dxy = dxyRes.status === 'fulfilled' ? dxyRes.value : null
  const tnx = tnxRes.status === 'fulfilled' ? tnxRes.value : null

  return {
    spx,
    nasdaq,
    setIndex,
    btc,
    gold,
    vix,
    fearGreed,
    dxy,
    tnx,
  }
}

async function runTacticalAnalysis(
  userId: string,
  baseCurrency: string
): Promise<TacticalAdvisorPayload> {
  // 1. Gather User Holdings & Cash
  const holdingsResult = await calculateUserHoldings(userId, baseCurrency, true)
  const accounts = await prisma.investmentAccount.findMany({
    where: { userId },
    select: { cashBalance: true, currency: true },
  })

  let totalCash = 0
  for (const acc of accounts) {
    totalCash += Number(acc.cashBalance) || 0
  }

  const totalPortfolioValue = holdingsResult.totalValueBase + totalCash
  const currentCashPercent =
    totalPortfolioValue > 0 ? Number(((totalCash / totalPortfolioValue) * 100).toFixed(1)) : 0

  // 2. Gather External Market Signals
  const market = await gatherMarketData()

  // 3. Gather past advice logs for Track Record verification
  const pastLogs = await prisma.aiAdviceLog.findMany({
    where: {
      userId,
      logType: 'advisor',
      prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { response: true, createdAt: true },
  })

  const pastContextSummaries = pastLogs
    .map((log) => {
      try {
        const parsed = JSON.parse(log.response)
        const dateStr = formatThaiDate(new Date(log.createdAt))
        const actionsSummary = (parsed.tacticalActions || [])
          .slice(0, 3)
          .map((a: any) => `${a.ticker} (${a.actionLabel})`)
          .join(', ')
        return `• วันที่ ${dateStr}: แนะนำ ${actionsSummary}`
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .join('\n')

  // 4. Construct high-fidelity system prompt & user prompt for Gemini
  const prompt = `
[AI Tactical Regime & Portfolio Advisor]
คุณคือ "หัวหน้านักกลยุทธ์การลงทุนอาวุโส (Chief Tactical Investment Strategist)" หน้าที่ของคุณคือการผสานข้อมูลสภาวะตลาดภายนอก (Macro/Sentiment/Indices/Rates) เข้ากับพอร์ตจริงของผู้ใช้ (Holdings/Cash/Allocation/Cost Basis) เพื่อสังเคราะห์เป็นแผนกลยุทธ์เฉพาะตัวที่ปฏิบัติได้จริงในห้วงเวลานี้ (Regime-Aware Tactical Playbook)

=== ข้อมูลตลาดภายนอก (EXTERNAL MARKET CLIMATE) ===
- S&P 500: ${market.spx?.price ?? 5800} (${(market.spx?.changePercent ?? 0) >= 0 ? '+' : ''}${market.spx?.changePercent?.toFixed(2) ?? 0}%)
- NASDAQ (Tech): ${market.nasdaq?.price ?? 18200} (${(market.nasdaq?.changePercent ?? 0) >= 0 ? '+' : ''}${market.nasdaq?.changePercent?.toFixed(2) ?? 0}%)
- SET Index (ไทย): ${market.setIndex?.price ?? 1450} (${(market.setIndex?.changePercent ?? 0) >= 0 ? '+' : ''}${market.setIndex?.changePercent?.toFixed(2) ?? 0}%)
- VIX (ความกลัว): ${market.vix?.price ?? 16}
- US 10Y Bond Yield: ${market.tnx?.price ?? 4.3}%
- US Dollar Index (DXY): ${market.dxy?.price ?? 104}
- CNN Fear & Greed Index: ${market.fearGreed?.score ?? 50}/100 (${market.fearGreed?.ratingLabelTh ?? 'เป็นกลาง'})
- Bitcoin: $${market.btc?.price?.toLocaleString() ?? '90,000'}
- Gold: $${market.gold?.price?.toLocaleString() ?? '2,600'}

=== ข้อมูลพอร์ตภายในจริง (INTERNAL PORTFOLIO DNA) ===
- มูลค่าพอร์ตลงทุนรวม: ${totalPortfolioValue.toLocaleString()} ${baseCurrency}
- มูลค่าสินทรัพย์หุ้น/คริปโต: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency} (คิดเป็น ${(100 - currentCashPercent).toFixed(1)}%)
- เงินสดสำรองพร้อมใช้ (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (คิดเป็น ${currentCashPercent}%)
- กำไร/ขาดทุนรวมที่ยังไม่รับรู้ (Unrealized P&L): ${holdingsResult.unrealizedPnLBase.toLocaleString()} ${baseCurrency} (${holdingsResult.unrealizedPnLPercent.toFixed(2)}%)
- รายการสินทรัพย์ที่ถือครองในพอร์ต (${holdingsResult.holdings.length} ตัว):
${holdingsResult.holdings
  .map(
    (h, idx) =>
      `  ${idx + 1}. [${h.ticker}] ${h.assetName} (${h.market}) | สัดส่วน: ${h.allocationPercent.toFixed(1)}% | ราคาปัจจุบัน: ${h.currentPrice} ${h.currency} | ต้นทุนเฉลี่ย: ${h.avgCost} | กำไร/ขาดทุน: ${h.unrealizedPnLPercent.toFixed(2)}% | มูลค่า: ${h.currentValueBase.toLocaleString()} ${baseCurrency}`
  )
  .join('\n')}

=== ประวัติคำแนะนำในรอบที่ผ่านๆ มา (เพื่อตรวจการบ้าน Track Record) ===
${pastContextSummaries || 'ยังไม่มีประวัติคำแนะนำก่อนหน้า (เป็นการวิเคราะห์รอบแรก)'}

=== กฎเหล็ก 5 มิติที่ต้องคำนึงถึงในการวิเคราะห์ (MANDATORY 5 DIMENSIONS) ===
1. กำหนดขนาดไม้และวงเงินเสมอ (Position Sizing & Tranches): หากแนะนำให้สะสม (ACCUMULATE) ต้องระบุว่าใช้เงินสดกี่ % หรือกี่บาท/ดอลลาร์ และแบ่งเป็นกี่ไม้ชัดเจน (เช่น ไม้แรก 30% ที่ราคา..., ไม้สอง 40% ที่แนวรับ S1...)
2. มีจุดหนีไฟหรือจุดตัดขาดทุนเสมอ (Stop Loss / Invalidation Point): ต้องระบุราคาที่หากหลุด ต้องหยุดซื้อถัวหรือพิจารณาตัดขาดทุน
3. ตรวจสอบความเสี่ยงเชิงธีมซ้ำซ้อน (Thematic Correlation Risk): วิเคราะห์ว่าถือหุ้นคนละตัวแต่อยู่ในธีมเดียวกันมากเกินไปไหม (เช่น ถือ Tech/AI หลายตัวจนรวมกันเกิน 50-60%) หากพบให้ระบุใน thematicRiskAlert ชัดเจน
4. คำนึงถึงภาษีเงินได้จากการขาย (Tax Sensitivity): หากแนะนำให้ลดพอร์ตหรือขายทำกำไร (TRIM_PROFIT) ให้ระบุเตือนภาษีสั้นๆ เสมอ (เช่น ระวังกฎหมายภาษีหุ้นนอกหากนำกำไรกลับเข้าไทยในปีเดียวกัน)
5. สรุปผลการบ้านคำแนะนำรอบก่อนหน้า (Track Record Review): ประเมินคำแนะนำรอบก่อนว่าสภาวะตลาดเป็นไปตามคาดไหม

กรุณาสังเคราะห์และตอบกลับมาเป็น JSON ตามรูปแบบนี้เท่านั้น ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON:
{
  "marketRegime": {
    "status": "VOLATILE_CAUTION" | "EARLY_ACCUMULATION" | "BULL_EXPANSION" | "DEFENSIVE_ROTATION",
    "statusLabelTh": "ชื่อสภาวะตลาดภาษาไทยแบบกระชับ",
    "summaryTh": "สรุปสภาวะตลาดและบริบทห้วงเวลานี้ใน 2 ประโยค",
    "riskLevel": 1 ถึง 5 (5 คือเสี่ยงสูงสุด),
    "riskLevelLabel": "ความเสี่ยงระดับสูง / ปานกลาง / ต่ำ",
    "fearGreedScore": ตัวเลข 0-100,
    "fearGreedLabel": "Extreme Fear / Fear / Neutral / Greed / Extreme Greed",
    "macroDrivers": ["ประเด็นหลักที่ 1", "ประเด็นหลักที่ 2", "ประเด็นหลักที่ 3"]
  },
  "portfolioResilience": {
    "score": ตัวเลข 0-100,
    "status": "STRONG" | "MODERATE" | "FRAGILE",
    "statusLabelTh": "พร้อมรับมือดีเยี่ยม / แข็งแกร่งปานกลาง / เปราะบางควรปรับพอร์ต",
    "strengths": ["จุดแข็งที่ 1 ของพอร์ตในตลาดห้วงนี้", "จุดแข็งที่ 2"],
    "vulnerabilities": ["จุดเปราะบางที่ 1", "จุดเปราะบางที่ 2"],
    "thematicRiskAlert": "ข้อความแจ้งเตือนความเสี่ยงการกระจุกตัวในธีมเดียวกัน หรือ null ถ้าพอร์ตกระจายตัวดีแล้ว"
  },
  "tacticalActions": [
    {
      "id": "1",
      "ticker": "SYMBOL",
      "assetName": "Company Name",
      "market": "US" | "TH" | "CRYPTO",
      "action": "ACCUMULATE" | "HOLD_WATCH" | "TRIM_PROFIT" | "CASH_PRESERVE",
      "actionLabel": "สะสมไม้แรก (Dip Buy) / ถือจับตา / ทยอยล็อกกำไร",
      "badgeColor": "emerald" | "amber" | "rose" | "indigo",
      "currentPrice": ราคาปัจจุบัน,
      "currency": "$ หรือ ฿",
      "targetZone": "ช่วงราคาเป้าหมาย เช่น $155 - $160",
      "tranchePlan": "แผนแบ่งไม้และวงเงิน เช่น แบ่งเงินสด 25% ($800) เข้าไม้แรกที่ $155 และรอไม้สอง $1,000 ที่แนวรับ $133",
      "stopLossPoint": "จุดยอมแพ้ เช่น $128.00 (หลุดแนวรับสำคัญ)",
      "rationale": "เหตุผลเชิงกลยุทธ์ที่คมชัด 1-2 ประโยค",
      "taxImpactNote": "หมายเหตุภาษี (ถ้าเป็นขายให้เตือนภาษี ถ้าเป็นซื้อให้ระบุว่าไม่มีภาษี)"
    }
  ],
  "cashStrategy": {
    "recommendedCashPercent": สัดส่วนเงินสดที่ควรเตรียมไว้ในห้วงนี้ (เช่น 15-20),
    "currentCashPercent": ${currentCashPercent},
    "currentCashTotalBase": ${totalCash},
    "baseCurrency": "${baseCurrency}",
    "guidanceText": "คำแนะนำการจัดสรรเงินสดในห้วงนี้"
  },
  "trackRecordReview": [
    {
      "period": "คำแนะนำรอบล่าสุด",
      "recommendationSummary": "สรุปสั้นๆ ว่ารอบก่อนแนะนำอะไร",
      "outcomeAssessment": "ประเมินว่าผลลัพธ์เป็นอย่างไรตามสภาพตลาดจริง",
      "accuracyStatus": "ACCURATE" | "NEUTRAL" | "CAUTION"
    }
  ]
}
`

  const aiResult = await callGemini({
    userId,
    prompt,
    logType: 'advisor',
    systemInstruction:
      'คุณคือนักวางแผนกลยุทธ์การลงทุน Tactical Asset Allocation ผู้เชี่ยวชาญระดับโลก ตอบเป็น JSON ภาษาไทยที่ถูกต้อง 100% สื่อสารอย่างตรงไปตรงมา ชัดเจน มีตัวเลขกำกับทุกแอ็กชัน และไม่คลุมเครือ',
    responseMimeType: 'application/json',
    thinkingBudget: 0,
  })

  let parsed: any = null
  try {
    parsed = JSON.parse(aiResult.text)
  } catch (err) {
    const cleaned = aiResult.text.replace(/```json/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(cleaned)
  }

  const now = new Date()
  const payload: TacticalAdvisorPayload = {
    asOfDate: getTodayBangkokDateString(),
    asOfDateThai: formatThaiDate(now),
    marketRegime: parsed.marketRegime,
    portfolioResilience: parsed.portfolioResilience,
    tacticalActions: parsed.tacticalActions || [],
    cashStrategy: parsed.cashStrategy,
    trackRecordReview: parsed.trackRecordReview || [],
    modelUsed: aiResult.modelUsed,
    generatedAt: now.toISOString(),
  }

  return payload
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    // 1. Check cached tactical advice if not forcing refresh
    if (!forceRefresh) {
      const latestLog = await prisma.aiAdviceLog.findFirst({
        where: {
          userId,
          logType: 'advisor',
          prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (latestLog) {
        const ageHours = (Date.now() - new Date(latestLog.createdAt).getTime()) / (1000 * 60 * 60)
        if (ageHours < 8) {
          try {
            const parsed = JSON.parse(latestLog.response)
            return NextResponse.json({
              success: true,
              data: parsed,
              cached: true,
              generatedAt: latestLog.createdAt.toISOString(),
              modelUsed: latestLog.modelUsed,
            })
          } catch {
            // fallback to re-generate if parse fails
          }
        }
      }
    }

    // 2. Run analysis
    const payload = await runTacticalAnalysis(userId, baseCurrency)

    return NextResponse.json({
      success: true,
      data: payload,
      cached: false,
      generatedAt: payload.generatedAt,
      modelUsed: payload.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor GET error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate tactical advice' },
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
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const payload = await runTacticalAnalysis(userId, baseCurrency)

    return NextResponse.json({
      success: true,
      data: payload,
      cached: false,
      generatedAt: payload.generatedAt,
      modelUsed: payload.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor POST error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute tactical analysis' },
      { status: 500 }
    )
  }
}
