/**
 * lib/analytics/portfolio-analytics.test.ts
 * Pure TypeScript unit tests for:
 * 1. Yahoo split-adjusted close inversion (forward 10:1 & reverse 1:5)
 * 2. Accounting identity (Holdings - NetDeposits + Dividends === Realized + Unrealized + Dividends - Fees)
 * 3. TWR, MWR (Modified Dietz), SR across multi-deposit, partial sell, full liquidation, and ex-dividend drop
 * 4. Counterfactual S&P 500 PME & Not-Investing values + TODAY / YESTERDAY cash-flow-neutral deltas
 * 5. %Off High Drawdown cash-flow immunity
 * 6. computeKeyStats (Max DD peak/trough/recovery, Volatility, Sharpe, Sortino, Beta, Win Days %, Best/Worst Day)
 * 7. computeMonthlyReturnMatrix monthly/annual compounding & alpha
 * 8. resolveZoomIndices & isZoomAvailable
 */

import assert from 'assert'
import {
  buildDailyAnalyticsSeries,
  computeKeyStats,
  computeMonthlyReturnMatrix,
  computeWindowSeries,
  isZoomAvailable,
  resolveZoomIndices,
  unadjustYahooClosePrices,
} from './portfolio-analytics-math'
import type { StockSplitEvent } from './stock-splits'

console.log('🧪 Starting Portfolio Analytics & Benchmark Engine Unit Tests...\n')

// ── Test 1: Yahoo Split Unadjustment (Forward 10:1 & Reverse 1:5) ────────────────────────
{
  const bars = [
    { date: '2024-06-06', close: 118.0 }, // Yahoo retroactively divided $1180 by 10
    { date: '2024-06-07', close: 120.0 }, // pre-split actual close = $1200
    { date: '2024-06-10', close: 121.0 }, // ex-split 10:1 actual close = $121
    { date: '2025-02-03', close: 200.0 }, // pre-reverse-split (actual before 1:5 was $40!)
    { date: '2025-02-04', close: 205.0 }, // ex-reverse-split 1:5 actual close = $205
  ]
  const yahooSplits = [
    { splitDate: '2024-06-10', multiplier: 10 }, // 10:1 forward split
    { splitDate: '2025-02-04', multiplier: 0.2 }, // 1:5 reverse split
  ]

  const unadjusted = unadjustYahooClosePrices(bars, yahooSplits)
  // On 2024-06-07: futureMult = 10 * 0.2 = 2 -> 120 * 2 = 240? Wait: check sequentially!
  // After 2024-06-10 (10:1), $1200 became $120; then on 2025-02-04 (1:5), $120 became $600!
  // So Yahoo retroactively multiplied 2024-06-07 by (1/10) * 5 = 0.5, i.e., $1200 * 0.5 = $600 -> wait:
  // If raw Yahoo on 2024-06-07 was 120.0, futureMult = 10 * 0.2 = 2 -> 240.0!
  // Check single split cleanly as well:
  const singleSplitMap = unadjustYahooClosePrices(
    [
      { date: '2024-06-07', close: 120.0 },
      { date: '2024-06-10', close: 121.0 },
    ],
    [{ splitDate: '2024-06-10', multiplier: 10 }]
  )
  assert.strictEqual(singleSplitMap.get('2024-06-07'), 1200, '10:1 pre-split close should unadjust to $1,200')
  assert.strictEqual(singleSplitMap.get('2024-06-10'), 121, '10:1 ex-split close should stay $121')

  const reverseSplitMap = unadjustYahooClosePrices(
    [
      { date: '2025-02-03', close: 200.0 },
      { date: '2025-02-04', close: 205.0 },
    ],
    [{ splitDate: '2025-02-04', multiplier: 0.2 }]
  )
  assert.strictEqual(reverseSplitMap.get('2025-02-03'), 40, '1:5 reverse pre-split close should unadjust to $40')
  assert.strictEqual(reverseSplitMap.get('2025-02-04'), 205, '1:5 reverse ex-split close should stay $205')
  assert.ok(unadjusted.get('2025-02-03') === 40 && unadjusted.get('2024-06-06') === 236)

  console.log('✅ Test 1 Passed: unadjustYahooClosePrices handles forward 10:1 and reverse 1:5 splits cleanly')
}

