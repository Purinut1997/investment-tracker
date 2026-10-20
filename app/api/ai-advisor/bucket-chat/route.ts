import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { getBatchTechnicalSignals, TechnicalSignal } from '@/lib/market-data/technical-signals'
import { callGemini } from '@/lib/ai/gemini-client'
import { BucketStrategyType, STRATEGY_TYPE_META } from '@/lib/analytics/strategy-buckets'

export const maxDuration = 45

function buildDeterministicBucketFallback(params: {
  bucketName: string
  strategyType: BucketStrategyType
  targetPercent: number
  actualPercent: number
  dcaBudget: number
  baseCurrency: string
  totalCash: number
  bucketHoldings: any[]
  signals: Record<string, TechnicalSignal>
  question: string
  takeProfitPercent?: number
  stopLossPercent?: number
}): string {
  const {
    bucketName,
    strategyType,
    targetPercent,
    actualPercent,
    dcaBudget,
    bucketHoldings,
    signals,
    takeProfitPercent = 15,
    stopLossPercent = 8,
  } = params

  const diff = Number((actualPercent - targetPercent).toFixed(1))
  const lines: string[] = []

  lines.push(
    `### 🎯 สรุปแนวทาง "${bucketName}" (${STRATEGY_TYPE_META[strategyType]?.shortLabel || strategyType})`
  )
  lines.push(
    `- **สถานะสัดส่วน**: ปัจจุบันอยู่ที่ **${actualPercent}%** (เป้าหมาย **${targetPercent}%** | ${
      diff > 1.5
        ? `เกินเป้า **+${diff}%** แนะนำชะลอเติมเงินก้อนใหม่`
        : diff < -1.5
        ? `ต่ำกว่าเป้า **${diff}%** สามารถทยอยเติมทุนเพิ่มได้`
        : `สมดุลตามเป้าหมาย`
    })`
  )

  if (strategyType === 'SHORT_TERM') {
    lines.push(
      `- **กติกาเก็งกำไรระยะสั้น**: เป้าแบ่งขายทำกำไร **+${takeProfitPercent}%** (หรือเมื่อชนแนวต้าน R1 / RSI > 68) และจุดตัดขาดทุน **-${stopLossPercent}%** (หรือหลุดแนวรับ S1)`
    )
  } else if (strategyType === 'DIVIDEND') {
    lines.push(
      `- **กติกาพอร์ตปันผล**: เน้นสะสมเพิ่มเมื่อราคาย่อตัวใกล้แนวรับ S1 เพื่อให้ได้ Dividend Yield สูงขึ้น และถือรับกระแสเงินสดต่อเนื่อง`
    )
  } else if (strategyType === 'LONG_TERM') {
    lines.push(
      `- **กติกาพอร์ตถือยาว**: เน้นทยอยสะสม (DCA) หุ้นพื้นฐานแข็งแกร่ง โดยเฉพาะตัวที่ราคาย่อตัวลงมาจากจุดสูงสุดหรืออยู่ใกล้แนวรับสำคัญ`
    )
  }

  lines.push(`\n### 📊 วิเคราะห์จังหวะรายตัวในตะกร้านี้`)

  if (bucketHoldings.length === 0) {
    lines.push(`- ยังไม่มีสินทรัพย์ที่ถือครองในตะกร้านี้ สามารถเพิ่มหุ้นเข้าตะกร้าและเริ่มทยอยสะสมไม้แรกตามสัดส่วนเป้าหมาย`)
  } else {
    for (const h of bucketHoldings) {
      const sig = signals[h.ticker.toUpperCase()]
      const sym = h.currency === 'USD' ? '$' : '฿'
      const pnl = Number(h.unrealizedPnLPercent || 0)
      const rsiText = sig?.rsi14 !== null && sig?.rsi14 !== undefined ? `RSI ${sig.rsi14}` : 'RSI ปกติ'
      const s1Text = sig?.supportS1 ? `แนวรับ S1: ${sym}${sig.supportS1.toFixed(2)}` : ''
      const r1Text = sig?.resistanceR1 ? `แนวต้าน R1: ${sym}${sig.resistanceR1.toFixed(2)}` : ''

      let actionAdvice = 'ถือต่อตามแผน (Hold)'
      if (strategyType === 'SHORT_TERM') {
        if (pnl >= takeProfitPercent || (sig?.rsi14 && sig.rsi14 >= 68)) {
          actionAdvice = `🎯 **แนะนำแบ่งขายล็อกกำไร 30–50%** (กำไร +${pnl.toFixed(1)}% / ${rsiText} ใกล้โซนตึงตัว ${r1Text})`
        } else if (pnl <= -stopLossPercent) {
          actionAdvice = `🛡️ **ระวังหลุดจุด Stop Loss (-${stopLossPercent}%)** ตรวจสอบแนวรับ ${s1Text} หากหลุดควรลดความเสี่ยง`
        } else if (sig?.isNearSupport || (sig?.rsi14 && sig.rsi14 <= 38)) {
          actionAdvice = `⚡ **จังหวะน่าเข้าเก็งกำไรสั้น** ราคาอยู่ใกล้โซนแนวรับ (${s1Text}, ${rsiText}) เป้าขายทำกำไรที่ ${r1Text || `+${takeProfitPercent}%`}`
        } else {
          actionAdvice = `⏳ **ถือรอรอบ (Wait & Watch)** รอซื้อเพิ่มเมื่อย่อใกล้ ${s1Text || 'แนวรับ'} หรือแบ่งขายเมื่อขยับใกล้ ${r1Text || 'แนวต้าน'}`
        }
      } else if (strategyType === 'DIVIDEND') {
        if (sig?.isNearSupport || (sig?.pullbackFromHigh && sig.pullbackFromHigh <= -5)) {
          actionAdvice = `💰 **จังหวะสะสมรับปันผล** ราคาย่อตัว ${sig.pullbackFromHigh}% ลงมาใกล้ ${s1Text} ทำให้ได้ต้นทุนปันผลที่คุ้มค่าขึ้น`
        } else {
          actionAdvice = `✅ **ถือรับปันผลต่อเนื่อง** (ต้นทุนเฉลี่ย ${sym}${Number(h.avgCost).toFixed(2)} | กำไรสะสม ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%)`
        }
      } else {
        if (sig?.isNearSupport || (sig?.rsi14 && sig.rsi14 <= 40)) {
          actionAdvice = `🟢 **น่าช้อนสะสมพิเศษ** (${rsiText}, ${s1Text}) ราคาพักตัวลงมาในโซนได้เปรียบสำหรับถือยาว`
        } else if (sig?.rsi14 && sig.rsi14 >= 70) {
          actionAdvice = `⏸️ **ราคาตึงตัวระยะสั้น (${rsiText})** แนะนำชะลอการไล่ราคา รอจังหวะย่อตัวใกล้ ${s1Text}`
        } else {
          actionAdvice = `🌱 **ทยอย DCA ตามรอบปกติ** พื้นฐานระยะยาว (ราคาปัจจุบัน ${sym}${Number(h.currentPrice).toFixed(2)} | ${s1Text})`
        }
      }

      lines.push(`- **${h.ticker}** (ราคา **${sym}${Number(h.currentPrice).toFixed(2)}**, P&L **${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%**): ${actionAdvice}`)
    }
  }

  lines.push(`\n### 💡 แผนปฏิบัติการทันที (งบจัดสรร ฿${dcaBudget.toLocaleString()})`)
  if (bucketHoldings.length > 0) {
    const sorted = [...bucketHoldings].sort((a, b) => {
      const sigA = signals[a.ticker.toUpperCase()]
      const sigB = signals[b.ticker.toUpperCase()]
      const scoreA = (sigA?.isOversold ? 30 : 0) + (sigA?.isNearSupport ? 20 : 0) - (a.unrealizedPnLPercent || 0) * 0.2
      const scoreB = (sigB?.isOversold ? 30 : 0) + (sigB?.isNearSupport ? 20 : 0) - (b.unrealizedPnLPercent || 0) * 0.2
      return scoreB - scoreA
    })
    const topPick = sorted[0]
    lines.push(
      `- หากต้องการเติมเงินในตะกร้านี้ แนะนำโฟกัสอันดับแรกที่ **${topPick.ticker}** เป็นลำดับแรกเนื่องจากสัญญาณราคาและต้นทุนได้เปรียบที่สุดในกลุ่ม`
    )
  } else {
    lines.push(`- เลือกเพิ่มหุ้นเป้าหมายเข้าตะกร้านี้ แล้วแบ่งไม้เข้าซื้อ 2–3 ไม้ตามแนวรับสำคัญ`)
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const {
      bucket,
      question,
      dcaBudget = 5000,
    }: {
      bucket: {
        id: string
        name: string
        strategyType: BucketStrategyType
        description?: string
        targetPercent: number
        actualPercent: number
        tickers: string[]
        takeProfitPercent?: number
        stopLossPercent?: number
        targetYieldPercent?: number
      }
      question: string
      dcaBudget?: number
    } = body

    if (!bucket || !question) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลตะกร้ากลยุทธ์และคำถาม' }, { status: 400 })
    }

    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const [holdingsResult, accounts] = await Promise.all([
      calculateUserHoldings(userId, baseCurrency),
      prisma.investmentAccount.findMany({
        where: { userId },
        select: { cashBalance: true, currency: true },
      }),
    ])

    let totalCash = 0
    for (const acc of accounts) {
      totalCash += Number(acc.cashBalance) || 0
    }

    const bucketTickerSet = new Set(
      (bucket.tickers || []).map((t) => String(t).trim().toUpperCase()).filter(Boolean)
    )

    const bucketHoldings = holdingsResult.holdings.filter((h) =>
      bucketTickerSet.has(h.ticker.toUpperCase())
    )

    // Fetch live technical signals for all tickers in this bucket
    const tickerItems = Array.from(bucketTickerSet)
      .filter((t) => t !== 'CASH')
      .map((ticker) => {
        const held = bucketHoldings.find((h) => h.ticker.toUpperCase() === ticker)
        return {
          ticker,
          market: held?.market || (ticker.endsWith('.BK') ? 'TH' : 'US'),
        }
      })

    let signals: Record<string, TechnicalSignal> = {}
    if (tickerItems.length > 0) {
      try {
        signals = await getBatchTechnicalSignals(tickerItems)
      } catch (err) {
        console.warn('[bucket-chat technical signals]', err)
      }
    }

    const strategyMeta = STRATEGY_TYPE_META[bucket.strategyType] || STRATEGY_TYPE_META.CUSTOM

    const detailedAssets = Array.from(bucketTickerSet)
      .filter((t) => t !== 'CASH')
      .map((ticker) => {
        const held = bucketHoldings.find((h) => h.ticker.toUpperCase() === ticker)
        const sig = signals[ticker]
        return {
          ticker,
          heldInPortfolio: Boolean(held),
          quantity: held ? Number(held.quantity.toFixed(4)) : 0,
          avgCost: held ? Number(held.avgCost.toFixed(2)) : null,
          currentPrice: sig?.currentPrice ?? held?.currentPrice ?? null,
          currency: held?.currency ?? (ticker.endsWith('.BK') ? 'THB' : 'USD'),
          unrealizedPnLPercent: held ? `${held.unrealizedPnLPercent.toFixed(2)}%` : 'ยังไม่ได้ถือครอง',
          portfolioWeightPercent: held ? `${held.allocationPercent.toFixed(1)}%` : '0%',
          rsi14: sig?.rsi14 ?? null,
          supportS1: sig?.supportS1 ?? null,
          resistanceR1: sig?.resistanceR1 ?? null,
          sma50: sig?.sma50 ?? null,
          sma200: sig?.sma200 ?? null,
          pullbackFrom52WHigh: sig?.pullbackFromHigh !== undefined ? `${sig.pullbackFromHigh}%` : null,
          technicalSignal: sig?.badgeText ?? 'ปกติ',
        }
      })

    const roleSpecificInstruction =
      bucket.strategyType === 'SHORT_TERM'
        ? `นี่คือตะกร้า "หุ้นเก็งกำไรระยะสั้น (Short-Term Swing Trade)" เป้าหมายทำกำไร +${bucket.takeProfitPercent || 15}% และจุดตัดขาดทุน -${bucket.stopLossPercent || 8}%:
- วิเคราะห์แบบ Tactical Swing Trader เน้นจังหวะเข้า-ออกที่คมชัด
- ระบุราคาแนวรับ S1 (จุดเข้าซื้อเก็งกำไร), แนวต้าน R1 (จุดแบ่งขายทำกำไร), และจุด Stop Loss รายตัว
- บอกชัดเจนว่าตัวไหนในตะกร้านี้ควร "ซื้อเก็งสั้น", "ถือรอรอบ", "แบ่งขายทำกำไร", หรือ "คัทลอส"`
        : bucket.strategyType === 'DIVIDEND'
        ? `นี่คือตะกร้า "หุ้นปันผล & กระแสเงินสด (Dividend Income)" เป้าหมายรับปันผลสม่ำเสมอ:
- วิเคราะห์แบบ Income & Yield Strategist เน้นความคุ้มค่าของต้นทุนเทียบเงินปันผล
- ชี้จุดสะสมเพิ่มเมื่อราคาย่อตัวใกล้แนวรับ S1 เพื่อล็อก Dividend Yield ที่สูงขึ้น และเตือนการถือรับปันผลก่อนขึ้น XD`
        : bucket.strategyType === 'LONG_TERM'
        ? `นี่คือตะกร้า "หุ้นถือยาวสะสมความมั่งคั่ง (Long-Term Core Growth)":
- วิเคราะห์แบบ Chief Wealth Strategist เน้นการเติบโตระยะยาวและการถัวเฉลี่ยต้นทุน (DCA)
- ชี้ว่าตัวไหนสัดส่วนยังขาดหรือราคาย่อตัวลงมาน่าสะสมเพิ่มมากที่สุด และตัวไหนควรชะลอซื้อชั่วคราว`
        : `วิเคราะห์ตามเป้าหมายของตะกร้า "${bucket.name}" (${bucket.description || ''})`

    const prompt = `
คุณเป็นที่ปรึกษาการลงทุนส่วนบุคคลอัจฉริยะ (AI Portfolio Strategist)
ผู้ใช้กำลังถามคำถามเจาะจงเกี่ยวกับตะกร้าพอร์ตย่อยชื่อ: "${bucket.name}" (${strategyMeta.label})

[คำถามของผู้ใช้]:
"${question}"

[บริบทของตะกร้ากลยุทธ์นี้]:
- ประเภทกลยุทธ์: ${strategyMeta.label}
- คำอธิบายกลยุทธ์: ${bucket.description || strategyMeta.defaultDescription}
- สัดส่วนปัจจุบันของตะกร้านี้ในพอร์ตรวม: ${bucket.actualPercent}% (เป้าหมาย: ${bucket.targetPercent}%)
- มูลค่าพอร์ตสุทธิรวมทั้งหมดของผู้ใช้: ${(holdingsResult.totalValueBase + totalCash).toLocaleString()} ${baseCurrency}
- เงินสดสำรองพร้อมใช้: ${totalCash.toLocaleString()} ${baseCurrency}
- งบลงทุน/DCA รอบนี้ที่ตั้งไว้: ${Number(dcaBudget).toLocaleString()} ${baseCurrency}
- ข้อมูลหุ้นในตะกร้านี้พร้อมต้นทุนจริงและสัญญาณกราฟเทคนิคสด (RSI 14, แนวรับ S1, แนวต้าน R1, SMA50/200):
${JSON.stringify(detailedAssets, null, 2)}

[แนวทางการวิเคราะห์เฉพาะตะกร้านี้]:
${roleSpecificInstruction}

[กฎเหล็กในการตอบ]:
1. ห้ามเกริ่นนำหรือทักทาย (เช่น "สวัสดีครับ") ให้ตอบคำถามของผู้ใช้ทันทีอย่างตรงประเด็น กระชับ อ่านจบใน 15 วินาที!
2. แบ่งคำตอบเป็น 3 หัวข้อสั้นๆ ด้วย Markdown '###':
   ### 🎯 คำตอบฟันธงสำหรับ "${bucket.name}"
   (ตอบคำถามของผู้ใช้โดยตรง ชัดเจนว่าตอนนี้ควรเล่นแบบไหน ทำอะไรก่อน-หลัง)
   ### 📊 แผนจัดการรายตัว (จุดเข้า / จุดขาย / แนวรับ-แนวต้าน)
   (เจาะรายตัวในตะกร้านี้ ระบุชื่อ **TICKER** พร้อมตัวเลขราคาปัจจุบัน แนวรับ **S1**, แนวต้าน **R1**, ค่า **RSI** และกำไร/ขาดทุนจริงของผู้ใช้)
   ### 💵 แอ็กชันแนะนำตอนนี้
   (สรุป 1-2 ข้อที่ทำตามได้ทันที เช่น ถ้างบ ฿${Number(dcaBudget).toLocaleString()} ควรแบ่งใส่ตัวไหนกี่บาท หรือตั้งขายที่ราคาเท่าไหร่)
3. เน้นตัวหนา (**...**) ที่ชื่อหุ้น (Ticker ภาษาอังกฤษพิมพ์ใหญ่), ราคา ($ หรือ ฿), และเปอร์เซ็นต์เสมอ
`

    try {
      const { text, modelUsed } = await callGemini({
        userId,
        prompt,
        logType: 'advisor',
        systemInstruction:
          'คุณเป็น AI Strategist ประจำพอร์ตการลงทุน ตอบสั้น กระชับ ฟันธงชัดเจน อิงตัวเลขต้นทุนและแนวรับแนวต้านจริงของผู้ใช้',
      })

      return NextResponse.json({
        answer: text,
        modelUsed,
        updatedAt: new Date().toISOString(),
        isFallback: false,
      })
    } catch (aiErr: any) {
      console.warn('[bucket-chat Gemini fallback]', aiErr?.message)
      const fallbackText = buildDeterministicBucketFallback({
        bucketName: bucket.name,
        strategyType: bucket.strategyType,
        targetPercent: bucket.targetPercent,
        actualPercent: bucket.actualPercent,
        dcaBudget: Number(dcaBudget) || 5000,
        baseCurrency,
        totalCash,
        bucketHoldings,
        signals,
        question,
        takeProfitPercent: bucket.takeProfitPercent,
        stopLossPercent: bucket.stopLossPercent,
      })

      return NextResponse.json({
        answer: fallbackText,
        modelUsed: 'Technical Strategy Engine (Auto)',
        updatedAt: new Date().toISOString(),
        isFallback: true,
      })
    }
  } catch (error: any) {
    console.error('[bucket-chat POST]', error)
    return NextResponse.json(
      { error: error.message || 'ไม่สามารถวิเคราะห์ข้อมูลตะกร้ากลยุทธ์ได้' },
      { status: 500 }
    )
  }
}
