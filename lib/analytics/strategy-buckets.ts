import { HoldingItem } from './holdings'

export type BucketStrategyType =
  | 'LONG_TERM'
  | 'DIVIDEND'
  | 'SHORT_TERM'
  | 'CASH'
  | 'CUSTOM'

export interface StrategyBucket {
  id: string
  name: string
  emoji: string
  strategyType: BucketStrategyType
  description: string
  targetPercent: number
  tickers: string[]
  takeProfitPercent?: number
  stopLossPercent?: number
  targetYieldPercent?: number
}

export interface ComputedBucketItem extends StrategyBucket {
  actualValueBase: number
  actualPercent: number
  deviationPercent: number
  unrealizedPnLBase: number
  unrealizedPnLPercent: number
  holdings: HoldingItem[]
  unheldTickers: string[]
}

export const STRATEGY_TYPE_META: Record<
  BucketStrategyType,
  {
    label: string
    shortLabel: string
    emoji: string
    badgeClass: string
    accentColor: string
    defaultDescription: string
    quickPrompts: string[]
  }
> = {
  LONG_TERM: {
    label: 'ถือยาวเพื่ออนาคต (Core Growth)',
    shortLabel: 'ถือยาวเติบโต',
    emoji: '🌱',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    accentColor: '#6366f1',
    defaultDescription:
      'เน้นสะสมหุ้นเติบโต/ETF ดัชนีหลักระยะยาว 3–10 ปี+ ใช้กลยุทธ์ DCA และช้อนเพิ่มเมื่อราคาย่อตัว',
    quickPrompts: [
      '🌱 ระยะนี้ควรทยอย DCA ตัวไหนในตะกร้านี้คุ้มสุด?',
      '⚖️ สัดส่วนหุ้นถือยาวชุดนี้สมดุลหรือยัง ควรปรับตัวไหนไหม?',
      '📉 จุดแนวรับสำคัญที่น่าช้อนไม้ใหญ่ของแต่ละตัวอยู่ที่เท่าไหร่?',
    ],
  },
  DIVIDEND: {
    label: 'เน้นปันผล & กระแสเงินสด (Dividend Income)',
    shortLabel: 'หุ้นปันผล',
    emoji: '💰',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    accentColor: '#10b981',
    defaultDescription:
      'เน้นสร้างกระแสเงินสดสม่ำเสมอ เก็บสะสมตอนราคาย่อตัวเพื่อล็อก Dividend Yield สูง และติดตามรอบ XD',
    quickPrompts: [
      '💰 จังหวะนี้ตัวไหนน่าเก็บสะสมเพื่อรับปันผลที่สุด?',
      '📊 วิเคราะห์ความคุ้มค่าของต้นทุนและปันผลในตะกร้านี้ให้หน่อย',
      '🔄 ควรเพิ่มหรือลดสัดส่วนหุ้นปันผลตัวไหนเพื่อลดความเสี่ยง?',
    ],
  },
  SHORT_TERM: {
    label: 'เก็งกำไรระยะสั้น / จับจังหวะ (Short-Term Swing)',
    shortLabel: 'เก็งกำไรสั้น',
    emoji: '⚡',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    accentColor: '#f59e0b',
    defaultDescription:
      'เน้นจับจังหวะรอบสั้น–กลาง ซื้อใกล้แนวรับ S1 ขายทำกำไรใกล้แนวต้าน R1 พร้อมจุดตัดขาดทุนชัดเจน',
    quickPrompts: [
      '⚡ ระยะนี้ควรเล่นแบบไหน ตัวไหนน่าเข้าเก็งกำไรสั้น?',
      '🎯 ตัวไหนในตะกร้านี้ควรแบ่งขายทำกำไร (Take Profit) ได้แล้ว?',
      '🛡️ เช็กแนวรับ S1 แนวต้าน R1 และจุดคัทลอส (Stop Loss) รายตัว',
    ],
  },
  CASH: {
    label: 'กระสุนเงินสดสำรอง (Dry Powder & Yield)',
    shortLabel: 'เงินสดสำรอง',
    emoji: '💵',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    accentColor: '#06b6d4',
    defaultDescription:
      'เงินสดสำรองพร้อมช้อนเมื่อตลาดปรับฐาน และรับดอกเบี้ยเงินฝากสกุลเงินต่างประเทศ (เช่น Dime! Save / USD)',
    quickPrompts: [
      '💵 เงินสดสำรองตอนนี้เพียงพอไหม ควรแบ่งออกมาช้อนตลาดกี่ %?',
      '🧭 สภาวะตลาดแบบนี้ควรถือเงินสดรอก่อนหรือทยอยเข้าซื้อ?',
    ],
  },
  CUSTOM: {
    label: 'พอร์ตกลยุทธ์กำหนดเอง (Custom Strategy)',
    shortLabel: 'กลยุทธ์เฉพาะ',
    emoji: '🎯',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    accentColor: '#8b5cf6',
    defaultDescription: 'จัดกลุ่มสินทรัพย์ตามเป้าหมายเฉพาะตัวของคุณ',
    quickPrompts: [
      '🎯 ระยะนี้พอร์ตส่วนนี้ควรวางแผนเล่นแบบไหนดี?',
      '⚖️ มีตัวไหนควรซื้อเพิ่มหรือขายลดความเสี่ยงไหม?',
      '💡 ขอแผนจัดการพอร์ตส่วนนี้ในเดือนนี้แบบฟันธง',
    ],
  },
}

