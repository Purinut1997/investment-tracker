import { prepareTransactionSubmit, transactionSubmitRequest } from './retryable-transaction-submit'
/**
 * lib/analytics/quant-engine.test.ts
 * Pure TypeScript unit tests for:
 * - Portfolio XIRR & Risk Metrics (Max Drawdown, Sharpe, PME Alpha)
 * - Monte Carlo Simulation & Crisis Stress Test (Inflation & DCA speedup)
 * - Bucket & Ticker Rebalancing Math (Cash Flow cap, Tolerance Symmetry, SET Board Lots)
 * - Cash Ledger Deltas
 * - Bilingual Sentiment Detection
 * - User Investment Memory & Closed-Loop Advice Outcome Win-Rate
 */

import assert from 'assert'
import { calculatePortfolioXIRR, calculatePortfolioRiskMetrics } from './quant-metrics'
import { runMonteCarloSimulation, runCrisisStressTest } from './monte-carlo'
import { calculateBucketRebalancePlan, ComputedBucketItem } from './strategy-buckets'
import { computeEstimatedShares } from './rebalancing'
import { getTransactionCashDelta, getTransactionNetAmount } from './cash-ledger'
import { detectSentiment } from '../news/sentiment'
import {
  computeAdviceOutcomeMetrics,
  parseUserInvestmentMemory,
  serializeUserInvestmentMemory,
} from '../ai/outcome-evaluator'
import {
  ozToGrams,
  gramsToOz,
  ozToThaiBahtGold,
  calculateThai965PricePerBaht,
  normalizeGoldTicker,
  formatGoldWeightSublabel,
  getAssetUnitLabel,
} from '../market-data/gold'
import { calculateTaxReportFIFO } from './tax-fifo'

console.log('🧪 Starting Quantitative & AI Intelligence Unit Tests...\n')

// ── Test 1: XIRR Calculation ───────────────────────────────────────────────────────────
{
  // Exact +10% return over 1 leap/standard year (365.25 days)
  const t0 = new Date('2025-01-01T00:00:00Z')
  const t1 = new Date(t0.getTime() + 365.25 * 24 * 60 * 60 * 1000)
  const xirr = calculatePortfolioXIRR([
    { amount: -100000, date: t0 },
    { amount: 110000, date: t1 },
  ])
  assert.ok(Math.abs(xirr - 10.0) < 0.05, `Expected XIRR ~10.0%, got ${xirr}%`)

  // Edge case: only inflows returns 0
  assert.strictEqual(
    calculatePortfolioXIRR([
      { amount: 1000, date: t0 },
      { amount: 2000, date: t1 },
    ]),
    0,
    'All-positive cashflows should return 0'
  )

  console.log('✅ Test 1 Passed: calculatePortfolioXIRR accuracy & edge cases')
}

// ── Test 2: Risk Metrics (Max Drawdown, Sharpe, PME Alpha) ─────────────────────────────
{
  const points = [
    { month: 'M1', value: 100000, benchmark: 100000 },
    { month: 'M2', value: 120000, benchmark: 105000 },
    { month: 'M3', value: 90000, benchmark: 95000 }, // -25% drawdown from 120k peak
    { month: 'M4', value: 110000, benchmark: 100000 }, // +10% excess vs 100k benchmark
  ]

  const metrics = calculatePortfolioRiskMetrics(points, {
    baseCurrency: 'THB',
    cashFlows: [
      { amount: -100000, date: new Date('2025-01-01T00:00:00Z') },
      { amount: 110000, date: new Date('2026-01-01T00:00:00Z') },
    ],
  })

  assert.strictEqual(metrics.maxDrawdownPercent, -25, 'Max Drawdown should be -25%')
  assert.strictEqual(metrics.pmeExcessPercent, 10, 'PME excess should be +10%')
  assert.ok(metrics.annualizedVolatilityPercent > 0, 'Volatility should be positive')
  assert.strictEqual(metrics.monthsMeasured, 4, 'Months measured should equal 4')
  assert.strictEqual(
    calculatePortfolioRiskMetrics([]).maxDrawdownPercent,
    0,
    'Empty points should return 0 Max Drawdown'
  )

  console.log('✅ Test 2 Passed: calculatePortfolioRiskMetrics (MDD, PME, Volatility)')
}

