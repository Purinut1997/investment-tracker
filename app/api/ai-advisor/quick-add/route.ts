import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callGemini } from '@/lib/ai/gemini-client'

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

    const aiPrompt = `
ข้อความบันทึกธุรกรรมการลงทุนของผู้ใช้:
"${prompt}"

กรุณาแกะข้อมูลจากข้อความนี้ให้อยู่ในรูปแบบ JSON อย่างเคร่งครัด (ตอบเฉพาะ JSON object เท่านั้น ไม่ต้องมี markdown หรือคำอธิบายเพิ่มเติม):
{
  "txnType": "BUY" | "SELL" | "DIVIDEND" | "DEPOSIT" | "WITHDRAW" | "FEE",
  "ticker": "string (สัญลักษณ์หุ้นหรือคริปโตตัวพิมพ์ใหญ่ เช่น AAPL, PTT, BTC)",
  "quantity": number,
  "pricePerUnit": number,
  "fee": number (ถ้ามี ถ้าไม่มีให้ใส่ 0),
  "note": "string (ข้อความบันทึกย่อ)",
  "confidence": number (0.0 ถึง 1.0)
}
`

    const { text } = await callGemini({
      userId: session.user.id,
      prompt: aiPrompt,
      logType: 'quick_add_multimodal',
      systemInstruction:
        'คุณเป็น AI Parser ที่ทำหน้าที่แปลงข้อความบันทึกการลงทุนเป็น JSON ตาม Schema ที่กำหนดอย่างแม่นยำ ตอบเฉพาะ valid JSON เท่านั้น',
    })

    // Extract JSON block
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanText)

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('[ai-advisor quick-add]', error)
    return NextResponse.json({ error: error.message || 'AI parsing failed' }, { status: 500 })
  }
}