// ── Test 2: Accounting Identity & Split-Continuous Portfolio Valuation ─────────────────────
{
  const asset = {
    id: 'aapl',
    ticker: 'AAPL',
    assetName: 'Apple Inc.',
    market: 'US',
    assetType: 'stock',
    currency: 'USD',
  }

  // Buy 2 shares @ $1000 (fee $10) on 2026-01-05 (USD/THB = 34)
  // 10:1 split on 2026-01-08 -> 20 shares @ $100
  // Sell 5 shares @ $110 (fee $5, tax $0) on 2026-01-12 (USD/THB = 35)
  // Dividend $20 on 2026-01-14 (USD/THB = 35)
  // Final close on 2026-01-15: $115 (USD/THB = 36)
  const txns = [
    {
      id: 't1',
      assetId: 'aapl',
      txnDate: '2026-01-05T15:00:00Z',
      txnType: 'BUY',
      quantity: 2,
      pricePerUnit: 1000,
      fee: 10,
      taxWithheld: 0,
      totalAmount: 2010,
      asset,
    },
    {
      id: 't2',
      assetId: 'aapl',
      txnDate: '2026-01-12T15:00:00Z',
      txnType: 'SELL',
      quantity: 5,
      pricePerUnit: 110,
      fee: 5,
      taxWithheld: 0,
      totalAmount: 545,
      asset,
    },
    {
      id: 't3',
      assetId: 'aapl',
      txnDate: '2026-01-14T15:00:00Z',
      txnType: 'DIVIDEND',
      quantity: 15,
      pricePerUnit: 1.333333,
      fee: 0,
      taxWithheld: 0,
      totalAmount: 20,
      asset,
    },
  ]

  const splits = new Map<string, StockSplitEvent[]>([
    [
      'aapl',
      [
        {
          assetId: 'aapl',
          splitDate: '2026-01-08T00:00:00Z',
          numerator: 10,
          denominator: 1,
          splitRatio: '10:1',
        },
      ],
    ],
  ])

  const assetDailyPrices = new Map<string, Map<string, number>>([
    [
      'aapl',
      new Map([
        ['2026-01-05', 1000],
        ['2026-01-06', 1020],
        ['2026-01-07', 1040], // pre-split price
        ['2026-01-08', 105], // ex-split 10:1 price (no cliff!)
        ['2026-01-09', 108],
        ['2026-01-12', 110],
        ['2026-01-13', 112],
        ['2026-01-14', 111],
        ['2026-01-15', 115],
      ]),
    ],
  ])

  const dailyUsdThb = new Map([
    ['2026-01-05', 34],
    ['2026-01-08', 34.5],
    ['2026-01-12', 35],
    ['2026-01-14', 35],
    ['2026-01-15', 36],
  ])

  const benchPrices = new Map([
    ['2026-01-05', 5000],
    ['2026-01-06', 5020],
    ['2026-01-07', 5050],
    ['2026-01-08', 5060],
    ['2026-01-09', 5080],
    ['2026-01-12', 5100],
    ['2026-01-13', 5120],
    ['2026-01-14', 5090],
    ['2026-01-15', 5150],
  ])

  const { series } = buildDailyAnalyticsSeries({
    txns,
    effectiveSplitsByAsset: splits,
    assetDailyPrices,
    dailyUsdThb,
    currentUsdThbRate: 36,
    baseCurrency: 'THB',
    benchmarkDailyPrices: benchPrices,
    benchmarkCurrency: 'USD',
    liveAssetPrices: new Map([['aapl', 115]]),
    todayStr: '2026-01-15',
  })

  // Check split continuity between 2026-01-07 and 2026-01-08
  const pJan7 = series.find((p) => p.date === '2026-01-07')!
  const pJan8 = series.find((p) => p.date === '2026-01-08')!
  assert.ok(
    Math.abs(pJan8.dailyReturnPct - ((20 * 105 * 34.5) / (2 * 1040 * 34) - 1) * 100) < 0.05,
    `Split should not create cliff; got dailyReturnPct=${pJan8.dailyReturnPct}`
  )
  assert.ok(pJan7.holdingsValue > 65000 && pJan8.holdingsValue > 65000)

  // Check accounting identity on EVERY single day
  for (const pt of series) {
    const lhs = pt.holdingsValue - pt.cumNetDeposits + pt.cumDividends
    const rhs = pt.cumRealizedPnL + pt.unrealizedPnL + pt.cumDividends - pt.cumFees
    assert.ok(
      Math.abs(lhs - rhs) < 0.1,
      `Accounting identity failed on ${pt.date}: LHS=${lhs} vs RHS=${rhs}`
    )
  }

  console.log('✅ Test 2 Passed: Accounting identity & split continuity verified across all days')
}

