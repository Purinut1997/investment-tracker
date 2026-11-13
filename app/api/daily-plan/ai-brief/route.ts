import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'

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

    if (!portfolioTriggers || portfolioTriggers.length === 0) {
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
          prompt: { contains: 'AI Daily Investment Strategist' },
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

    const regimeTitle = marketOverview?.regime?.title || 'Consolidation'
    const fearGreed = marketOverview?.regime?.fearGreed
    const fearGreedSummary = fearGreed
      ? `${fearGreed.score}/100 (${fearGreed.ratingLabelTh} — CNN Fear & Greed Index ดัชนีอารมณ์มนุษย์ในตลาดจริง)`
      : 'N/A'

    const benchmarksSummary = marketOverview?.benchmarks
      ? marketOverview.benchmarks
          .map((b: any) => `${b.symbol}: ${b.price?.toLocaleString()} (${b.changePercent >= 0 ? '+' : ''}${b.changePercent?.toFixed(2)}%)`)
          .join(', ')
      : 'S&P 500, NASDAQ, SET Index'

    const vixBenchmark = marketOverview?.benchmarks?.find((b: any) => b.symbol === 'VIX')
    const vixSummary = vixBenchmark
      ? `${vixBenchmark.price} pts (${vixBenchmark.price < 15 ? 'สงบ/Low Volatility' : vixBenchmark.price < 20 ? 'ปกติ/Balanced' : vixBenchmark.price < 28 ? 'กังวลสูง/Elevated Fear' : 'ตื่นตระหนก/Extreme Fear — จุดช้อนซื้อ'})`
      : 'N/A'

    // 2. Prioritize triggers intelligently (High priority > Extreme RSI > Near S1 > High weight)
    const sortedTriggers = [...(portfolioTriggers as any[])].sort((a, b) => {
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
[AI Daily Investment Strategist — สรุปเช้าและแผนปฏิบัติการรายวัน]
คุณคือ Senior Portfolio Strategist สรุปทิศทางตลาดและแผนปฏิบัติการลงทุนรายวัน วันที่ ${planDate || 'วันนี้'}:

[ข้อมูลสภาวะตลาดวันนี้]
- สถานะตลาด (Market Regime): ${regimeTitle}
- ดัชนีอารมณ์มนุษย์ในตลาดจริง (CNN Fear & Greed Index): ${fearGreedSummary}
- ดัชนีหลักชี้นำ: ${benchmarksSummary}
- ดัชนีความกังวลและความกลัว (VIX Volatility Index): ${vixSummary}

[ภาพรวมพอร์ตโฟลิโอ]
- มูลค่าพอร์ตรวม: ${Number(totalPortfolioValue).toLocaleString()} ${baseCurrency}
- สภาพคล่องเงินสดสำรอง (Dry Powder): ${Number(totalCash).toLocaleString()} ${baseCurrency} (${totalPortfolioValue > 0 ? ((totalCash / totalPortfolioValue) * 100).toFixed(1) : 0}% ของพอร์ต)

[สินทรัพย์ในพอร์ตที่ส่งสัญญาณเทคนิคัลวันนี้ (Holdings with Technical Signals)]
${triggerSummary}

[กฎเหล็กการประเมินความเสี่ยงตามความเป็นจริง]:
- หากดัชนีอารมณ์มนุษย์ (CNN Fear & Greed Index) หรือสภาวะตลาดอยู่ในระดับกังวล/กลัว (Fear/Caution ต่ำกว่า 45) หรือ VIX สูง: ห้ามมองบวกเกินจริงเด็ดขาด ให้ยึดแนวทาง 'ไม่ Panic Sell ตามฝูงชน และไม่ไล่ราคาตอนเด้งเขียว (Dead-Cat Bounce)' ควรถือเงินสดสำรอง (Dry Powder) 15-20% และตั้ง Limit Order รอรับเฉพาะแนวรับสำคัญ S1 ที่ได้เปรียบเท่านั้น

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
