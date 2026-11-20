/**
 * lib/analytics/stock-splits.test.ts
 * Comprehensive unit tests for stock splits & reverse splits across:
 * - Forward & reverse split multipliers and FIFO cost basis preservation
 * - Pre-split realized gains isolation vs post-split open lot adjustments
 * - Same-day ordering invariant (SPLIT before same-day post-split TXN)
 * - FIFO tax calculation & total lot commission preservation
 * - Sequential multiple splits & historical pre-holding no-op splits
 * - Manual override & 1:1 cancellation precedence
 * - Exchange timezone date normalization & Yahoo Finance event extraction
 */

import assert from 'assert'
import {
  StockSplitEvent,
  getSplitMultiplier,
  normalizeSplitDate,
  resolveEffectiveSplitsByAsset,
} from './stock-splits'
import { calculateSingleAssetFifoPosition } from './holdings'
import { calculateTaxReportFIFO, TaxTxnInput } from './tax-fifo'
import { extractDiscoveredSplitsFromYahooChart } from '../market-data/split-sync'

console.log('🧪 Starting Stock Split & Reverse Split Unit Tests...\n')

// Test 1: SNDK 8:1 forward split (0.5245 @ $1,098.65 -> 4.196 @ $137.33, total cost $576.24 invariant)
{
  const sndkSplits: StockSplitEvent[] = [
    {
      assetId: 'sndk',
      splitDate: '2026-11-20T00:00:00.000Z',
      numerator: 8,
      denominator: 1,
      splitRatio: '8:1',
      source: 'auto_yahoo',
    },
  ]

  const txns = [
    {
      assetId: 'sndk',
      txnDate: '2026-11-05T15:00:00.000Z',
      txnType: 'BUY',
      quantity: 0.5245,
      pricePerUnit: 1098.65,
    },
  ]

  const pos = calculateSingleAssetFifoPosition(txns, 81.01, sndkSplits)
  assert.ok(pos !== null, 'Position should exist')
  assert.strictEqual(pos.shares, 4.196, 'SNDK shares should multiply 8x to 4.196')
  assert.ok(Math.abs(pos.avgCost - 137.33) <= 0.01, `Avg cost ~$137.33 (got ${pos.avgCost})`)
  assert.ok(Math.abs(pos.totalCost - 576.24) <= 0.02, `Total cost ~$576.24 invariant (got ${pos.totalCost})`)
  assert.ok(Math.abs(pos.currentValue - 339.92) <= 0.05, `Current value ~$339.92 (got ${pos.currentValue})`)
  assert.ok(Math.abs(pos.unrealizedGainPercent - -41.01) <= 0.05, `PnL ~-41.01% (got ${pos.unrealizedGainPercent}%)`)
  console.log('✅ Test 1 Passed: SNDK 8:1 forward split preserves total cost ($576.24) and adjusts PnL (-41.01%)')
}

