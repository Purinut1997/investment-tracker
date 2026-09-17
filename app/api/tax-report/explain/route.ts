import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callGemini } from '@/lib/ai/gemini-client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { year, dividends, thaiSetCapitalGains, foreignAndCryptoGains } = await req.json()

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านภาษีการลงทุนสำหรับบุคคลธรรมดาในประเทศไทย
กรุณาวิเคราะห์และอธิบายสรุปรายงานภาษีปี ${year} ของผู้ลงทุนเป็นภาษาไทยที่เข้าใจง่าย:

ข้อมูลภาษีปี ${year}:
1. เงินปันผล (Dividends):
   - ยอดเงินปันผลรวม (Gross): ฿${Number(dividends?.totalDividendGross ?? 0).toLocaleString()}
   - ภาษีหัก ณ ที่จ่ายรวม: ฿${Number(dividends?.totalTaxWithheld ?? 0).toLocaleString()}
   - เงินปันผลสุทธิที่ได้รับ: ฿${Number(dividends?.totalDividendNet ?? 0).toLocaleString()}

2. กำไรจากหุ้นไทย (SET Capital Gains):
   - กำไรส่วนต่างรวม: ฿${Number(thaiSetCapitalGains?.totalRealizedGain ?? 0).toLocaleString()}
   - ปริมาณการขายรวม: ฿${Number(thaiSetCapitalGains?.totalVolume ?? 0).toLocaleString()}
   - สถานะทางภาษี: ได้รับการยกเว้นภาษีเงินได้บุคคลธรรมดาในไทย

3. กำไรจากการขายสินทรัพย์ต่างประเทศ / คริปโต (Foreign Stocks & Crypto):
   - กำไรสุทธิรวม: ฿${Number(foreignAndCryptoGains?.totalRealizedGain ?? 0).toLocaleString()}
   - ยอดขายรวม: ฿${Number(foreignAndCryptoGains?.totalProceeds ?? 0).toLocaleString()}
   - ต้นทุนรวม: ฿${Number(foreignAndCryptoGains?.totalCost ?? 0).toLocaleString()}

กรุณาอธิบาย 3 ประเด็น:
1. ภาพรวมภาษีของปีนี้ หมวดไหนเด่น มีรายได้ที่ต้องนำไปคำนวณภาษีหรือไม่
2. ข้อพิจารณาสำหรับเงินปันผล (เช่น การเลือก Final Tax 10% หรือการขอเครดิตภาษีเงินปันผล)
3. ข้อควรระวังสำหรับหุ้นต่างประเทศ/คริปโตตามหลักเกณฑ์การนำเงินได้เข้าประเทศของกรมสรรพากร
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'tax_explain',
      systemInstruction:
        'คุณเป็นผู้ให้คำแนะนำด้านภาษีการลงทุนส่วนบุคคลในไทย ให้คำอธิบายที่ถูกต้องตามหลักการทางภาษีและเข้าใจง่าย',
    })

    const disclaimer =
      '⚠️ ข้อสงวนสิทธิ์: ข้อมูลนี้จัดทำขึ้นเพื่อเป็นแนวทางและอำนวยความสะดวกในการจัดหมวดหมู่ข้อมูลส่วนบุคคลเท่านั้น ไม่ถือเป็นแบบยื่นภาษีจริง และคำอธิบายจาก AI ไม่ใช่คำแนะนำด้านภาษีที่มีใบอนุญาต ผู้เสียภาษีควรตรวจสอบความถูกต้องกับเอกสารทางการจากสถาบันการเงินและปรึกษาผู้เชี่ยวชาญหรือกรมสรรพากรก่อนยื่นแบบ ภ.ง.ด. จริง'

    return NextResponse.json({
      explanation: text,
      disclaimer,
      modelUsed,
    })
  } catch (error: any) {
    console.error('[tax-report explain POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to explain tax report' }, { status: 500 })
  }
}
