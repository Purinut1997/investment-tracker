import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callGemini } from '@/lib/ai/gemini-client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      symbol,
      name,
      currentPrice,
      currency = 'USD',
      changePercent,
      pe,
      dividendYield,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      analystTarget,
    } = body

    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
    }

    const prompt = `
โปรดวิเคราะห์หุ้น/สินทรัพย์นี้ในฐานะ Executive Investment Analyst:
- ชื่อสินทรัพย์: ${name || symbol} (${symbol})
- ราคาปัจจุบัน: ${currentPrice} ${currency} (การเปลี่ยนแปลงวันนี้: ${changePercent ? `${changePercent}%` : 'N/A'})
- อัตราส่วน P/E: ${pe ? `${pe}x` : 'N/A หรือ ETF/Crypto'}
- อัตราผลตอบแทนเงินปันผล (Dividend Yield): ${dividendYield ? `${dividendYield}%` : 'N/A'}
- กรอบราคา 52 สัปดาห์: ต่ำสุด ${fiftyTwoWeekLow || 'N/A'} - สูงสุด ${fiftyTwoWeekHigh || 'N/A'}
- ความเห็นนักวิเคราะห์: ${analystTarget?.recommendation || 'N/A'}, ราคาเป้าหมายเฉลี่ย: ${analystTarget?.targetMean ? `${analystTarget.targetMean} ${currency} (Upside: ${analystTarget.upsidePercent}%)` : 'N/A'}

กรุณาสรุปบทวิเคราะห์ภาษาไทย 3 ส่วน โดยใช้ฟอร์แมต Markdown ที่อ่านง่าย มีสัญลักษณ์ Bullet เด่นชัด กระชับและทรงคุณค่า:
1. 🚀 **จุดเด่นและปัจจัยขับเคลื่อนการเติบโต (Growth Drivers & Moat)**: สรุป 2-3 ข้อเจาะลึก
2. ⚠️ **ความเสี่ยงและจุดที่ต้องระวัง (Key Risks to Watch)**: สรุป 2-3 ข้อ
3. 💡 **มุมมองและกลยุทธ์การลงทุน (Investment Verdict)**: คำแนะนำสั้นๆ สำหรับการทยอยสะสม (DCA) หรือการเข้าซื้อ/ถือ/ลดน้ำหนัก
`

    const systemInstruction = `คุณเป็น Senior Multi-Asset Portfolio Manager และ Equity Research Analyst ที่ปรึกษาการลงทุนระดับพรีเมียม ตอบเป็นภาษาไทยที่กระชับ ตรงประเด็น สละสลวย ใช้ตัวเลขและเหตุผลประกอบชัดเจน ไม่เยิ่นเย้อ`

    const result = await callGemini({
      userId: session.user.id,
      prompt,
      systemInstruction,
      logType: 'stock_insight',
    })

    return NextResponse.json({
      insight: result.text,
      modelUsed: result.modelUsed,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('[stock-ai-insight POST error]', error)
    return NextResponse.json(
      { error: error?.message || 'ไม่สามารถวิเคราะห์ด้วย AI ได้ในขณะนี้' },
      { status: 500 }
    )
  }
}
