/**
 * lib/analytics/tax-fifo.test.ts
 * Unit tests for FIFO cost basis tax calculation engine.
 */

import { calculateTaxReportFIFO, TaxTxnInput } from './tax-fifo'
import assert from 'assert'

console.log('🧪 Starting FIFO Tax Calculation Unit Tests...\n')

// Test Case 1: Simple Buy and Sell with FIFO lot matching (US stocks in USD)
{
  const txns: TaxTxnInput[] = [
    // Lot 1: Buy 100 shares @ $100 + $5 fee = $10,005
    {
      id: '1',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',  // ← required new field
      txnDate: new Date('2026-01-10T10:00:00Z'),
      txnType: 'BUY',
      quantity: 100,
      pricePerUnit: 100,
      fee: 5,
      taxWithheld: 0,
      totalAmount: 10005,
    },
    // Lot 2: Buy 50 shares @ $120 + $5 fee = $6,005
    {
      id: '2',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: new Date('2026-02-15T10:00:00Z'),
      txnType: 'BUY',
      quantity: 50,
      pricePerUnit: 120,
      fee: 5,
      taxWithheld: 0,
      totalAmount: 6005,
    },
    // Sell 120 shares @ $150 (should consume all 100 of Lot 1 + 20 of Lot 2)
    {
      id: '3',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: new Date('2026-06-20T10:00:00Z'),
      txnType: 'SELL',
      quantity: 120,
      pricePerUnit: 150,
      fee: 10,
      taxWithheld: 0,
      totalAmount: 17990,
    },
  ]

  const report = calculateTaxReportFIFO(txns, 2026, 35.5)
  assert.strictEqual(report.foreignAndCryptoGains.trades.length, 1, 'Should have 1 foreign trade')

  const trade = report.foreignAndCryptoGains.trades[0]
  // Proceeds = 120 * 150 - 10 = 17,990
  assert.strictEqual(trade.sellProceeds, 17990, 'Sell proceeds calculation')

  // Cost basis: Lot 1 (100 * 100 + 5 = 10,005) + Lot 2 (20/50 * (50 * 120 + 5) = 2402)
  // Expected cost = 10,005 + 2,402 = 12,407
  assert.strictEqual(trade.costBasis, 12407, 'FIFO cost basis calculation')

  // Realized Gain = 17,990 - 12,407 = 5,583
  assert.strictEqual(trade.realizedGain, 5583, 'Realized gain calculation')

  // USD figures should be populated
  assert.strictEqual(trade.currency, 'USD', 'US stock trade should have USD currency')
  assert.ok(trade.realizedGainTHB > 0, 'THB equivalent should be calculated')
  console.log('✅ Test 1 Passed: FIFO partial lot consumption matches expected cost basis')
}

// Test Case 2: Thai SET Capital Gains are classified as Tax Exempt
{
  const txns: TaxTxnInput[] = [
    {
      id: '4',
      assetId: 'ptt',
      ticker: 'PTT',
      assetName: 'PTT Public Company',
      market: 'TH',
      assetType: 'stock',
      currency: 'THB',  // ← required new field
      txnDate: new Date('2026-03-01T10:00:00Z'),
      txnType: 'BUY',
      quantity: 1000,
      pricePerUnit: 30,
      fee: 20,
      taxWithheld: 0,
      totalAmount: 30020,
    },
    {
      id: '5',
      assetId: 'ptt',
      ticker: 'PTT',
      assetName: 'PTT Public Company',
      market: 'TH',
      assetType: 'stock',
      currency: 'THB',
      txnDate: new Date('2026-05-01T10:00:00Z'),
      txnType: 'SELL',
      quantity: 1000,
      pricePerUnit: 35,
      fee: 20,
      taxWithheld: 0,
      totalAmount: 34980,
    },
  ]

  const report = calculateTaxReportFIFO(txns, 2026, 35.5)
  assert.strictEqual(report.thaiSetCapitalGains.trades.length, 1, 'Should record in Thai SET section')
  assert.strictEqual(report.thaiSetCapitalGains.taxExempt, true, 'Thai SET capital gains must be tax-exempt')
  assert.strictEqual(report.thaiSetCapitalGains.totalRealizedGain, 4960, 'Thai SET gain calculation')
  console.log('✅ Test 2 Passed: Thai SET capital gains correctly isolated and marked tax-exempt')
}

// Test Case 3: Dividend calculations and withholding tax aggregation (THB)
{
  const txns: TaxTxnInput[] = [
    {
      id: '6',
      assetId: 'cpall',
      ticker: 'CPALL',
      assetName: 'CP ALL Public Co',
      market: 'TH',
      assetType: 'stock',
      currency: 'THB',  // ← required new field
      txnDate: new Date('2026-04-15T10:00:00Z'),
      txnType: 'DIVIDEND',
      quantity: 0,
      pricePerUnit: 0,
      fee: 0,
      taxWithheld: 100, // 10% withheld
      totalAmount: 900, // net received
    },
  ]

  const report = calculateTaxReportFIFO(txns, 2026, 35.5)
  assert.strictEqual(report.dividends.items.length, 1, 'Should have 1 dividend item')
  // THB dividend: gross = 900 + 100 = 1000
  assert.strictEqual(report.dividends.totalDividendGrossTHB, 1000, 'Gross dividend THB should be 1000')
  assert.strictEqual(report.dividends.totalTaxWithheldTHB, 100, 'Tax withheld THB should be 100')
  assert.strictEqual(report.dividends.totalDividendNetTHB, 900, 'Net dividend THB should be 900')
  // USD aggregation should be 0 for a THB dividend
  assert.strictEqual(report.dividends.totalDividendGrossUSD, 0, 'THB dividend should not add to USD totals')
  console.log('✅ Test 3 Passed: Dividends gross, tax withheld, and net calculated accurately (THB)')
}

console.log('\n🎉 ALL FIFO UNIT TESTS PASSED SUCCESSFULLY!')
