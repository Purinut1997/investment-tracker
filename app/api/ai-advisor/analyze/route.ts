import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: 'Investment Advisor AI' },
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    return NextResponse.json({
      advice: latestLog?.response ?? null,
      modelUsed: latestLog?.modelUsed ?? null,
      updatedAt: latestLog?.createdAt ? latestLog.createdAt.toISOString() : null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch latest advice' }, { status: 500 })
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
    const { presetName, targetAllocation } = body || {}

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
วิเคราะห์ข้อมูลพอร์ตการลงทุนและแผนการจัดสรรสินทรัพย์ของผู้ใช้ต่อไปนี้ แล้วให้คำแนะนำภาษาไทยระดับมืออาชีพ ชัดเจน เข้าใจง่าย และตรงประเด็น:

[ข้อมูลพอร์ตปัจจุบัน]
- มูลค่ารวม: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency}
- กำไร/ขาดทุนรวม: ${holdingsResult.unrealizedPnLPercent.toFixed(2)}%
- Portfolio Health Score: ${healthScore.score}/100 (เกรด ${healthScore.grade})
- แผนการลงทุนที่เลือกใช้งาน: ${presetName || 'แผนมาตรฐาน'}
${targetAllocation ? `- สัดส่วนเป้าหมายตามแผน: ${JSON.stringify(targetAllocation)}` : ''}
- รายการสินทรัพย์ปัจจุบัน: ${JSON.stringify(holdingsSummary, null, 2)}

กรุณาวิเคราะห์ 3 ด้านสำคัญ:
1. 🛡️ **การกระจายความเสี่ยง (Diversification & Concentration)**: ชี้จุดกระจุกตัวหรือจุดเปราะบางเทียบกับเป้าหมาย
2. 🎯 **ข้อแนะนำในการปรับสมดุลพอร์ต (Rebalancing Action Steps)**: ระบุชัดเจนว่าควรทยอยเติมเงินหรือขายปรับสัดส่วนในกลุ่มใดเป็นพิเศษ
3. 💡 **ความเสี่ยงตลาดและยุทธศาสตร์รับมือ (Market Risks & Defensive Strategy)**: ข้อคิดในการบริหารเงินลงทุนระยะยาว

(คำตอบควรจัดหมวดหมู่ให้อ่านง่าย ใช้ Bullet points ชัดเจน ไม่พิมพ์เครื่องหมายกำกวม)
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
      updatedAt: new Date().toISOString(),
      healthScore,
    })
  } catch (error: any) {
    console.error('[ai-advisor analyze]', error)
    return NextResponse.json({ error: error.message || 'AI analysis failed' }, { status: 500 })
  }
}