// ── Test 3: Monte Carlo Inflation Consistency & Crisis Stress Test ─────────────────────
{
  const sim = runMonteCarloSimulation({
    initialAmount: 500000,
    monthlyContribution: 15000,
    years: 10,
    annualReturn: 0.09,
    annualVolatility: 0.14,
    targetAmount: 3000000,
    numSimulations: 200,
    adjustInflation: true,
    inflationRate: 0.03,
    expectedDividendYield: 0.025,
  })

  assert.ok(sim.finalRealP50 < sim.finalP50, 'Real purchasing power must be < nominal P50 when inflation > 0')
  assert.ok(sim.milestones.length > 0, 'Milestones should be populated')

  const noDcaCrisis = runCrisisStressTest({
    initialAmount: 500000,
    monthlyContribution: 0,
    years: 10,
    annualReturn: 0.09,
  })
  assert.ok(
    noDcaCrisis.every((c) => c.speedupYearsFromDCA === 0),
    'speedupYearsFromDCA must be 0 when monthlyContribution is 0'
  )

  const withDcaCrisis = runCrisisStressTest({
    initialAmount: 500000,
    monthlyContribution: 20000,
    years: 10,
    annualReturn: 0.09,
  })
  assert.ok(
    withDcaCrisis.every((c) => c.speedupYearsFromDCA > 0 && c.finalValueWithDCA > c.finalValueWithoutDCA),
    'With DCA must speed up recovery and beat no-DCA value'
  )

  console.log('✅ Test 3 Passed: Monte Carlo inflation consistency & Crisis DCA math')
}

// ── Test 4: Strategy Bucket Rebalance (No Overshoot & Tolerance Symmetry) ──────────────
{
  const makeBucket = (
    id: string,
    actual: number,
    actualPct: number,
    targetPct: number
  ): ComputedBucketItem => ({
    id,
    name: id,
    emoji: '📦',
    strategyType: 'CUSTOM',
    description: '',
    targetPercent: targetPct,
    tickers: [],
    actualValueBase: actual,
    actualPercent: actualPct,
    deviationPercent: actualPct - targetPct,
    unrealizedPnLBase: 0,
    unrealizedPnLPercent: 0,
    holdings: [],
    unheldTickers: [],
  })

  // Total current = 100,000; inflow = 100,000 => post = 200,000
  // Bucket A overweight (actual 90,000 vs post target 20% = 40,000 -> deficit 0)
  // Bucket B underweight (actual 10,000 vs post target 50% = 100,000 -> deficit 90,000)
  // Remaining target sum = 70% (<100%) => inflow 100,000 > deficit 90,000!
  const buckets = [
    makeBucket('A', 90000, 90, 20),
    makeBucket('B', 10000, 10, 50),
  ]
  const plan = calculateBucketRebalancePlan(buckets, 100000, 100000, 'CASH_FLOW', 2.0)
  const itemA = plan.items.find((i) => i.bucketId === 'A')!
  const itemB = plan.items.find((i) => i.bucketId === 'B')!

  // Before fix, B would get all 100,000; after fix, B gets deficit (90,000) + 50% of 10k surplus = 95,000
  assert.strictEqual(itemB.recommendedAmountBase, 95000, 'Bucket B should not absorb 100% of surplus beyond deficit')
  assert.strictEqual(itemA.recommendedAmountBase, 2000, 'Overweight Bucket A still gets proportional 20% share of unallocated surplus')

  // FULL_REBALANCE tolerance symmetry: slight drift (-1% vs +1%) within +/-2% stays HOLD
  const symBuckets = [
    makeBucket('U', 49000, 49, 50),
    makeBucket('O', 51000, 51, 50),
  ]
  const fullPlan = calculateBucketRebalancePlan(symBuckets, 100000, 0, 'FULL_REBALANCE', 2.0)
  assert.ok(
    fullPlan.items.every((i) => i.action === 'HOLD'),
    'Both slight underweight (-1%) and overweight (+1%) within 2% band must be HOLD'
  )

  console.log('✅ Test 4 Passed: Bucket Rebalance anti-overshoot & symmetric tolerance')
}

// ── Test 5: Thai SET Board Lot Rounding & Cash Ledger Deltas ───────────────────────────
{
  const thLot = computeEstimatedShares(5000, 32, 'TH') // raw = 156.25 => 100 shares
  assert.strictEqual(thLot.shares, 100, 'Thai SET >= 100 shares should round down to 100-share board lot')
  assert.strictEqual(thLot.boardLotAdjusted, true)

  const usFrac = computeEstimatedShares(5000, 2000, 'US') // raw = 2.5
  assert.strictEqual(usFrac.shares, 2.5, 'US stock should preserve 2 decimal fractional shares')
  assert.strictEqual(usFrac.boardLotAdjusted, false)

  assert.strictEqual(getTransactionCashDelta('BUY', 1000), -1000)
  assert.strictEqual(getTransactionCashDelta('WITHDRAW', 500), -500)
  assert.strictEqual(getTransactionCashDelta('SELL', 1200), 1200)
  assert.strictEqual(getTransactionCashDelta('DIVIDEND', 150), 150)
  assert.strictEqual(getTransactionNetAmount('BUY', 3, 100, 5, 0), 305)
  assert.strictEqual(getTransactionNetAmount('SELL', 3, 100, 5, 8), 287)
  assert.strictEqual(getTransactionNetAmount('DIVIDEND', 3, 10, 5, 8), 17)
  assert.strictEqual(getTransactionNetAmount('FEE', 1, 12, 0, 0), 12)
  assert.strictEqual(getTransactionNetAmount('FEE', 1, 12, 7, 0), 7)

  console.log('✅ Test 5 Passed: Thai SET board lot rounding & cash ledger deltas')
}

