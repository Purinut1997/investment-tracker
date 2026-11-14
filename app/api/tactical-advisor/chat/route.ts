import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({}))
    const { question, tacticalContext } = body

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 })
    }

    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)

    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, currency: true },
    })
    let totalCash = 0
    accounts.forEach((acc) => {
      totalCash += Number(acc.cashBalance) || 0
    })

    const holdingsText = holdingsResult.holdings
      .slice(0, 10)
      .map(
        (h) =>
          `- [${h.ticker}] ${h.assetName} (${h.allocationPercent.toFixed(1)}% พอร์ต, กำไร/ขาดทุน: ${h.unrealizedPnLPercent.toFixed(2)}%)`
      )
      .join('\n')

    const contextSummary = tacticalContext
      ? `
- สภาวะตลาดห้วงนี้: ${tacticalContext.marketRegime?.statusLabelTh || 'ทั่วไป'} (ความเสี่ยงระดับ ${tacticalContext.marketRegime?.riskLevel || 3}/5)
- สรุปตลาด: ${tacticalContext.marketRegime?.summaryTh || '-'}
- สุขภาพพอร์ต: ${tacticalContext.portfolioResilience?.statusLabelTh || '-'} (คะแนน ${tacticalContext.portfolioResilience?.score || 70}/100)
- คำเตือนเชิงธีม: ${tacticalContext.portfolioResilience?.thematicRiskAlert || 'ไม่มี'}
- เงินสดสำรองปัจจุบัน: ${totalCash.toLocaleString()} ${baseCurrency}
`
      : 'ไม่มีข้อมูลบริบทเพิ่มเติม'

    const prompt = `
[AI Tactical Copilot Chat]
ผู้ใช้กำลังสอบถามเกี่ยวกับกลยุทธ์การลงทุนเฉพาะกิจในห้วงเวลานี้

=== ข้อมูลบริบทกลยุทธ์ปัจจุบัน ===
${contextSummary}

=== พอร์ตของนักลงทุน ===
${holdingsText || 'ไม่มีหุ้นในพอร์ต'}
เงินสดคงเหลือ: ${totalCash.toLocaleString()} ${baseCurrency}

=== คำถามของผู้ใช้ ===
"${question.trim()}"

=== คำแนะนำในการตอบ ===
1. ตอบเป็นภาษาไทยที่กระชับ ตรงไปตรงมา ชัดเจน ไม่อ้อมค้อม
2. ให้คำแนะนำเชิงกลยุทธ์ (Tactical Action) ที่เชื่อมโยงกับพอร์ตของเขาและเงินสดที่มีจริง
3. หากแนะนำเรื่องการซื้อ ให้ระบุขนาดไม้และจุด Stop Loss คร่าวๆ เสมอ
4. ตอบในรูปแบบ Markdown ที่อ่านง่าย มี Bullet Points และตัวหนาเน้นข้อความสำคัญ
`

    const aiResult = await callGemini({
      userId,
      prompt,
      logType: 'bucket_chat',
      systemInstruction:
        'คุณคือที่ปรึกษากลยุทธ์การลงทุนส่วนบุคคลระดับอาวุโส ให้คำตอบที่เป็นประโยชน์ จริงใจ มีเหตุผลรองรับ และคำนึงถึงการบริหารความเสี่ยงเป็นหลัก',
      thinkingBudget: 0,
    })

    return NextResponse.json({
      answer: aiResult.text,
      modelUsed: aiResult.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor chat error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    )
  }
}
