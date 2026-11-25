import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { parseModelJson } from '@/lib/ai/model-contracts'
import { isExtractionEnvelope, normalizeExtraction } from '@/lib/ai/transaction-extraction'

export const maxDuration = 60 // Allow longer processing for extensive reports

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { prompt } = await req.json()
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20_000) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }

    // Fetch user's existing accounts to help AI match account names accurately
    const userAccounts = await prisma.investmentAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, accountName: true, currency: true, accountType: true },
    })

    const accountsListStr =
      userAccounts.length > 0
        ? userAccounts
            .map((a) => `- ชื่อบัญชี: "${a.accountName}" (สกุลเงิน: ${a.currency}, ประเภท: ${a.accountType})`)
            .join('\n')
        : 'ผู้ใช้ยังไม่มีบัญชีในระบบ (แนะนำชื่อบัญชีมาตรฐาน เช่น Dime! USD, Dime! Save, InnovestX)'

    const systemPrompt = `คุณคือ AI ผู้เชี่ยวชาญด้านการเงินและการลงทุนที่ทำหน้าที่วิเคราะห์ข้อความ, รายงานสรุปการซื้อขาย หรือ Statement ทางการเงิน
หน้าที่ของคุณคือสกัดข้อมูลธุรกรรมการลงทุนทั้งหมดที่พบในข้อความ ไม่ว่าจะระบุหุ้นตัวเดียว หรือหลายหุ้น หลายรายการพร้อมกัน

กฎการประมวลผลอย่างเคร่งครัด:
1. สกัดข้อมูลธุรกรรม "ทั้งหมด" ที่พบในข้อความลงใน Array "transactions" ไม่จำกัดจำนวนรายการ
2. หากข้อความมีหลายหุ้น (เช่น ซื้อ NVDA, ขาย MU, รับปันผล GOOGL, ซื้อ AAPL) ให้แยกเป็นแต่ละรายการธุรกรรมอย่างชัดเจน
3. จัดหมวดหมู่ txnType:
   - "BUY": ซื้อหุ้น, เข้าซื้อ, DCA, เติมพอร์ต
   - "SELL": ขายหุ้น, ขายทำกำไร, ตัดขาดทุน
   - "DIVIDEND": ได้รับเงินปันผล (Dividend)
   - "FEE": ค่าธรรมเนียมเดี่ยว (เช่น ค่าธรรมเนียมโอน/จัดการ)
   - "DEPOSIT": ฝากเงินเข้าบัญชี
   - "WITHDRAW": ถอนเงินออกจากบัญชี
4. การแปลงวันที่และปี พ.ศ. เป็น ค.ศ. (ISO 8601 String):
   - ในภาษาไทย หากระบุปี พ.ศ. เช่น "2568" = ค.ศ. 2025, "2569" = ค.ศ. 2026, "2567" = ค.ศ. 2024 (ลบด้วย 543)
   - ตัวย่อปี พ.ศ. เช่น "68" = 2025, "69" = 2026
   - เดือนไทย: ม.ค.=01, ก.พ.=02, มี.ค.=03, เม.ย.=04, พ.ค.=05, มิ.ย.=06, ก.ค.=07, ส.ค.=08, ก.ย.=09, ต.ค.=10, พ.ย.=11, ธ.ค.=12
   - หากระบุเพียงวันที่ ให้คืน YYYY-MM-DD หากไม่ระบุวันที่ ให้คืน null
5. สินทรัพย์และตลาด:
   - Ticker: สัญลักษณ์ย่อตัวพิมพ์ใหญ่ เช่น AAPL, NVDA, GOOGL, PTT, BTC
   - Market: "US" สำหรับหุ้นสหรัฐ, "TH" สำหรับหุ้นไทย, "CRYPTO" สำหรับคริปโต
   - Currency: "USD" สำหรับหุ้น US, "THB" สำหรับหุ้นไทย
   - ทองคำ Dime! (ทอง 99.99% / ซื้อทองใน Dime / XAU / ออนซ์):
     * ให้ใส่ ticker: "XAU", assetName: "Dime! Gold 99.99% (USD/oz)", assetType: "gold", market: "US", currency: "USD", fee: 0 (ถ้าไม่ระบุ), quantity ในหน่วย "oz" (หากผู้ใช้ระบุเป็นกรัมให้แปลงเป็น oz = กรัม / 31.1034768)
   - ทองคำแท่งไทย 96.5% (บาททองคำ / Gold NOW / ฮั่วเซ่งเฮง):
     * ให้ใส่ ticker: "GOLD965", assetName: "ทองคำแท่งไทย 96.5% (THB/บาททอง)", assetType: "gold", market: "TH", currency: "THB", fee: 0 (ถ้าไม่ระบุ), quantity ในหน่วย "บาททองคำ"
6. ยอดเงินและค่าธรรมเนียม:
   - กรณีระบุยอดเงินรวม (เช่น 'ซื้อ MU 690.00 USD' หรือ 'ขาย EOSE 94.66 USD') แต่ไม่ได้ระบุจำนวนหุ้นหรือราคาต่อหุ้น:
     * ให้ใส่ totalAmount เท่ากับยอดเงินนั้น (เช่น 690.00 หรือ 94.66)
     * ให้คืน quantity และ pricePerUnit เป็น null ถ้าไม่มีหลักฐานของทั้งสองค่า
   - กรณีระบุจำนวนหุ้นแต่ไม่ระบุยอดเงินรวม (เช่น 'ขาย NVDA 0.9432 หุ้น'):
     * ให้ใส่ quantity: 0.9432 และ pricePerUnit: null หากไม่พบราคา
   - quantity: จำนวนหุ้นเมื่อมีข้อมูลเท่านั้น
   - pricePerUnit: ราคาต่อหุ้น
   - fee: ค่าคอมมิชชันและค่าธรรมเนียมรวมทั้งหมด
     * หุ้นไทย (THB): รวม ค่าคอมมิชชั่น + ค่าธรรมเนียมอื่นๆ (Trading/Clearing/Regulatory fee) + VAT 7% เข้าด้วยกัน
     * หุ้นสหรัฐฯ (USD) ตอนซื้อ: รวม ค่าคอมมิชชั่น + VAT 7%
     * หุ้นสหรัฐฯ (USD) ตอนขาย: รวม ค่าคอมมิชชั่น + VAT 7% + ค่าธรรมเนียมรอจ่าย (SEC Fee) + ค่าธรรมเนียมการขาย (TAF Fee)
   - taxWithheld: ภาษีหัก ณ ที่จ่าย (สำหรับเงินปันผล ถ้าไม่มีให้เป็น 0)
   - totalAmount: มูลค่ารวมสุทธิของธุรกรรม
     * กรณีซื้อ (BUY): (quantity * pricePerUnit) + fee
     * กรณีขาย (SELL): (quantity * pricePerUnit) - fee - taxWithheld
     * กรณีเงินปันผล (DIVIDEND): (quantity * pricePerUnit) - fee - taxWithheld
     * กรณีค่าธรรมเนียม (FEE): fee
7. การจับคู่บัญชี (matchedAccountId):
   - คืนเฉพาะชื่อบัญชีจริงที่พบในข้อมูล ถ้าไม่ระบุให้คืน null
8. ตอบกลับเป็น JSON Object เท่านั้น ห้ามมีคำอธิบายหรือ Markdown อื่นใด`

    const userPrompt = `ข้อความหรือรายงานธุรกรรมการลงทุนของผู้ใช้:
"""
${prompt}
"""

รายชื่อบัญชีของผู้ใช้ที่มีในระบบ:
${accountsListStr}

กรุณาวิเคราะห์และคืนค่าเป็น JSON Object ตาม Schema นี้เท่านั้น:
{
  "summary": "สรุปสั้นๆ เช่น พบ 3 รายการธุรกรรม: ซื้อ NVDA, ขาย MU, รับปันผล GOOGL",
  "transactions": [
    {
      "id": "txn_1",
      "txnType": "BUY" | "SELL" | "DIVIDEND" | "FEE" | "DEPOSIT" | "WITHDRAW",
      "ticker": "NVDA",
      "assetName": "NVIDIA Corporation",
      "market": "US" | "TH" | "CRYPTO",
      "assetType": "stock" | "fund" | "crypto" | "bond" | "gold",
      "quantity": 10,
      "pricePerUnit": 120,
      "fee": 2,
      "taxWithheld": 0,
      "totalAmount": 1202,
      "currency": "USD",
      "txnDate": "2026-09-18T10:00:00+07:00",
      "matchedAccountId": null,
      "accountName": "Dime! USD",
      "note": "string (ข้อความเพิ่มเติมหรือหมายเหตุ)",
      "confidence": 0.95
    }
  ],
  "cashBalances": [
    {
      "matchedAccountId": null,
      "accountName": "Dime! Save",
      "currency": "THB",
      "cashAmount": 0,
      "accruedInterest": 0
    }
  ]
}`

    const { text } = await callGemini({
      userId: session.user.id,
      prompt: userPrompt,
      logType: 'quick_add_multimodal',
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      validateJson: isExtractionEnvelope,
      thinkingBudget: 0,
    })

    const data = normalizeExtraction(parseModelJson(text), userAccounts)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[ai-advisor quick-add]', error)
    return NextResponse.json({ error: error.message || 'AI parsing failed' }, { status: 500 })
  }
}
