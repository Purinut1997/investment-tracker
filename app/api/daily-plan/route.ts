import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal, TechnicalSignal } from '@/lib/market-data/technical-signals'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { fetchRealHumanSentiment } from '@/lib/market-data/fear-greed'

export const maxDuration = 45

interface MarketBenchmark {
  symbol: string
  name: string
  price: number
  changePercent: number
  change?: number
  high?: number
  low?: number
  previousClose?: number
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

    // 2. Fetch key market benchmarks and real human sentiment in parallel
    const [
      spxRes,
      nasdaqRes,
      setRes,
      btcRes,
      goldRes,
      vixRes,
      usdThbRate,
      fearGreedRes,
      dxyRes,
      tnxRes,
    ] = await Promise.allSettled([
      yahooFinanceProvider.getQuote('S&P 500'),
      yahooFinanceProvider.getQuote('NASDAQ'),
      yahooFinanceProvider.getQuote('SET INDEX', 'TH'),
      coinGeckoProvider.getQuote('BTC'),
      yahooFinanceProvider.getQuote('GOLD'),
      yahooFinanceProvider.getQuote('VIX'),
      getExchangeRate('USD', 'THB'),
      fetchRealHumanSentiment(),
      yahooFinanceProvider.getQuote('DXY'),
      yahooFinanceProvider.getQuote('US10Y'),
    ])

    const benchmarks: MarketBenchmark[] = []

    if (spxRes.status === 'fulfilled' && spxRes.value) {
      benchmarks.push({
        symbol: 'S&P 500',
        name: 'ดัชนีตลาดสหรัฐฯ',
        price: spxRes.value.price,
        changePercent: spxRes.value.changePercent,
        change: spxRes.value.change,
        high: spxRes.value.high,
        low: spxRes.value.low,
        previousClose: spxRes.value.previousClose,
        currency: 'USD',
        category: 'index',
      })
    } else {
      benchmarks.push({
        symbol: 'S&P 500',
        name: 'ดัชนีตลาดสหรัฐฯ',
        price: 5800,
        changePercent: 0.35,
        change: 20.3,
        high: 5825,
        low: 5790,
        previousClose: 5779.7,
        currency: 'USD',
        category: 'index',
      })
    }

    if (nasdaqRes.status === 'fulfilled' && nasdaqRes.value) {
      benchmarks.push({
        symbol: 'NASDAQ',
        name: 'หุ้นเทคโนโลยี',
        price: nasdaqRes.value.price,
        changePercent: nasdaqRes.value.changePercent,
        change: nasdaqRes.value.change,
        high: nasdaqRes.value.high,
        low: nasdaqRes.value.low,
        previousClose: nasdaqRes.value.previousClose,
        currency: 'USD',
        category: 'index',
      })
    } else {
      benchmarks.push({
        symbol: 'NASDAQ',
        name: 'หุ้นเทคโนโลยี',
        price: 18200,
        changePercent: 0.65,
        change: 118.3,
        high: 18280,
        low: 18140,
        previousClose: 18081.7,
        currency: 'USD',
        category: 'index',
      })
    }

    if (setRes.status === 'fulfilled' && setRes.value) {
      benchmarks.push({
        symbol: 'SET INDEX',
        name: 'ตลาดหุ้นไทย',
        price: setRes.value.price,
        changePercent: setRes.value.changePercent,
        change: setRes.value.change,
        high: setRes.value.high,
        low: setRes.value.low,
        previousClose: setRes.value.previousClose,
        currency: 'PTS',
        category: 'index',
      })
    } else {
      benchmarks.push({
        symbol: 'SET INDEX',
        name: 'ตลาดหุ้นไทย',
        price: 1450,
        changePercent: 0.12,
        change: 1.74,
        high: 1456,
        low: 1445,
        previousClose: 1448.26,
        currency: 'PTS',
        category: 'index',
      })
    }

