import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

function parseStructuredInsight(rawText: string | null | undefined) {
  if (!rawText) return null
  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  const cleanSymbol = symbol.toUpperCase()

  try {
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId: session.user.id,
        logType: 'advisor',
        OR: [
          { prompt: { contains: `(${cleanSymbol})` } },
          { prompt: { contains: `สัญลักษณ์ (Ticker): ${cleanSymbol}` } },
          { prompt: { contains: `สัญลักษณ์: ${cleanSymbol}` } },
          { prompt: { contains: cleanSymbol } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    // If the latest log contains no Thai characters (e.g. older English generation),
    // do not return it so the user receives a clean Thai analysis upon clicking.
    const hasThai = latestLog?.response ? /[ก-๙]/.test(latestLog.response) : false
    if (!hasThai && latestLog) {
      return NextResponse.json({
        insight: null,
        structuredInsight: null,
        modelUsed: null,
        updatedAt: null,
      })
    }

    const structuredInsight = parseStructuredInsight(latestLog?.response)

    return NextResponse.json({
      insight: latestLog?.response ?? null,
      structuredInsight,
      modelUsed: latestLog?.modelUsed ?? null,
      updatedAt: latestLog?.createdAt ? latestLog.createdAt.toISOString() : null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stock insight history' },
      { status: 500 }
    )
  }
}

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
      pb,
      evEbitda,
      dividendYield,
      payoutRatio,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      marketCap,
      revenue,
      revenueGrowth,
      eps,
      freeCashflow,
      analystTarget,
    } = body

    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
    }

    const cleanSymbol = symbol.toUpperCase()

    const prompt = `
คุณเป็น Senior Equity Research Analyst & Multi-Asset Portfolio Manager ระดับสถาบันการเงินชั้นนำ
กรุณาวิเคราะห์สินทรัพย์/หุ้นนี้แบบเจาะลึกรอบด้าน (Deep-Dive Institutional Grade Analysis) สำหรับนักลงทุนไทย:
- สัญลักษณ์ (Ticker): ${cleanSymbol} (${cleanSymbol})
- ชื่อสินทรัพย์: ${name || cleanSymbol}
- ราคาล่าสุด: ${currentPrice} ${currency} (การเปลี่ยนแปลงวันนี้: ${
      changePercent !== undefined ? `${changePercent}%` : 'N/A'
    })
- กรอบ 52 สัปดาห์: ต่ำสุด ${fiftyTwoWeekLow || 'N/A'} - สูงสุด ${fiftyTwoWeekHigh || 'N/A'}
- มูลค่าตลาด (Market Cap): ${marketCap ? `${marketCap} ${currency}` : 'N/A'}
- อัตราส่วนประเมินมูลค่า: P/E: ${pe ? `${pe}x` : 'N/A'}, P/B: ${pb ? `${pb}x` : 'N/A'}, EV/EBITDA: ${
      evEbitda ? `${evEbitda}x` : 'N/A'
    }
- เงินปันผล: Dividend Yield: ${
      dividendYield !== null && dividendYield !== undefined ? `${dividendYield}%` : 'N/A'
    }, Payout Ratio: ${payoutRatio ? `${payoutRatio}%` : 'N/A'}
- ผลประกอบการล่าสุด: รายได้รวม (Revenue): ${revenue ? `${revenue} ${currency}` : 'N/A'}, เติบโต: ${
      revenueGrowth ? `${revenueGrowth}%` : 'N/A'
    }, EPS: ${eps ?? 'N/A'}, กระแสเงินสดอิสระ (FCF): ${freeCashflow ? `${freeCashflow} ${currency}` : 'N/A'}
- ความเห็นนักวิเคราะห์ Wall St.: ${analystTarget?.recommendation || 'N/A'}, ราคาเป้าหมายเฉลี่ย: ${
      analystTarget?.targetMean
        ? `${analystTarget.targetMean} ${currency} (Upside: ${analystTarget.upsidePercent}%)`
        : 'N/A'
    }

⚠️ กฎเหล็กสูงสุดด้านภาษาและการตอบ (STRICT MANDATORY RULES):
1. **ภาษาไทย 100% (THAI LANGUAGE ONLY):** ข้อความในทุกฟิลด์ของ JSON Object (summary, businessOverview, financialPerformance, valuationAndDividend, strengths, risks, scenarioAnalysis, latestNewsCatalyst) ต้องเขียนอธิบายและวิเคราะห์เป็น "ภาษาไทย" ทั้งหมด ห้ามตอบเป็นภาษาอังกฤษโดยเด็ดขาด ยกเว้นรหัสย่อ Ticker (เช่น ${cleanSymbol}), ชื่อเฉพาะของระบบ/ผลิตภัณฑ์ (เช่น Google Cloud, YouTube, Android, Moat, AI) และตัวย่อทางการเงินสากล (เช่น P/E, P/B, EPS, FCF)
2. **ภาษาไทยสละสลวย ชัดเจน และเป็นมืออาชีพ:** เขียนอธิบายด้วยภาษาไทยที่นักลงทุนอ่านแล้วเข้าใจได้ทันที มีสาระเชิงลึก ทรงคุณค่าทางวิชาการและนำไปใช้ตัดสินใจลงทุนได้จริง
3. ห้ามเขียนคำทักทาย เช่น "เรียนท่านนักลงทุน" หรือ "สวัสดีครับ"
4. วิเคราะห์ด้วยเนื้อหาจริง ตรงไปตรงมา กระชับ และตรงประเด็น
5. ตอบกลับเป็น JSON Object ที่ถูกต้องเท่านั้น (ห้ามมี markdown หรือข้อความอื่นนอก JSON) ตามโครงสร้างดังนี้:
{
  "summary": "สรุปสาระสำคัญที่สุด 1-2 ประโยคสำหรับนักลงทุน (เขียนเป็นภาษาไทย)",
  "businessOverview": "อธิบายโมเดลธุรกิจเป็นภาษาไทย: บริษัททำอะไร / รายได้หลักมาจากไหน / ความได้เปรียบในการแข่งขัน (Moat) หรือถ้านี่คือกองทุน ETF ให้อธิบายนโยบายและดัชนีอ้างอิง (เขียนเป็นภาษาไทย)",
  "financialPerformance": {
    "revenue": "สรุปตัวเลขรายได้และยอดขายล่าสุดเป็นภาษาไทยอย่างกระชับ เช่น '20.25 พันล้านดอลลาร์ (+371.6% YoY) ขยายตัวโดดเด่นจากอุปสงค์ชิป'",
    "eps": "สรุปตัวเลขกำไรต่อหุ้น EPS และประสิทธิภาพการทำกำไรเป็นภาษาไทยอย่างกระชับ เช่น '$73.78 สะท้อนความสามารถทำกำไรระดับสูงมาก'",
    "growth": "สรุปทิศทางการเติบโต YoY/QoQ เป็นภาษาไทยอย่างกระชับ เช่น 'เติบโตแบบก้าวกระโดด หนุนโดยราคาและปริมาณความต้องการหน่วยความจำ'",
    "fcf": "สรุปกระแสเงินสดอิสระ Free Cash Flow และสภาพคล่องเป็นภาษาไทยอย่างกระชับ เช่น '7.72 พันล้านดอลลาร์ บ่งชี้กระแสเงินสดดำเนินงานที่มั่นคงแข็งแกร่ง'"
  },
  "valuationAndDividend": {
    "pe": "วิเคราะห์ความถูกแพงของ P/E เมื่อเทียบกับค่าเฉลี่ยในอดีตหรือกลุ่มเป็นภาษาไทย",
    "pb": "ระดับ P/B Ratio และความน่าสนใจเป็นภาษาไทย",
    "evEbitda": "ระดับ EV/EBITDA เป็นภาษาไทย",
    "dividendYield": "อัตราผลตอบแทนเงินปันผล และความสม่ำเสมอเป็นภาษาไทย",
    "payoutRatio": "ความปลอดภัยของ Payout Ratio และศักยภาพในการจ่ายปันผลต่อเป็นภาษาไทย"
  },
  "strengths": [
    "จุดแข็งหรือปัจจัยขับเคลื่อนข้อที่ 1 เป็นภาษาไทย พร้อมเหตุผลสั้นกระชับ",
    "จุดแข็งหรือปัจจัยขับเคลื่อนข้อที่ 2 เป็นภาษาไทย พร้อมเหตุผลสั้นกระชับ",
    "จุดแข็งหรือปัจจัยขับเคลื่อนข้อที่ 3 เป็นภาษาไทย พร้อมเหตุผลสั้นกระชับ"
  ],
  "risks": [
    "ความเสี่ยงหรือปัจจัยเฝ้าระวังข้อที่ 1 เป็นภาษาไทย พร้อมเหตุผลสั้นกระชับ",
    "ความเสี่ยงหรือปัจจัยเฝ้าระวังข้อที่ 2 เป็นภาษาไทย พร้อมเหตุผลสั้นกระชับ",
    "ความเสี่ยงหรือปัจจัยเฝ้าระวังข้อที่ 3 เป็นภาษาไทย พร้อมเหตุผลสั้นกระชับ"
  ],
  "scenarioAnalysis": {
    "bull": "Bull Case (กรณีดีที่สุด): ปัจจัยบวกที่ผลักดันราคาและผลประกอบการทะลุเป้าเป็นภาษาไทย",
    "base": "Base Case (กรณีพื้นฐาน): ผลประกอบการตามคาดการณ์และมูลค่าที่เหมาะสมเป็นภาษาไทย",
    "bear": "Bear Case (กรณีแย่สุด): ปัจจัยลบหรือความเสี่ยงที่อาจฉุดรั้งราคาเป็นภาษาไทย"
  },
  "latestNewsCatalyst": "ประเด็นข่าวล่าสุดหรือ Catalyst สำคัญที่ตลาดกำลังจับตามองเป็นภาษาไทย"
}
`

    const systemInstruction = `คุณเป็น Senior Multi-Asset Portfolio Manager และ Equity Research Analyst ที่ปรึกษาการลงทุนระดับสถาบัน ทุกคำตอบและคำอธิบายของคุณต้องเขียนเป็น "ภาษาไทย" ทั้งหมด 100% ห้ามตอบเป็นภาษาอังกฤษเด็ดขาด (ยกเว้นรหัส Ticker, ตัวย่อทางการเงินสากล เช่น P/E, EPS, FCF หรือชื่อเฉพาะของผลิตภัณฑ์) ตอบเป็น JSON ที่ถูกต้องตามโครงสร้างที่กำหนดเท่านั้น ไม่ใช้คำทักทายเยิ่นเย้อ`

    const result = await callGemini({
      userId: session.user.id,
      prompt,
      systemInstruction,
      logType: 'stock_insight',
    })

    const structuredInsight = parseStructuredInsight(result.text)

    return NextResponse.json({
      insight: result.text,
      structuredInsight,
      modelUsed: result.modelUsed,
      updatedAt: new Date().toISOString(),
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('[stock-ai-insight POST error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI stock insight' },
      { status: 500 }
    )
  }
}
