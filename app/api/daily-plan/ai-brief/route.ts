import { randomUUID } from 'node:crypto'
import { advisorDate } from '@/lib/ai/advisor-date'
import { advisorFlags } from '@/lib/ai/advisor-rollout'
import { generateAdvisorBrief } from '@/lib/ai/advisor-daily'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { getObservationTime, formatMarketObservation } from '@/lib/ai/advisor-evidence'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const {
      marketOverview,
      portfolioTriggers,
      totalPortfolioValue,
      totalCash,
      baseCurrency = 'THB',
      planDate,
      forceRefresh = false,
    } = body

    if (planDate !== undefined && planDate !== advisorDate()) {
      return NextResponse.json({ error: 'สร้างรายงานใหม่ได้เฉพาะวันที่ปัจจุบัน' }, { status: 400 })
    }
    if (advisorFlags(userId).daily) {
      const requestId = typeof body.requestId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(body.requestId)
        ? body.requestId : randomUUID()
      const result = await generateAdvisorBrief(userId, advisorDate(), forceRefresh === true, requestId)
      if (!result.report) {
        return NextResponse.json({ status: result.status }, { status: result.status === 'running' ? 202 : 409 })
      }
      return NextResponse.json({
        success: true, status: result.status, advice: result.report.text, modelUsed: result.report.modelUsed,
        generatedAt: result.report.createdAt, asOf: result.report.asOf, revision: result.report.revision,
      })
    }
    if (!Array.isArray(portfolioTriggers) || portfolioTriggers.length === 0 || typeof totalPortfolioValue !== 'number' || typeof totalCash !== 'number') {
      return NextResponse.json({
        advice: 'ยังไม่มีข้อมูลสินทรัพย์ในพอร์ตที่เพียงพอสำหรับการจัดทำแผนประจำวัน กรุณาบันทึกรายการลงทุนเพื่อเริ่มการวิเคราะห์',
      })
    }

    // 1. Day-level caching check (Asia/Bangkok time) to prevent token waste and rapid re-generation
    if (!forceRefresh) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const todayBangkok = formatter.format(new Date())

      const latestLog = await prisma.aiAdviceLog.findFirst({
        where: {
          userId,
          logType: 'advisor',
          AND: [{ prompt: { contains: '[daily-brief:v2]' } }, { prompt: { contains: `วันที่ ${todayBangkok}:` } }],
        },
        orderBy: { createdAt: 'desc' },
      })

      if (latestLog) {
        const logDateBangkok = formatter.format(new Date(latestLog.createdAt))
        if (logDateBangkok === todayBangkok) {
          return NextResponse.json({
            success: true,
            advice: latestLog.response,
            modelUsed: latestLog.modelUsed,
            generatedAt: latestLog.createdAt.toISOString(),
            cached: true,
          })
        }
      }
    }

    const fearGreed = marketOverview?.regime?.fearGreed
    const now = Date.now()
    const fearGreedSummary = fearGreed?.source === 'CNN_LIVE' && getObservationTime(Date.parse(fearGreed.timestamp), now)
      && Number.isFinite(fearGreed.score) ? `${fearGreed.score}/100 (CNN ณ ${fearGreed.timestamp})` : 'ไม่มีข้อมูล CNN ที่ยืนยันได้'
    const marketSymbols = ['S&P 500', 'NASDAQ', 'VIX']
    const benchmarks = await Promise.all(marketSymbols.map(async (symbol) => {
      const quote = await yahooFinanceProvider.getQuote(symbol).catch(() => null)
      return formatMarketObservation(symbol, quote ? { ...quote, timestamp: quote.observationTimestamp ?? 0 } : null, now)
    }))

    // 2. Prioritize triggers intelligently (High priority > Extreme RSI > Near S1 > High weight)
    const sortedTriggers = portfolioTriggers.filter((item) =>
      item && typeof item.ticker === 'string' && typeof item.allocationPercent === 'number'
      && Number.isFinite(item.currentPrice) && item.currentPrice > 0
      && getObservationTime(Date.parse(item.observedAt || ''), now)
    ).slice(0, 50).sort((a, b) => {
      const getScore = (item: any) => {
        let score = 0
        if (item.actionPriority === 'HIGH') score += 100
        else if (item.actionPriority === 'MEDIUM') score += 50

        const rsi = Number(item.rsi14)
        if (rsi && (rsi <= 30 || rsi >= 70)) score += 35
        else if (rsi && (rsi <= 40 || rsi >= 65)) score += 15

        const distS1 = Math.abs(Number(item.distanceToS1Percent ?? 999))
        if (distS1 <= 2.5) score += 25
        else if (distS1 <= 5) score += 10

        score += Math.min(20, (Number(item.allocationPercent) || 0) * 0.5)
        return score
      }
      return getScore(b) - getScore(a)
    })

    const topTriggers = sortedTriggers.slice(0, 8)
    const triggerSummary = topTriggers
      .map((t) => {
        const isThai =
          t.currency === 'THB' ||
          t.market === 'TH' ||
          t.market === 'SET' ||
          String(t.ticker).endsWith('.BK') ||
          String(t.ticker).toUpperCase() === 'SCB'
        const currSym = isThai ? '฿' : '$'
        const s1Formatted =
          t.supportS1 !== null && t.supportS1 !== undefined
            ? `${currSym}${t.supportS1}`
            : 'N/A'
        return `- ${t.ticker} (${t.assetName}): ราคา ${currSym}${t.currentPrice} | สัดส่วน ${t.allocationPercent?.toFixed(1)}% | RSI(14): ${t.rsi14 ?? 'N/A'} | S1: ${s1Formatted} (ห่าง ${t.distanceToS1Percent ?? 'N/A'}%) | สัญญาณ: ${t.actionTag}`
      })
      .join('\n')

    const prompt = `
[daily-brief:v2]
[AI Daily Investment Strategist — สรุปเช้าและแผนปฏิบัติการรายวัน]
คุณคือ Senior Portfolio Strategist สรุปทิศทางตลาดและแผนปฏิบัติการลงทุนรายวัน วันที่ ${advisorDate()}:

[ข้อมูลสภาวะตลาดวันนี้]
- ดัชนีอารมณ์ตลาด: ${fearGreedSummary}
${benchmarks.join('\n')}

[ภาพรวมพอร์ตโฟลิโอ]
- มูลค่าพอร์ตรวม: ${Number(totalPortfolioValue).toLocaleString()} ${baseCurrency}
- สภาพคล่องเงินสดสำรอง (Dry Powder): ${Number(totalCash).toLocaleString()} ${baseCurrency} (${totalPortfolioValue > 0 ? ((totalCash / totalPortfolioValue) * 100).toFixed(1) : 0}% ของพอร์ต)

[สินทรัพย์ในพอร์ตที่ส่งสัญญาณเทคนิคัลวันนี้ (Holdings with Technical Signals)]
${triggerSummary || 'ไม่มีกราฟหุ้นที่ยืนยันได้ ให้จำกัดคำตอบไว้ที่ข้อมูลตลาดและสิ่งที่ต้องตรวจต่อ'}

[กฎเหล็กการประเมินความเสี่ยงตามความเป็นจริง]:
- ระบุเฉพาะราคาและสัญญาณที่มีในข้อมูล ถ้าไม่มีให้เสนอสิ่งที่ต้องตรวจต่อ งดกำหนดเปอร์เซ็นต์เงินสดหรือราคาเข้าซื้อแทนผู้ใช้โดยไม่มีเป้าหมายที่แนบมา

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

    const aiResult = await callGemini({
      userId,
      prompt,
      logType: 'daily_brief',
      thinkingBudget: 0,
      systemInstruction:
        'คุณเป็น Senior Portfolio Strategist ที่ให้คำแนะนำการลงทุนตามหลักการบริหารความเสี่ยงระดับสถาบัน ชัดเจน ตรงประเด็น ใช้ภาษาไทยเข้าใจง่าย',
    })

    return NextResponse.json({
      success: true,
      advice: aiResult.text,
      modelUsed: aiResult.modelUsed,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[POST /api/daily-plan/ai-brief error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI brief' },
      { status: 500 }
    )
  }
}