// ── Test 6: Bilingual News Sentiment Detection ─────────────────────────────────────────
{
  assert.strictEqual(detectSentiment('Nvidia surges to all-time high after earnings beat'), 'positive')
  assert.strictEqual(detectSentiment('AOT กำไรพุ่ง นิวไฮรับนักท่องเที่ยวฟื้นตัว'), 'positive')
  assert.strictEqual(detectSentiment('หุ้นเทคร่วงหนัก หลังกังวลขาดทุนและหั่นเป้า'), 'negative')
  assert.strictEqual(detectSentiment('Stock drops sharply following analyst downgrade'), 'negative')
  assert.strictEqual(detectSentiment('Company announces annual shareholder meeting date'), 'neutral')

  console.log('✅ Test 6 Passed: Thai + English financial sentiment analyzer')
}

// ── Test 7: AI Memory & Closed-Loop Outcome Evaluator ──────────────────────────────────
{
  const serialized = serializeUserInvestmentMemory({
    riskTolerance: 'aggressive',
    horizonYears: 15,
    maxSinglePositionPercent: 25,
    maxDrawdownTolerancePercent: 30,
    preferredStyle: 'AI & Semiconductors',
    personalRules: 'Cut loss at -8%',
  })
  const parsed = parseUserInvestmentMemory(serialized)
  assert.strictEqual(parsed.riskTolerance, 'aggressive')
  assert.strictEqual(parsed.maxSinglePositionPercent, 25)
  assert.strictEqual(parseUserInvestmentMemory('conservative').riskTolerance, 'conservative')
  assert.strictEqual(parseUserInvestmentMemory('corrupted-json').riskTolerance, 'moderate')

  const now = new Date('2026-11-19T12:00:00Z')
  const oldLogDate = new Date('2026-11-10T12:00:00Z')
  const tooRecentLogDate = new Date('2026-11-19T10:00:00Z') // only 2h old (<12h)

  const logs = [
    {
      createdAt: oldLogDate,
      response: JSON.stringify({
        tacticalActions: [
          { ticker: 'NVDA', action: 'ACCUMULATE', actionLabel: 'สะสมเพิ่ม', currentPrice: 100, currency: '$' }, // now 108 -> +8% HIT
          { ticker: 'AAPL', action: 'ACCUMULATE', actionLabel: 'สะสมเพิ่ม', currentPrice: 200, currency: '$' }, // now 188 -> -6% MISS
          { ticker: 'TSLA', action: 'TRIM_PROFIT', actionLabel: 'ล็อกกำไร', currentPrice: 300, currency: '$' }, // now 270 -> -10% HIT
        ],
      }),
    },
    {
      createdAt: tooRecentLogDate,
      response: JSON.stringify({
        tacticalActions: [
          { ticker: 'MSFT', action: 'ACCUMULATE', actionLabel: 'สะสมเพิ่ม', currentPrice: 400, currency: '$' },
        ],
      }),
    },
  ]

  const liveMap = new Map<string, number>([
    ['NVDA', 108],
    ['AAPL', 188],
    ['TSLA', 270],
    ['MSFT', 450],
  ])

  const outcome = computeAdviceOutcomeMetrics(logs, liveMap, { minAgeHours: 12, now })
  assert.strictEqual(outcome.totalTrackedCalls, 3, 'Should ignore log younger than 12h')
  assert.strictEqual(outcome.hits, 2, 'NVDA (+8% BUY) and TSLA (-10% TRIM) should be HITs')
  assert.strictEqual(outcome.misses, 1, 'AAPL (-6% BUY) should be MISS')
  assert.strictEqual(outcome.winRatePercent, 66.7, '2/3 decided calls = 66.7% win rate')
  assert.strictEqual(outcome.avgAccumulateReturnPercent, 1.0, '(+8% + -6%) / 2 = +1.0%')
  assert.strictEqual(outcome.avgTrimAvoidedDropPercent, 10.0, 'Avoided 10% drop on TRIM_PROFIT')

  console.log('✅ Test 7 Passed: AI Memory serialization & Closed-Loop Outcome Win-Rate')
}

