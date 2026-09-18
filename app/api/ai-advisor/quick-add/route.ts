import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 60 // Allow longer processing for extensive reports

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
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
            .map((a) => `- ชื่อบัญชี: "${a.accountName}" (สกุลเงิน: ${a.currency}, ประเภท: ${a.accountType}) [ID: ${a.id}]`)
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
   - หากไม่ระบุเวลา ให้ใช้วันที่ที่ระบุพร้อมเวลา 10:00:00+07:00 หากไม่ระบุวันที่ ให้ใช้วันที่ปัจจุบัน
5. สินทรัพย์และตลาด:
   - Ticker: สัญลักษณ์ย่อตัวพิมพ์ใหญ่ เช่น AAPL, NVDA, GOOGL, PTT, BTC
   - Market: "US" สำหรับหุ้นสหรัฐ, "TH" สำหรับหุ้นไทย, "CRYPTO" สำหรับคริปโต
   - Currency: "USD" สำหรับหุ้น US, "THB" สำหรับหุ้นไทย
6. ยอดเงินและค่าธรรมเนียม:
   - กรณีระบุยอดเงินรวม (เช่น 'ซื้อ MU 690.00 USD' หรือ 'ขาย EOSE 94.66 USD') แต่ไม่ได้ระบุจำนวนหุ้นหรือราคาต่อหุ้น:
     * ให้ใส่ totalAmount เท่ากับยอดเงินนั้น (เช่น 690.00 หรือ 94.66)
     * ห้ามใส่ quantity เป็น 0 เด็ดขาด! หากไม่ทราบราคาต่อหน่วย:
       - ซื้อ: ให้ใส่ quantity: 1 และ pricePerUnit: (totalAmount - fee)
       - ขาย: ให้ใส่ quantity: 1 และ pricePerUnit: (totalAmount + fee)
   - กรณีระบุจำนวนหุ้นแต่ไม่ระบุยอดเงินรวม (เช่น 'ขาย NVDA 0.9432 หุ้น'):
     * ให้ใส่ quantity: 0.9432 และหากไม่ทราบราคาต่อหน่วยให้ประมาณการหรือใส่ราคาตามตลาด
   - quantity: จำนวนหุ้น (ต้องมากกว่า 0 เสมอ เช่น 10, 0.9432 หรือ 1)
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
   - เทียบเคียงกับรายชื่อบัญชีของผู้ใช้ด้านล่าง หากระบุหรือตรงกับบัญชีใด ให้ใส่ ID ของบัญชีนั้น
   - หากไม่ระบุบัญชี แต่เป็นหุ้น US ให้พิจารณาบัญชีสกุลเงิน USD (เช่น Dime! USD)
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
      "matchedAccountId": "string (ไอดีบัญชีที่ตรงกัน)",
      "accountName": "Dime! USD",
      "note": "string (ข้อความเพิ่มเติมหรือหมายเหตุ)",
      "confidence": 0.95
    }
  ],
  "cashBalances": [
    {
      "matchedAccountId": "string",
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
      thinkingBudget: 0,
    })

    // Extract JSON block safely
    let parsed: any
    const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim()
    try {
      parsed = JSON.parse(cleanText)
    } catch {
      const firstBrace = text.indexOf('{')
      const lastBrace = text.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1))
      } else {
        const firstBracket = text.indexOf('[')
        const lastBracket = text.lastIndexOf(']')
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          parsed = { transactions: JSON.parse(text.slice(firstBracket, lastBracket + 1)) }
        } else {
          throw new Error('AI ไม่สามารถแปลงข้อความเป็นรูปแบบ JSON ได้ กรุณาลองใหม่อีกครั้ง')
        }
      }
    }

    if (Array.isArray(parsed)) {
      parsed = { transactions: parsed }
    }

    // Ensure backwards compatibility if model returns single transaction object
    if (!parsed.transactions && parsed.ticker) {
      parsed.transactions = [
        {
          id: 'txn_1',
          txnType: parsed.txnType || 'BUY',
          ticker: parsed.ticker,
          assetName: parsed.assetName || parsed.ticker,
          market: parsed.market || 'US',
          assetType: parsed.assetType || 'stock',
          quantity: Number(parsed.quantity || 0),
          pricePerUnit: Number(parsed.pricePerUnit || 0),
          fee: Number(parsed.fee || 0),
          taxWithheld: Number(parsed.taxWithheld || 0),
          totalAmount: Number(
            parsed.totalAmount ||
              (parsed.txnType === 'SELL' || parsed.txnType === 'DIVIDEND'
                ? Math.max(
                    0,
                    Number(parsed.quantity || 0) * Number(parsed.pricePerUnit || 0) -
                      Number(parsed.fee || 0) -
                      Number(parsed.taxWithheld || 0)
                  )
                : parsed.txnType === 'FEE'
                ? Number(parsed.fee || 0)
                : Number(parsed.quantity || 0) * Number(parsed.pricePerUnit || 0) + Number(parsed.fee || 0))
          ),
          currency: parsed.currency || 'USD',
          txnDate: parsed.txnDate || new Date().toISOString(),
          matchedAccountId: userAccounts[0]?.id || '',
          accountName: userAccounts[0]?.accountName || 'Dime! USD',
          note: parsed.note || '',
          confidence: parsed.confidence || 0.9,
        },
      ]
      parsed.summary = `พบ 1 รายการ: ${parsed.txnType || 'ซื้อ'} ${parsed.ticker}`
    }

    if (!Array.isArray(parsed.transactions)) {
      parsed.transactions = []
    } else {
      parsed.transactions.forEach((txn: any) => {
        const q = Number(txn.quantity || 0)
        const p = Number(txn.pricePerUnit || 0)
        const f = Number(txn.fee || 0)
        const t = Number(txn.taxWithheld || 0)
        if (txn.txnType === 'SELL' && q > 0 && p > 0 && f > 0) {
          const gross = q * p
          if (Number(txn.totalAmount) > gross || Number(txn.totalAmount) === gross + f) {
            txn.totalAmount = Math.max(0, gross - f - t)
          }
        }
      })
    }

    if (!Array.isArray(parsed.cashBalances)) {
      parsed.cashBalances = []
    }

    if (!parsed.summary) {
      parsed.summary = `พบ ${parsed.transactions.length} รายการธุรกรรม`
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('[ai-advisor quick-add]', error)
    return NextResponse.json({ error: error.message || 'AI parsing failed' }, { status: 500 })
  }
}
