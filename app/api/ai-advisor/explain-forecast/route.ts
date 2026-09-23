import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId: session.user.id,
        logType: 'forecast_explain',
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    const hasThai = latestLog?.response ? /[ก-๙]/.test(latestLog.response) : false
    if (!hasThai && latestLog) {
      return NextResponse.json({
        explanation: null,
        modelUsed: null,
        updatedAt: null,
      })
    }

    return NextResponse.json({
      explanation: latestLog?.response ?? null,
      modelUsed: latestLog?.modelUsed ?? null,
      updatedAt: latestLog?.createdAt ? latestLog.createdAt.toISOString() : null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch forecast history' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      initialAmount,
      monthlyContribution,
      years,
      finalP10,
      finalP50,
      finalP90,
      targetAmount,
      probabilityOfReachingTarget,
      adjustInflation,
      finalRealP50,
      retirementMonthlyIncome,
      dividendMonthlyIncome,
      milestonesSummary,
    } = await req.json()

    const prompt = `
คุณเป็น Certified Financial Planner (CFP) และ Wealth Management Director ระดับสถาบันการเงินชั้นนำ
กรุณาวิเคราะห์และสังเคราะห์ยุทธศาสตร์การเติบโตของพอร์ตลงทุน (Wealth Forecast & Retirement Horizon) จากผลจำลองสถิติ Monte Carlo 1,000 สถานการณ์จำลอง ต่อไปนี้เป็นภาษาไทยที่คมคาย เป็นรูปธรรม และนำไปใช้ปฏิบัติได้ทันที:

📊 ข้อมูลแบบจำลองพอร์ต:
- เงินต้นเริ่มต้นปัจจุบัน: ฿${Number(initialAmount).toLocaleString()}
- วินัยการเติมเงินออม DCA รายเดือน: ฿${Number(monthlyContribution).toLocaleString()}/เดือน
- ระยะเวลาเป้าหมาย: ${years} ปี
- เป้าหมายเงินก้อนที่ต้องการ: ฿${Number(targetAmount).toLocaleString()}
- ความน่าจะเป็นในการพิชิตเป้าหมาย (Probability of Success): ${probabilityOfReachingTarget ?? 'N/A'}%
- ผลลัพธ์คาดการณ์เมื่อครบ ${years} ปี:
  • กรณีตลาดแย่ (P10 Bear Market): ฿${Number(finalP10).toLocaleString()}
  • กรณีมัธยฐานหลัก (P50 Expected Wealth): ฿${Number(finalP50).toLocaleString()}
  • กรณีตลาดดีเยี่ยม (P90 Bull Market): ฿${Number(finalP90).toLocaleString()}
${adjustInflation && finalRealP50 ? `- อำนาจซื้อแท้จริงหลังหักเงินเฟ้อ (Real Purchasing Power): ฿${Number(finalRealP50).toLocaleString()}` : ''}
${retirementMonthlyIncome ? `- เงินเดือนเกษียณใช้ชีวิตตามกฎ 4% Rule: ฿${Number(retirementMonthlyIncome).toLocaleString()}/เดือน` : ''}
${dividendMonthlyIncome ? `- กระแสเงินปันผลรับแท้จริงต่อเดือน: ฿${Number(dividendMonthlyIncome).toLocaleString()}/เดือน` : ''}
${milestonesSummary ? `- ไทม์ไลน์หลักไมล์สำคัญ: ${milestonesSummary}` : ''}

⚠️ กฎเหล็ก:
1. เขียนเนื้อหาทั้งหมดเป็น "ภาษาไทย 100%" สละสลวย ชัดเจน และทรงคุณค่า
2. ไม่ทักทายเยิ่นเย้อ เช่น "สวัสดีครับ" หรือ "เรียนท่านนักลงทุน"
3. สรุปเป็น 3 หัวข้อหลักด้วย Markdown ที่สวยงาม:
   - 📈 **1. การตีความผลลัพธ์และความมั่นคงทางการเงิน (Executive Interpretation)**: วิเคราะห์ตัวเลขมัธยฐาน P50 เทียบกับเป้าหมาย และเงินเดือนเกษียณที่ถอนใช้ได้จริง
   - 🎯 **2. ประเมินไทม์ไลน์และหลักไมล์สู่ความมั่งคั่ง (Milestone & Inflation Reality)**: วิเคราะห์ผลกระทบของเงินเฟ้อ และช่วงเวลาที่จะเกิด Compounding Effect (การทบต้นแบบก้าวกระโดด)
   - 💡 **3. พิมพ์เขียวกลยุทธ์เร่งการเติบโต (Actionable Growth Blueprint)**: แนะนำ 2-3 ขั้นตอนปฏิบัติจริง เช่น การเพิ่มเงินออมตามรายได้ที่โตขึ้น (Step-up DCA) หรือการรักษาวินัยช่วงตลาดปรับฐาน
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'forecast_explain',
      systemInstruction: 'คุณเป็นผู้อำนวยการฝ่ายวางแผนความมั่งคั่งและเกษียณอายุ (Wealth & Retirement Director) ตอบเป็นภาษาไทย 100% สละสลวย ชัดเจน ตรงประเด็น ใช้ตัวเลขประกอบการตัดสินใจจริง',
    })

    return NextResponse.json({
      explanation: text,
      modelUsed,
      updatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[explain-forecast POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to explain forecast' }, { status: 500 })
  }
}
