import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal, TechnicalSignal } from '@/lib/market-data/technical-signals'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

export const maxDuration = 45

interface MarketBenchmark {
  symbol: string
  name: string
  price: number
  changePercent: number
  currency: 'USD' | 'THB' | 'PTS'
  category: 'index' | 'crypto' | 'commodity' | 'rates'
}

export interface DailyPlanChecklistItem {
  id: string
  text: string
  done: boolean
  category?: 'routine' | 'action' | 'review'
}

export interface DailyPlanTargetAction {
  id: string
  ticker: string
  action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH'
  targetPrice?: number
  note?: string
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED'
}

function getTodayBangkokDateString(): string {
  // Returns 'YYYY-MM-DD' in Asia/Bangkok timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

const DEFAULT_CHECKLIST: DailyPlanChecklistItem[] = [
  { id: '1', text: 'ตรวจเช็กดัชนีตลาดโลกและแนวโน้มทิศทางเช้านี้', done: false, category: 'routine' },
  { id: '2', text: 'ตรวจสอบสภาพคล่องเงินสดสำรอง (Dry Powder) ในบัญชี', done: false, category: 'routine' },
  { id: '3', text: 'สแกนหุ้นในพอร์ตที่ลงมาแตะแนวรับสำคัญ (Key Support S1/SMA)', done: false, category: 'review' },
  { id: '4', text: 'วางแผนจุดรับซื้อและตั้ง Limit Order ตามกรอบราคา', done: false, category: 'action' },
  { id: '5', text: 'บันทึกสรุปผลการตัดสินใจท้ายวัน (Trading Journal)', done: false, category: 'review' },
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const queryDate = searchParams.get('date') || getTodayBangkokDateString()

  try {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    // 1. Fetch user's holdings & cash
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, currency: true },
    })

    let totalCash = 0
    for (const acc of accounts) {
      totalCash += Number(acc.cashBalance) || 0
    }

    // 2. Fetch key market benchmarks in parallel
    const [
      spxRes,
      nasdaqRes,
      setRes,
      btcRes,
      goldRes,
      usdThbRate,
    ] = await Promise.allSettled([
      yahooFinanceProvider.getQuote('S&P 500'),
      yahooFinanceProvider.getQuote('NASDAQ'),
      yahooFinanceProvider.getQuote('SET INDEX', 'TH'),
      coinGeckoProvider.getQuote('BTC'),
      yahooFinanceProvider.getQuote('GOLD'),
      getExchangeRate('USD', 'THB'),
    ])

    const benchmarks: MarketBenchmark[] = []

    if (spxRes.status === 'fulfilled' && spxRes.value) {
      benchmarks.push({
        symbol: 'S&P 500',
        name: 'ดัชนีตลาดสหรัฐฯ',
        price: spxRes.value.price,
        changePercent: spxRes.value.changePercent,
        currency: 'USD',
        category: 'index',
      })
    } else {
      benchmarks.push({ symbol: 'S&P 500', name: 'ดัชนีตลาดสหรัฐฯ', price: 5800, changePercent: 0.35, currency: 'USD', category: 'index' })
    }

    if (nasdaqRes.status === 'fulfilled' && nasdaqRes.value) {
      benchmarks.push({
        symbol: 'NASDAQ',
        name: 'หุ้นเทคโนโลยี',
        price: nasdaqRes.value.price,
        changePercent: nasdaqRes.value.changePercent,
        currency: 'USD',
        category: 'index',
      })
    } else {
      benchmarks.push({ symbol: 'NASDAQ', name: 'หุ้นเทคโนโลยี', price: 18200, changePercent: 0.65, currency: 'USD', category: 'index' })
    }

    if (setRes.status === 'fulfilled' && setRes.value) {
      benchmarks.push({
        symbol: 'SET INDEX',
        name: 'ตลาดหุ้นไทย',
        price: setRes.value.price,
        changePercent: setRes.value.changePercent,
        currency: 'PTS',
        category: 'index',
      })
    } else {
      benchmarks.push({ symbol: 'SET INDEX', name: 'ตลาดหุ้นไทย', price: 1450, changePercent: 0.12, currency: 'PTS', category: 'index' })
    }

    if (btcRes.status === 'fulfilled' && btcRes.value) {
      benchmarks.push({
        symbol: 'BTC',
        name: 'Bitcoin',
        price: btcRes.value.price,
        changePercent: btcRes.value.changePercent,
        currency: 'USD',
        category: 'crypto',
      })
    } else {
      benchmarks.push({ symbol: 'BTC', name: 'Bitcoin', price: 76500, changePercent: 1.2, currency: 'USD', category: 'crypto' })
    }

    if (goldRes.status === 'fulfilled' && goldRes.value) {
      benchmarks.push({
        symbol: 'GOLD (XAU)',
        name: 'ทองคำสปอต',
        price: goldRes.value.price,
        changePercent: goldRes.value.changePercent,
        currency: 'USD',
        category: 'commodity',
      })
    } else {
      benchmarks.push({ symbol: 'GOLD (XAU)', name: 'ทองคำสปอต', price: 2650, changePercent: -0.25, currency: 'USD', category: 'commodity' })
    }

    // 3. Compute Market Regime & Sentiment
    const spxChg = benchmarks.find((b) => b.symbol === 'S&P 500')?.changePercent || 0
    const ndxChg = benchmarks.find((b) => b.symbol === 'NASDAQ')?.changePercent || 0
    const btcChg = benchmarks.find((b) => b.symbol === 'BTC')?.changePercent || 0
    const avgEquities = (spxChg + ndxChg) / 2

    let regimeType: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE' = 'NEUTRAL'
    let regimeTitle = 'ตลาดทรงตัวในกรอบ (Consolidation)'
    let regimeDesc = 'ดัชนีเคลื่อนไหวในกรอบสะสมกำลัง แนะนำเน้นเกาะแผน DCA หรือรอจังหวะซื้อตามแนวรับสำคัญ'
    let regimeColor = 'text-cyan-400'
    let regimeBg = 'bg-cyan-500/10 border-cyan-500/20'

    if (avgEquities > 0.6) {
      regimeType = 'BULLISH'
      regimeTitle = 'เปิดรับความเสี่ยงเชิงบวก (Risk-On / Bullish)'
      regimeDesc = 'ตลาดมีโมเมนตัมบวกนำโดยกลุ่มเทคโนโลยี แนะนำถือรันเทรนด์ ไม่ควรไล่ราคาที่แนวต้าน'
      regimeColor = 'text-emerald-400'
      regimeBg = 'bg-emerald-500/10 border-emerald-500/30'
    } else if (avgEquities < -0.6) {
      regimeType = 'BEARISH'
      regimeTitle = 'ตลาดเข้าสู่โหมดระมัดระวัง (Risk-Off / Caution)'
      regimeDesc = 'แรงขายกดดันดัชนีหลัก เป็นจังหวะดีในการคัดกรองหุ้นแข็งแกร่งและเตรียมเงินสดช้อนซื้อที่แนวรับลึก'
      regimeColor = 'text-rose-400'
      regimeBg = 'bg-rose-500/10 border-rose-500/30'
    } else if (Math.abs(spxChg) > 1.5 || Math.abs(btcChg) > 4) {
      regimeType = 'VOLATILE'
      regimeTitle = 'ความผันผวนสูง (High Volatility)'
      regimeDesc = 'มีความผันผวนสูงกว่าปกติ ควรบริหารความเสี่ยงอย่างเข้มงวดและแบ่งไม้ซื้อ'
      regimeColor = 'text-amber-400'
      regimeBg = 'bg-amber-500/10 border-amber-500/30'
    }

    // 4. Scan holdings for technical signals & actionable triggers
    const triggerPromises = holdingsResult.holdings.slice(0, 15).map(async (holding) => {
      try {
        const signal = await fetchSingleTickerTechnicalSignal(holding.ticker)
        return {
          holding,
          signal,
        }
      } catch (err) {
        return {
          holding,
          signal: null as TechnicalSignal | null,
        }
      }
    })

    const holdingsWithSignals = await Promise.all(triggerPromises)

    // Actionable items: near support, oversold, or deep dip
    const actionItems = holdingsWithSignals.map(({ holding, signal }) => {
      const currentPrice = signal?.currentPrice ?? holding.currentPrice
      const s1 = signal?.supportS1 ?? null
      const r1 = signal?.resistanceR1 ?? null
      const sma50 = signal?.sma50 ?? null
      const rsi14 = signal?.rsi14 ?? null
      const pullback = signal?.pullbackFromHigh ?? 0

      let distanceToS1Percent: number | null = null
      if (s1 && currentPrice > 0) {
        distanceToS1Percent = Number((((currentPrice - s1) / currentPrice) * 100).toFixed(1))
      }

      let distanceToR1Percent: number | null = null
      if (r1 && currentPrice > 0) {
        distanceToR1Percent = Number((((r1 - currentPrice) / currentPrice) * 100).toFixed(1))
      }

      let actionPriority: 'HIGH' | 'MEDIUM' | 'NORMAL' = 'NORMAL'
      let actionTag = 'ถือตามรอบปกติ'
      let actionTagColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20'

      if (signal?.signalType === 'STRONG_DIP_BUY') {
        actionPriority = 'HIGH'
        actionTag = '🎯 จุดช้อนซื้อได้เปรียบสูง (Dip Buy)'
        actionTagColor = 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
      } else if (signal?.signalType === 'NEAR_SUPPORT' || (distanceToS1Percent !== null && distanceToS1Percent <= 2)) {
        actionPriority = 'HIGH'
        actionTag = '🟢 ทดสอบแนวรับสำคัญ (จ่อ S1)'
        actionTagColor = 'text-teal-300 bg-teal-500/15 border-teal-500/30'
      } else if (signal?.signalType === 'OVERBOUGHT_RESISTANCE') {
        actionPriority = 'MEDIUM'
        actionTag = '⚠️ ใกล้แนวต้าน / งดไล่ราคา'
        actionTagColor = 'text-amber-300 bg-amber-500/15 border-amber-500/30'
      } else if (pullback <= -12) {
        actionPriority = 'MEDIUM'
        actionTag = `📉 ย่อตัวแรง ${pullback.toFixed(1)}%`
        actionTagColor = 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30'
      }

      return {
        ticker: holding.ticker,
        assetName: holding.assetName,
        market: holding.market,
        currency: holding.currency,
        currentPrice,
        unrealizedPnLPercent: holding.unrealizedPnLPercent,
        allocationPercent: holding.allocationPercent,
        currentValueBase: holding.currentValueBase,
        rsi14,
        supportS1: s1,
        resistanceR1: r1,
        sma50,
        pullbackFromHigh: pullback,
        distanceToS1Percent,
        distanceToR1Percent,
        signalType: signal?.signalType || 'NEUTRAL',
        badgeText: signal?.badgeText || 'ปกติ',
        badgeClass: signal?.badgeClass || '',
        actionPriority,
        actionTag,
        actionTagColor,
        technicalReason: signal?.technicalReason || 'ราคาทรงตัวในกรอบปกติ',
      }
    })

    // Sort by action priority (HIGH first, then MEDIUM, then allocation)
    actionItems.sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, NORMAL: 1 }
      if (rank[b.actionPriority] !== rank[a.actionPriority]) {
        return rank[b.actionPriority] - rank[a.actionPriority]
      }
      return b.allocationPercent - a.allocationPercent
    })

    // 5. Fetch or initialize DailyPlan from Database
    const existingPlan = await prisma.dailyPlan.findUnique({
      where: {
        userId_planDate: {
          userId,
          planDate: queryDate,
        },
      },
    })

    const checklist: DailyPlanChecklistItem[] =
      (existingPlan?.checklist as unknown as DailyPlanChecklistItem[]) || DEFAULT_CHECKLIST

    const targetActions: DailyPlanTargetAction[] =
      (existingPlan?.targetActions as unknown as DailyPlanTargetAction[]) || []

    // 6. Fetch latest AI brief for daily plan
    const latestAiLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: 'AI Daily Investment Strategist' },
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    return NextResponse.json({
      planDate: queryDate,
      isToday: queryDate === getTodayBangkokDateString(),
      baseCurrency,
      totalPortfolioValue: holdingsResult.totalValueBase + totalCash,
      investedValue: holdingsResult.totalValueBase,
      totalCash,
      marketOverview: {
        regime: {
          type: regimeType,
          title: regimeTitle,
          description: regimeDesc,
          color: regimeColor,
          bg: regimeBg,
        },
        benchmarks,
        usdThbRate: typeof usdThbRate === 'number' ? usdThbRate : 33.5,
      },
      portfolioTriggers: actionItems,
      plan: {
        id: existingPlan?.id || null,
        marketBias: existingPlan?.marketBias || regimeType,
        notes: existingPlan?.notes || '',
        checklist,
        targetActions,
        updatedAt: existingPlan?.updatedAt || null,
      },
      aiBriefing: latestAiLog
        ? {
            text: latestAiLog.response,
            modelUsed: latestAiLog.modelUsed,
            updatedAt: latestAiLog.createdAt,
          }
        : null,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[GET /api/daily-plan error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load daily plan' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const planDate = body.planDate || getTodayBangkokDateString()
    const { marketBias, notes, checklist, targetActions } = body

    const updated = await prisma.dailyPlan.upsert({
      where: {
        userId_planDate: {
          userId,
          planDate,
        },
      },
      update: {
        ...(marketBias !== undefined && { marketBias }),
        ...(notes !== undefined && { notes }),
        ...(checklist !== undefined && { checklist }),
        ...(targetActions !== undefined && { targetActions }),
      },
      create: {
        userId,
        planDate,
        marketBias: marketBias || 'NEUTRAL',
        notes: notes || '',
        checklist: checklist || DEFAULT_CHECKLIST,
        targetActions: targetActions || [],
      },
    })

    return NextResponse.json({
      success: true,
      plan: updated,
    })
  } catch (error: any) {
    console.error('[POST /api/daily-plan error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save daily plan' },
      { status: 500 }
    )
  }
}
