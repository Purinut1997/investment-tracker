import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { fetchRealHumanSentiment } from '@/lib/market-data/fear-greed'
import { callGemini } from '@/lib/ai/gemini-client'

export const maxDuration = 60

function getTodayBangkokDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

export async function GET(req: NextRequest) {
  // 1. Verify CRON_SECRET if configured
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  const todayStr = getTodayBangkokDateString()
  const results = {
    date: todayStr,
    usersChecked: 0,
    briefsGenerated: 0,
    skippedAlreadyGenerated: 0,
    errors: [] as string[],
    timestamp: new Date().toISOString(),
  }

  try {
    // 2. Fetch benchmarks and real human sentiment once for all users to save bandwidth
    const [spxRes, ndxRes, vixRes, setRes, btcRes, goldRes, fxRes, fearGreedRes] = await Promise.allSettled([
      yahooFinanceProvider.getQuote('^GSPC'),
      yahooFinanceProvider.getQuote('^IXIC'),
      yahooFinanceProvider.getQuote('^VIX'),
      yahooFinanceProvider.getQuote('^SET.BK'),
      coinGeckoProvider.getQuote('BTC'),
      yahooFinanceProvider.getQuote('GC=F'),
      getExchangeRate('USD', 'THB'),
      fetchRealHumanSentiment(),
    ])

    const fearGreed =
      fearGreedRes.status === 'fulfilled' && fearGreedRes.value
        ? fearGreedRes.value
        : {
            score: 35,
            rating: 'fear' as const,
            ratingLabelTh: 'ตลาดกังวล / ระมัดระวัง (Fear)',
            previousClose: 34,
            previous1Week: 31,
            previous1Month: 32,
            timestamp: new Date().toISOString(),
            source: 'CALCULATED_FALLBACK' as const,
          }

    const benchmarks: Array<{ symbol: string; name: string; price: number; changePercent: number }> = []

    if (spxRes.status === 'fulfilled' && spxRes.value) {
      benchmarks.push({ symbol: 'S&P 500', name: 'ดัชนี S&P 500', price: spxRes.value.price, changePercent: spxRes.value.changePercent })
    }
    if (ndxRes.status === 'fulfilled' && ndxRes.value) {
      benchmarks.push({ symbol: 'NASDAQ', name: 'ดัชนีแนสแด็ก', price: ndxRes.value.price, changePercent: ndxRes.value.changePercent })
    }
    const vixPrice = vixRes.status === 'fulfilled' && vixRes.value ? vixRes.value.price : 17.5
    if (vixRes.status === 'fulfilled' && vixRes.value) {
      benchmarks.push({ symbol: 'VIX', name: 'ดัชนีความกลัวตลาด', price: vixRes.value.price, changePercent: vixRes.value.changePercent })
    }
    if (setRes.status === 'fulfilled' && setRes.value) {
      benchmarks.push({ symbol: 'SET Index', name: 'ตลาดหุ้นไทย', price: setRes.value.price, changePercent: setRes.value.changePercent })
    }
    if (btcRes.status === 'fulfilled' && btcRes.value) {
      benchmarks.push({ symbol: 'BTC', name: 'Bitcoin', price: btcRes.value.price, changePercent: btcRes.value.changePercent })
    }
    if (goldRes.status === 'fulfilled' && goldRes.value) {
      benchmarks.push({ symbol: 'GOLD (XAU)', name: 'ทองคำสปอต', price: goldRes.value.price, changePercent: goldRes.value.changePercent })
    }

    const regimeScore = fearGreed.score
    let regimeTitle = 'ตลาดทรงตัวในกรอบ (Consolidation)'
    if (regimeScore <= 25) {
      regimeTitle = 'ตลาดกลัวจัด / ระมัดระวังสูงสุด (Extreme Fear)'
    } else if (regimeScore <= 45) {
      regimeTitle = 'ตลาดเข้าสู่โหมดระมัดระวัง (Human Fear)'
    } else if (regimeScore <= 55) {
      regimeTitle = 'ตลาดสมดุล / ลังเลรอดูทิศทาง (Human Neutral)'
    } else if (regimeScore <= 75) {
      regimeTitle = 'เปิดรับความเสี่ยงเชิงบวก (Human Greed)'
    } else {
      regimeTitle = 'ตลาดร้อนแรงเกินพิกัด (Extreme Greed / Overbought)'
    }

    const benchmarksSummary = benchmarks
      .map((b) => `${b.symbol}: ${b.price?.toLocaleString()} (${b.changePercent >= 0 ? '+' : ''}${b.changePercent?.toFixed(2)}%)`)
      .join(', ')

    // 3. Find active users with transactions
    const distinctUsers = await prisma.transaction.findMany({
      select: { userId: true },
      distinct: ['userId'],
      take: 10,
    })

    results.usersChecked = distinctUsers.length

    for (const { userId } of distinctUsers) {
      try {
        // Check if an AI brief for today already exists in Bangkok time
        const startOfTodayBangkok = new Date(new Date().setHours(0, 0, 0, 0))
        const existingLog = await prisma.aiAdviceLog.findFirst({
          where: {
            userId,
            logType: 'advisor',
            prompt: { contains: 'AI Daily Investment Strategist' },
            createdAt: { gte: startOfTodayBangkok },
          },
        })

        if (existingLog) {
          results.skippedAlreadyGenerated++
          continue
        }

        const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
        const baseCurrency = userSettings?.baseCurrency ?? 'THB'

        // Calculate user's current holdings
        const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
        if (!holdingsResult.holdings || holdingsResult.holdings.length === 0) {
          continue
        }

        // Scan technical triggers for top holdings
        const topHoldings = holdingsResult.holdings.slice(0, 8)
        const triggerLines: string[] = []

        for (const h of topHoldings) {
          try {
            const marketHint = h.market || (h.currency === 'THB' ? 'TH' : 'US')
            const signal = await fetchSingleTickerTechnicalSignal(h.ticker, marketHint)
            const currSym = h.currency === 'THB' ? '฿' : '$'
            const s1Str = signal?.supportS1 ? `${currSym}${signal.supportS1}` : 'N/A'
            triggerLines.push(
              `- ${h.ticker} (${h.assetName}): ราคา ${currSym}${h.currentPrice} | สัดส่วน ${h.allocationPercent?.toFixed(1)}% | RSI(14): ${signal?.rsi14 ?? 'N/A'} | S1: ${s1Str} | สัญญาณ: ${signal?.badgeText || 'ถือตามรอบปกติ'}`
            )
          } catch {}
        }

        if (triggerLines.length === 0) continue

        const prompt = `
[AI Daily Investment Strategist — สรุปเช้าและแผนปฏิบัติการรายวัน]
คุณคือ Senior Portfolio Strategist สรุปทิศทางตลาดและแผนปฏิบัติการลงทุนรายวัน วันที่ ${todayStr}:

[ข้อมูลสภาวะตลาดวันนี้]
- สถานะตลาด (Market Regime): ${regimeTitle}
- ดัชนีอารมณ์มนุษย์ในตลาดจริง (CNN Fear & Greed Index): ${fearGreed.score}/100 (${fearGreed.ratingLabelTh})
- ดัชนีหลักชี้นำ: ${benchmarksSummary}

[ภาพรวมพอร์ตโฟลิโอ]
- มูลค่าพอร์ตรวม: ${Number(holdingsResult.totalValueBase).toLocaleString()} ${baseCurrency}

[สินทรัพย์ในพอร์ตที่ส่งสัญญาณเทคนิคัลวันนี้ (Holdings with Technical Signals)]
${triggerLines.join('\n')}

[กฎเหล็กการประเมินความเสี่ยงตามความเป็นจริง]:
- หากดัชนีอารมณ์มนุษย์ (CNN Fear & Greed Index) หรือสภาวะตลาดอยู่ในระดับกังวล/กลัว (Fear/Caution ต่ำกว่า 45): ห้ามมองบวกเกินจริงเด็ดขาด ให้ยึดแนวทาง 'ไม่ Panic Sell ตามฝูงชน และไม่ไล่ราคาตอนเด้งเขียว (Dead-Cat Bounce)' ควรถือเงินสดสำรองและรอรับเฉพาะแนวรับสำคัญ S1 ที่ได้เปรียบเท่านั้น

[กฎเหล็กและข้อห้ามเด็ดขาดเพื่อความกระชับสูงสุด]:
1. ห้ามใส่คำทักทายเด็ดขาด (ห้ามเขียน "เรียน ท่าน...", "สวัสดีครับ", "ยินดีต้อนรับ") ให้เริ่มต้นที่เนื้อหาส่วนที่ 1 ทันที
2. ตัดคำฟุ่มเฟือยทิ้งทั้งหมด เขียนกระชับ คม ตรงประเด็น ใช้เวลาอ่านจับใจความไม่เกิน 1 นาที
3. ต้องระบุชื่อสินทรัพย์ทุกตัวด้วย "สัญลักษณ์ย่อ Ticker Symbol" ตัวพิมพ์ใหญ่เสมอ (เช่น NVDA, AAPL, SCHD, VOO, GOOGL, SCB, PTT)

รูปแบบบทวิเคราะห์ (แบ่งเป็น 3 ส่วนชัดเจน):
1. 🧭 **ทิศทางตลาดและบรรยากาศมหภาควันนี้ (Market Regime & Macro Pulse)**: สรุปภาพรวมทิศทางดัชนีหลักและปัจจัยสำคัญใน 1-2 ประโยคสั้นๆ ให้จบใจความทันที
2. 🎯 **วิเคราะห์เจาะจงสินทรัพย์ในพอร์ต (Key Support & Triggers)**:
- ขึ้นต้นแต่ละบรรทัดด้วย: - **TICKER ($ราคา หรือ ฿ราคา | RSI: xx | S1: $xx หรือ ฿xx):** [ระบุคำแนะนำสั้นๆ 1 บรรทัดจบ เช่น ช้อนซื้อจุดได้เปรียบ Oversold / ชะลอการไล่ราคาใกล้แนวต้าน / ถือรอจังหวะ]
3. 📋 **แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้ (Today's 3 Execution Steps)**:
- 1. **[คำสั่งสั้นๆ เช่น ตั้งรับ GOOGL ที่แนวรับ $301]:** [เหตุผล 1 ประโยค]
- 2. **[คำสั่งสั้นๆ]:** [เหตุผล 1 ประโยค]
- 3. **[คำสั่งสั้นๆ]:** [เหตุผล 1 ประโยค]
`

        await callGemini({
          userId,
          prompt,
          logType: 'advisor',
          systemInstruction:
            'คุณเป็น Senior Portfolio Strategist ที่ให้คำแนะนำการลงทุนตามหลักการบริหารความเสี่ยงระดับสถาบัน ชัดเจน ตรงประเด็น ใช้ภาษาไทยเข้าใจง่าย',
        })

        results.briefsGenerated++
      } catch (userErr: any) {
        results.errors.push(`User ${userId}: ${userErr.message}`)
      }
    }

    return NextResponse.json(results)
  } catch (err: any) {
    console.error('[CRON morning-briefing error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