    if (btcRes.status === 'fulfilled' && btcRes.value) {
      benchmarks.push({
        symbol: 'BTC',
        name: 'Bitcoin',
        price: btcRes.value.price,
        changePercent: btcRes.value.changePercent,
        change: btcRes.value.change,
        high: btcRes.value.high,
        low: btcRes.value.low,
        previousClose: btcRes.value.previousClose,
        currency: 'USD',
        category: 'crypto',
      })
    } else {
      benchmarks.push({
        symbol: 'BTC',
        name: 'Bitcoin',
        price: 76500,
        changePercent: 1.2,
        change: 918,
        high: 77200,
        low: 75400,
        previousClose: 75582,
        currency: 'USD',
        category: 'crypto',
      })
    }

    if (goldRes.status === 'fulfilled' && goldRes.value) {
      benchmarks.push({
        symbol: 'GOLD (XAU)',
        name: 'ทองคำสปอต',
        price: goldRes.value.price,
        changePercent: goldRes.value.changePercent,
        change: goldRes.value.change,
        high: goldRes.value.high,
        low: goldRes.value.low,
        previousClose: goldRes.value.previousClose,
        currency: 'USD',
        category: 'commodity',
      })
    } else {
      benchmarks.push({
        symbol: 'GOLD (XAU)',
        name: 'ทองคำสปอต',
        price: 2650,
        changePercent: -0.25,
        change: -6.62,
        high: 2665,
        low: 2642,
        previousClose: 2656.62,
        currency: 'USD',
        category: 'commodity',
      })
    }

    if (vixRes.status === 'fulfilled' && vixRes.value) {
      benchmarks.push({
        symbol: 'VIX',
        name: 'ความกลัวตลาด',
        price: vixRes.value.price,
        changePercent: vixRes.value.changePercent,
        change: vixRes.value.change,
        high: vixRes.value.high,
        low: vixRes.value.low,
        previousClose: vixRes.value.previousClose,
        currency: 'PTS',
        category: 'index',
      })
    } else {
      benchmarks.push({
        symbol: 'VIX',
        name: 'ความกลัวตลาด',
        price: 17.5,
        changePercent: -1.15,
        change: -0.2,
        high: 18.2,
        low: 17.1,
        previousClose: 17.7,
        currency: 'PTS',
        category: 'index',
      })
    }

    // 3. Compute Real Market Sentiment & Quantitative Signals
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

    const spxChg = benchmarks.find((b) => b.symbol === 'S&P 500')?.changePercent || 0
    const ndxChg = benchmarks.find((b) => b.symbol === 'NASDAQ')?.changePercent || 0
    const btcChg = benchmarks.find((b) => b.symbol === 'BTC')?.changePercent || 0
    const vixBenchmark = benchmarks.find((b) => b.symbol === 'VIX')
    const vixPrice = vixBenchmark?.price || 17.5
    const avgEquities = (spxChg + ndxChg) / 2

    // Real Human Sentiment Score directly from CNN Fear & Greed Index
    const regimeScore = fearGreed.score

    let regimeType: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE' = 'NEUTRAL'
    let regimeTitle = 'ตลาดทรงตัวในกรอบ (Consolidation)'
    let regimeDesc = 'ดัชนีเคลื่อนไหวในกรอบสะสมกำลัง แนะนำเน้นเกาะแผน DCA หรือรอจังหวะซื้อตามแนวรับสำคัญ'
    let regimeColor = 'text-yellow-400'
    let regimeBg = 'bg-yellow-500/15 border-yellow-500/30'
    let tierLabel = 'สมดุล (Neutral)'

    let playbook = {
      donts: [
        'ห้าม Panic Sell ตามอารมณ์กลัวของคนส่วนใหญ่ในตลาด',
        'ห้ามไล่ราคาตอนตลาดเด้งเขียวระยะสั้น (Dead-Cat Bounce)',
      ],
      dos: [
        'ถือเงินสดสำรอง (Dry Powder) 15-20% เพื่อรักษาความได้เปรียบ',
        'ตั้ง Limit Order รอรับเฉพาะสินทรัพย์พื้นฐานแข็งแกร่งที่แตะแนวรับสำคัญ S1',
      ],
    }

