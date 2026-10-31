/**
 * lib/export/export.test.ts
 * Test Excel generation for Tax Report and Transactions
 */

import { calculateTaxReportFIFO, TaxTxnInput } from '../analytics/tax-fifo'
import { exportTaxReportToExcel } from './tax-excel-export'
import { exportTransactionsToExcel, TransactionExportItem } from './transactions-excel-export'
import assert from 'assert'
import fs from 'fs'

async function runExportTests() {
  console.log('🧪 Testing Excel Export Engine...\n')

  const sampleTxns: TaxTxnInput[] = [
    {
      id: 'tx-1',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: new Date('2026-01-15T10:00:00Z'),
      txnType: 'BUY',
      quantity: 10,
      pricePerUnit: 180,
      fee: 2,
      taxWithheld: 0,
      totalAmount: 1802,
      accountName: 'Dime! Wallet',
    },
    {
      id: 'tx-2',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: new Date('2026-05-20T10:00:00Z'),
      txnType: 'DIVIDEND',
      quantity: 10,
      pricePerUnit: 0.25,
      fee: 0,
      taxWithheld: 0.38,
      totalAmount: 2.12,
      accountName: 'Dime! Wallet',
    },
    {
      id: 'tx-3',
      assetId: 'aapl',
      ticker: 'AAPL',
      assetName: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      currency: 'USD',
      txnDate: new Date('2026-08-10T10:00:00Z'),
      txnType: 'SELL',
      quantity: 10,
      pricePerUnit: 220,
      fee: 5,
      taxWithheld: 0,
      totalAmount: 2195,
      accountName: 'Dime! Wallet',
    },
    {
      id: 'tx-4',
      assetId: 'ptt',
      ticker: 'PTT',
      assetName: 'PTT Public Co., Ltd.',
      market: 'TH',
      assetType: 'stock',
      currency: 'THB',
      txnDate: new Date('2026-02-01T10:00:00Z'),
      txnType: 'BUY',
      quantity: 1000,
      pricePerUnit: 32,
      fee: 50,
      taxWithheld: 0,
      totalAmount: 32050,
      accountName: 'InnovestX TH',
    },
    {
      id: 'tx-5',
      assetId: 'ptt',
      ticker: 'PTT',
      assetName: 'PTT Public Co., Ltd.',
      market: 'TH',
      assetType: 'stock',
      currency: 'THB',
      txnDate: new Date('2026-09-01T10:00:00Z'),
      txnType: 'SELL',
      quantity: 1000,
      pricePerUnit: 36,
      fee: 60,
      taxWithheld: 0,
      totalAmount: 35940,
      accountName: 'InnovestX TH',
    },
  ]

  const report = calculateTaxReportFIFO(sampleTxns, 2026, 36.0)

  // 1. Test Tax Excel generation
  const taxFile = await exportTaxReportToExcel(report, {
    selectedYear: 2026,
    usdThbRate: 36.0,
    repatriated: true,
    aiExplanation: 'คำแนะนำจาก AI: มีการรับรู้กำไรจากหุ้น AAPL ในปี 2569 จำนวน $393 ซึ่งแปลงเป็นเงินบาทได้ ฿14,148',
    userName: 'ทดสอบ ผู้ลงทุน',
  })

  assert.ok(fs.existsSync(taxFile), 'Tax Excel file should be created')
  console.log(`✅ Generated Tax Report Excel: ${taxFile} (${fs.statSync(taxFile).size} bytes)`)

  // 2. Test Transactions Excel generation
  const transactionItems: TransactionExportItem[] = sampleTxns.map((t) => ({
    id: t.id,
    txnDate: t.txnDate,
    txnType: t.txnType,
    quantity: t.quantity,
    pricePerUnit: t.pricePerUnit,
    fee: t.fee,
    taxWithheld: t.taxWithheld,
    totalAmount: t.totalAmount,
    account: { accountName: t.accountName || 'บัญชีหลัก', currency: t.currency },
    asset: {
      ticker: t.ticker,
      assetName: t.assetName,
      assetType: t.assetType,
      market: t.market,
      currency: t.currency,
    },
  }))

  const txnFile = await exportTransactionsToExcel(transactionItems, {
    userName: 'ทดสอบ ผู้ลงทุน',
  })

  assert.ok(fs.existsSync(txnFile), 'Transactions Excel file should be created')
  console.log(`✅ Generated Transactions Excel: ${txnFile} (${fs.statSync(txnFile).size} bytes)`)

  // Cleanup test files
  if (fs.existsSync(taxFile)) fs.unlinkSync(taxFile)
  if (fs.existsSync(txnFile)) fs.unlinkSync(txnFile)
  console.log('🧹 Cleaned up temporary test files')
  console.log('🎉 ALL EXCEL EXPORT TESTS PASSED!')
}

runExportTests().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
