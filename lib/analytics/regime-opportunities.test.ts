import assert from 'node:assert/strict'
import {
  calculateBetaToBenchmark,
  calculatePearsonCorrelation,
  computeRegimeOpportunityScore,
  detectMarketRegime,
  evaluateEntryReadiness,
  rankRegimeOpportunities,
  simulateHedgeImpact,
  type DailySeriesSnapshot,
} from './regime-opportunities'
import type { HoldingItem } from './holdings'

console.log('🧪 Starting Regime Opportunity & Downside Hedge Quant Tests...\n')

function buildSeries(start: number, stepReturns: number[]): number[] {
  const closes = [start]
  for (const r of stepReturns) {
    closes.push(closes[closes.length - 1] * (1 + r))
  }
  return closes
}

// 1. Pearson correlation & Beta accuracy
const benchSteps = Array.from({ length: 65 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.008))
const qqqCloses = buildSeries(400, benchSteps)
const corrSame = calculatePearsonCorrelation(qqqCloses, qqqCloses, 60)
assert.equal(corrSame, 1)

const inverseCloses = buildSeries(200, benchSteps.map((r) => -r))
const corrInv = calculatePearsonCorrelation(inverseCloses, qqqCloses, 60)
assert.ok(corrInv <= -0.95, `Expected inverse correlation near -1, got ${corrInv}`)

const flatCloses = Array.from({ length: 66 }, () => 100)
assert.equal(calculatePearsonCorrelation(flatCloses, qqqCloses, 60), 0)

const halfBetaCloses = buildSeries(100, benchSteps.map((r) => r * 0.5))
const betaHalf = calculateBetaToBenchmark(halfBetaCloses, qqqCloses, 60)
assert.ok(Math.abs(betaHalf - 0.5) <= 0.05, `Expected beta near 0.5, got ${betaHalf}`)
console.log('✅ Test 1 Passed: Pearson correlation & 60D Beta accurate with edge guards')

// 2. detectMarketRegime distinctions
const techSelloff = detectMarketRegime({
  qqqReturn21D: -5.2,
  spyReturn21D: -1.1,
  qqqPullback6M: -6.5,
  qqqAboveSma50: false,
  spyAboveSma50: true,
  vixPrice: 20.5,
  us10yYield: 4.45,
})
assert.equal(techSelloff.code, 'TECH_SELLOFF_YIELD_PRESSURE')

const riskOff = detectMarketRegime({
  qqqReturn21D: -6.0,
  spyReturn21D: -4.5,
  qqqPullback6M: -9.0,
  qqqAboveSma50: false,
  spyAboveSma50: false,
  vixPrice: 27.4,
  us10yYield: 4.1,
})
assert.equal(riskOff.code, 'RISK_OFF_DEFENSIVE')

const dipMode = detectMarketRegime({
  qqqReturn21D: -2.0,
  spyReturn21D: -1.5,
  qqqPullback6M: -8.5,
  qqqAboveSma50: false,
  spyAboveSma50: true,
  vixPrice: 19.2,
  us10yYield: 3.9,
})
assert.equal(dipMode.code, 'TECH_CORRECTION_DIP')

const riskOn = detectMarketRegime({
  qqqReturn21D: 4.2,
  spyReturn21D: 3.1,
  qqqPullback6M: -1.0,
  qqqAboveSma50: true,
  spyAboveSma50: true,
  vixPrice: 14.8,
  us10yYield: 3.85,
})
assert.equal(riskOn.code, 'RISK_ON_EXPANSION')
console.log('✅ Test 2 Passed: Market regime detector distinguishes all major regimes')

// 3. computeRegimeOpportunityScore & RSI > 72 anti-chase guardrail
const cleanHedgeScore = computeRegimeOpportunityScore({
  role: 'DEFENSIVE_HEDGE',
  regime: techSelloff,
  rsVsQqq5D: 2.5,
  rsVsQqq21D: 7.4,
  rsVsQqq63D: 8.1,
  corr60DWithQqq: 0.04,
  rsi14: 54,
  currentPrice: 245,
  supportS1: 242,
  sma50: 238,
  pullbackFrom6MHigh: -1.5,
  techExposurePercent: 60,
  alreadyHeldPct: 0,
  maxSinglePositionPercent: 20,
})
assert.ok(cleanHedgeScore.totalScore >= 80 && cleanHedgeScore.entryCaution === null)