const KNOWN_DIVIDEND_TICKERS = new Set([
  'SCHD',
  'VIG',
  'JEPI',
  'JEPQ',
  'O',
  'KO',
  'PEP',
  'JNJ',
  'PG',
  'VZ',
  'T',
  'MO',
  'SCB',
  'PTT',
  'PTTEP',
  'KBANK',
  'BBL',
  'TISCO',
  'KKP',
  'ADVANC',
  'INTUCH',
  'LH',
  'AP',
  'SIRI',
  'SPALI',
  'TTB',
  'KTB',
  'DIF',
  '3BBIF',
])

const KNOWN_SHORT_TERM_TICKERS = new Set([
  'NVDA',
  'TSLA',
  'AMD',
  'MU',
  'SMH',
  'SOXX',
  'PLTR',
  'COIN',
  'MSTR',
  'ARKK',
  'META',
  'NFLX',
  'DELTA',
  'HANA',
  'KCE',
  'JMT',
  'JMART',
  'EA',
  'BTC',
  'ETH',
  'SOL',
])

export function inferStrategyTypeForTicker(ticker: string, assetType?: string): BucketStrategyType {
  const sym = ticker.trim().toUpperCase().replace(/\.BK$/, '')
  if (sym === 'CASH') return 'CASH'
  if (assetType?.toLowerCase() === 'crypto') return 'SHORT_TERM'
  if (KNOWN_DIVIDEND_TICKERS.has(sym)) return 'DIVIDEND'
  if (KNOWN_SHORT_TERM_TICKERS.has(sym)) return 'SHORT_TERM'
  return 'LONG_TERM'
}

export function buildDefaultStrategyBuckets(holdings: HoldingItem[] = []): StrategyBucket[] {
  const longTermTickers = new Set<string>(['VOO', 'QQQM', 'GOOGL'])
  const dividendTickers = new Set<string>(['SCHD', 'SCB'])
  const shortTermTickers = new Set<string>(['NVDA', 'MU'])

  // If user actually holds assets, classify their real holdings into the 3 buckets automatically
  if (holdings.length > 0) {
    longTermTickers.clear()
    dividendTickers.clear()
    shortTermTickers.clear()

    for (const h of holdings) {
      const sym = h.ticker.toUpperCase()
      const inferred = inferStrategyTypeForTicker(sym, h.assetType)
      if (inferred === 'DIVIDEND') {
        dividendTickers.add(sym)
      } else if (inferred === 'SHORT_TERM') {
        shortTermTickers.add(sym)
      } else {
        longTermTickers.add(sym)
      }
    }
  }

  return [
    {
      id: 'bucket-long-term',
      name: 'พอร์ตถือยาวสะสมความมั่งคั่ง',
      emoji: '🌱',
      strategyType: 'LONG_TERM',
      description: 'เน้นสะสมหุ้นเติบโต & ETF ดัชนีหลักเพื่ออนาคต ถัวเฉลี่ย DCA และซื้อเพิ่มเมื่อย่อตัว',
      targetPercent: 50,
      tickers: Array.from(longTermTickers),
    },
    {
      id: 'bucket-dividend',
      name: 'พอร์ตหุ้นปันผล & กระแสเงินสด',
      emoji: '💰',
      strategyType: 'DIVIDEND',
      description: 'เน้นเก็บหุ้นปันผลเด่น สร้าง Passive Income ต่อเนื่องและรอจังหวะสะสมก่อนขึ้น XD',
      targetPercent: 25,
      tickers: Array.from(dividendTickers),
      targetYieldPercent: 4.5,
    },
    {
      id: 'bucket-short-term',
      name: 'พอร์ตเก็งกำไรระยะสั้น (Swing Trade)',
      emoji: '⚡',
      strategyType: 'SHORT_TERM',
      description: 'หุ้นหวังกำไรรอบสั้น–กลาง จับจังหวะซื้อที่แนวรับ S1 และแบ่งขายทำกำไรเมื่อชนแนวต้าน R1',
      targetPercent: 15,
      tickers: Array.from(shortTermTickers),
      takeProfitPercent: 15,
      stopLossPercent: 8,
    },
    {
      id: 'bucket-cash',
      name: 'กระสุนเงินสดสำรอง (Dry Powder)',
      emoji: '💵',
      strategyType: 'CASH',
      description: 'เงินสดสำรองในบัญชี (เช่น Dime! Save / FCD) รอจังหวะช้อนเมื่อตลาดปรับฐาน',
      targetPercent: 10,
      tickers: ['CASH'],
    },
  ]
}

