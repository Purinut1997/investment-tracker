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
      vixRes,
      usdThbRate,
    ] = await Promise.allSettled([
      yahooFinanceProvider.getQuote('S&P 500'),
      yahooFinanceProvider.getQuote('NASDAQ'),
      yahooFinanceProvider.getQuote('SET INDEX', 'TH'),
      coinGeckoProvider.getQuote('BTC'),
      yahooFinanceProvider.getQuote('GOLD'),
      yahooFinanceProvider.getQuote('VIX'),
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

    if (vixRes.status === 'fulfilled' && vixRes.value) {
      benchmarks.push({
        symbol: 'VIX',
        name: 'ความกลัวตลาด',
        price: vixRes.value.price,
        changePercent: vixRes.value.changePercent,
        currency: 'PTS',
        category: 'index',
      })
    } else {
      benchmarks.push({ symbol: 'VIX', name: 'ความกลัวตลาด', price: 17.5, changePercent: -1.15, currency: 'PTS', category: 'index' })
    }

    // 3. Compute Quantitative Market Regime Score & Sentiment
    const spxChg = benchmarks.find((b) => b.symbol === 'S&P 500')?.changePercent || 0
    const ndxChg = benchmarks.find((b) => b.symbol === 'NASDAQ')?.changePercent || 0
    const btcChg = benchmarks.find((b) => b.symbol === 'BTC')?.changePercent || 0
    const vixBenchmark = benchmarks.find((b) => b.symbol === 'VIX')
    const vixPrice = vixBenchmark?.price || 17.5
    const avgEquities = (spxChg + ndxChg) / 2

    // 1. Equities Momentum (Weight 40%): baseline 20 pts at 0%
    const equityScore = Math.max(0, Math.min(40, 20 + avgEquities * 7.5))
    // 2. VIX Volatility / Fear Factor (Weight 40%, Inverted): baseline 20 pts at VIX 16.5
    const vixScore = Math.max(0, Math.min(40, 20 - (vixPrice - 16.5) * 2.5))
    // 3. Alternative / Crypto Appetite (Weight 20%): baseline 10 pts at 0%
    const btcScore = Math.max(0, Math.min(20, 10 + btcChg * 1.5))

    const compositeScore = Math.round(equityScore + vixScore + btcScore)
    let regimeScore = Math.max(5, Math.min(95, compositeScore))

    // Institutional VIX Fear Filter & Safety Cap:
    // If VIX is elevated (>= 17.0), the market CANNOT be classified as full Bullish/Risk-On!
    if (vixPrice >= 18.0 && regimeScore > 54) {
      regimeScore = 54
    } else if (vixPrice >= 17.0 && regimeScore > 58) {
      regimeScore = 58
    }

    let regimeType: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE' = 'NEUTRAL'
    let regimeTitle = 'ตลาดทรงตัวในกรอบ (Consolidation)'
    let regimeDesc = 'ดัชนีเคลื่อนไหวในกรอบสะสมกำลัง แนะนำเน้นเกาะแผน DCA หรือรอจังหวะซื้อตามแนวรับสำคัญ'
    let regimeColor = 'text-yellow-400'
    let regimeBg = 'bg-yellow-500/15 border-yellow-500/30'
    let tierLabel = 'สมดุล (Neutral)'

    if (regimeScore <= 25) {
      regimeType = 'BEARISH'
      regimeTitle = 'ตลาดกลัวจัด / ระมัดระวังสูงสุด (Extreme Risk-Off)'
      regimeDesc = 'แรงขายกดดันรุนแรง ดัชนีความกลัวพุ่งสูง แนะนำสำรองเงินสดและตั้งรับเฉพาะแนวรับลึก'
      regimeColor = 'text-rose-400'
      regimeBg = 'bg-rose-500/15 border-rose-500/40'
      tierLabel = 'กลัวจัด (Extreme Fear)'
    } else if (regimeScore <= 45) {
      regimeType = 'BEARISH'
      regimeTitle = 'ตลาดเข้าสู่โหมดระมัดระวัง (Risk-Off / Caution)'
      regimeDesc = 'แรงขายกดดันดัชนีหลัก เป็นจังหวะดีในการคัดกรองหุ้นแข็งแกร่งและเตรียมเงินสดช้อนซื้อที่แนวรับลึก'
      regimeColor = 'text-orange-400'
      regimeBg = 'bg-orange-500/15 border-orange-500/30'
      tierLabel = 'ระวัง (Caution)'
    } else if (regimeScore <= 58) {
      if (vixPrice >= 17.0 || avgEquities > 0.2) {
        regimeType = 'NEUTRAL'
        regimeTitle = 'รีบาวด์เปราะบาง / เฝ้าระวัง (Fragile Rebound)'
        regimeDesc = 'ตลาดฟื้นตัวระยะสั้น แต่ดัชนีความผันผวน (VIX) ยังอยู่ในระดับเฝ้าระวัง สะท้อนว่าตลาดยังมีความกังวลแฝงอยู่ ควรระวังการเด้งเพื่อลงต่อ ไม่ควรผลีผลามไล่ราคาที่แนวต้าน เน้นถือเงินสดสำรองไว้ก่อน'
        regimeColor = 'text-amber-400'
        regimeBg = 'bg-amber-500/15 border-amber-500/30'
        tierLabel = 'รีบาวด์เปราะบาง (Fragile)'
      } else {
        regimeType = 'NEUTRAL'
        regimeTitle = 'ตลาดทรงตัวในกรอบ (Consolidation)'
        regimeDesc = 'ดัชนีเคลื่อนไหวในกรอบสะสมกำลัง แนะนำเน้นเกาะแผน DCA หรือรอจังหวะซื้อตามแนวรับสำคัญ'
        regimeColor = 'text-yellow-400'
        regimeBg = 'bg-yellow-500/15 border-yellow-500/30'
        tierLabel = 'สมดุล (Neutral)'
      }
    } else if (regimeScore <= 78) {
      regimeType = 'BULLISH'
      regimeTitle = 'เปิดรับความเสี่ยงเชิงบวก (Risk-On / Bullish)'
      regimeDesc = 'ตลาดมีโมเมนตัมบวกนำโดยกลุ่มเทคโนโลยี แนะนำถือรันเทรนด์ ไม่ควรไล่ราคาที่แนวต้าน'
      regimeColor = 'text-emerald-400'
      regimeBg = 'bg-emerald-500/15 border-emerald-500/30'
      tierLabel = 'เปิดรับความเสี่ยง (Risk-On)'
    } else {
      regimeType = 'BULLISH'
      regimeTitle = 'ตลาดร้อนแรงเกินพิกัด (Extreme Greed / Overbought)'
      regimeDesc = 'ดัชนีวิ่งขึ้นต่อเนื่องใกล้ระดับ Overbought พิจารณาชะลอการซื้อเพิ่มและเตรียมล็อกกำไรบางส่วน'
      regimeColor = 'text-cyan-300'
      regimeBg = 'bg-cyan-500/15 border-cyan-500/40'
      tierLabel = 'ร้อนแรงมาก (Overbought)'
    }

    // 4. Scan holdings for technical signals & actionable triggers
    const triggerPromises = holdingsResult.holdings.slice(0, 15).map(async (holding) => {
      try {
        const marketHint = holding.market || (holding.currency === 'THB' ? 'TH' : 'US')
        const signal = await fetchSingleTickerTechnicalSignal(holding.ticker, marketHint)
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
          score: regimeScore,
          tierLabel,
          drivers: {
            equityMomentum: avgEquities,
            vixPrice,
            btcChange: btcChg,
          },
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