const overboughtScore = computeRegimeOpportunityScore({
  role: 'DEFENSIVE_HEDGE',
  regime: techSelloff,
  rsVsQqq5D: 2.5,
  rsVsQqq21D: 7.4,
  rsVsQqq63D: 8.1,
  corr60DWithQqq: 0.04,
  rsi14: 78.5,
  currentPrice: 260,
  supportS1: 240,
  sma50: 230,
  pullbackFrom6MHigh: 0,
  techExposurePercent: 60,
  alreadyHeldPct: 0,
  maxSinglePositionPercent: 20,
})
assert.equal(overboughtScore.scoreBreakdown.entryTiming, 3)
assert.ok(overboughtScore.entryCaution !== null && overboughtScore.entryCaution.includes('72'))
console.log('✅ Test 3 Passed: Scoring rewards RS + low corr and enforces RSI > 72 anti-chase guardrail')

// 4. simulateHedgeImpact math
const hedgeImpact = simulateHedgeImpact({
  totalPortfolioValueBase: 1_000_000,
  techValueBase: 600_000,
  suggestedWeightPct: 10,
  betaToQqq: 0.05,
  baseCurrency: 'THB',
  shockPercent: -15,
})
assert.ok(hedgeImpact !== null)
assert.ok(hedgeImpact.lossReductionBase > 10_000)
assert.ok(hedgeImpact.hedgedLossBase < hedgeImpact.baselineLossBase)
console.log('✅ Test 4 Passed: Hedge impact simulator computes realistic -15% shock loss reduction')

// 5. rankRegimeOpportunities returns diverse Long-only Top 5 respecting maxSinglePositionPercent
function makeSnap(symbol: string, closes: number[], opts?: Partial<DailySeriesSnapshot>): DailySeriesSnapshot {
  return {
    symbol,
    name: symbol,
    market: 'US',
    currency: 'USD',
    currentPrice: closes[closes.length - 1],
    changePercent: 0.5,
    observedAt: '2026-11-26T04:00:00Z',
    closes,
    highs: closes.map((c) => c * 1.01),
    lows: closes.map((c) => c * 0.99),
    return5D: 1.5,
    return21D: 3.5,
    return63D: 6.0,
    rsi14: 52,
    sma50: closes[closes.length - 1] * 0.97,
    supportS1: closes[closes.length - 1] * 0.98,
    resistanceR1: closes[closes.length - 1] * 1.03,
    pullbackFrom6MHigh: -2,
    ...opts,
  }
}

const mockHoldings: HoldingItem[] = [
  {
    assetId: 'a1',
    ticker: 'NVDA',
    assetName: 'NVIDIA',
    market: 'US',
    assetType: 'stock',
    currency: 'USD',
    quantity: 100,
    avgCost: 110,
    totalCost: 11000,
    currentPrice: 130,
    currentValue: 13000,
    currentValueBase: 600_000,
    unrealizedPnL: 2000,
    unrealizedPnLBase: 70_000,
    unrealizedPnLPercent: 18.2,
    allocationPercent: 60,
    isStale: false,
  },
]

const qqqSnap = makeSnap('QQQ', qqqCloses, { return5D: -1.8, return21D: -5.2, return63D: -3.0 })
const gldSnap = makeSnap('GLD', inverseCloses, { return5D: 2.1, return21D: 4.5, return63D: 9.0, rsi14: 55 })
const schdSnap = makeSnap('SCHD', buildSeries(80, benchSteps.map((r) => r * 0.3)), { return5D: 1.0, return21D: 2.2, return63D: 4.1, rsi14: 49 })
const xlvSnap = makeSnap('XLV', buildSeries(140, benchSteps.map((r) => r * 0.2)), { return5D: 0.9, return21D: 1.8, return63D: 3.5, rsi14: 47 })
const sgovSnap = makeSnap('SGOV', buildSeries(100, Array.from({ length: 65 }, () => 0.0002)), { return5D: 0.1, return21D: 0.4, return63D: 1.2, rsi14: 50 })
const xleSnap = makeSnap('XLE', inverseCloses, { return5D: 1.2, return21D: 3.1, return63D: 5.0, rsi14: 58 })
const watchDipSnap = makeSnap('COST', buildSeries(850, benchSteps.map((r) => r * 0.5)), {
  return5D: 0.4,
  return21D: -1.5,
  return63D: 2.0,
  rsi14: 34,
  pullbackFrom6MHigh: -9.5,
})