// ── Test 8: Dime! Gold 99.99% & Thai Gold 96.5% Conversion + FIFO Tax Isolation ──────
{
  const oz = gramsToOz(31.1034768)
  assert.ok(Math.abs(oz - 1.0) < 1e-6, '31.1034768g should equal 1 troy oz')
  assert.ok(Math.abs(ozToGrams(0.5) - 15.5517384) < 1e-5)
  assert.ok(ozToThaiBahtGold(1) > 2.0, '1 troy oz should equal ~2.04 baht-gold weight')

  const thb965 = calculateThai965PricePerBaht(3000, 35)
  // 3000 * 35 * (15.244 / 31.1034768 * 0.965) ~ 49,660 THB
  assert.ok(thb965 > 49000 && thb965 < 50500, `Unexpected 96.5% gold baht price: ${thb965}`)

  const normDime = normalizeGoldTicker('DIMEGOLD')
  assert.ok(normDime && normDime.ticker === 'XAU' && normDime.currency === 'USD')
  const normThai = normalizeGoldTicker('GOLD965')
  assert.ok(normThai && normThai.ticker === 'GOLD965' && normThai.currency === 'THB')
  // NYSE stock GOLD (Barrick Gold) when assetType === 'stock' must NOT be hijacked
  assert.strictEqual(normalizeGoldTicker('GOLD', 'stock', 'USD'), null)

  assert.strictEqual(getAssetUnitLabel('XAU', 'gold'), 'oz')
  assert.strictEqual(getAssetUnitLabel('GOLD965', 'gold'), 'บาททอง')
  assert.ok(formatGoldWeightSublabel(0.1, 'XAU', 'gold')?.includes('กรัม'))

  // FIFO Tax: Dime! Gold XAU traded in USD stays out of foreign equity Por. 161/2566 bucket
  const goldReport = calculateTaxReportFIFO(
    [
      {
        id: 'g1',
        assetId: 'xau-id',
        ticker: 'XAU',
        assetName: 'Dime! Gold 99.99% (USD/oz)',
        market: 'US',
        assetType: 'gold',
        currency: 'USD',
        txnDate: new Date('2026-02-01T10:00:00Z'),
        txnType: 'BUY',
        quantity: 0.1,
        pricePerUnit: 3000,
        fee: 0,
        taxWithheld: 0,
        totalAmount: 300,
      },
      {
        id: 'g2',
        assetId: 'xau-id',
        ticker: 'XAU',
        assetName: 'Dime! Gold 99.99% (USD/oz)',
        market: 'US',
        assetType: 'gold',
        currency: 'USD',
        txnDate: new Date('2026-06-01T10:00:00Z'),
        txnType: 'SELL',
        quantity: 0.1,
        pricePerUnit: 3500,
        fee: 0,
        taxWithheld: 0,
        totalAmount: 350,
      },
    ],
    2026,
    35.0
  )

  assert.strictEqual(goldReport.foreignAndCryptoGains.trades.length, 0, 'Domestic Dime! Gold must not go into foreign equity gains')
  assert.strictEqual(goldReport.thaiSetCapitalGains.trades.length, 1, 'Gold trade isolated into exempt domestic bucket')
  assert.strictEqual(goldReport.thaiSetCapitalGains.totalRealizedGain, 50 * 35.0, 'USD $50 gain converted to THB ฿1,750')

  console.log('✅ Test 8 Passed: Dime! Gold math, ticker normalization & FIFO tax separation')
}

console.log('\n🎉 ALL QUANTITATIVE & INTELLIGENCE UNIT TESTS PASSED!')


{
  const attempts = new Map<string, string>()
  const first = transactionSubmitRequest(attempts, { amount: 100 }, () => 'first-key')
  const changed = transactionSubmitRequest(attempts, { amount: 200 }, () => 'second-key')
  assert.notEqual(first.headers['Idempotency-Key'], changed.headers['Idempotency-Key'])
  assert.deepEqual(transactionSubmitRequest(attempts, { amount: 100 }, () => 'unexpected'), first)
  assert.notEqual(transactionSubmitRequest(new Map(), { amount: 100 }, () => 'new-form').headers['Idempotency-Key'],
    first.headers['Idempotency-Key'])
}


void (async () => {
  const saved = new Map<string, string>()
  const storage = { getItem: (name: string) => saved.get(name) ?? null,
    setItem: (name: string, value: string) => { saved.set(name, value) },
    removeItem: (name: string) => { saved.delete(name) } }
  const data = { accountId: 'test-account', amount: 100 }
  const submitted = await prepareTransactionSubmit(new Map(), 'cash-wallet', data, storage)
  const reopened = await prepareTransactionSubmit(new Map(), 'cash-wallet', data, storage)
  assert.deepEqual(reopened.request, submitted.request)
  assert.ok([...saved.keys()].every(key => !key.includes('test-account')))
  reopened.confirmed()
  const intentional = await prepareTransactionSubmit(new Map(), 'cash-wallet', data, storage)
  assert.notEqual(intentional.request.headers['Idempotency-Key'], submitted.request.headers['Idempotency-Key'])
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
