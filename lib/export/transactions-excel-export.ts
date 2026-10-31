/**
 * lib/export/transactions-excel-export.ts
 * Professional Multi-Sheet Excel (.xlsx) Export Engine for Portfolio Transactions Ledger
 */

export interface TransactionExportItem {
  id: string
  txnDate: string | Date
  txnType: string
  quantity: number
  pricePerUnit: number
  fee: number
  taxWithheld: number
  totalAmount: number
  note?: string | null
  source?: string | null
  asset?: {
    ticker: string
    assetName: string
    assetType: string
    market: string
    currency: string
  } | null
  account?: {
    accountName: string
    currency: string
  } | null
}

export interface TransactionsExportOptions {
  title?: string
  userName?: string
  filterSummary?: string
}

function autoFitColumns(rows: any[][], minWidth = 10, maxWidth = 60) {
  const colWidths: number[] = []
  rows.forEach((row) => {
    if (!Array.isArray(row)) return
    row.forEach((cell, colIndex) => {
      let str = ''
      if (cell === null || cell === undefined) {
        str = ''
      } else if (typeof cell === 'object' && cell.v !== undefined) {
        str = String(cell.v)
      } else {
        str = String(cell)
      }
      const len = Math.ceil(str.length * 1.15)
      colWidths[colIndex] = Math.max(colWidths[colIndex] || minWidth, len)
    })
  })
  return colWidths.map((w) => ({ wch: Math.min(Math.max(w, minWidth), maxWidth) }))
}

function numCell(val: number, format = '#,##0.00') {
  return { t: 'n', v: Math.round(val * 100) / 100, z: format }
}