// Test 2: Pre-split May 2026 BUY+SELL + Nov 2026 BUY + Nov 20 8:1 split -> May 2026 realized gain untouched, Nov 2026 lots adjusted 8x
{
  const splitsMap = new Map<string, StockSplitEvent[]>([
    [
      'sndk',
      [
        {
          assetId: 'sndk',
          splitDate: '2026-11-20T00:00:00.000Z',
          numerator: 8,
          denominator: 1,
          splitRatio: '8:1',
          source: 'auto_yahoo',
        },
      ],
    ],
  ])

  const txns: TaxTxnInput[] = [
    {
      id: 'may-buy',
      assetId: 'sndk',
      ticker: 'SNDK',
      assetName: 'Sandisk',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: '2026-05-07T00:15:00.000Z',
      txnType: 'BUY',
      quantity: 0.5,
      pricePerUnit: 1300,
      fee: 0,
      taxWithheld: 0,
      totalAmount: 650,
    },
    {
      id: 'may-sell',
      assetId: 'sndk',
      ticker: 'SNDK',
      assetName: 'Sandisk',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: '2026-05-11T18:07:00.000Z',
      txnType: 'SELL',
      quantity: 0.5,
      pricePerUnit: 1400,
      fee: 0,
      taxWithheld: 0,
      totalAmount: 700,
    },
    {
      id: 'nov-buy',
      assetId: 'sndk',
      ticker: 'SNDK',
      assetName: 'Sandisk',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: '2026-11-05T15:00:00.000Z',
      txnType: 'BUY',
      quantity: 0.5245,
      pricePerUnit: 1098.65,
      fee: 0,
      taxWithheld: 0,
      totalAmount: 576.24,
    },
  ]

  const taxReport = calculateTaxReportFIFO(txns, 2026, 35.5, splitsMap)
  assert.strictEqual(taxReport.foreignAndCryptoGains.trades.length, 1)
  assert.strictEqual(taxReport.foreignAndCryptoGains.trades[0].costBasis, 650, 'May 2026 pre-split cost basis untouched')
  assert.strictEqual(taxReport.foreignAndCryptoGains.trades[0].realizedGain, 50, 'May 2026 realized gain untouched ($50)')

  const pos = calculateSingleAssetFifoPosition(txns, 81.01, splitsMap.get('sndk')!)
  assert.ok(pos !== null)
  assert.strictEqual(pos.shares, 4.196, 'Nov 2026 open lots adjusted 8x to 4.196')
  console.log('✅ Test 2 Passed: Pre-split May 2026 realized gain untouched while Nov 2026 lots adjusted 8x')
}

// Test 3: Same-day post-split manual BUY (2026-11-20T00:00:00.000Z @ $81.01) runs AFTER split -> NOT multiplied by 8
{
  const splits: StockSplitEvent[] = [
    {
      assetId: 'sndk',
      splitDate: '2026-11-20T00:00:00.000Z',
      numerator: 8,
      denominator: 1,
      splitRatio: '8:1',
    },
  ]

  const txns = [
    {
      assetId: 'sndk',
      txnDate: '2026-11-05T15:00:00.000Z',
      txnType: 'BUY',
      quantity: 0.5,
      pricePerUnit: 1000,
    },
    {
      assetId: 'sndk',
      txnDate: '2026-11-20T00:00:00.000Z', // Post-split manual buy entered with date-only midnight timestamp
      txnType: 'BUY',
      quantity: 2,
      pricePerUnit: 81.01,
    },
  ]

  const pos = calculateSingleAssetFifoPosition(txns, 81.01, splits)
  assert.ok(pos !== null)
  // 0.5 * 8 = 4 shares (@ $125 = $500) + 2 post-split shares (@ $81.01 = $162.02) = 6 shares, $662.02 total cost
  assert.strictEqual(pos.shares, 6, 'Same-day post-split buy must NOT be multiplied by 8')
  assert.ok(Math.abs(pos.totalCost - 662.02) <= 0.01, `Expected totalCost $662.02, got ${pos.totalCost}`)
  console.log('✅ Test 3 Passed: Same-day post-split BUY at midnight runs AFTER split and is not re-multiplied')
}

