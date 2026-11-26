import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { forecastContextKey, forecastInputSchema } from '@/lib/ai/model-contracts'
import {
  getUnifiedPortfolioContext,
  formatUnifiedContextPrompt,
  buildUnifiedDecisionRules,
} from '@/lib/ai/unified-context'

export const maxDuration = 45

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const context = req.nextUrl.searchParams.get('scenario')
    if (!context || context.length > 330 || !/^[0-9e+._-]+$/.test(context)) {
      return NextResponse.json({ explanation: null, modelUsed: null, updatedAt: null })
    }
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId: session.user.id,
        logType: 'forecast_explain',
        prompt: { contains: `[forecast:v2:${context}]` },
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

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
    const body = forecastInputSchema.safeParse(await req.json())
    if (!body.success) {
      return NextResponse.json({ error: 'ผลจำลองไม่ครบหรือค่า P10/P50/P90 ไม่เรียงตามลำดับ' }, { status: 400 })
    }
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
    } = body.data

    const unifiedCtx = await getUnifiedPortfolioContext(session.user.id).catch(() => null)

    const prompt = `
[forecast:v2:${forecastContextKey(body.data)}]
คุณกำลังอธิบายผลจำลองการลงทุนที่ระบบคำนวณไว้ภายใต้สมมติฐานของผู้ใช้ P10/P50/P90 เป็นเปอร์เซ็นไทล์ของผลจำลองตามลำดับ ห้ามรับประกันผลลัพธ์หรือเรียก P50 ว่าค่าเฉลี่ย
กรุณาวิเคราะห์และสังเคราะห์ยุทธศาสตร์การเติบโตของพอร์ตลงทุน (Wealth Forecast & Retirement Horizon) จากผลจำลองสถิติ Monte Carlo 1,000 สถานการณ์จำลอง เชื่อมโยงกับโครงสร้างพอร์ตจริงของผู้ใช้ ต่อไปนี้เป็นภาษาไทยระดับมืออาชีพ ชัดเจน แยกหมวดหมู่อย่างเป็นระบบ และนำไปใช้ปฏิบัติได้ทันที:

${unifiedCtx ? formatUnifiedContextPrompt(unifiedCtx, { excludeSurface: 'forecast', compact: true }) : ''}

${buildUnifiedDecisionRules('forecast')}

📊 ข้อมูลแบบจำลองพอร์ต:
- เงินต้นเริ่มต้นปัจจุบัน: ฿${Number(initialAmount).toLocaleString()}
- วินัยการเติมเงินออม DCA รายเดือน: ฿${Number(monthlyContribution).toLocaleString()}/เดือน
- ระยะเวลาเป้าหมาย: ${years} ปี
- เป้าหมายเงินก้อนที่ต้องการ: ฿${Number(targetAmount).toLocaleString()}
- สัดส่วนรอบจำลองที่ถึงเป้าหมาย: ${probabilityOfReachingTarget == null ? 'ไม่มีข้อมูล' : `${probabilityOfReachingTarget}%`}
- ผลลัพธ์คาดการณ์เมื่อครบ ${years} ปี:
  • เปอร์เซ็นไทล์ต่ำ (P10): ฿${Number(finalP10).toLocaleString()}
  • มัธยฐาน (P50): ฿${Number(finalP50).toLocaleString()}
  • เปอร์เซ็นไทล์สูง (P90): ฿${Number(finalP90).toLocaleString()}
${adjustInflation && finalRealP50 != null ? `- อำนาจซื้อหลังปรับเงินเฟ้อตามสมมติฐาน: ฿${Number(finalRealP50).toLocaleString()}` : '- ใช้ตัวเลขก่อนปรับเงินเฟ้อในส่วนที่ไม่มีผลจำลองแบบ Real Value'}
${retirementMonthlyIncome != null ? `- ตัวอย่างยอดถอนตามสมมติฐาน 4%: ฿${Number(retirementMonthlyIncome).toLocaleString()}/เดือน` : ''}
${dividendMonthlyIncome != null ? `- กระแสเงินปันผลโดยประมาณจากสมมติฐาน: ฿${Number(dividendMonthlyIncome).toLocaleString()}/เดือน` : ''}
${milestonesSummary ? `- ไทม์ไลน์หลักไมล์สำคัญ: ${milestonesSummary}` : ''}

⚠️ กฎเหล็กในการจัดรูปแบบรายงาน (Executive Format):
1. เขียนเนื้อหาเป็น "ภาษาไทย 100%" สละสลวย ชัดเจน และทรงคุณค่า
2. ไม่ทักทายเยิ่นเย้อ เช่น "สวัสดีครับ" หรือ "เรียนท่านนักลงทุน" เข้าสู่เนื้อหาทันที
3. เน้นตัวเลขสำคัญด้วยตัวหนา เช่น **฿1,219,801**, **72%**, **10 ปี** เสมอ
4. จัดรูปแบบแยกหมวดหมู่ด้วย Markdown Headers (###) ทั้ง 5 ส่วนดังนี้:

### 📌 สรุปภาพรวมผู้บริหาร (Executive Summary)
- สรุปผลจำลองและความท้าทายหลัก ใช้สัดส่วนรอบที่ถึงเป้าหมายเฉพาะเมื่อมีข้อมูล

### 📈 1. การตีความผลลัพธ์และอำนาจซื้อแท้จริง (Executive Interpretation & Inflation Reality)
- วิเคราะห์ผลลัพธ์มัธยฐาน P50 เทียบกับเป้าหมายที่ตั้งไว้
${adjustInflation ? '- ชี้ให้เห็นถึงความเสี่ยงกรณีตลาดแย่ (P10) และผลกระทบของการกัดกร่อนจากเงินเฟ้อต่ออำนาจซื้อแท้จริง' : '- ชี้ให้เห็นถึงความเสี่ยงกรณีตลาดแย่ (P10) และการปกป้องเงินต้นในระยะยาว'}
- แยกตัวอย่างยอดถอน 4% และประมาณการเงินปันผล ระบุว่าต้องมีข้อมูลรายจ่ายก่อนประเมินความเพียงพอ

### 🎯 2. ประเมินไทม์ไลน์และจุดเร่งทบต้น (Milestone Velocity & Compounding Effect)
- ใช้ปีของหลักไมล์จากไทม์ไลน์ที่ให้เท่านั้น หากไม่มีให้บอกว่าข้อมูลไม่พอระบุปี
- อธิบายช่วงเวลาที่จะเริ่มเกิดพลังดอกเบี้ยทบต้น (Compounding Acceleration) ที่เงินทำงานแทนคุณ

### 🚀 3. พิมพ์เขียวกลยุทธ์เร่งการเติบโต (Actionable Growth Blueprint)
- 1. [กลยุทธ์เงินออม]: แนะนำแนวทางปฏิบัติ เช่น การปรับเพิ่มเงิน DCA (Step-up DCA) ตามฐานเงินเดือน
- 2. [กลยุทธ์บริหารความเสี่ยง]: แนะนำวินัยช่วงตลาดปรับฐาน หรือการ Rebalance สินทรัพย์
- 3. [กลยุทธ์กระแสเงินสด]: แนวทางการสร้าง Passive Income รองรับเกษียณ

### 💡 4. คำแนะนำสรุปฟันธง (Strategic Conclusion)
- สรุป Action สำคัญ 1-2-3 ที่เชื่อมผลจำลองเข้ากับพอร์ตจริงตอนนี้ (เช่น ปรับงบ DCA ใน /plans, ลดความเสี่ยงกระจุกตัวใน /radar, หรือจำลองเพิ่มงบใน /ai-advisor)
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
