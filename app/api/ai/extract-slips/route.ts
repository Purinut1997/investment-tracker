import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'

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

    // Fetch user's existing accounts to help AI match account names accurately
    const userAccounts = await prisma.investmentAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, accountName: true, currency: true, accountType: true },
    })

    const accountsListStr = userAccounts.length > 0
      ? userAccounts.map((a) => `- ${a.accountName} (${a.currency}, ${a.accountType}) [ID: ${a.id}]`).join('\n')
      : 'ผู้ใช้ยังไม่มีบัญชีที่บันทึกไว้ในระบบ (สามารถแนะนำชื่อบัญชีจากสลิปได้ เช่น Dime! USD, Dime! Save, InnovestX)'

    const systemPrompt = `คุณคือ AI ผู้เชี่ยวชาญด้านการเงินและการลงทุนที่วิเคราะห์ภาพถ่ายสลิปธุรกรรมการลงทุน (Investment Slips & Brokerage Screenshots) ของแอปพลิเคชันการเงินในไทย (เช่น Dime!, InnovestX, Streaming, Bitkub, Luno ฯลฯ)

หน้าที่ของคุณคือ:
1. วิเคราะห์รูปภาพทั้งหมด (${imageParts.length} ภาพ) ที่ส่งมาพร้อมกัน
2. สกัดข้อมูลธุรกรรมการซื้อขายหุ้น/คริปโต/กองทุน, การจ่ายเงินปันผล, ค่าธรรมเนียม, หรือยอดเงินสดคงเหลือ
3. จัดกลุ่มและรวมค่าธรรมเนียมที่เกี่ยวข้อง เช่น:
   - สลิปซื้อ: ค่าคอมมิชชัน + VAT 7% รวมเป็นค่า fee เดียวกัน
   - สลิปขาย: รวมค่าคอม + VAT + ค่าธรรมเนียมตลาดฯ (SEC fee) + TAF fee เข้าเป็น fee ของคำสั่งขาย หรือแยกเป็นรายการ FEE หากปรากฏเป็นรายการตัดเงินเดี่ยวใน statement
   - สลิปปันผล: ปันผลเป็นรายการ DIVIDEND, ภาษีหัก ณ ที่จ่าย (Withholding Tax) ใส่ใน taxWithheld
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
      "matchedAccountId": "ID ของบัญชีผู้ใช้ถ้าตรง หรือ null",
      "accountName": "ชื่อบัญชีที่พบในสลิป เช่น Dime! USD หรือ Dime! Save",
      "note": "สรุปสั้นๆ เช่น ซื้อ GOOGL ผ่าน Dime! สำเร็จ",
      "confidence": 0.95
    }
  ],
  "cashBalances": [
    {
      "matchedAccountId": "ID ของบัญชีถ้าตรง หรือ null",
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
    })

    // Clean JSON response
    const cleanText = text
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim()

    let parsedResult: any
    try {
      parsedResult = JSON.parse(cleanText)
    } catch (parseErr) {
      console.error('[extract-slips] JSON Parse error. Raw output:', cleanText)
      throw new Error('AI ส่งผลลัพธ์ที่ไม่ใช่ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
    }

    // Enhance matching with user accounts if not matched
    if (Array.isArray(parsedResult.transactions)) {
      parsedResult.transactions.forEach((txn: any, idx: number) => {
        txn.id = txn.id || `txn_${idx + 1}`
        if (!txn.matchedAccountId && txn.accountName) {
          const match = userAccounts.find(
            (a) =>
              a.accountName.toLowerCase() === txn.accountName.toLowerCase() ||
              a.accountName.toLowerCase().includes(txn.accountName.toLowerCase()) ||
              txn.accountName.toLowerCase().includes(a.accountName.toLowerCase())
          )
          if (match) {
            txn.matchedAccountId = match.id
            txn.accountName = match.accountName
          }
        }

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

    if (Array.isArray(parsedResult.cashBalances)) {
      parsedResult.cashBalances.forEach((cb: any) => {
        if (!cb.matchedAccountId && cb.accountName) {
          const match = userAccounts.find(
            (a) =>
              a.accountName.toLowerCase() === cb.accountName.toLowerCase() ||
              a.accountName.toLowerCase().includes(cb.accountName.toLowerCase()) ||
              cb.accountName.toLowerCase().includes(a.accountName.toLowerCase())
          )
          if (match) {
            cb.matchedAccountId = match.id
            cb.accountName = match.accountName
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      modelUsed,
      data: parsedResult,
    })
  } catch (error: any) {
    console.error('[extract-slips POST]', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการวิเคราะห์สลิป' },
      { status: 500 }
    )
  }
}
