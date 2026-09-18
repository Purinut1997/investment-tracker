import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callGemini } from '@/lib/ai/gemini-client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { year, usdThbRate, dividends, thaiSetCapitalGains, foreignAndCryptoGains } = await req.json()

    const fx = usdThbRate ?? 35.5

    // Build human-readable values with correct currency labels
    const divGrossUSD = Number(dividends?.totalDividendGrossUSD ?? 0)
    const divTaxUSD = Number(dividends?.totalTaxWithheldUSD ?? 0)
    const divNetUSD = Number(dividends?.totalDividendNetUSD ?? 0)
    const divGrossTHB = Number(dividends?.totalDividendGrossTHB ?? 0)
    const divTaxTHB = Number(dividends?.totalTaxWithheldTHB ?? 0)
    const divNetTHB = Number(dividends?.totalDividendNetTHB ?? 0)

    const thaiGain = Number(thaiSetCapitalGains?.totalRealizedGain ?? 0)
    const thaiVolume = Number(thaiSetCapitalGains?.totalVolume ?? 0)

    const foreignGainUSD = Number(foreignAndCryptoGains?.totalRealizedGainUSD ?? 0)
    const foreignProceedsUSD = Number(foreignAndCryptoGains?.totalProceedsUSD ?? 0)
    const foreignCostUSD = Number(foreignAndCryptoGains?.totalCostUSD ?? 0)
    const foreignGainTHB = Number(foreignAndCryptoGains?.totalRealizedGainTHB ?? 0)

    const hasForeignGain = foreignGainUSD !== 0 || foreignGainTHB !== 0
    const hasDivUSD = divGrossUSD > 0

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านภาษีการลงทุนสำหรับบุคคลธรรมดาในประเทศไทย
กรุณาวิเคราะห์และอธิบายสรุปรายงานภาษีปี ${year} ของผู้ลงทุนเป็นภาษาไทยที่เข้าใจง่าย:

ข้อมูลภาษีปี ${year} (อัตราแลกเปลี่ยน 1 USD = ${fx.toFixed(2)} THB):

1. เงินปันผล (Dividends):
${hasDivUSD ? `   - หุ้นต่างประเทศ (USD): ยอดรวม $${divGrossUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD / ภาษีหัก -$${divTaxUSD.toFixed(2)} USD / สุทธิ $${divNetUSD.toFixed(2)} USD` : ''}
   - เทียบเท่าเงินบาท: ฿${divGrossTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB (รวมทุกสกุล)
   - ภาษีหัก ณ ที่จ่ายรวม (THB): ฿${divTaxTHB.toFixed(2)}
   - เงินปันผลสุทธิ (THB): ฿${divNetTHB.toFixed(2)}

2. กำไรจากหุ้นไทย (SET Capital Gains):
   - กำไรส่วนต่างรวม: ฿${thaiGain.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB
   - ปริมาณการขายรวม: ฿${thaiVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB
   - สถานะทางภาษี: ได้รับการยกเว้นภาษีเงินได้บุคคลธรรมดาในไทย (ตาม พ.ร.บ. ตลาดหลักทรัพย์)

3. กำไรจากการขายสินทรัพย์ต่างประเทศ / คริปโต (Foreign Stocks & Crypto):
${hasForeignGain ? `   - กำไรสุทธิ: $${foreignGainUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (≈ ฿${foreignGainTHB.toFixed(2)} THB)
   - ยอดขายรวม: $${foreignProceedsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
   - ต้นทุนรวม (FIFO): $${foreignCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD` : '   - ไม่มีรายการขายสินทรัพย์ต่างประเทศในปีนี้'}

กรุณาอธิบาย 3 ประเด็น:
1. ภาพรวมภาษีของปีนี้ หมวดไหนเด่น มีรายได้ที่ต้องนำไปคำนวณภาษีหรือไม่
2. ข้อพิจารณาสำหรับเงินปันผล (เช่น การเลือก Final Tax 10% หรือการขอเครดิตภาษีเงินปันผล) — โดยเฉพาะกรณีหุ้นต่างประเทศที่มีภาษีหัก ณ ที่จ่ายในสหรัฐ (W-8BEN 15%) ซึ่งอาจนำมาหักเครดิตได้
3. ข้อควรระวังสำหรับหุ้นต่างประเทศ/คริปโตตามหลักเกณฑ์การนำเงินได้เข้าประเทศของกรมสรรพากร (มาตรา 41 วรรค 2)
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'tax_explain',
      systemInstruction:
        'คุณเป็นผู้ให้คำแนะนำด้านภาษีการลงทุนส่วนบุคคลในไทย ให้คำอธิบายที่ถูกต้องตามหลักการทางภาษีและเข้าใจง่าย ใช้สกุลเงินที่ถูกต้องเสมอ: USD ($) สำหรับรายได้จากต่างประเทศ และ THB (฿) สำหรับรายได้ในไทย',
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
