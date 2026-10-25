import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
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
    // 2. Fetch benchmarks once for all users to save bandwidth
    const [spxRes, ndxRes, setRes, btcRes, goldRes, fxRes] = await Promise.allSettled([
      yahooFinanceProvider.getQuote('^GSPC'),
      yahooFinanceProvider.getQuote('^IXIC'),
      yahooFinanceProvider.getQuote('^SET.BK'),
      coinGeckoProvider.getQuote('BTC'),
      yahooFinanceProvider.getQuote('GC=F'),
      getExchangeRate('USD', 'THB'),
    ])

    const benchmarks: Array<{ symbol: string; name: string; price: number; changePercent: number }> = []

    if (spxRes.status === 'fulfilled' && spxRes.value) {
      benchmarks.push({ symbol: 'S&P 500', name: 'ดัชนี S&P 500', price: spxRes.value.price, changePercent: spxRes.value.changePercent })
    }
    if (ndxRes.status === 'fulfilled' && ndxRes.value) {
      benchmarks.push({ symbol: 'NASDAQ', name: 'ดัชนีแนสแด็ก', price: ndxRes.value.price, changePercent: ndxRes.value.changePercent })
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

    const spxChg = benchmarks.find((b) => b.symbol === 'S&P 500')?.changePercent || 0
    const ndxChg = benchmarks.find((b) => b.symbol === 'NASDAQ')?.changePercent || 0
    const avgEquities = (spxChg + ndxChg) / 2

    let regimeTitle = 'ตลาดทรงตัวในกรอบ (Consolidation)'
    if (avgEquities > 0.6) regimeTitle = 'เปิดรับความเสี่ยงเชิงบวก (Risk-On / Bullish)'
    else if (avgEquities < -0.6) regimeTitle = 'ตลาดเข้าสู่โหมดระมัดระวัง (Risk-Off / Caution)'

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
[AI Daily Investment Strategist — วางแผนปฏิบัติการประจำวัน]
คุณคือ "Chief Investment Strategist" มืออาชีพ จงสรุปบทวิเคราะห์ทิศทางตลาดวันนี้ และจัดทำแผนปฏิบัติการลงทุนรายวัน (Daily Actionable Game Plan) เฉพาะสำหรับพอร์ตการลงทุนนี้ วันที่ ${todayStr}:

[ข้อมูลสภาวะตลาดวันนี้]
- สถานะตลาด (Market Regime): ${regimeTitle}
- ดัชนีหลักชี้นำ: ${benchmarksSummary}

[ภาพรวมพอร์ตโฟลิโอ]
- มูลค่าพอร์ตรวม: ${Number(holdingsResult.totalValueBase).toLocaleString()} ${baseCurrency}

[สินทรัพย์ในพอร์ตที่ส่งสัญญาณเทคนิคัลวันนี้ (Holdings with Technical Signals)]
${triggerLines.join('\n')}

[กฎเหล็กระดับมืออาชีพ — มาตรฐานการเงินสากล]:
- ต้องระบุชื่อสินทรัพย์ทุกตัวด้วย "สัญลักษณ์ย่อของหุ้น (Ticker Symbol)" ภาษาอังกฤษตัวพิมพ์ใหญ่เสมอ (เช่น NVDA, AAPL, SCHD, VOO, GOOGL, SCB, PTT, DELTA, BTC, GOLD)
- ในส่วนที่ 2: ให้ขึ้นต้นแต่ละบรรทัดด้วยรูปแบบ: - **TICKER ($ราคา หรือ ฿ราคา | RSI: xx | S1: $xx หรือ ฿xx):** รายละเอียด
- ในส่วนที่ 3: ให้ระบุ Ticker ให้ชัดเจนในแต่ละข้อปฏิบัติ เช่น "1. **ตั้งรับ NVDA ที่แนวรับ $118:** ..."

กรุณาเขียนบทวิเคราะห์และแผนปฏิบัติการรายวันเป็นภาษาไทยที่กระชับ คมชัด และลงมือทำได้จริง โดยแบ่งเป็น 3 ส่วนชัดเจน:
1. 🧭 **ทิศทางตลาดและบรรยากาศมหภาควันนี้ (Market Regime & Macro Pulse)**: สรุปภาพรวมทิศทางดัชนีหลัก และปัจจัยที่ต้องจับตาในคืนนี้/วันนี้ (2-3 บรรทัด)
2. 🎯 **วิเคราะห์เจาะจงสินทรัพย์ในพอร์ต (Key Support & Triggers)**: วิเคราะห์ว่าหุ้น/สินทรัพย์ตัวไหนในพอร์ตลงมาถึงจุดน่าสนใจ หรือตัวไหนควรชะลอการซื้อ พร้อมระบุราคาแนวรับ S1 และระดับ RSI
3. 📋 **แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้ (Today's 3 Execution Steps)**: ให้เขียนเป็น 3 ข้อ bullet สั้นๆ ที่ผู้ใช้สามารถนำไปติ๊กทำใน Daily Checklist ได้ทันที
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