const ranked = rankRegimeOpportunities({
  regime: techSelloff,
  qqqSeries: qqqSnap,
  candidates: [
    { spec: { ticker: 'GLD', name: 'SPDR Gold', category: 'Gold', defaultRole: 'DEFENSIVE_HEDGE', isWatchlist: false, market: 'US' }, series: gldSnap },
    { spec: { ticker: 'SCHD', name: 'Schwab Div', category: 'Dividend', defaultRole: 'INCOME_BUFFER', isWatchlist: false, market: 'US' }, series: schdSnap },
    { spec: { ticker: 'XLV', name: 'Health Care', category: 'Healthcare', defaultRole: 'DEFENSIVE_HEDGE', isWatchlist: false, market: 'US' }, series: xlvSnap },
    { spec: { ticker: 'SGOV', name: '0-3M T-Bill', category: 'CashYield', defaultRole: 'INCOME_BUFFER', isWatchlist: false, market: 'US' }, series: sgovSnap },
    { spec: { ticker: 'XLE', name: 'Energy', category: 'Energy', defaultRole: 'SECTOR_ROTATION', isWatchlist: false, market: 'US' }, series: xleSnap },
    { spec: { ticker: 'COST', name: 'Costco', category: 'Watchlist', defaultRole: 'CONTRARIAN_DIP', isWatchlist: true, market: 'US' }, series: watchDipSnap },
  ],
  holdings: mockHoldings,
  totalCashBase: 200_000,
  baseCurrency: 'THB',
  maxSinglePositionPercent: 20,
})

assert.equal(ranked.candidates.length, 5)
assert.ok(ranked.techExposurePercent > 70)
assert.equal(ranked.candidates[0].ticker, 'GLD')
assert.ok(ranked.candidates[0].hedgeImpact !== null && ranked.candidates[0].hedgeImpact.lossReductionBase > 0)
console.log('✅ Test 5 Passed: Ranker picks top 5 diverse Long-only Regime Alpha candidates accurately')

// 6. Comprehensive 4-layer evaluateEntryReadiness checks
const overbought = evaluateEntryReadiness({
  category: 'Gold',
  isWatchlist: false,
  currentPrice: 260,
  rsi14: 75.5,
  sma50: 245,
  supportS1: 250,
  resistanceR1: 265,
})
assert.equal(overbought.entryReadiness, 'TOO_HIGH_DO_NOT_CHASE')
assert.equal(overbought.entryTimingScore, 3)

const extendedSma = evaluateEntryReadiness({
  category: 'Gold',
  isWatchlist: false,
  currentPrice: 272,
  rsi14: 66,
  sma50: 240,
  supportS1: 258,
  resistanceR1: 280,
})
assert.equal(extendedSma.entryReadiness, 'TOO_HIGH_DO_NOT_CHASE')
assert.ok((extendedSma.distanceAboveSma50Pct ?? 0) >= 12)

const poorRewardAtR1 = evaluateEntryReadiness({
  category: 'Dividend',
  isWatchlist: false,
  currentPrice: 82.9,
  rsi14: 59,
  sma50: 80.5,
  supportS1: 79.0,
  resistanceR1: 83.0,
})
assert.equal(poorRewardAtR1.entryReadiness, 'TOO_HIGH_DO_NOT_CHASE')
assert.ok((poorRewardAtR1.riskRewardRatio ?? 99) < 0.2)

const richValuation = evaluateEntryReadiness({
  category: 'Watchlist',
  isWatchlist: true,
  currentPrice: 500,
  rsi14: 54,
  sma50: 495,
  supportS1: 492,
  resistanceR1: 525,
  forwardPe: 55,
})
assert.equal(richValuation.entryReadiness, 'WAIT_PULLBACK')
assert.ok(richValuation.valuationWarningTh !== null && richValuation.valuationWarningTh.includes('55.0x'))

const sgovReady = evaluateEntryReadiness({
  category: 'CashYield',
  isWatchlist: false,
  currentPrice: 100.4,
  rsi14: 78,
  sma50: 100.1,
  supportS1: 100.2,
  resistanceR1: 100.5,
})
assert.equal(sgovReady.entryReadiness, 'READY_TO_ENTER')

const cleanDip = evaluateEntryReadiness({
  category: 'Healthcare',
  isWatchlist: false,
  currentPrice: 141,
  rsi14: 44,
  sma50: 140,
  supportS1: 139.5,
  resistanceR1: 148,
})
assert.equal(cleanDip.entryReadiness, 'READY_TO_ENTER')
assert.ok((cleanDip.riskRewardRatio ?? 0) >= 2.0)
console.log('✅ Test 6 Passed: 4-layer entry readiness catches RSI, SMA50 stretch, R:R, and high P/E')

console.log('\n🎉 ALL REGIME OPPORTUNITY & HEDGE QUANT TESTS PASSED!')
