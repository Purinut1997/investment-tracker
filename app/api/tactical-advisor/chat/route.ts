import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { getBatchTechnicalSignals } from '@/lib/market-data/technical-signals'
import { createFallbackPillars, MarketPillarsData } from '@/app/api/tactical-advisor/route'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({}))
    const { question, messages, tacticalContext } = body

    let activeQuestion = ''
    let messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (Array.isArray(messages) && messages.length > 0) {
      messageHistory = messages.filter((m) => m && m.role && m.content)
      const lastUserMsg = [...messageHistory].reverse().find((m) => m.role === 'user')
      activeQuestion = lastUserMsg?.content?.trim() || ''
    } else if (typeof question === 'string' && question.trim()) {
      activeQuestion = question.trim()
      messageHistory = [{ role: 'user', content: activeQuestion }]
    }

    if (!activeQuestion) {
      return NextResponse.json({ error: 'Missing question or messages' }, { status: 400 })
    }

    // 1. Gather Internal Portfolio DNA
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)

    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, currency: true },
    })

    let totalCash = 0
    accounts.forEach((acc) => {
      totalCash += Number(acc.cashBalance) || 0
    })

    const totalPortfolioValue = holdingsResult.totalValueBase
    const totalWealth = totalPortfolioValue + totalCash
    const cashPercent = totalWealth > 0 ? (totalCash / totalWealth) * 100 : 0

    // Compute Thematic & Sector Concentration (e.g. US Tech & AI)
    const techAiTickers = new Set([
      'QQQ',
      'QQQM',
      'GOOGL',
      'GOOG',
      'NVDA',
      'AAPL',
      'MSFT',
      'META',
      'AMZN',
      'TSM',
      'AVGO',
      'AMD',
      'SNDK',
      'CHPY',
      'PLTR',
      'SMCI',
      'ARM',
    ])

    let techAiAllocationPercent = 0
    holdingsResult.holdings.forEach((h) => {
      if (techAiTickers.has(h.ticker.toUpperCase())) {
        techAiAllocationPercent += h.allocationPercent || 0
      }
    })

    // 2. Fetch Live Technical Signals for all user holdings in parallel
    const holdingsToAnalyze = holdingsResult.holdings.slice(0, 15)
    const technicalSignals = await getBatchTechnicalSignals(
      holdingsToAnalyze.map((h) => ({
        ticker: h.ticker,
        market:
          h.market ||
          (h.ticker.endsWith('.BK') ||
          ['SCB', 'PTT', 'KBANK', 'CPALL', 'AOT', 'BDMS', 'DELTA'].includes(h.ticker.toUpperCase())
            ? 'TH'
            : 'US'),
      }))
    )

    // 3. Compile Detailed Holdings & Technical Signals Dossier
    const detailedHoldingsText = holdingsToAnalyze
      .map((h) => {
        const sig = technicalSignals[h.ticker.toUpperCase()]
        const pnlPrefix = h.unrealizedPnLPercent >= 0 ? '+' : ''
        const currencySymbol = h.currency === 'THB' ? '฿' : '$'

        const rsiDesc = sig?.rsi14
          ? `RSI(14): ${sig.rsi14} (${
              sig.rsi14 <= 35
                ? 'Oversold/ขายมากเกินไป'
                : sig.rsi14 >= 68
                ? 'Overbought/ซื้อมากเกินไป'
                : 'ปกติ/พักตัว'
            })`
          : 'RSI: ไม่มีข้อมูล'

        const smaDesc =
          [
            sig?.sma50
              ? `SMA 50: ${currencySymbol}${sig.sma50} (${
                  sig.currentPrice >= sig.sma50 ? 'ราคายืนเหนือ' : 'ราคาหลุดต่ำกว่า'
                })`
              : null,
            sig?.sma200
              ? `SMA 200: ${currencySymbol}${sig.sma200} (${
                  sig.currentPrice >= sig.sma200 ? 'ราคายืนเหนือ' : 'ราคาหลุดต่ำกว่า'
                })`
              : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'SMA: ไม่มีข้อมูล'

        const pivotDesc =
          [
            sig?.supportS1 ? `แนวรับ S1: ${currencySymbol}${sig.supportS1}` : null,
            sig?.supportS2 ? `แนวรับ S2 (จุดหนีไฟ): ${currencySymbol}${sig.supportS2}` : null,
            sig?.resistanceR1 ? `แนวต้าน R1: ${currencySymbol}${sig.resistanceR1}` : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'Pivots: ไม่มีข้อมูล'

        const pullbackDesc =
          sig?.pullbackFromHigh !== undefined
            ? `ย่อตัวจากจุดสูงสุด 52W: ${sig.pullbackFromHigh.toFixed(1)}%`
            : ''

        const statusBadge = sig?.badgeText || 'ตามแผน'
        const reason = sig?.technicalReason || 'สัดส่วนและแนวโน้มตามแผนพอร์ตหลัก'

        return `
- [${h.ticker}] ${h.assetName}
  * สัดส่วนในพอร์ต: ${h.allocationPercent.toFixed(1)}% (อันดับน้ำหนักการลงทุน)
  * ต้นทุนเฉลี่ย: ${currencySymbol}${h.avgCost.toFixed(2)} | ราคาตลาดปัจจุบัน: ${currencySymbol}${h.currentPrice.toFixed(
          2
        )} | กำไร/ขาดทุน: ${pnlPrefix}${h.unrealizedPnLPercent.toFixed(2)}%
  * สัญญาณเทคนิค: ${rsiDesc} | ${statusBadge} | ${pullbackDesc}
  * ค่าเฉลี่ยเคลื่อนที่: ${smaDesc}
  * จุดแนวรับ/แนวต้าน Pivot: ${pivotDesc}
  * คำอธิบายเทคนิค: ${reason}`
      })
      .join('\n')

    // 4. Resolve 4 Pillars Market Climate Data
    const pillars: MarketPillarsData =
      tacticalContext?.marketRegime?.pillars || createFallbackPillars(tacticalContext || {})

    const macroSummary = `
- สภาวะตลาดห้วงเวลานี้: ${tacticalContext?.marketRegime?.statusLabelTh || 'ผันผวนและควรระมัดระวัง'} (ระดับความเสี่ยง ${
      pillars.formula?.calculatedRiskScore || 4
    }/5: ${pillars.formula?.calculatedRiskLabel || 'ความเสี่ยงระดับสูง'})
- กลยุทธ์ภาพรวมที่แนะนำ: ${pillars.formula?.postureLabelTh || '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)'} (${
      pillars.formula?.postureSubtitleTh || 'แบ่งไม้ทยอยสะสมเฉพาะหุ้นพื้นฐานแกร่งที่ลงมาแนวรับสำคัญ'
    })
- สูตรประเมินสภาวะ (Formula): ${
      pillars.formula?.formulaEquation ||
      'โมเมนตัม S&P 500 ย่อตัว + อารมณ์กังวล + Bond Yield ตึงตัว ➔ ความเสี่ยง 4/5'
    }
- เสาที่ 1 (Sentiment & Volatility): CNN Fear & Greed ${pillars.sentiment.fearGreedScore}/100 (${
      pillars.sentiment.fearGreedLabelTh
    }, การเปลี่ยนแปลง 1 สัปดาห์: ${pillars.sentiment.fearGreed1WDiff > 0 ? '+' : ''}${
      pillars.sentiment.fearGreed1WDiff
    } pts) | CBOE VIX Index: ${pillars.sentiment.vixValue} pts (${pillars.sentiment.vixStatusLabel})
- เสาที่ 2 (Trend & Breadth): S&P 500: ${pillars.momentum.spxPrice.toLocaleString()} pts (${
      pillars.momentum.spxChangePercent > 0 ? '+' : ''
    }${pillars.momentum.spxChangePercent}%, Drawdown จากจุดสูงสุด 52W: ${pillars.momentum.spxDrawdownPercent.toFixed(
      2
    )}%) | NASDAQ: ${pillars.momentum.nasdaqPrice.toLocaleString()} pts (${
      pillars.momentum.nasdaqChangePercent > 0 ? '+' : ''
    }${pillars.momentum.nasdaqChangePercent}%, Drawdown จากจุดสูงสุด 52W: ${pillars.momentum.nasdaqDrawdownPercent.toFixed(
      2
    )}%) | Breadth: ${pillars.momentum.breadthStatus}
- เสาที่ 3 (Macro & Liquidity): US 10Y Bond Yield: ${pillars.macroLiquidity.us10yYield.toFixed(
      2
    )}% (${pillars.macroLiquidity.yieldPressureLabel}) | นโยบาย Fed: ${
      pillars.macroLiquidity.fedPolicyStance
    } | คาดการณ์เงินเฟ้อ CPI/PCE: ${pillars.macroLiquidity.inflationExpectation}
- เสาที่ 4 (Catalysts & Fund Flows): กระแสเงินทุน: ${
      pillars.catalystsAndFlows.safeHavenFlowLabel
    } | ราคาทองคำ: $${pillars.catalystsAndFlows.goldPrice?.toLocaleString()} | ดัชนีดอลลาร์ DXY: ${
      pillars.catalystsAndFlows.dxyPrice?.toFixed(2)
    } | ปัจจัยเร่งตลาด: ${(pillars.catalystsAndFlows.keyCatalysts || []).join('; ')}
`

    // 5. Multi-Turn Conversation Thread
    const previousHistoryText =
      messageHistory.length > 1
        ? `
=== ประวัติการสนทนาก่อนหน้า ===
${messageHistory
  .slice(0, -1)
  .map((m) => `${m.role === 'user' ? 'ผู้ใช้' : 'ที่ปรึกษา AI'}: ${m.content}`)
  .join('\n\n')}
`
        : ''

    const prompt = `
[AI Tactical Wealth Advisor Copilot]
ผู้ใช้กำลังสอบถามเกี่ยวกับกลยุทธ์การลงทุน วิเคราะห์พอร์ต สัญญาณเทคนิค หรือแนวทางตัดสินใจในห้วงเวลานี้

=== ข้อมูลสภาวะตลาดโลก 4 เสาหลัก (MARKET CLIMATE) ===
${macroSummary}

=== ข้อมูลพอร์ตโฟลิโอภายในของนักลงทุน (INTERNAL PORTFOLIO DNA) ===
- สกุลเงินหลัก: ${baseCurrency}
- มูลค่าสินทรัพย์รวมในพอร์ต: ${totalPortfolioValue.toLocaleString()} ${baseCurrency}
- เงินสดสำรองรวม (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (${cashPercent.toFixed(
      1
    )}% ของความมั่งคั่งรวม | คำแนะนำกลยุทธ์เงินสดในสภาวะนี้: ควรมีประมาณ 25%)
- การกระจุกตัวของธีมการลงทุน: ${
      techAiAllocationPercent > 50
        ? `🚨 พอร์ตมีความเสี่ยงกระจุกตัวสูงมากในกลุ่ม US Tech & AI (${techAiAllocationPercent.toFixed(
            1
          )}% ของพอร์ต)`
        : `กระจายตัวปกติ (Tech & AI: ${techAiAllocationPercent.toFixed(1)}%)`
    }

=== รายการสินทรัพย์ที่ถือครองจริง พร้อมสัญญาณเทคนิครายตัว (RSI, SMA, Pivot S1/S2/R1) ===
${detailedHoldingsText || 'ไม่มีหุ้นในพอร์ต'}

${previousHistoryText}

=== คำถามล่าสุดของผู้ใช้ ===
"${activeQuestion}"

=== คำแนะนำและกรอบการตอบ (INSTITUTIONAL ADVISORY STANDARDS) ===
1. ตอบเป็นภาษาไทยที่กระชับ สุภาพ มั่นใจ ตรงไปตรงมา มีหลักการทางสถิติและการเงินรองรับ
2. หากผู้ใช้ถามเรื่อง "กราฟ", "แนวโน้ม", "แนวรับแนวต้าน", หรือ "จุดกลับตัว":
   - คุณต้องอ้างอิงตัวเลขจริงจากสัญญาณเทคนิคที่ให้ไว้ข้างบนอย่างครบถ้วน (Wilder's RSI, SMA 50/200, แนวรับ S1/S2, แนวต้าน R1, % ย่อตัวจาก 52W High)
   - ห้ามตอบแบบกำกวมว่า "การคาดเดาอนาคตยาก ให้บริหารความเสี่ยง" โดยไม่มีตัวเลขเด็ดขาด! ให้ชี้จุดกลับตัวและจุดรับที่ได้เปรียบเชิงปริมาณอย่างชัดเจน
3. หากผู้ใช้ถามเรื่องการซื้อเพิ่ม (Dip Buy / DCA):
   - แนะนำการแบ่งไม้ (Tranche Entry) ตามแนวรับสำคัญ (เช่น ไม้แรกที่ S1, ไม้สองที่ SMA 200)
   - ต้องระบุจุดหนีไฟ (Stop Loss) เสมอ
4. หากผู้ใช้ถามเรื่องการลดความเสี่ยงหรือพอร์ตกระจุกตัว:
   - นำเสนอแนวทางปรับสัดส่วน (Rebalancing) อย่างมีเหตุผล โดยคำนึงถึงผลกระทบทางภาษีต่างประเทศ (มาตรา 41)
5. กฎเรื่องการจัดหน้า (Typography & Clean Formatting):
   - แบ่งหัวข้อให้ชัดเจน มีโครงสร้างเป็นระเบียบ สบายตา
   - ห้ามใส่เครื่องหมายดอกจัน (**) ฟุ่มเฟือย ให้ใช้เน้นเฉพาะตัวเลขสำคัญหรือชื่อหุ้นเท่านั้น
   - ใช้เครื่องหมายขีด (-) นำหน้ารายการ
`

    const aiResult = await callGemini({
      userId,
      prompt,
      logType: 'bucket_chat',
      systemInstruction:
        'คุณคือ Senior Chief Investment Officer (CIO) & Chartered Market Technician (CMT) ผู้เชี่ยวชาญด้านกลยุทธ์การลงทุนระดับสากล มีความรอบรู้ลึกซึ้งทั้งสภาวะมหภาค (4 เสาหลัก) การจัดพอร์ต (Asset Allocation) และสัญญาณเทคนิคเชิงปริมาณ (RSI, SMA, Pivots) ตอบด้วยตัวเลขที่ชัดเจน มีเหตุผล ตรงไปตรงมา ไม่กำกวม และจัดหน้าอย่างสะอาดตา',
      thinkingBudget: 0,
    })

    const cleanedAnswer = (aiResult.text || '')
      .replace(/\*\*\s*\*\*/g, ' ')
      .replace(/\*{3,}/g, '**')

    return NextResponse.json({
      answer: cleanedAnswer,
      modelUsed: aiResult.modelUsed,
      portfolioSummary: {
        totalPortfolioValue,
        totalCash,
        baseCurrency,
        cashPercent,
        techAiAllocationPercent,
        holdingsCount: holdingsResult.holdings.length,
      },
      technicalSignals,
    })
  } catch (error: any) {
    console.error('[tactical-advisor chat error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    )
  }
}
