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

    const holdingsToAnalyze = holdingsResult.holdings.slice(0, 15)
    const userSymbols = holdingsToAnalyze.map((h) => h.ticker.toUpperCase())

    // 2. Fetch Live Technical Signals & Chart Levels for all holdings in parallel
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

    // 3. Fetch Real External News & Catalysts from Database (Finnhub / Yahoo / Google News RSS)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    let [portfolioNews, generalMarketNews] = await Promise.all([
      prisma.newsItem.findMany({
        where: {
          symbol: { in: userSymbols },
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: 'desc' },
        take: 12,
      }),
      prisma.newsItem.findMany({
        where: {
          symbol: null,
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: 'desc' },
        take: 8,
      }),
    ])

    // Fallback if recent 7-day filter yields too few items
    let allNews = [...portfolioNews, ...generalMarketNews]
    if (allNews.length < 5) {
      allNews = await prisma.newsItem.findMany({
        where: {
          OR: [{ symbol: { in: userSymbols } }, { symbol: null }],
        },
        orderBy: { publishedAt: 'desc' },
        take: 15,
      })
    }

    const externalNewsText =
      allNews.length > 0
        ? allNews
            .slice(0, 15)
            .map((n) => {
              const symTag = n.symbol ? `[หุ้น ${n.symbol}]` : '[ข่าวเศรษฐกิจโลก & การเงิน]'
              const sentimentTag = n.sentiment ? ` (ทิศทางข่าว: ${n.sentiment})` : ''
              const timeStr = n.publishedAt
                ? new Date(n.publishedAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : ''
              const summarySnippet = n.summary ? `\n    สรุปเนื้อหา: ${n.summary.slice(0, 240)}...` : ''
              return `- ${symTag} "${n.headline}" (แหล่งข่าว: ${n.sourceName} | วันที่: ${timeStr})${sentimentTag}${summarySnippet}`
            })
            .join('\n')
        : 'ไม่มีข่าวล่าสุดในระบบ'

    // 4. Compile Detailed Technical Chart Profiles & Support/Resistance Levels
    const detailedHoldingsText = holdingsToAnalyze
      .map((h) => {
        const sig = technicalSignals[h.ticker.toUpperCase()]
        const pnlPrefix = h.unrealizedPnLPercent >= 0 ? '+' : ''
        const currencySymbol = h.currency === 'THB' ? '฿' : '$'

        const rsiDesc = sig?.rsi14
          ? `RSI(14): ${sig.rsi14} (${
              sig.rsi14 <= 35
                ? 'Oversold / ขายมากเกินไป มีโอกาสรีบาวด์'
                : sig.rsi14 >= 68
                ? 'Overbought / ซื้อมากเกินไป ตึงตัว'
                : 'Neutral / พักตัวในกรอบ'
            })`
          : 'RSI: ไม่มีข้อมูล'

        const smaDesc =
          [
            sig?.sma50
              ? `SMA 50: ${currencySymbol}${sig.sma50} (${
                  sig.currentPrice >= sig.sma50 ? 'ราคายืนเหนือแนวรับเส้น 50 วัน' : 'ราคาหลุดต่ำกว่าเส้น 50 วัน'
                })`
              : null,
            sig?.sma200
              ? `SMA 200: ${currencySymbol}${sig.sma200} (${
                  sig.currentPrice >= sig.sma200 ? 'โครงสร้างหลักระยะยาวยังเป็นขาขึ้น' : 'ราคาหลุดต่ำกว่าเส้น 200 วัน'
                })`
              : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'SMA: ไม่มีข้อมูล'

        const pivotDesc =
          [
            sig?.supportS1 ? `แนวรับแรก S1: ${currencySymbol}${sig.supportS1}` : null,
            sig?.supportS2 ? `แนวรับหนีไฟ S2: ${currencySymbol}${sig.supportS2}` : null,
            sig?.resistanceR1 ? `แนวต้านเป้าหมาย R1: ${currencySymbol}${sig.resistanceR1}` : null,
          ]
            .filter(Boolean)
            .join(' | ') || 'Pivots: ไม่มีข้อมูล'

        const rangeDesc = [
          sig?.fiftyTwoWeekHigh ? `จุดสูงสุด 52 สัปดาห์: ${currencySymbol}${sig.fiftyTwoWeekHigh}` : null,
          sig?.fiftyTwoWeekLow ? `จุดต่ำสุด 52 สัปดาห์: ${currencySymbol}${sig.fiftyTwoWeekLow}` : null,
          sig?.pullbackFromHigh !== undefined
            ? `ย่อตัวจากจุดสูงสุด 52W: ${sig.pullbackFromHigh.toFixed(1)}%`
            : null,
        ]
          .filter(Boolean)
          .join(' | ')

        const statusBadge = sig?.badgeText || 'ตามแผน'
        const reason = sig?.technicalReason || 'โครงสร้างราคาและแนวโน้มตามแผนหลัก'

        return `
- [${h.ticker}] ${h.assetName}
  * สัดส่วนในพอร์ต: ${h.allocationPercent.toFixed(1)}% | ต้นทุนเฉลี่ย: ${currencySymbol}${h.avgCost.toFixed(
          2
        )} | ราคาตลาดปัจจุบัน: ${currencySymbol}${h.currentPrice.toFixed(
          2
        )} | กำไร/ขาดทุน: ${pnlPrefix}${h.unrealizedPnLPercent.toFixed(2)}%
  * กราฟและกรอบราคาภายนอก: ${rangeDesc}
  * สัญญาณเทคนิค: ${rsiDesc} | สถานะสัญญาณ: ${statusBadge}
  * ค่าเฉลี่ยเคลื่อนที่ (Trend): ${smaDesc}
  * จุดแนวรับ/แนวต้าน Pivot: ${pivotDesc}
  * บทวิเคราะห์เทคนิค: ${reason}`
      })
      .join('\n')

    // 5. Resolve 4 Pillars Macro Climate Data
    const pillars: MarketPillarsData =
      tacticalContext?.marketRegime?.pillars || createFallbackPillars(tacticalContext || {})

    const macroSummary = `
- สภาวะตลาดห้วงเวลานี้: ${tacticalContext?.marketRegime?.statusLabelTh || 'ผันผวนและควรระมัดระวัง'} (ระดับความเสี่ยง ${
      pillars.formula?.calculatedRiskScore || 4
    }/5: ${pillars.formula?.calculatedRiskLabel || 'ความเสี่ยงระดับสูง'})
- กลยุทธ์ภาพรวมที่แนะนำ: ${pillars.formula?.postureLabelTh || '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)'} (${
      pillars.formula?.postureSubtitleTh || 'แบ่งไม้ทยอยสะสมเฉพาะหุ้นพื้นฐานแกร่งที่ลงมาแนวรับสำคัญ ไม่ไล่ราคา'
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

    // 6. Multi-Turn Conversation Thread
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
ผู้ใช้ต้องการให้คุณวิเคราะห์และให้คำปรึกษาการลงทุนแบบ "ครอบคลุมรอบด้าน 360 องศา" โดยต้องดึงข้อมูลทั้งจากภายนอก (ข่าวสารตลาดโลก ข่าวรายตัว กราฟราคา สัญญาณเทคนิค) และข้อมูลภายใน (พอร์ต เงินสด ต้นทุน) มาประมวลผลร่วมกัน

=== 1. ข้อมูลข่าวสารและความเคลื่อนไหวภายนอกล่าสุด (EXTERNAL LIVE NEWS & CATALYSTS) ===
${externalNewsText}

=== 2. ข้อมูลสภาวะตลาดโลก 4 เสาหลัก (EXTERNAL MACRO CLIMATE & SENTIMENT) ===
${macroSummary}

=== 3. ข้อมูลกราฟเทคนิคและกรอบราคาภายนอกรายตัว (EXTERNAL TECHNICAL CHART PROFILES) ===
${detailedHoldingsText || 'ไม่มีหุ้นในพอร์ต'}

=== 4. ข้อมูลพอร์ตโฟลิโอภายในของนักลงทุน (INTERNAL PORTFOLIO DNA) ===
- สกุลเงินหลัก: ${baseCurrency}
- มูลค่าสินทรัพย์รวมในพอร์ต: ${totalPortfolioValue.toLocaleString()} ${baseCurrency}
- เงินสดสำรองรวม (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (${cashPercent.toFixed(
      1
    )}% ของความมั่งคั่งรวม | สภาวะนี้แนะนำถือเงินสดประมาณ 25%)
- การกระจุกตัว: ${
      techAiAllocationPercent > 50
        ? `🚨 พอร์ตมีความเสี่ยงกระจุกตัวสูงมากในกลุ่ม US Tech & AI (${techAiAllocationPercent.toFixed(
            1
          )}% ของพอร์ต)`
        : `กระจายตัวปกติ (Tech & AI: ${techAiAllocationPercent.toFixed(1)}%)`
    }

${previousHistoryText}

=== คำถามล่าสุดของผู้ใช้ ===
"${activeQuestion}"

=== กฎเหล็กการวิเคราะห์แบบรอบด้าน (360° INSTITUTIONAL ADVISORY STANDARDS) ===
1. ต้องดึง "ข่าวสารภายนอกล่าสุด (External News & Catalysts)" มาอ้างอิงเสมอ:
   - ห้ามตอบโดยอิงแค่ตัวเลขสัดส่วนในพอร์ตเท่านั้น! ผู้ใช้ต้องการรู้ว่าโลกภายนอก ข่าวในตลาด Wall Street และข่าวของหุ้นแต่ละตัวกำลังเกิดอะไรขึ้น
   - คุณต้องหยิบยกประเด็นข่าวจริงที่ให้ไว้ข้างบน (เช่น ข่าว AI Chips ของ Google/Nvidia, ข่าวเม็ดเงิน ETF ไหลเข้า, ข่าว Bond Yield พุ่งแรง, นโยบาย Fed, หรือคดีผูกขาด) มาอธิบายว่าข่าวนี้ส่งผลเชิงบวกหรือเชิงลบต่อราคาและพื้นฐานหุ้นอย่างไร
2. ต้องวิเคราะห์ "โครงสร้างกราฟราคาภายนอก (Technical Chart Analysis)" อย่างชัดเจน:
   - ต้องอ้างอิงตัวเลขทางเทคนิคจริง: ระดับราคา, ระยะย่อตัวจากจุดสูงสุด 52 สัปดาห์ (% Drawdown), ค่าโมเมนตัม Wilder's RSI(14), ตำแหน่งราคาเทียบกับเส้นค่าเฉลี่ย SMA 50 / SMA 200 วัน, และจุดแนวรับ Pivot S1/S2 กับแนวต้าน R1
   - อธิบายว่ากราฟตัวไหนมีสัญญาณกลับตัวหรือน่าช้อนซื้อ (Dip Buy) ตัวไหนตึงตัว หรือตัวไหนเสี่ยงหลุดแนวรับ
3. เชื่อมโยงเข้ากับพอร์ตและเงินสดจริงของผู้ใช้:
   - แนะนำการแบ่งไม้เข้าซื้อ (Tranche Plan เช่น ไม้ 1 ที่ S1, ไม้ 2 ที่ SMA 200) และต้องระบุจุดหนีไฟ (Stop Loss) เสมอ
   - สื่อสารเรื่องการกระจุกตัว 80.9% ใน Tech/AI และแนวทางบริหารความเสี่ยงหรือภาษีต่างประเทศอย่างรอบคอบ
4. กฎการจัดหน้า (Clean Formatting):
   - แบ่งหัวข้อให้ชัดเจน สบายตา มีลำดับขั้นตอน
   - ห้ามใส่เครื่องหมายดอกจัน (**) ซ้ำซ้อนหรือพร่ำเพรื่อในประโยค ให้เน้นเฉพาะตัวเลขสำคัญหรือชื่อหุ้นเท่านั้น
   - ใช้เครื่องหมายขีด (-) นำหน้ารายการ
`

    const aiResult = await callGemini({
      userId,
      prompt,
      logType: 'bucket_chat',
      systemInstruction:
        'คุณคือ Senior Chief Investment Officer (CIO) & Chartered Market Technician (CMT) ผู้เชี่ยวชาญด้านกลยุทธ์การลงทุนระดับสากล วิเคราะห์รอบด้าน 360 องศา ทั้งข่าวสารภายนอกล่าสุด (Finnhub, Bloomberg, CNBC) กราฟเทคนิคเชิงปริมาณ (RSI, SMA, Pivots, 52W Range) และโครงสร้างพอร์ตภายใน ตอบด้วยข้อมูลเชิงลึก ตัวเลขชัดเจน มีเหตุผล ตรงไปตรงมา และจัดหน้าอย่างสะอาดตา',
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
      recentNews: allNews.slice(0, 15).map((n) => ({
        id: n.id,
        symbol: n.symbol,
        headline: n.headline,
        sourceName: n.sourceName,
        sourceUrl: n.sourceUrl,
        publishedAt: n.publishedAt.toISOString(),
        sentiment: n.sentiment,
        summary: n.summary,
      })),
    })
  } catch (error: any) {
    console.error('[tactical-advisor chat error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    )
  }
}
