import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { FOREIGN_INCOME_TAX_RULE, FOREIGN_INCOME_TAX_SOURCE, foreignIncomeAssessment, taxReportContextTag } from '@/lib/analytics/foreign-income-tax'
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

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year') || new Date().getFullYear())
  const repatriated = searchParams.get('repatriated') === 'true'
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    return NextResponse.json({ error: 'Invalid tax year' }, { status: 400 })
  }

  try {
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId: session.user.id,
        logType: 'tax_explain',
        prompt: { contains: taxReportContextTag(year, repatriated) },
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    return NextResponse.json({
      explanation: latestLog?.response ?? null,
      modelUsed: latestLog?.modelUsed ?? null,
      updatedAt: latestLog?.createdAt ? latestLog.createdAt.toISOString() : null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tax explanation' }, { status: 500 })
  }
}

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
      repatriated = false,
    } = await req.json()
    if (!Number.isInteger(year) || year < 1900 || year > 9999 || typeof repatriated !== 'boolean') {
      return NextResponse.json({ error: 'Invalid tax context' }, { status: 400 })
    }

    let fx = Number(usdThbRate) || 0
    if (fx <= 0) {
      try {
        const liveFx = await getExchangeRate('USD', 'THB')
        fx = liveFx && liveFx > 0 ? liveFx : 0
      } catch {
        fx = 0
      }
    }

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

    const assessment = foreignIncomeAssessment(repatriated)
    const unifiedCtx = await getUnifiedPortfolioContext(session.user.id).catch(() => null)

    const prompt = `
[ปีภาษี: ${year}]
${taxReportContextTag(year, repatriated)}
คุณเป็นผู้เชี่ยวชาญด้านภาษีการลงทุนสำหรับบุคคลธรรมดาในประเทศไทย ที่มีความเข้าใจลึกซึ้งในกฎภาษีการลงทุนต่างประเทศ
กรุณาวิเคราะห์และอธิบายสรุปรายงานภาษีปี ${year} ของผู้ลงทุนเป็นภาษาไทยที่เข้าใจง่าย

=== กฎภาษีสำคัญที่ต้องใช้ในการวิเคราะห์ ===

ก. ภาษีต่างประเทศ:
   - ใช้ยอดภาษีที่บันทึกจริง ห้ามสมมติว่าทุกธุรกรรมใช้อัตราเดียวกัน
   - การประเมินภาษีและเครดิตภาษีขึ้นกับแหล่งเงินได้ ประเภทสินทรัพย์ สถานะผู้ลงทุน และสิทธิตามอนุสัญญาภาษีซ้อน

ข. ภาษีไทย (มาตรา 41 วรรค 2 + คำสั่ง ป.161/2566 และ ป.162/2566):
   - ${FOREIGN_INCOME_TAX_RULE}
   - อ้างอิงกรมสรรพากร: ${FOREIGN_INCOME_TAX_SOURCE}
   - ต้องแยกเงินต้นออกจากเงินได้ด้วยเอกสาร ห้ามถือว่าเงินที่นำเข้าทั้งหมดเป็นกำไรหรือเงินต้น

ค. สถานะตามข้อมูลที่ผู้ใช้ระบุ: ${assessment.label}
   - ${assessment.detail}
   - ระบบไม่มีข้อมูลวันอยู่ไทย ยอดเงินได้ที่นำเข้าจริง หรือเอกสารเครดิตภาษี ห้ามสรุปยอดภาษีหรือหน้าที่ต้องยื่นเด็ดขาดจากสถานะนี้

=== ข้อมูลปี ${year} (${fx > 0 ? `อัตราอ้างอิง 1 USD = ${fx.toFixed(2)} THB ไม่ใช่อัตรา ณ วันนำเข้า` : 'ไม่พบอัตราแลกเปลี่ยนอ้างอิง'}) ===

${unifiedCtx ? formatUnifiedContextPrompt(unifiedCtx, { excludeSurface: 'tax', compact: true }) : ''}

${buildUnifiedDecisionRules('tax')}

1. เงินปันผล (Dividends):
${hasDivUSD
  ? `   - หุ้นต่างประเทศ (USD): ยอดรวม $${divGrossUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ภาษีหักตามบันทึก = -$${divTaxUSD.toFixed(2)} / สุทธิ $${divNetUSD.toFixed(2)}`
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
   - สถานะภาษีไทยเบื้องต้น: ${assessment.label} — ${assessment.detail}`
  : '   - ไม่พบกำไรหรือขาดทุนสุทธิในยอดสรุปที่ส่งมา'}

=== กรุณาวิเคราะห์และแนะนำ 3 ประเด็นต่อไปนี้ ===
1. **ภาพรวมภาษี**: แยกยอดจากระบบ เงื่อนไขทางภาษี และข้อมูลที่ยังขาด
2. **เงินปันผล**: อธิบายภาษีที่หักตามบันทึกและเอกสารที่ใช้ตรวจสิทธิเครดิตภาษี
3. **เตรียมก่อนยื่น**: แยกปีที่เกิดเงินได้ ปีที่นำเข้า หลักฐานอัตราแลกเปลี่ยน และเอกสารที่ต้องตรวจ

=== รูปแบบคำตอบ (สำคัญ) ===
- ตอบเป็น Markdown ภาษาไทยที่อ่านง่ายเท่านั้น และเริ่มด้วยหัวข้อ ## ภาพรวมภาษีปี ${year}
- ใช้หัวข้อ ## สำหรับแต่ละหมวดหลัก และ ### สำหรับหัวข้อย่อย ไม่ต้องใช้เส้นคั่น ---
- แต่ละย่อหน้าไม่เกิน 2 ประโยค และใช้ bullet list เมื่อมีรายการมากกว่า 1 ข้อ
- เน้นเฉพาะสถานะภาษี จำนวนเงิน อัตราภาษี และสิ่งที่ต้องทำด้วย **ตัวหนา**; อย่าใส่ตัวหนาทั้งย่อหน้า
- ปิดท้ายด้วยหัวข้อ ## สิ่งที่ควรทำต่อ โดยระบุเป็นลำดับ 1. 2. 3. ที่ทำตามได้จริง พร้อมเชื่อมโยงกับหุ้นที่อาจพิจารณาลดน้ำหนักในพอร์ต (หากมีใน /radar หรือ /tactical-advisor) และหน้าที่ควรเช็กต่อ
`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt,
      logType: 'tax_explain',
      systemInstruction:
        'คุณช่วยจัดเตรียมข้อมูลภาษีการลงทุน ตอบภาษาไทย อธิบายตามบริบทและแหล่งอ้างอิงที่แนบ ใช้ $ สำหรับ USD และ ฿ สำหรับ THB ระบุข้อมูลที่ขาด และห้ามเดาภาระภาษีเฉพาะบุคคล',
    })

    const disclaimer =
      '⚠️ ข้อสงวนสิทธิ์: ข้อมูลนี้จัดทำขึ้นเพื่อเป็นแนวทางตามกฎภาษี ป.161/2566 เท่านั้น ไม่ถือเป็นแบบยื่นภาษีจริง กรุณาตรวจสอบกับเอกสาร ใบ 50 ทวิ จากโบรกเกอร์ และปรึกษาผู้เชี่ยวชาญด้านภาษีก่อนยื่น ภ.ง.ด.'

    return NextResponse.json({
      explanation: text,
      disclaimer,
      modelUsed,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[tax-report explain POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to explain tax report' }, { status: 500 })
  }
}
