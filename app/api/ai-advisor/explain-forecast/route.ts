import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callGemini } from '@/lib/ai/gemini-client'

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
    } = await req.json()

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านการวางแผนการเงินส่วนบุคคล
กรุณาอธิบายผลลัพธ์การจำลองการเติบโตของพอร์ตลงทุนแบบ Monte Carlo (500-1000 สถานการณ์จำลอง) ต่อไปนี้เป็นภาษาไทยที่เข้าใจง่ายและให้กำลังใจ:

ข้อมูลการจำลอง:
- เงินต้นเริ่มต้น: ฿${Number(initialAmount).toLocaleString()}
- เงินออมลงทุนเพิ่มต่อเดือน: ฿${Number(monthlyContribution).toLocaleString()}
- ระยะเวลาลงทุน: ${years} ปี
- เป้าหมายที่ต้องการ: ฿${Number(targetAmount).toLocaleString()}
- โอกาสสำเร็จตามเป้าหมาย (Probability): ${probabilityOfReachingTarget ?? 'ไม่ได้ระบุ'}%
- ผลลัพธ์สถานการณ์จำลอง (เมื่อครบ ${years} ปี):
  • กรณีแย่ (P10 - โอกาสเกิด 10% จากตลาดซบเซา): ฿${Number(finalP10).toLocaleString()}
  • กรณีกลาง (P50 - มัธยฐานตลาดทั่วไป): ฿${Number(finalP50).toLocaleString()}
  • กรณีดีเยี่ยม (P90 - ตลาดกระทิงสดใส): ฿${Number(finalP90).toLocaleString()}

กรุณาสรุป 3 ส่วน:
1. ความหมายของตัวเลขเหล่านี้สำหรับผู้ลงทุน (ตีความเป็นภาษาคน ไม่ใช้ศัพท์สถิติซับซ้อน)
2. การประเมินโอกาสที่จะบรรลุเป้าหมาย
3. คำแนะนำที่ทำได้จริงเพื่อเพิ่มโอกาสสำเร็จ (เช่น การเพิ่มเงินออมรายเดือน หรือการปรับสัดส่วนสินทรัพย์)
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'forecast_explain',
      systemInstruction: 'คุณเป็นที่ปรึกษาการวางแผนการเงินส่วนบุคคลที่เข้าใจง่าย ให้คำแนะนำที่เป็นรูปธรรม',
    })

    return NextResponse.json({
      explanation: text,
      modelUsed,
    })
  } catch (error: any) {
    console.error('[explain-forecast POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to explain forecast' }, { status: 500 })
  }
}
