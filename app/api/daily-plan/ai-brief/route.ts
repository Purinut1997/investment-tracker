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
    } = body

    if (!portfolioTriggers || portfolioTriggers.length === 0) {
      return NextResponse.json({
        advice: 'ยังไม่มีข้อมูลสินทรัพย์ในพอร์ตที่เพียงพอสำหรับการจัดทำแผนประจำวัน กรุณาบันทึกรายการลงทุนเพื่อเริ่มการวิเคราะห์',
      })
    }

    const regimeTitle = marketOverview?.regime?.title || 'Consolidation'
    const benchmarksSummary = marketOverview?.benchmarks
      ? marketOverview.benchmarks
          .map((b: any) => `${b.symbol}: ${b.price?.toLocaleString()} (${b.changePercent >= 0 ? '+' : ''}${b.changePercent?.toFixed(2)}%)`)
          .join(', ')
      : 'S&P 500, NASDAQ, SET Index'

    const topTriggers = (portfolioTriggers as any[]).slice(0, 6)
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
[AI Daily Investment Strategist — วางแผนปฏิบัติการประจำวัน]
คุณคือ "Chief Investment Strategist" มืออาชีพ จงสรุปบทวิเคราะห์ทิศทางตลาดวันนี้ และจัดทำแผนปฏิบัติการลงทุนรายวัน (Daily Actionable Game Plan) เฉพาะสำหรับพอร์ตการลงทุนนี้ วันที่ ${planDate || 'วันนี้'}:

[ข้อมูลสภาวะตลาดวันนี้]
- สถานะตลาด (Market Regime): ${regimeTitle}
- ดัชนีหลักชี้นำ: ${benchmarksSummary}

[ภาพรวมพอร์ตโฟลิโอ]
- มูลค่าพอร์ตรวม: ${Number(totalPortfolioValue).toLocaleString()} ${baseCurrency}
- สภาพคล่องเงินสดสำรอง (Dry Powder): ${Number(totalCash).toLocaleString()} ${baseCurrency} (${totalPortfolioValue > 0 ? ((totalCash / totalPortfolioValue) * 100).toFixed(1) : 0}% ของพอร์ต)

[สินทรัพย์ในพอร์ตที่ส่งสัญญาณเทคนิคัลวันนี้ (Holdings with Technical Signals)]
${triggerSummary}

[กฎเหล็กระดับมืออาชีพ — มาตรฐานการเงินสากล]:
- ต้องระบุชื่อสินทรัพย์ทุกตัวด้วย "สัญลักษณ์ย่อของหุ้น (Ticker Symbol)" ภาษาอังกฤษตัวพิมพ์ใหญ่เสมอ (เช่น NVDA, AAPL, SCHD, VOO, GOOGL, SCB, PTT, DELTA, BTC, GOLD) ห้ามใช้ชื่อบริษัทภาษาไทยหรือชื่อยาวโดดเดี่ยวเด็ดขาด
- ในส่วนที่ 2: ให้ขึ้นต้นแต่ละบรรทัดด้วยรูปแบบ: - **TICKER ($ราคา หรือ ฿ราคา | RSI: xx | S1: $xx หรือ ฿xx):** รายละเอียด (ใช้ ฿ สำหรับหุ้นไทย เช่น SCB, PTT และใช้ $ สำหรับหุ้นสหรัฐฯ เช่น VOO, SCHD)
- ในส่วนที่ 3: ให้ระบุ Ticker ให้ชัดเจนในแต่ละข้อปฏิบัติ เช่น "1. **ตั้งรับ NVDA ที่แนวรับ $118:** ..." หรือ "1. **ตั้งรับ SCB ที่แนวรับ ฿151:** ..."

กรุณาเขียนบทวิเคราะห์และแผนปฏิบัติการรายวันเป็นภาษาไทยที่กระชับ คมชัด และลงมือทำได้จริง โดยแบ่งเป็น 3 ส่วนชัดเจน:
1. 🧭 **ทิศทางตลาดและบรรยากาศมหภาควันนี้ (Market Regime & Macro Pulse)**: สรุปภาพรวมทิศทางดัชนีหลัก และปัจจัยที่ต้องจับตาในคืนนี้/วันนี้ (2-3 บรรทัด)
2. 🎯 **วิเคราะห์เจาะจงสินทรัพย์ในพอร์ต (Key Support & Triggers)**: วิเคราะห์ว่าหุ้น/สินทรัพย์ตัวไหนในพอร์ตลงมาถึงจุดน่าสนใจ หรือตัวไหนควรชะลอการซื้อ พร้อมระบุราคาแนวรับ S1 และระดับ RSI
3. 📋 **แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้ (Today's 3 Execution Steps)**: ให้เขียนเป็น 3 ข้อ bullet สั้นๆ ที่ผู้ใช้สามารถนำไปติ๊กทำใน Daily Checklist ได้ทันที
`

    const aiResult = await callGemini({
      userId,
      prompt,
      logType: 'advisor',
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
