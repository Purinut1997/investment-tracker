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
กรุณาวิเคราะห์และสังเคราะห์ยุทธศาสตร์การเติบโตของพอร์ตลงทุน (Wealth Forecast & Retirement Horizon) จากผลจำลองสถิติ Monte Carlo 1,000 สถานการณ์จำลอง ต่อไปนี้เป็นภาษาไทยระดับมืออาชีพ ชัดเจน แยกหมวดหมู่อย่างเป็นระบบ และนำไปใช้ปฏิบัติได้ทันที:

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

⚠️ กฎเหล็กในการจัดรูปแบบรายงาน (Executive Format):
1. เขียนเนื้อหาเป็น "ภาษาไทย 100%" สละสลวย ชัดเจน และทรงคุณค่า
2. ไม่ทักทายเยิ่นเย้อ เช่น "สวัสดีครับ" หรือ "เรียนท่านนักลงทุน" เข้าสู่เนื้อหาทันที
3. เน้นตัวเลขสำคัญด้วยตัวหนา เช่น **฿1,219,801**, **72%**, **10 ปี** เสมอ
4. จัดรูปแบบแยกหมวดหมู่ด้วย Markdown Headers (###) ทั้ง 5 ส่วนดังนี้:

### 📌 สรุปภาพรวมผู้บริหาร (Executive Summary)
- สรุปสถานะพอร์ต โอกาสสำเร็จ ${probabilityOfReachingTarget ?? 0}% และความท้าทายหลักใน 2-3 บรรทัดที่กระชับ คมคาย

### 📈 1. การตีความผลลัพธ์และอำนาจซื้อแท้จริง (Executive Interpretation & Inflation Reality)
- วิเคราะห์ผลลัพธ์มัธยฐาน P50 เทียบกับเป้าหมายที่ตั้งไว้
- ชี้ให้เห็นถึงความเสี่ยงกรณีตลาดแย่ (P10) และผลกระทบของการกัดกร่อนจากเงินเฟ้อต่ออำนาจซื้อแท้จริง
- วิเคราะห์กระแสเงินสดเกษียณจากกฎ 4% Rule และเงินปันผลว่าเพียงพอต่อคุณภาพชีวิตจริงหรือไม่

### 🎯 2. ประเมินไทม์ไลน์และจุดเร่งทบต้น (Milestone Velocity & Compounding Effect)
- วิเคราะห์ปีที่คาดว่าจะแตะหลักไมล์สำคัญ (เช่น 1 ล้าน, 3 ล้าน, 5 ล้าน, 10 ล้าน)
- อธิบายช่วงเวลาที่จะเริ่มเกิดพลังดอกเบี้ยทบต้น (Compounding Acceleration) ที่เงินทำงานแทนคุณ

### 🚀 3. พิมพ์เขียวกลยุทธ์เร่งการเติบโต (Actionable Growth Blueprint)
- 1. [กลยุทธ์เงินออม]: แนะนำแนวทางปฏิบัติ เช่น การปรับเพิ่มเงิน DCA (Step-up DCA) ตามฐานเงินเดือน
- 2. [กลยุทธ์บริหารความเสี่ยง]: แนะนำวินัยช่วงตลาดปรับฐาน หรือการ Rebalance สินทรัพย์
- 3. [กลยุทธ์กระแสเงินสด]: แนวทางการสร้าง Passive Income รองรับเกษียณ

### 💡 4. คำแนะนำสรุปฟันธง (Strategic Conclusion)
- สรุป Action สำคัญที่สุด 1 ประการที่นักลงทุนควรลงมือทำทันทีในเดือนนี้เพื่อเพิ่มโอกาสสำเร็จของพอร์ต
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'forecast_explain',
      systemInstruction: 'คุณเป็นผู้อำนวยการฝ่ายวางแผนความมั่งคั่งและเกษียณอายุ (Wealth & Retirement Director) ตอบเป็นภาษาไทย 100% สละสลวย กระชับ ตรงประเด็น ใช้ตัวเลขประกอบการตัดสินใจจริง จัดรูปแบบหัวข้อและหมวดหมู่อย่างเป็นระเบียบ',
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
