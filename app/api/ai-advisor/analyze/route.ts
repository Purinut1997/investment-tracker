import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // 1. Gather context
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const healthScore = calculatePortfolioHealthScore(holdingsResult.holdings)

    if (holdingsResult.holdings.length === 0) {
      return NextResponse.json({
        advice: 'ยังไม่มีสินทรัพย์ในพอร์ต กรุณาเพิ่มรายการธุรกรรมซื้อ-ขายก่อนขอคำแนะนำจาก AI',
        disclaimer: 'ข้อมูลนี้ไม่ใช่คำแนะนำทางการเงินที่มีใบอนุญาต เป็นเพียงการวิเคราะห์เชิงสถิติ',
      })
    }

    // 2. Format holdings list for AI
    const holdingsSummary = holdingsResult.holdings.map((h) => ({
      ticker: h.ticker,
      market: h.market,
      currentValue: `${h.currentValueBase.toLocaleString()} ${baseCurrency}`,
      allocationPercent: `${h.allocationPercent.toFixed(1)}%`,
      pnlPercent: `${h.unrealizedPnLPercent.toFixed(1)}%`,
    }))

    const prompt = `
คุณเป็นที่ปรึกษาการลงทุนอัจฉริยะส่วนบุคคล (Investment Advisor AI)
วิเคราะห์ข้อมูลพอร์ตการลงทุนของผู้ใช้ต่อไปนี้ แล้วให้คำแนะนำภาษาไทยที่เข้าใจง่าย กระชับ และตรงประเด็น:

ข้อมูลพอร์ต:
- มูลค่ารวม: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency}
- กำไร/ขาดทุนรวม: ${holdingsResult.unrealizedPnLPercent.toFixed(2)}%
- Portfolio Health Score: ${healthScore.score}/100 (เกรด ${healthScore.grade})
- รายการสินทรัพย์: ${JSON.stringify(holdingsSummary, null, 2)}

กรุณาวิเคราะห์ 3 ด้าน:
1. การกระจายความเสี่ยง (Diversification) และสินทรัพย์ที่กระจุกตัว
2. ข้อแนะนำในการปรับสมดุลพอร์ต (Rebalancing Suggestions)
3. ความเสี่ยงตลาดที่ควรจับตาในรอบนี้

(คำตอบควรจัดหมวดหมู่อย่างสวยงาม ใช้ Bullet point และสรุปสั้นกระชับ)
`

    const systemInstruction =
      'คุณเป็น AI วิเคราะห์การลงทุน ให้คำตอบเป็นภาษาไทยที่เป็นมิตร สุภาพ มีเหตุผล และอิงหลักการลงทุนระยะยาว'

    const { text, modelUsed } = await callGemini({
      userId,
      prompt,
      logType: 'advisor',
      systemInstruction,
    })

    const disclaimer =
      '⚠️ ข้อสงวนสิทธิ์: ข้อมูลนี้เกิดจากการประมวลผลด้วย AI เพื่อการวิเคราะห์ส่วนบุคคลเท่านั้น ไม่ถือเป็นคำแนะนำทางการเงิน การลงทุน หรือการชักชวนให้ซื้อขายหลักทรัพย์ที่มีใบอนุญาต ผู้ลงทุนควรศึกษาข้อมูลและตัดสินใจด้วยตนเอง'

    return NextResponse.json({
      advice: text,
      disclaimer,
      modelUsed,
      healthScore,
    })
  } catch (error: any) {
    console.error('[ai-advisor analyze]', error)
    return NextResponse.json({ error: error.message || 'AI analysis failed' }, { status: 500 })
  }
}