export function extractStrategyBuckets(
  targetAllocation: Record<string, any> | null | undefined,
  holdings: HoldingItem[] = []
): StrategyBucket[] {
  if (
    targetAllocation &&
    typeof targetAllocation === 'object' &&
    Array.isArray(targetAllocation._buckets) &&
    targetAllocation._buckets.length > 0
  ) {
    return targetAllocation._buckets.map((b: any, idx: number) => ({
      id: String(b.id || `bucket-${idx}`),
      name: String(b.name || 'พอร์ตกลยุทธ์'),
      emoji: String(b.emoji || STRATEGY_TYPE_META[b.strategyType as BucketStrategyType]?.emoji || '🎯'),
      strategyType: (b.strategyType as BucketStrategyType) || 'CUSTOM',
      description: String(
        b.description ||
          STRATEGY_TYPE_META[(b.strategyType as BucketStrategyType) || 'CUSTOM']?.defaultDescription ||
          ''
      ),
      targetPercent: Number(b.targetPercent) || 0,
      tickers: Array.isArray(b.tickers)
        ? b.tickers.map((t: any) => String(t).trim().toUpperCase()).filter(Boolean)
        : [],
      takeProfitPercent: b.takeProfitPercent !== undefined ? Number(b.takeProfitPercent) : undefined,
      stopLossPercent: b.stopLossPercent !== undefined ? Number(b.stopLossPercent) : undefined,
      targetYieldPercent: b.targetYieldPercent !== undefined ? Number(b.targetYieldPercent) : undefined,
    }))
  }

  return buildDefaultStrategyBuckets(holdings)
}

export function computeBucketsWithHoldings(
  buckets: StrategyBucket[],
  holdings: HoldingItem[],
  totalCashBase: number,
  totalPortfolioValue: number
): {
  computedBuckets: ComputedBucketItem[]
  unassignedHoldings: HoldingItem[]
  tickerToBucketMap: Record<string, StrategyBucket>
} {
  const holdingsByTicker = new Map<string, HoldingItem>()
  for (const h of holdings) {
    holdingsByTicker.set(h.ticker.toUpperCase(), h)
  }

  const assignedTickers = new Set<string>()
  const tickerToBucketMap: Record<string, StrategyBucket> = {}

  const computedBuckets: ComputedBucketItem[] = buckets.map((bucket) => {
    if (bucket.strategyType === 'CASH' || bucket.tickers.includes('CASH')) {
      const actualValueBase = totalCashBase
      const actualPercent =
        totalPortfolioValue > 0 ? Number(((actualValueBase / totalPortfolioValue) * 100).toFixed(1)) : 0
      const deviationPercent = Number((actualPercent - bucket.targetPercent).toFixed(1))

      return {
        ...bucket,
        actualValueBase,
        actualPercent,
        deviationPercent,
        unrealizedPnLBase: 0,
        unrealizedPnLPercent: 0,
        holdings: [],
        unheldTickers: [],
      }
    }

    const bucketHoldings: HoldingItem[] = []
    const unheldTickers: string[] = []
    let actualValueBase = 0
    let totalCostBase = 0
    let unrealizedPnLBase = 0

    for (const rawTicker of bucket.tickers) {
      const sym = rawTicker.toUpperCase()
      if (sym === 'CASH') continue
      assignedTickers.add(sym)
      tickerToBucketMap[sym] = bucket

      const found = holdingsByTicker.get(sym)
      if (found) {
        bucketHoldings.push(found)
        actualValueBase += found.currentValueBase
        totalCostBase += found.currentValueBase - found.unrealizedPnLBase
        unrealizedPnLBase += found.unrealizedPnLBase
      } else {
        unheldTickers.push(sym)
      }
    }

    const actualPercent =
      totalPortfolioValue > 0 ? Number(((actualValueBase / totalPortfolioValue) * 100).toFixed(1)) : 0
    const deviationPercent = Number((actualPercent - bucket.targetPercent).toFixed(1))
    const unrealizedPnLPercent =
      totalCostBase > 0 ? Number(((unrealizedPnLBase / totalCostBase) * 100).toFixed(2)) : 0

    return {
      ...bucket,
      actualValueBase,
      actualPercent,
      deviationPercent,
      unrealizedPnLBase,
      unrealizedPnLPercent,
      holdings: bucketHoldings,
      unheldTickers,
    }
  })

  const unassignedHoldings = holdings.filter(
    (h) => !assignedTickers.has(h.ticker.toUpperCase())
  )

  return {
    computedBuckets,
    unassignedHoldings,
    tickerToBucketMap,
  }
}