// Test 4: calculateTaxReportFIFO with 2:1 split + partial post-split SELL -> cost basis AND total lot fee allocated accurately
{
  const splitsMap = new Map<string, StockSplitEvent[]>([
    [
      'aapl',
      [
        {
          assetId: 'aapl',
          splitDate: '2026-06-01T00:00:00.000Z',
          numerator: 2,
          denominator: 1,
          splitRatio: '2:1',
        },
      ],
    ],
  ])

  const txns: TaxTxnInput[] = [
    {
      id: 'b1',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: '2026-02-01T10:00:00.000Z',
      txnType: 'BUY',
      quantity: 10,
      pricePerUnit: 100,
      fee: 5,
      taxWithheld: 0,
      totalAmount: 1005,
    },
    {
      id: 's1',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: '2026-08-15T10:00:00.000Z',
      txnType: 'SELL',
      quantity: 10, // Post-split 10 shares = 50% of 20 split-adjusted shares
      pricePerUnit: 60,
      fee: 2,
      taxWithheld: 0,
      totalAmount: 598,
    },
  ]

  const report = calculateTaxReportFIFO(txns, 2026, 35.5, splitsMap)
  assert.strictEqual(report.foreignAndCryptoGains.trades.length, 1)
  const trade = report.foreignAndCryptoGains.trades[0]
  assert.strictEqual(trade.sellProceeds, 598, 'Proceeds should be 10*60 - 2 = 598')
  assert.strictEqual(trade.costBasis, 502.5, 'Half of ($1,000 + $5 fee) = $502.50')
  assert.strictEqual(trade.realizedGain, 95.5, 'Realized gain should be 598 - 502.50 = $95.50')
  console.log('✅ Test 4 Passed: 2:1 split + partial post-split SELL allocates cost basis & buy fee accurately')
}

// Test 5: Reverse split 1:10 (100 @ $2 -> 10 @ $20, total cost $200 invariant)
{
  const reverseSplit: StockSplitEvent[] = [
    {
      assetId: 'rev',
      splitDate: '2026-09-01T00:00:00.000Z',
      numerator: 1,
      denominator: 10,
      splitRatio: '1:10',
      source: 'manual',
    },
  ]

  const txns = [
    {
      assetId: 'rev',
      txnDate: '2026-04-01T10:00:00.000Z',
      txnType: 'BUY',
      quantity: 100,
      pricePerUnit: 2,
    },
  ]

  const pos = calculateSingleAssetFifoPosition(txns, 25, reverseSplit)
  assert.ok(pos !== null)
  assert.strictEqual(pos.shares, 10, '100 shares / 10 = 10 shares')
  assert.strictEqual(pos.avgCost, 20, '$2 * 10 = $20 avg cost')
  assert.strictEqual(pos.totalCost, 200, 'Total cost $200 preserved')
  assert.strictEqual(pos.unrealizedGain, 50, '10 * $25 - $200 = $50')
  console.log('✅ Test 5 Passed: Reverse split 1:10 halves/reduces shares (100 -> 10) and scales cost ($2 -> $20)')
}

// Test 6: Sequential multiple splits (4:1 then 10:1 = 40x, e.g. NVDA)
{
  const nvdaSplits: StockSplitEvent[] = [
    {
      assetId: 'nvda',
      splitDate: '2021-07-20T00:00:00.000Z',
      numerator: 4,
      denominator: 1,
      splitRatio: '4:1',
    },
    {
      assetId: 'nvda',
      splitDate: '2024-06-10T00:00:00.000Z',
      numerator: 10,
      denominator: 1,
      splitRatio: '10:1',
    },
  ]

  const txns = [
    {
      assetId: 'nvda',
      txnDate: '2020-05-01T14:00:00.000Z',
      txnType: 'BUY',
      quantity: 2,
      pricePerUnit: 400,
    },
  ]

  const pos = calculateSingleAssetFifoPosition(txns, 140, nvdaSplits)
  assert.ok(pos !== null)
  assert.strictEqual(pos.shares, 80, '2 * 4 * 10 = 80 shares')
  assert.strictEqual(pos.avgCost, 10, '$400 / 40 = $10 avg cost')
  assert.strictEqual(pos.totalCost, 800, 'Total cost $800 preserved')
  console.log('✅ Test 6 Passed: Sequential splits (4:1 then 10:1) compound cleanly to 40x')
}