// ── Test 3: TWR, MWR, SR, Full Liquidation & Ex-Dividend Neutrality ──────────────────────
{
  const asset = {
    id: 'etf',
    ticker: 'VOO',
    assetName: 'Vanguard S&P 500',
    market: 'TH', // Keep fx=1 for crisp exact verification
    assetType: 'fund',
    currency: 'THB',
  }

  // Day 1 (2026-02-02): Buy 100 @ 100 = 10,000
  // Day 2 (2026-02-03): Price jumps +10% to 110 -> V=11,000 (+10%)
  // Day 3 (2026-02-04): Deposit/Buy 100 @ 110 = 11,000; end close stays 110 -> V=22,000
  // Day 4 (2026-02-05): Ex-dividend! Price drops 2 THB to 108, Dividend = 200 * 2 = 400 THB -> V=21,600, total value incl div = 22,000 (0% return!)
  // Day 5 (2026-02-06): Sell ALL 200 @ 108 -> V=0 (full liquidation, no NaN/Infinity!)
  // Day 6 (2026-02-09): Still empty V=0
  // Day 7 (2026-02-10): Buy back 100 @ 100 -> closes at 105 -> V=10,500 (+5%)
  const txns = [
    { id: '1', assetId: 'etf', txnDate: '2026-02-02T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 100, fee: 0, totalAmount: 10000, asset },
    { id: '2', assetId: 'etf', txnDate: '2026-02-04T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 110, fee: 0, totalAmount: 11000, asset },
    { id: '3', assetId: 'etf', txnDate: '2026-02-05T10:00:00Z', txnType: 'DIVIDEND', quantity: 200, pricePerUnit: 2, fee: 0, totalAmount: 400, asset },
    { id: '4', assetId: 'etf', txnDate: '2026-02-06T10:00:00Z', txnType: 'SELL', quantity: 200, pricePerUnit: 108, fee: 0, totalAmount: 21600, asset },
    { id: '5', assetId: 'etf', txnDate: '2026-02-10T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 100, fee: 0, totalAmount: 10000, asset },
  ]

  const assetDailyPrices = new Map([
    [
      'etf',
      new Map([
        ['2026-02-02', 100],
        ['2026-02-03', 110],
        ['2026-02-04', 110],
        ['2026-02-05', 108],
        ['2026-02-06', 108],
        ['2026-02-09', 108],
        ['2026-02-10', 105],
      ]),
    ],
  ])

  const benchPrices = new Map([
    ['2026-02-02', 100],
    ['2026-02-03', 102],
    ['2026-02-04', 102],
    ['2026-02-05', 102],
    ['2026-02-06', 102],
    ['2026-02-09', 102],
    ['2026-02-10', 104],
  ])

  const { series } = buildDailyAnalyticsSeries({
    txns,
    effectiveSplitsByAsset: new Map(),
    assetDailyPrices,
    dailyUsdThb: new Map(),
    currentUsdThbRate: 35,
    baseCurrency: 'THB',
    benchmarkDailyPrices: benchPrices,
    benchmarkCurrency: 'THB',
    liveAssetPrices: new Map([['etf', 105]]),
    todayStr: '2026-02-10',
  })

  // Ex-dividend day (2026-02-05): price fell 2, dividend paid +400 -> 0% daily return
  const exDivPt = series.find((p) => p.date === '2026-02-05')!
  assert.strictEqual(exDivPt.dailyReturnPct, 0, 'Ex-dividend price drop offset by dividend must yield 0% return')

  // Full liquidation + re-entry: no NaN/Infinity anywhere
  for (const pt of series) {
    assert.ok(Number.isFinite(pt.twrIndex) && Number.isFinite(pt.dailyReturnPct), 'No NaN/Infinity allowed')
  }

  const twrWindow = computeWindowSeries(series, 0, series.length - 1, 'TWR')
  const mwrWindow = computeWindowSeries(series, 0, series.length - 1, 'MWR')
  const srWindow = computeWindowSeries(series, 0, series.length - 1, 'SR')

  // Compounded TWR = 1.10 * 1.05 - 1 = +15.50%
  assert.ok(
    Math.abs(twrWindow.summary.portfolio.percent - 15.5) < 0.05,
    `Expected TWR ~15.50%, got ${twrWindow.summary.portfolio.percent}%`
  )
  // Total Gain = 1,000 (first leg) + 400 (div) - 400 (ex-div price diff on sale) + 500 (second leg) = 1,500
  assert.strictEqual(mwrWindow.summary.portfolio.amount, 1500, 'Total Gain should equal ฿1,500')
  assert.ok(Number.isFinite(mwrWindow.summary.portfolio.percent) && mwrWindow.summary.portfolio.percent > 0)
  assert.ok(Number.isFinite(srWindow.summary.portfolio.percent) && srWindow.summary.portfolio.percent > 0)

  console.log('✅ Test 3 Passed: TWR, MWR, SR, full liquidation, and ex-dividend neutrality accurate')
}

// ── Test 4: Counterfactual PME Benchmark & TODAY / YESTERDAY Deltas ───────────────────────
{
  const asset = {
    id: 'nvda',
    ticker: 'NVDA',
    assetName: 'Nvidia',
    market: 'TH',
    assetType: 'stock',
    currency: 'THB',
  }

  // Day 0 (2026-03-02): Buy 100 @ 100 = 10,000; Bench = 100 (buys 100 bench units)
  // Day 1 (2026-03-03): Stock = 110 (V=11,000, +1,000 / +10%); Bench = 105 (B=10,500, +500 / +5%)
  // Day 2 (2026-03-04): Deposit/Buy 100 @ 110 = 11,000 AND close moves to 112 ->
  //   V_2 = 200 * 112 = 22,400; CF_2 = 11,000 -> TODAY gain = 22,400 - 11,000 - 11,000 = +400
  //   Denom = 11,000 + 11,000 = 22,000 -> TODAY % = +400 / 22,000 = +1.82%
  //   Bench = 105 -> buys 11,000/105 units; Bench closes at 105 -> B_2 = 21,500; TODAY = 0%
  const txns = [
    { id: '1', assetId: 'nvda', txnDate: '2026-03-02T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 100, fee: 0, totalAmount: 10000, asset },
    { id: '2', assetId: 'nvda', txnDate: '2026-03-04T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 110, fee: 0, totalAmount: 11000, asset },
  ]
  const assetDailyPrices = new Map([
    ['nvda', new Map([['2026-03-02', 100], ['2026-03-03', 110], ['2026-03-04', 112]])],
  ])
  const benchPrices = new Map([['2026-03-02', 100], ['2026-03-03', 105], ['2026-03-04', 105]])

  const { deltas } = buildDailyAnalyticsSeries({
    txns,
    effectiveSplitsByAsset: new Map(),
    assetDailyPrices,
    dailyUsdThb: new Map(),
    currentUsdThbRate: 35,
    baseCurrency: 'THB',
    benchmarkDailyPrices: benchPrices,
    benchmarkCurrency: 'THB',
    liveAssetPrices: new Map([['nvda', 112]]),
    todayStr: '2026-03-04',
  })

  assert.strictEqual(deltas.portfolio.value, 22400)
  assert.strictEqual(deltas.notInvesting.value, 21000)
  assert.strictEqual(deltas.notInvesting.today.amount, 0)
  assert.strictEqual(deltas.notInvesting.yesterday.amount, 0)
  assert.strictEqual(deltas.portfolio.today.amount, 400, 'TODAY gain must exclude 11,000 deposit')
  assert.ok(Math.abs(deltas.portfolio.today.percent - 1.82) < 0.02)
  assert.strictEqual(deltas.portfolio.yesterday.amount, 1000)
  assert.strictEqual(deltas.portfolio.yesterday.percent, 10)
  assert.strictEqual(deltas.benchmark.value, 21500)
  assert.strictEqual(deltas.benchmark.yesterday.amount, 500)
  assert.strictEqual(deltas.benchmark.yesterday.percent, 5)

  console.log('✅ Test 4 Passed: Counterfactual PME & TODAY/YESTERDAY cash-flow-excluded deltas accurate')
}

// ── Test 5: %Off High Drawdown Cash-Withdrawal Immunity ───────────────────────────────────
{
  const asset = {
    id: 'msft',
    ticker: 'MSFT',
    assetName: 'Microsoft',
    market: 'TH',
    assetType: 'stock',
    currency: 'THB',
  }

  // Price goes 100 -> 120 -> 120 (sell half, portfolio value drops from 12,000 to 6,000!) -> 108 (-10% from peak 120)
  const txns = [
    { id: '1', assetId: 'msft', txnDate: '2026-04-01T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 100, fee: 0, totalAmount: 10000, asset },
    { id: '2', assetId: 'msft', txnDate: '2026-04-03T10:00:00Z', txnType: 'SELL', quantity: 50, pricePerUnit: 120, fee: 0, totalAmount: 6000, asset },
  ]
  const assetDailyPrices = new Map([
    [
      'msft',
      new Map([
        ['2026-04-01', 100],
        ['2026-04-02', 120],
        ['2026-04-03', 120],
        ['2026-04-06', 108],
      ]),
    ],
  ])
  const benchPrices = new Map([
    ['2026-04-01', 100],
    ['2026-04-02', 100],
    ['2026-04-03', 100],
    ['2026-04-06', 100],
  ])

  const { series } = buildDailyAnalyticsSeries({
    txns,
    effectiveSplitsByAsset: new Map(),
    assetDailyPrices,
    dailyUsdThb: new Map(),
    currentUsdThbRate: 35,
    baseCurrency: 'THB',
    benchmarkDailyPrices: benchPrices,
    benchmarkCurrency: 'THB',
    liveAssetPrices: new Map([['msft', 108]]),
    todayStr: '2026-04-06',
  })

  const ddWindow = computeWindowSeries(series, 0, series.length - 1, 'TWR')
  const apr3 = ddWindow.points.find((p) => p.date === '2026-04-03')!
  const apr6 = ddWindow.points.find((p) => p.date === '2026-04-06')!

  assert.strictEqual(apr3.portfolioDrawdownPct, 0, 'Selling 50% at high must NOT trigger fake -50% drawdown')
  assert.strictEqual(apr6.portfolioDrawdownPct, -10, '120 -> 108 should yield exact -10% drawdown')

  console.log('✅ Test 5 Passed: %Off High Drawdown is immune to cash withdrawals')
}

// ── Test 6 & 7: Key Stats (Max DD Peak/Trough/Recovery, Sharpe, Sortino, Beta) & Matrix ───
{
  const asset = {
    id: 'spy',
    ticker: 'SPY',
    assetName: 'SPDR S&P 500',
    market: 'TH',
    assetType: 'fund',
    currency: 'THB',
  }

  // Build clean multi-month test spanning 2025-11 -> 2026-02
  const txns = [
    { id: '1', assetId: 'spy', txnDate: '2025-11-03T10:00:00Z', txnType: 'BUY', quantity: 100, pricePerUnit: 100, fee: 0, totalAmount: 10000, asset },
  ]
  const prices = new Map<string, number>([
    ['2025-11-03', 100],
    ['2025-11-17', 120], // Peak
    ['2025-11-28', 120],
    ['2025-12-15', 90],  // -25% trough
    ['2025-12-31', 96],
    ['2026-01-15', 114],
    ['2026-01-30', 126], // Recovered past 120!
    ['2026-02-13', 132],
  ])
  const benchPrices = new Map<string, number>([
    ['2025-11-03', 100],
    ['2025-11-17', 110],
    ['2025-11-28', 110],
    ['2025-12-15', 99],
    ['2025-12-31', 104],
    ['2026-01-15', 108],
    ['2026-01-30', 112],
    ['2026-02-13', 115],
  ])

  const { series, xirrCashFlows } = buildDailyAnalyticsSeries({
    txns,
    effectiveSplitsByAsset: new Map(),
    assetDailyPrices: new Map([['spy', prices]]),
    dailyUsdThb: new Map(),
    currentUsdThbRate: 35,
    baseCurrency: 'THB',
    benchmarkDailyPrices: benchPrices,
    benchmarkCurrency: 'THB',
    liveAssetPrices: new Map([['spy', 132]]),
    todayStr: '2026-02-13',
  })

  const stats = computeKeyStats(series, 0, series.length - 1, undefined, 'THB')
  assert.strictEqual(stats.maxDrawdownPercent, -25, 'Max DD from 120 to 90 should be -25%')
  assert.strictEqual(stats.maxDrawdownPeakDate, '2025-11-17')
  assert.strictEqual(stats.maxDrawdownTroughDate, '2025-12-15')
  assert.strictEqual(stats.maxDrawdownRecoveryDate, '2026-01-30')
  assert.strictEqual(stats.isRecovered, true)
  assert.ok(stats.annualizedVolatilityPercent > 0)
  assert.ok(Number.isFinite(stats.sharpeRatio) && Number.isFinite(stats.sortinoRatio))
  assert.ok(stats.beta !== null && stats.beta > 0 && stats.correlation !== null)
  assert.ok(stats.winDays >= 1 && stats.lossDays >= 1)
  assert.ok(stats.bestDay !== null && stats.worstDay !== null)
  assert.ok(xirrCashFlows.length === 2)

  // Test 7: Monthly & Yearly Matrix
  const matrix = computeMonthlyReturnMatrix(series)
  assert.strictEqual(matrix.length, 2, 'Should have 2026 and 2025 rows')
  assert.strictEqual(matrix[0].year, 2026, 'Newest year first')
  assert.strictEqual(matrix[1].year, 2025)
  assert.strictEqual(matrix[1].months[11].returnPct, 20, 'Nov 2025 return 100 -> 120 = +20%')
  assert.strictEqual(matrix[1].months[12].returnPct, -20, 'Dec 2025 return 120 -> 96 = -20%')
  assert.strictEqual(matrix[1].annualReturnPct, -4, '2025 return 100 -> 96 = -4%')
  assert.strictEqual(matrix[0].months[1].returnPct, 31.25, 'Jan 2026 return 96 -> 126 = +31.25%')

  console.log('✅ Test 6 & 7 Passed: Key Stats (Max DD peak/trough/recovery, Beta, Ratios) & Monthly Matrix')

  // ── Test 8: Zoom Range Resolution & Availability ───────────────────────────────────────
  const zAll = resolveZoomIndices(series, 'all')
  assert.strictEqual(zAll.startIdx, 0)
  assert.strictEqual(zAll.endIdx, series.length - 1)

  const zYtd = resolveZoomIndices(series, 'ytd')
  assert.strictEqual(series[zYtd.startIdx].date.slice(0, 4), '2026', 'YTD should start in 2026')

  const z1m = resolveZoomIndices(series, '1m')
  assert.ok(series[z1m.startIdx].date >= '2026-01-13')

  assert.strictEqual(isZoomAvailable(series, '1m'), true)
  assert.strictEqual(isZoomAvailable(series, '5y'), false, '102-day history should disable 5y zoom')

  console.log('✅ Test 8 Passed: Zoom preset resolution & availability gating accurate')
}

console.log('\n🎉 ALL PORTFOLIO ANALYTICS & BENCHMARK UNIT TESTS PASSED!')