    if (regimeScore <= 25) {
      regimeType = 'BEARISH'
      regimeTitle = 'ตลาดกลัวจัด / ระมัดระวังสูงสุด (Extreme Fear)'
      regimeDesc = `ดัชนีอารมณ์มนุษย์ (CNN Fear & Greed: ${regimeScore}) ตกสู่ระดับกลัวจัด ผู้เล่นในตลาดตื่นตระหนก ไม่ควร Panic Sell ตามมวลชน และห้ามรีบรับมีด เน้นถือเงินสดสำรอง 20-30% รอตั้งรับเฉพาะสินทรัพย์พื้นฐานแกร่งที่ Oversold แตะแนวรับสำคัญ S1`
      regimeColor = 'text-rose-400'
      regimeBg = 'bg-rose-500/15 border-rose-500/40'
      tierLabel = 'กลัวจัด (Extreme Fear)'
      playbook = {
        donts: [
          'ห้าม Panic Sell เทขายที่ก้นเหวตามอารมณ์ตื่นตระหนกของตลาด',
          'ห้ามรีบ All-in รับมีดที่กำลังร่วงแรงโดยไม่มีจุด Stop Loss',
        ],
        dos: [
          'ถือเงินสดสำรอง 20-30% ไว้ช้อนซื้อสินทรัพย์คุณภาพในราคาลดกระหน่ำ',
          'แบ่งไม้ซื้อเฉพาะหุ้นที่มี RSI < 30 และลงมาทดสอบแนวรับประวัติศาสตร์ S1',
        ],
      }
    } else if (regimeScore <= 45) {
      regimeType = 'BEARISH'
      regimeTitle = 'ตลาดเข้าสู่โหมดระมัดระวัง (Human Fear)'
      regimeDesc = `ดัชนีอารมณ์มนุษย์ (CNN Fear & Greed Index: ${regimeScore}) สะท้อนว่านักลงทุนส่วนใหญ่กังวลต่อความเสี่ยงมหภาค แม้จะมีแรงรีบาวด์สลับ ห้ามไล่ราคาตอนเด้งเขียว (Dead-Cat Bounce) ควรถือเงินสดสำรอง 15-20% และตั้ง Limit Order รอรับเฉพาะแนวรับสำคัญที่ได้เปรียบ`
      regimeColor = 'text-orange-400'
      regimeBg = 'bg-orange-500/15 border-orange-500/30'
      tierLabel = 'ระวัง / วิตกกังวล (Fear)'
      playbook = {
        donts: [
          'ห้าม Panic Sell ตามอารมณ์กลัวชั่วคราว',
          'ห้าม FOMO ไล่ซื้อตอนตลาดเด้งเขียวสลับ (เสี่ยงเจอกับดัก Dead-Cat Bounce)',
        ],
        dos: [
          'สำรองเงินสด (Dry Powder) 15-20% เตรียมพร้อมรับมือความผันผวน',
          'ตั้ง Limit Order รอรับเฉพาะสินทรัพย์ที่ย่อตัวลงมาใกล้แนวรับ S1 เท่านั้น',
        ],
      }
    } else if (regimeScore <= 55) {
      regimeType = 'NEUTRAL'
      regimeTitle = 'ตลาดสมดุล / ลังเลรอดูทิศทาง (Human Neutral)'
      regimeDesc = `ดัชนีอารมณ์มนุษย์ (CNN Fear & Greed Index: ${regimeScore}) อยู่ในระดับสมดุล ตลาดไม่มีความโลภหรือความกลัวสุดโต่ง แนะนำเกาะแผน DCA ตามรอบปกติ`
      regimeColor = 'text-yellow-400'
      regimeBg = 'bg-yellow-500/15 border-yellow-500/30'
      tierLabel = 'สมดุล (Neutral)'
      playbook = {
        donts: [
          'ห้ามเทรดเกินขนาดพอร์ตหรือ Overtrade ในช่วงตลาดไร้ทิศทางชัดเจน',
        ],
        dos: [
          'เกาะวินัยการออมและการลงทุนแบบ DCA ตามแผนประจำเดือน',
          'รีวิวสัดส่วนพอร์ต (Rebalance) หากมีสินทรัพย์ใดเบี่ยงเบนจากเป้าหมาย',
        ],
      }
    } else if (regimeScore <= 75) {
      regimeType = 'BULLISH'
      regimeTitle = 'เปิดรับความเสี่ยงเชิงบวก (Human Greed)'
      regimeDesc = `ดัชนีอารมณ์มนุษย์ (CNN Fear & Greed Index: ${regimeScore}) มีความมั่นใจและกล้าเสี่ยงสูง โมเมนตัมตลาดเป็นบวก แนะนำถือรันเทรนด์ ห้ามไล่ราคาที่แนวต้าน`
      regimeColor = 'text-emerald-400'
      regimeBg = 'bg-emerald-500/15 border-emerald-500/30'
      tierLabel = 'เปิดรับเสี่ยง (Greed / Risk-On)'
      playbook = {
        donts: [
          'ห้ามไล่ราคาซื้อหุ้นหรือเหรียญที่วิ่งขึ้นไปใกล้แนวต้าน R1/R2',
        ],
        dos: [
          'ถือรันเทรนด์ (Let Profits Run) โดยขยับ Trailing Stop ตามขึ้นไป',
          'ทยอยล็อกกำไรบางส่วนสำหรับสินทรัพย์ที่ราคาขึ้นชนเป้าหมาย',
        ],
      }
    } else {
      regimeType = 'BULLISH'
      regimeTitle = 'ตลาดโลภจัด / ร้อนแรงเกินพิกัด (Extreme Greed)'
      regimeDesc = `ดัชนีอารมณ์มนุษย์ (CNN Fear & Greed Index: ${regimeScore}) พุ่งแตะระดับโลภจัด (Extreme Greed) ตลาดร้อนแรงเกินปกติ เสี่ยงต่อการปรับฐานรุนแรง แนะนำล็อกกำไรและเตรียมเงินสด`
      regimeColor = 'text-cyan-300'
      regimeBg = 'bg-cyan-500/15 border-cyan-500/40'
      tierLabel = 'โลภจัด (Extreme Greed)'
      playbook = {
        donts: [
          'ห้ามเปิดออเดอร์ซื้อใหม่ด้วยเงินก้อนใหญ่ที่บริเวณดอย',
          'ห้ามประมาทคิดว่าตลาดจะขึ้นไปเรื่อยๆ โดยไม่มีการย่อ',
        ],
        dos: [
          'ล็อกกำไร 15-30% เข้ากระเป๋าและถือเงินสดเพิ่มขึ้น',
          'ตั้ง Stop-loss / Trailing Stop อย่างเคร่งครัดเพื่อปกป้องกำไร',
        ],
      }
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
          fearGreed: {
            score: fearGreed.score,
            rating: fearGreed.rating,
            ratingLabelTh: fearGreed.ratingLabelTh,
            previousClose: fearGreed.previousClose,
            previous1Week: fearGreed.previous1Week,
            source: fearGreed.source,
          },
          playbook,
          drivers: {
            equityMomentum: avgEquities,
            vixPrice,
            btcChange: btcChg,
          },
        },
        benchmarks,
        usdThbRate: typeof usdThbRate === 'number' ? usdThbRate : 33.5,
        macro: {
          dxy: {
            price: dxyRes.status === 'fulfilled' && dxyRes.value ? dxyRes.value.price : 104.18,
            changePercent: dxyRes.status === 'fulfilled' && dxyRes.value ? dxyRes.value.changePercent : 0.12,
          },
          tnx: {
            price: tnxRes.status === 'fulfilled' && tnxRes.value ? tnxRes.value.price : 4.24,
            changePercent: tnxRes.status === 'fulfilled' && tnxRes.value ? tnxRes.value.changePercent : -0.05,
          },
        },
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