// Test 7: Historical split before user's first buy (e.g. 2022 split, 2026 buy) -> safe no-op
{
  const googlSplits: StockSplitEvent[] = [
    {
      assetId: 'googl',
      splitDate: '2022-07-18T00:00:00.000Z',
      numerator: 20,
      denominator: 1,
      splitRatio: '20:1',
    },
  ]

  const txns = [
    {
      assetId: 'googl',
      txnDate: '2026-03-01T14:00:00.000Z',
      txnType: 'BUY',
      quantity: 5,
      pricePerUnit: 175,
    },
  ]

  const pos = calculateSingleAssetFifoPosition(txns, 180, googlSplits)
  assert.ok(pos !== null)
  assert.strictEqual(pos.shares, 5, '2022 split before 2026 buy must NOT affect 2026 buy')
  assert.strictEqual(pos.avgCost, 175, '2022 split must NOT divide 2026 avg cost')
  console.log('✅ Test 7 Passed: Historical split prior to first purchase acts as safe no-op')
}

// Test 8: Manual override of auto_yahoo on same date + manual 1:1 cancellation
{
  const rows: StockSplitEvent[] = [
    {
      assetId: 'a1',
      splitDate: '2026-11-20T00:00:00.000Z',
      numerator: 8,
      denominator: 1,
      splitRatio: '8:1',
      source: 'auto_yahoo',
    },
    {
      assetId: 'a1',
      splitDate: '2026-11-20T00:00:00.000Z',
      numerator: 10,
      denominator: 1,
      splitRatio: '10:1',
      source: 'manual',
    },
    {
      assetId: 'a2',
      splitDate: '2026-06-01T00:00:00.000Z',
      numerator: 2,
      denominator: 1,
      splitRatio: '2:1',
      source: 'auto_yahoo',
    },
    {
      assetId: 'a2',
      splitDate: '2026-06-01T00:00:00.000Z',
      numerator: 1,
      denominator: 1,
      splitRatio: '1:1',
      source: 'manual',
    },
  ]

  const resolved = resolveEffectiveSplitsByAsset(rows)
  const a1Splits = resolved.get('a1') || []
  assert.strictEqual(a1Splits.length, 1, 'Should deduplicate to 1 effective split for a1')
  assert.strictEqual(getSplitMultiplier(a1Splits[0]), 10, 'Manual 10:1 overrides auto_yahoo 8:1')

  const a2Splits = resolved.get('a2') || []
  assert.strictEqual(a2Splits.length, 0, 'Manual 1:1 cancels auto_yahoo 2:1 completely')
  console.log('✅ Test 8 Passed: Manual override wins over auto_yahoo and 1:1 override cancels split')
}

// Test 9: Exchange timezone date normalization & Yahoo Finance chart extraction (uses s.date, not object key)
{
  const usDate = normalizeSplitDate(1795185000, 'US')
  assert.strictEqual(usDate.toISOString(), '2026-11-20T00:00:00.000Z', 'SNDK US split timestamp 1795185000 -> 2026-11-20')

  const thDate = normalizeSplitDate(1524538800, 'TH')
  assert.strictEqual(thDate.toISOString(), '2018-04-24T00:00:00.000Z', 'PTT.BK TH split timestamp 1524538800 -> 2018-04-24')

  const fakeYahooChart = {
    events: {
      splits: {
        // Object key is month-start timestamp (Nov 1), whereas s.date is actual ex-split date (Nov 20)!
        '1793505600': {
          date: 1795185000,
          numerator: 8,
          denominator: 1,
          splitRatio: '8:1',
        },
      },
    },
  }
  const extracted = extractDiscoveredSplitsFromYahooChart(fakeYahooChart, 'US')
  assert.strictEqual(extracted.length, 1)
  assert.strictEqual(extracted[0].splitDate.toISOString(), '2026-11-20T00:00:00.000Z', 'Must read s.date rather than month-start object key')
  assert.strictEqual(extracted[0].splitRatio, '8:1')
  console.log('✅ Test 9 Passed: US/TH exchange timezone normalization & Yahoo chart split extraction accurate')
}

console.log('\n🎉 ALL STOCK SPLIT UNIT TESTS PASSED!')
