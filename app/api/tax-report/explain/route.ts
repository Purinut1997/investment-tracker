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
      year,
      usdThbRate,
      dividends,
      thaiSetCapitalGains,
      foreignAndCryptoGains,
      // Optional: user declares whether they repatriated funds to Thailand
      repatriated = false,
    } = await req.json()

    const fx = usdThbRate ?? 35.5
    const taxYear2024 = 2024  // rule change year (ป.161/2566)

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

    // Determine if foreign capital gains are taxable in Thailand based on rules
    // Rule: เงินลงทุนก่อนปี 2567 → ต้องเสียภาษีไทยเฉพาะเมื่อนำเงินกลับไทย
    //       เงินลงทุนตั้งแต่ปี 2567 → ต้องเสียภาษีไทยไม่ว่าจะนำกลับหรือไม่
    const isNewRuleYear = year >= taxYear2024
    const foreignGainTaxableInThailand = isNewRuleYear || repatriated

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านภาษีการลงทุนสำหรับบุคคลธรรมดาในประเทศไทย ที่มีความเข้าใจลึกซึ้งในกฎภาษีการลงทุนต่างประเทศ
กรุณาวิเคราะห์และอธิบายสรุปรายงานภาษีปี ${year} ของผู้ลงทุนเป็นภาษาไทยที่เข้าใจง่าย

=== กฎภาษีสำคัญที่ต้องใช้ในการวิเคราะห์ ===

ก. ภาษีสหรัฐฯ สำหรับนักลงทุนต่างชาติที่ไม่ได้อาศัยอยู่ในสหรัฐ:
   - เงินปันผล: ถูกหัก ณ ที่จ่าย 15% (เมื่อยื่น W-8BEN) หรือ 30% (ถ้าไม่ยื่น)
   - กำไรจากการขายหุ้น (Capital Gains): ไม่ต้องเสียภาษีในสหรัฐฯ เลย

ข. ภาษีไทย (มาตรา 41 วรรค 2 + คำสั่ง ป.161/2566):
   - เงินลงทุนที่นำออกก่อนปี 2567 และนำกลับคนละปี: ไม่ต้องเสียภาษีไทย
   - เงินลงทุนที่นำออกก่อนปี 2567 และ "ไม่นำกลับไทย": ไม่ต้องเสียภาษีไทย
   - เงินลงทุนที่นำออกตั้งแต่ปี 2567 เป็นต้นไป: ต้องเสียภาษีไทยไม่ว่าจะนำกลับหรือไม่

ค. กลยุทธ์ประหยัดภาษี (กรณีนำเงินกลับไทย):
   - นำกลับเฉพาะส่วน "ทุน" (≤ จำนวนที่นำออกไปในปีนั้น) → ไม่ต้องเสียภาษี
   - ภาษีหัก ณ ที่จ่ายในสหรัฐ (15%) สามารถนำมาเป็น "เครดิตภาษี" หักออกจากภาษีไทยได้

=== ข้อมูลภาษีปี ${year} (อัตราแลกเปลี่ยน 1 USD = ${fx.toFixed(2)} THB) ===

1. เงินปันผล (Dividends):
${hasDivUSD
  ? `   - หุ้นต่างประเทศ (USD): ยอดรวม $${divGrossUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ภาษีหัก W-8BEN 15% = -$${divTaxUSD.toFixed(2)} / สุทธิ $${divNetUSD.toFixed(2)}
   - ภาษีที่หักไปแล้วในสหรัฐฯ สามารถนำมาเป็นเครดิตภาษีไทยได้`
  : '   - ไม่มีเงินปันผลจากหุ้นต่างประเทศ'}
   - เทียบเท่าเงินบาทรวม: ฿${divGrossTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })} (หัก ฿${divTaxTHB.toFixed(2)}) = สุทธิ ฿${divNetTHB.toFixed(2)}

2. กำไรจากหุ้นไทย (SET Capital Gains):
   - กำไรส่วนต่างรวม: ฿${thaiGain.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB
   - มูลค่าซื้อขายรวม: ฿${thaiVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })} THB
   - สถานะ: ยกเว้นภาษีเงินได้บุคคลธรรมดาไทย (ตาม พ.ร.บ. ตลาดหลักทรัพย์)

3. กำไรจากหุ้นต่างประเทศ (Capital Gains):
${hasForeignGain
  ? `   - กำไร FIFO: $${foreignGainUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (≈ ฿${foreignGainTHB.toFixed(2)} THB)
   - ยอดขายรวม: $${foreignProceedsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD / ต้นทุน FIFO: $${foreignCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
   - ภาษีสหรัฐฯ: ไม่ต้องเสีย (นักลงทุนต่างชาติไม่มีภาระ Capital Gains ในสหรัฐ)
   - ภาษีไทย: ${foreignGainTaxableInThailand
     ? `⚠️ ปี ${year} ${isNewRuleYear ? '(ตั้งแต่ 2567 เป็นต้นไป) ต้องนำกำไรมายื่นภาษีไทยด้วย ไม่ว่าจะนำเงินกลับหรือไม่' : 'มีการนำเงินกลับไทย — ต้องนำมายื่นภาษีเงินได้บุคคลธรรมดา อัตราก้าวหน้าสูงสุด 35%'}`
     : `✅ ยังไม่มีภาระภาษีไทย (ปี ${year} ลงทุนก่อน 2567 และยังไม่ได้นำเงินกลับไทย)`}`
  : '   - ไม่มีรายการขายหุ้นต่างประเทศในปีนี้'}

=== กรุณาวิเคราะห์และแนะนำ 3 ประเด็นต่อไปนี้ ===
1. สรุปภาระภาษีจริงของปีนี้ — หมวดไหนที่ "ต้องเสีย" หมวดไหนที่ "ไม่ต้องเสีย" และเพราะเหตุใด
2. คำแนะนำเรื่องเงินปันผล — วิธีเลือกระหว่าง Final Tax 10% กับการขอเครดิตภาษีจาก W-8BEN 15%
3. กลยุทธ์ภาษีที่แนะนำ — เช่น วิธีนำเงินกลับไทยโดยประหยัดภาษีสูงสุด (นำกลับเฉพาะส่วนทุน, ใช้เครดิตภาษี W-8BEN)
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'tax_explain',
      systemInstruction:
        'คุณเป็นที่ปรึกษาด้านภาษีการลงทุนต่างประเทศสำหรับนักลงทุนไทย ให้คำอธิบายที่ถูกต้องตามกฎหมายภาษีไทยล่าสุด (ป.161/2566) ใช้สกุลเงินที่ถูกต้องเสมอ: $ สำหรับรายได้ USD และ ฿ สำหรับ THB อย่าบอกว่ากำไรหุ้น US ต้องเสียภาษีไทยหากยังไม่นำเงินกลับและเป็นการลงทุนก่อนปี 2567',
    })

    const disclaimer =
      '⚠️ ข้อสงวนสิทธิ์: ข้อมูลนี้จัดทำขึ้นเพื่อเป็นแนวทางตามกฎภาษี ป.161/2566 เท่านั้น ไม่ถือเป็นแบบยื่นภาษีจริง กรุณาตรวจสอบกับเอกสาร ใบ 50 ทวิ จากโบรกเกอร์ และปรึกษาผู้เชี่ยวชาญด้านภาษีก่อนยื่น ภ.ง.ด.'

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
