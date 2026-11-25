import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { parseModelJson } from '@/lib/ai/model-contracts'
import { isExtractionEnvelope, normalizeExtraction } from '@/lib/ai/transaction-extraction'

export const maxDuration = 60 // Allow longer processing for multiple images

interface ImageInput {
  data: string // base64 without data:image/xxx;base64, or with it
  mimeType?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const rawImages: (string | ImageInput)[] = body.images || []

    if (!Array.isArray(rawImages) || rawImages.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาอัปโหลดรูปภาพสลิปอย่างน้อย 1 ภาพ' },
        { status: 400 }
      )
    }

    if (rawImages.length > 10 || rawImages.some((img) => typeof img !== 'string' && (!img || typeof img.data !== 'string'))) {
      return NextResponse.json({ error: 'กรุณาส่งรูปที่ถูกต้องไม่เกิน 10 ภาพต่อรอบ' }, { status: 400 })
    }
    // Prepare image parts for Gemini
    const imageParts = rawImages.map((img) => {
      let base64 = typeof img === 'string' ? img : img.data
      let mimeType = typeof img === 'object' && img.mimeType ? img.mimeType : 'image/jpeg'

      if (base64.startsWith('data:')) {
        const match = base64.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/)
        if (match) {
          mimeType = match[1]
          base64 = match[2]
        }
      }

      return {
        inlineData: {
          data: base64,
          mimeType,
        },
      }
    })
    if (imageParts.some(({ inlineData }) =>
      !/^image\/(jpeg|png|webp|heic|heif)$/.test(inlineData.mimeType) || !/^[\w+/]+={0,2}$/.test(inlineData.data)
    ) || imageParts.reduce((bytes, { inlineData }) => bytes + inlineData.data.length * 0.75, 0) > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'รูปภาพไม่รองรับหรือขนาดรวมเกิน 12 MB' }, { status: 400 })
    }

    // Fetch user's existing accounts to help AI match account names accurately
    const userAccounts = await prisma.investmentAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, accountName: true, currency: true, accountType: true },
    })

    const accountsListStr = userAccounts.length > 0
      ? userAccounts.map((a) => `- ${a.accountName} (${a.currency}, ${a.accountType})`).join('\n')
      : 'ผู้ใช้ยังไม่มีบัญชีที่บันทึกไว้ในระบบ (สามารถแนะนำชื่อบัญชีจากสลิปได้ เช่น Dime! USD, Dime! Save, InnovestX)'

    const systemPrompt = `คุณคือ AI ผู้เชี่ยวชาญด้านการเงินและการลงทุนที่วิเคราะห์ภาพถ่ายสลิปธุรกรรมการลงทุน (Investment Slips & Brokerage Screenshots) ของแอปพลิเคชันการเงินในไทย (เช่น Dime!, InnovestX, Streaming, Bitkub, Luno ฯลฯ)

หน้าที่ของคุณคือ:
1. วิเคราะห์รูปภาพทั้งหมด (${imageParts.length} ภาพ) ที่ส่งมาพร้อมกัน
2. สกัดข้อมูลธุรกรรมการซื้อขายหุ้น/คริปโต/กองทุน, การจ่ายเงินปันผล, ค่าธรรมเนียม, หรือยอดเงินสดคงเหลือ
3. จัดกลุ่มและรวมค่าธรรมเนียมทั้งหมดเข้าในฟิลด์ "fee" ให้ครบถ้วนตามหลักเกณฑ์การลงทุน:
   - หุ้นไทย (THB):
     * สลิปซื้อ: รวม ค่าคอมมิชชั่น + ค่าธรรมเนียมอื่นๆ (Trading fee, Clearing fee, Regulatory fee) + VAT 7% เข้าด้วยกันเป็น fee (ยอดรวมสุทธิ = มูลค่าซื้อ + fee)
     * สลิปขาย: รวม ค่าคอมมิชชั่น + ค่าธรรมเนียมอื่นๆ + VAT 7% เข้าด้วยกันเป็น fee (ยอดรวมสุทธิที่ได้รับ = มูลค่าขาย - fee)
   - หุ้นต่างประเทศ/สหรัฐฯ (USD เช่น Dime!, InnovestX):
     * สลิปซื้อ: รวม ค่าคอมมิชชั่น + VAT 7% เข้าด้วยกันเป็น fee (ยอดรวมสุทธิ = มูลค่าซื้อ + fee)
     * สลิปขาย: รวม ค่าคอมมิชชั่น + VAT 7% + ค่าธรรมเนียมรอจ่าย (ค่าธรรมเนียมตลาดหลักทรัพย์ / SEC Fee) + ค่าธรรมเนียมการขาย (TAF Fee) เข้าด้วยกันเป็น fee (ยอดรวมสุทธิที่ได้รับ = มูลค่าขาย - fee)
   - สลิปเงินปันผล (DIVIDEND): เงินปันผลก่อนหักภาษีเป็นมูลค่า, ภาษีหัก ณ ที่จ่าย (Withholding Tax) ใส่ใน taxWithheld
   - สลิปซื้อขายทองคำ (Dime! Gold 99.99%, Gold 99.99%, MTS, YLG หรือทองคำแท่งไทย 96.5%):
     * ทอง 99.99% อิง USD/oz (แอป Dime!): ticker: "XAU", assetName: "Dime! Gold 99.99% (USD/oz)", assetType: "gold", market: "US", currency: "USD", รักษาน้ำหนักเป็น oz ทศนิยมสูงสุด 6 ตำแหน่ง (หากระบุเป็นกรัมให้หารด้วย 31.1034768), fee: 0 (ถ้าไม่มีค่าธรรมเนียมแยก)
     * ทองแท่งไทย 96.5%: ticker: "GOLD965", assetName: "ทองคำแท่งไทย 96.5% (THB/บาททอง)", assetType: "gold", market: "TH", currency: "THB", quantity เป็นหน่วยบาททองคำ (1 สลึง = 0.25 บาททอง)
4. การแปลงวันที่ พ.ศ. เป็น ค.ศ. อย่างเคร่งครัด:
   - ในสลิปภาษาไทยระบุปี พ.ศ. เช่น "69" หรือ "2569" หมายถึง ค.ศ. 2026 (ลบ 543)
   - "9 ก.ย. 69 - 22:29 น." -> "2026-09-09T22:29:00+07:00"
   - "14 ก.ย. 69 - 22:12:09 น." -> "2026-09-14T22:12:09+07:00"
   - "18 ก.ย. 69 - 07:11 น." -> "2026-09-18T07:11:00+07:00"
   - เดือนภาษาไทย: ม.ค.=01, ก.พ.=02, มี.ค.=03, เม.ย.=04, พ.ค.=05, มิ.ย.=06, ก.ค.=07, ส.ค.=08, ก.ย.=09, ต.ค.=10, พ.ย.=11, ธ.ค.=12
5. หากเป็นภาพหน้าจอเงินสดและดอกเบี้ยสะสม (เช่น หน้า "เงินสด" ของ Dime!):
   - สกัดยอดเงินสดแต่ละสกุลเงินเข้าใน cashBalances เช่น:
     - Dime! Save: 51,085.70 THB, ดอกเบี้ยสะสม 109.81 THB, อีก 104 วัน
     - Dime! USD: 169.13 USD, ดอกเบี้ยสะสม 7.13 USD
     - Dime! FCD: 1,015.66 USD
6. ตอบกลับเฉพาะโครงสร้าง JSON ที่ถูกต้อง 100% ตาม Schema ด้านล่าง ห้ามมี markdown wrap อื่นนอกเหนือจาก JSON object`

    const userPrompt = `กรุณาวิเคราะห์ภาพสลิปทั้ง ${imageParts.length} ภาพนี้ และดึงข้อมูลธุรกรรมทั้งหมดออกมา

รายชื่อบัญชีที่มีอยู่ในระบบของผู้ใช้ปัจจุบัน:
${accountsListStr}

ให้ส่งผลลัพธ์เป็น JSON Object รูปแบบดังนี้เท่านั้น:
{
  "transactions": [
    {
      "id": "txn_1",
      "sourceImageIndex": 0,
      "txnType": "BUY" | "SELL" | "DIVIDEND" | "FEE" | "DEPOSIT" | "WITHDRAW",
      "ticker": "สัญลักษณ์ตัวพิมพ์ใหญ่ เช่น GOOGL, MU, AAPL, BTC",
      "assetName": "ชื่อเต็มสินทรัพย์ เช่น Alphabet Inc., Micron Technology Inc.",
      "market": "US" | "TH" | "CRYPTO",
      "assetType": "stock" | "fund" | "crypto" | "bond" | "gold",
      "quantity": ตัวเลขจำนวนหุ้น (เช่น 1 หรือ 0.3191112),
      "pricePerUnit": ราคาต่อหุ้นที่ได้จริง (เช่น 328.94 หรือ 1034.12),
      "fee": รวมค่าธรรมเนียมทั้งหมดที่เป็นบวก (เช่น 0.53),
      "taxWithheld": ภาษีหัก ณ ที่จ่ายถ้ามี (เช่น 0.06),
      "totalAmount": ยอดรวมสุทธิของคำสั่ง (กรณีซื้อ: (หุ้น x ราคา) + ค่าธรรมเนียม, กรณีขาย: (หุ้น x ราคา) - ค่าธรรมเนียม - ภาษี เช่น 329.47),
      "currency": "USD" หรือ "THB",
      "txnDate": "ISO String เช่น 2026-09-09T22:29:00+07:00",
      "matchedAccountId": null,
      "accountName": "ชื่อบัญชีที่พบในสลิป เช่น Dime! USD หรือ Dime! Save",
      "note": "สรุปสั้นๆ เช่น ซื้อ GOOGL ผ่าน Dime! สำเร็จ",
      "confidence": 0.95
    }
  ],
  "cashBalances": [
    {
      "matchedAccountId": null,
      "accountName": "เช่น Dime! Save, Dime! USD, Dime! FCD",
      "accountType": "bank" | "brokerage" | "cash",
      "currency": "THB" หรือ "USD",
      "cashAmount": ตัวเลขยอดเงินสดคงเหลือ (เช่น 51085.70),
      "accruedInterest": ดอกเบี้ยสะสมถ้ามี (เช่น 109.81),
      "interestDays": วันที่เหลือจนกว่าจะจ่ายดอกเบี้ย (เช่น 104) หรือ null,
      "balanceDate": "ISO String วันที่เวลาข้อมูล เช่น 2026-09-18T07:11:00+07:00"
    }
  ],
  "summary": "ข้อความสรุปผลการวิเคราะห์สั้นๆ เป็นภาษาไทย"
}`

    const { text, modelUsed } = await callGemini({
      userId: session.user.id,
      prompt: userPrompt,
      images: imageParts,
      logType: 'quick_add_multimodal',
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      validateJson: isExtractionEnvelope,
      timeoutMs: 38_000,
    })

    const data = normalizeExtraction(parseModelJson(text), userAccounts, imageParts.length)
    return NextResponse.json({ success: true, modelUsed, data })
  } catch (error: any) {
    console.error('[extract-slips POST]', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการวิเคราะห์สลิป' },
      { status: 500 }
    )
  }
}