export async function exportTransactionsToExcel(
  transactions: TransactionExportItem[],
  options: TransactionsExportOptions = {}
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const exportedAtStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // =========================================================================
  // SHEET 1: 📊 สรุปภาพรวมธุรกรรม (Portfolio Activity Summary)
  // =========================================================================
  const summaryAoa: any[][] = []

  summaryAoa.push(['รายงานสรุปภาพรวมประวัติธุรกรรมพอร์ตการลงทุน (Investment Activity & Portfolio Summary)'])
  summaryAoa.push([
    `ระบบ: Investment Pro | วันที่พิมพ์รายงาน: ${exportedAtStr} | จำนวนธุรกรรมทั้งหมด: ${transactions.length} รายการ`,
  ])
  if (options.filterSummary) {
    summaryAoa.push([`ตัวกรองข้อมูล: ${options.filterSummary}`])
  }
  summaryAoa.push([])

  // Calculate totals by type
  const typeMap: Record<string, { count: number; totalAmount: number; fee: number; tax: number }> = {}
  let grandTotalBuy = 0
  let grandTotalSell = 0
  let grandTotalDiv = 0
  let grandTotalDeposit = 0
  let grandTotalWithdraw = 0
  let grandTotalFee = 0

  transactions.forEach((t) => {
    const type = t.txnType
    if (!typeMap[type]) {
      typeMap[type] = { count: 0, totalAmount: 0, fee: 0, tax: 0 }
    }
    const amt = Number(t.totalAmount || 0)
    const fee = Number(t.fee || 0)
    const tax = Number(t.taxWithheld || 0)

    typeMap[type].count += 1
    typeMap[type].totalAmount += amt
    typeMap[type].fee += fee
    typeMap[type].tax += tax

    grandTotalFee += fee
    if (type === 'BUY') grandTotalBuy += amt
    if (type === 'SELL') grandTotalSell += amt
    if (type === 'DIVIDEND') grandTotalDiv += amt
    if (type === 'DEPOSIT') grandTotalDeposit += amt
    if (type === 'WITHDRAW') grandTotalWithdraw += amt
  })

  summaryAoa.push(['[1] สรุปสถิติแยกตามประเภทธุรกรรม (Activity by Transaction Type)'])
  summaryAoa.push([
    'ประเภทธุรกรรม',
    'ความหมาย',
    'จำนวนรายการ',
    'มูลค่ารวมสุทธิ',
    'ค่าธรรมเนียมรวม',
    'ภาษีหัก ณ ที่จ่ายรวม',
    'สัดส่วนเทียบรายการทั้งหมด (%)',
  ])

  const typeLabels: Record<string, string> = {
    BUY: 'ซื้อสินทรัพย์ (Asset Purchase)',
    SELL: 'ขายสินทรัพย์ (Asset Disposal)',
    DIVIDEND: 'เงินปันผลรับ (Dividend Inflow)',
    DEPOSIT: 'ฝากเงินสดเข้าพอร์ต (Cash Deposit)',
    WITHDRAW: 'ถอนเงินสดออกจากพอร์ต (Cash Withdrawal)',
    FEE: 'ค่าธรรมเนียมอื่นๆ (Other Fees)',
  }

  const allTypes = ['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE']
  allTypes.forEach((typeKey) => {
    const data = typeMap[typeKey] || { count: 0, totalAmount: 0, fee: 0, tax: 0 }
    const pct = transactions.length > 0 ? (data.count / transactions.length) * 100 : 0
    summaryAoa.push([
      typeKey,
      typeLabels[typeKey] || typeKey,
      data.count,
      numCell(data.totalAmount, '#,##0.00'),
      numCell(data.fee, '#,##0.00'),
      numCell(data.tax, '#,##0.00'),
      { t: 'n', v: Math.round(pct * 100) / 10000, z: '0.00%' },
    ])
  })

  summaryAoa.push([])
  summaryAoa.push([
    '--- รวมทั้งสิ้น (GRAND TOTAL) ---',
    '',
    transactions.length,
    numCell(
      Object.values(typeMap).reduce((s, d) => s + d.totalAmount, 0),
      '#,##0.00'
    ),
    numCell(grandTotalFee, '#,##0.00'),
    numCell(
      Object.values(typeMap).reduce((s, d) => s + d.tax, 0),
      '#,##0.00'
    ),
    { t: 'n', v: 1.0, z: '0.00%' },
  ])
  summaryAoa.push([])

  // Account Breakdown
  const accountMap: Record<string, { count: number; buy: number; sell: number; div: number }> = {}
  transactions.forEach((t) => {
    const acc = t.account?.accountName || 'บัญชีทั่วไป'
    if (!accountMap[acc]) {
      accountMap[acc] = { count: 0, buy: 0, sell: 0, div: 0 }
    }
    accountMap[acc].count += 1
    const amt = Number(t.totalAmount || 0)
    if (t.txnType === 'BUY') accountMap[acc].buy += amt
    if (t.txnType === 'SELL') accountMap[acc].sell += amt
    if (t.txnType === 'DIVIDEND') accountMap[acc].div += amt
  })

  summaryAoa.push(['[2] สรุปการเคลื่อนไหวแยกตามบัญชีและโบรกเกอร์ (Activity by Account / Brokerage)'])
  summaryAoa.push([
    'ชื่อบัญชี / โบรกเกอร์',
    'จำนวนธุรกรรม',
    'ยอดซื้อรวม (Buy Volume)',
    'ยอดขายรวม (Sell Volume)',
    'เงินปันผลรับรวม (Dividends)',
  ])

  Object.entries(accountMap).forEach(([accName, info]) => {
    summaryAoa.push([
      accName,
      info.count,
      numCell(info.buy, '#,##0.00'),
      numCell(info.sell, '#,##0.00'),
      numCell(info.div, '#,##0.00'),
    ])
  })

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa)
  wsSummary['!cols'] = autoFitColumns(summaryAoa, 12, 60)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวม (Summary)')

  // =========================================================================
  // SHEET 2: 📑 สมุดรายการธุรกรรมทั้งหมด (Transaction Ledger)
  // =========================================================================
  const ledgerAoa: any[][] = []

  ledgerAoa.push(['สมุดรายการธุรกรรมพอร์ตการลงทุน (Complete Transactions Ledger)'])
  ledgerAoa.push([`วันที่ส่งออกข้อมูล: ${exportedAtStr}`])
  ledgerAoa.push([])

  ledgerAoa.push([
    'ลำดับ',
    'วันที่ทำรายการ',
    'สัญลักษณ์ (Ticker)',
    'ชื่อสินทรัพย์',
    'ประเภทสินทรัพย์',
    'ตลาด',
    'บัญชี / โบรกเกอร์',
    'ประเภทธุรกรรม',
    'จำนวนหน่วย (Quantity)',
    'ราคาต่อหน่วย (Price)',
    'ค่าธรรมเนียม (Fee)',
    'ภาษีหัก ณ ที่จ่าย (Withheld Tax)',
    'มูลค่ารวมสุทธิ (Total Amount)',
    'สกุลเงิน',
    'แหล่งที่มา (Source)',
    'บันทึกเพิ่มเติม (Note)',
  ])

  let sumQty = 0
  let sumFee = 0
  let sumTax = 0
  let sumTotal = 0

  transactions.forEach((t, index) => {
    const qty = Number(t.quantity || 0)
    const price = Number(t.pricePerUnit || 0)
    const fee = Number(t.fee || 0)
    const tax = Number(t.taxWithheld || 0)
    const total = Number(t.totalAmount || 0)

    sumQty += qty
    sumFee += fee
    sumTax += tax
    sumTotal += total

    const dateStr = new Date(t.txnDate).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    ledgerAoa.push([
      index + 1,
      dateStr,
      t.asset?.ticker || '-',
      t.asset?.assetName || t.asset?.ticker || '-',
      t.asset?.assetType || '-',
      t.asset?.market || '-',
      t.account?.accountName || 'บัญชีหลัก',
      t.txnType,
      numCell(qty, '#,##0.000000'),
      numCell(price, '#,##0.00'),
      numCell(fee, '#,##0.00'),
      numCell(tax, '#,##0.00'),
      numCell(total, '#,##0.00'),
      t.asset?.currency || t.account?.currency || 'THB',
      t.source || 'manual',
      t.note || '',
    ])
  })

  // Total Row
  ledgerAoa.push([])
  ledgerAoa.push([
    '--- รวมทั้งสิ้น (TOTAL) ---',
    `${transactions.length} รายการ`,
    '',
    '',
    '',
    '',
    '',
    '',
    numCell(sumQty, '#,##0.000000'),
    '-',
    numCell(sumFee, '#,##0.00'),
    numCell(sumTax, '#,##0.00'),
    numCell(sumTotal, '#,##0.00'),
    '',
    '',
    '',
  ])

  const wsLedger = XLSX.utils.aoa_to_sheet(ledgerAoa)
  wsLedger['!cols'] = autoFitColumns(ledgerAoa, 12, 45)
  XLSX.utils.book_append_sheet(wb, wsLedger, 'สมุดธุรกรรม (Ledger)')

  const filename = `Transactions_Ledger_${new Date().toISOString().slice(0, 10)}_InvestmentPro.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}
