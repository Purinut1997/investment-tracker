/**
 * lib/export/transactions-excel-export.ts
 * Luxury Multi-Sheet Transactions Ledger Export Engine
 * Powered by xlsx-js-style for complete cell styling, borders, colors, and freeze panes
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

// ─── Color Palette & Styling Tokens ─────────────────────────
const C = {
  navyDark: '0F172A',
  navyMedium: '1E293B',
  indigoDark: '1E1B4B',
  slateLight: 'F8FAFC',
  slateZebra: 'F1F5F9',
  slateBorder: 'CBD5E1',
  emeraldBg: 'D1FAE5',
  emeraldText: '065F46',
  roseBg: 'FFE4E6',
  roseText: '9F1239',
  cyanBg: 'CFFAFE',
  cyanText: '155E75',
  amberBg: 'FEF3C7',
  amberText: '92400E',
  indigoBg: 'E0E7FF',
  indigoText: '3730A3',
  textDark: '0F172A',
  textMuted: '475569',
  white: 'FFFFFF',
}

const borderThin = {
  top: { style: 'thin', color: { rgb: C.slateBorder } },
  bottom: { style: 'thin', color: { rgb: C.slateBorder } },
  left: { style: 'thin', color: { rgb: C.slateBorder } },
  right: { style: 'thin', color: { rgb: C.slateBorder } },
}

const borderAccountingTotal = {
  top: { style: 'thin', color: { rgb: C.navyMedium } },
  bottom: { style: 'double', color: { rgb: C.navyDark } },
  left: { style: 'thin', color: { rgb: C.slateBorder } },
  right: { style: 'thin', color: { rgb: C.slateBorder } },
}

function makeTitleCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.navyDark } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    },
  }
}

function makeMetaCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, italic: true, color: { rgb: C.textMuted } },
      fill: { fgColor: { rgb: C.slateLight } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: { bottom: { style: 'thin', color: { rgb: C.slateBorder } } },
    },
  }
}

function makeSectionHeaderCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.indigoDark } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    },
  }
}

function makeThCell(text: string, align: 'left' | 'center' | 'right' = 'center') {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: C.white } },
      fill: { fgColor: { rgb: C.navyMedium } },
      alignment: { horizontal: align, vertical: 'center', wrapText: true },
      border: {
        top: { style: 'medium', color: { rgb: C.navyDark } },
        bottom: { style: 'medium', color: { rgb: C.navyDark } },
        left: { style: 'thin', color: { rgb: '475569' } },
        right: { style: 'thin', color: { rgb: '475569' } },
      },
    },
  }
}

function makeTextCell(text: string, rowIndex: number, align: 'left' | 'center' | 'right' = 'left') {
  const isEven = rowIndex % 2 === 0
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, color: { rgb: C.textDark } },
      fill: { fgColor: { rgb: isEven ? C.white : C.slateZebra } },
      alignment: { horizontal: align, vertical: 'center' },
      border: borderThin,
    },
  }
}

function makeNumCell(val: number, rowIndex: number, format = '#,##0.00', bold = false) {
  const isEven = rowIndex % 2 === 0
  return {
    v: Math.round(val * 100) / 100,
    t: 'n',
    z: format,
    s: {
      font: { name: 'Segoe UI', sz: 9.5, bold, color: { rgb: C.textDark } },
      fill: { fgColor: { rgb: isEven ? C.white : C.slateZebra } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderThin,
    },
  }
}

function makeTypeBadgeCell(type: string, rowIndex: number) {
  let fgColor = C.slateLight
  let fontColor = C.textDark

  if (type === 'BUY') {
    fgColor = C.emeraldBg
    fontColor = C.emeraldText
  } else if (type === 'SELL') {
    fgColor = C.roseBg
    fontColor = C.roseText
  } else if (type === 'DIVIDEND') {
    fgColor = C.cyanBg
    fontColor = C.cyanText
  } else if (type === 'DEPOSIT') {
    fgColor = C.indigoBg
    fontColor = C.indigoText
  } else if (type === 'WITHDRAW') {
    fgColor = C.amberBg
    fontColor = C.amberText
  }

  return {
    v: type,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: fontColor } },
      fill: { fgColor: { rgb: fgColor } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderThin,
    },
  }
}

function makeTotalCell(val: string | number, format = '#,##0.00', align: 'left' | 'center' | 'right' = 'right') {
  if (typeof val === 'number') {
    return {
      v: Math.round(val * 100) / 100,
      t: 'n',
      z: format,
      s: {
        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: C.navyDark } },
        fill: { fgColor: { rgb: C.amberBg } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: borderAccountingTotal,
      },
    }
  }

  return {
    v: String(val),
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: C.navyDark } },
      fill: { fgColor: { rgb: C.amberBg } },
      alignment: { horizontal: align, vertical: 'center' },
      border: borderAccountingTotal,
    },
  }
}

function makeBlankCell() {
  return { v: '', t: 's', s: { fill: { fgColor: { rgb: C.white } } } }
}

function calculateColWidths(rows: any[][], minWidth = 11, maxWidth = 55) {
  const widths: number[] = []
  rows.forEach((row) => {
    if (!Array.isArray(row)) return
    row.forEach((cell, i) => {
      let str = ''
      if (cell && typeof cell === 'object') {
        str = cell.v !== undefined && cell.v !== null ? String(cell.v) : ''
      } else if (cell !== undefined && cell !== null) {
        str = String(cell)
      }
      const len = Math.ceil(str.length * 1.15)
      widths[i] = Math.max(widths[i] || minWidth, len)
    })
  })
  return widths.map((w) => ({ wch: Math.min(Math.max(w, minWidth), maxWidth) }))
}

export async function exportTransactionsToExcel(
  transactions: TransactionExportItem[],
  options: TransactionsExportOptions = {}
) {
  const XLSX = await import('xlsx-js-style')
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
  const s1: any[][] = []

  s1.push([makeTitleCell('รายงานสรุปภาพรวมประวัติธุรกรรมพอร์ตการลงทุน (Investment Activity & Portfolio Summary)')])
  s1.push([
    makeMetaCell(
      `ระบบ: Investment Pro | วันที่พิมพ์รายงาน: ${exportedAtStr} | จำนวนธุรกรรมทั้งหมด: ${transactions.length} รายการ${
        options.filterSummary ? ` | ตัวกรอง: ${options.filterSummary}` : ''
      }`
    ),
  ])
  s1.push([makeBlankCell()])

  // Aggregate activity
  const typeMap: Record<string, { count: number; totalAmount: number; fee: number; tax: number }> = {}
  let grandTotalBuy = 0
  let grandTotalSell = 0
  let grandTotalDiv = 0
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
  })

  s1.push([makeSectionHeaderCell('[1] สรุปสถิติแยกตามประเภทธุรกรรม (Activity by Transaction Type)')])
  s1.push([
    makeThCell('ประเภทธุรกรรม', 'center'),
    makeThCell('ความหมาย', 'left'),
    makeThCell('จำนวนรายการ', 'center'),
    makeThCell('มูลค่ารวมสุทธิ', 'right'),
    makeThCell('ค่าธรรมเนียมรวม', 'right'),
    makeThCell('ภาษีหัก ณ ที่จ่ายรวม', 'right'),
    makeThCell('สัดส่วนเทียบรายการทั้งหมด (%)', 'right'),
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
  allTypes.forEach((typeKey, idx) => {
    const data = typeMap[typeKey] || { count: 0, totalAmount: 0, fee: 0, tax: 0 }
    const pct = transactions.length > 0 ? (data.count / transactions.length) * 100 : 0
    s1.push([
      makeTypeBadgeCell(typeKey, idx),
      makeTextCell(typeLabels[typeKey] || typeKey, idx),
      makeTextCell(`${data.count} รายการ`, idx, 'center'),
      makeNumCell(data.totalAmount, idx, '#,##0.00', true),
      makeNumCell(data.fee, idx, '#,##0.00'),
      makeNumCell(data.tax, idx, '#,##0.00'),
      {
        v: Math.round(pct * 100) / 10000,
        t: 'n',
        z: '0.00%',
        s: {
          font: { name: 'Segoe UI', sz: 9.5, color: { rgb: C.textDark } },
          fill: { fgColor: { rgb: idx % 2 === 0 ? C.white : C.slateZebra } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: borderThin,
        },
      },
    ])
  })

  s1.push([
    makeTotalCell('--- รวมทั้งสิ้น (GRAND TOTAL) ---', '#,##0.00', 'left'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell(`${transactions.length} รายการ`, '#,##0.00', 'center'),
    makeTotalCell(
      Object.values(typeMap).reduce((s, d) => s + d.totalAmount, 0),
      '#,##0.00'
    ),
    makeTotalCell(grandTotalFee, '#,##0.00'),
    makeTotalCell(
      Object.values(typeMap).reduce((s, d) => s + d.tax, 0),
      '#,##0.00'
    ),
    makeTotalCell('100.00%', '#,##0.00', 'right'),
  ])
  s1.push([makeBlankCell()])

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

  s1.push([makeSectionHeaderCell('[2] สรุปการเคลื่อนไหวแยกตามบัญชีและโบรกเกอร์ (Activity by Account / Brokerage)')])
  s1.push([
    makeThCell('ชื่อบัญชี / โบรกเกอร์', 'left'),
    makeThCell('จำนวนธุรกรรม', 'center'),
    makeThCell('ยอดซื้อรวม (Buy Volume)', 'right'),
    makeThCell('ยอดขายรวม (Sell Volume)', 'right'),
    makeThCell('เงินปันผลรับรวม (Dividends)', 'right'),
  ])

  Object.entries(accountMap).forEach(([accName, info], idx) => {
    s1.push([
      makeTextCell(accName, idx, 'left'),
      makeTextCell(`${info.count} รายการ`, idx, 'center'),
      makeNumCell(info.buy, idx, '#,##0.00'),
      makeNumCell(info.sell, idx, '#,##0.00'),
      makeNumCell(info.div, idx, '#,##0.00', true),
    ])
  })

  const wsSummary = XLSX.utils.aoa_to_sheet(s1)
  wsSummary['!cols'] = calculateColWidths(s1, 13, 60)
  wsSummary['!views'] = [{ showGridLines: true }]
  XLSX.utils.book_append_sheet(wb, wsSummary, '📊 สรุปภาพรวม (Summary)')

  // =========================================================================
  // SHEET 2: 📑 สมุดรายการธุรกรรมทั้งหมด (Transaction Ledger)
  // =========================================================================
  const s2: any[][] = []

  s2.push([makeTitleCell('สมุดรายการธุรกรรมพอร์ตการลงทุน (Complete Transactions Ledger)')])
  s2.push([
    makeMetaCell(`วันที่ส่งออกข้อมูล: ${exportedAtStr} | จำนวนรายการทั้งหมด: ${transactions.length} รายการ`),
  ])
  s2.push([makeBlankCell()])

  s2.push([
    makeThCell('ลำดับ', 'center'),
    makeThCell('วันที่ทำรายการ', 'center'),
    makeThCell('สัญลักษณ์', 'center'),
    makeThCell('ชื่อสินทรัพย์', 'left'),
    makeThCell('ประเภท', 'center'),
    makeThCell('ตลาด', 'center'),
    makeThCell('บัญชี / โบรกเกอร์', 'left'),
    makeThCell('ประเภทธุรกรรม', 'center'),
    makeThCell('จำนวนหน่วย (Quantity)', 'right'),
    makeThCell('ราคาต่อหน่วย (Price)', 'right'),
    makeThCell('ค่าธรรมเนียม (Fee)', 'right'),
    makeThCell('ภาษีหัก ณ ที่จ่าย', 'right'),
    makeThCell('มูลค่ารวมสุทธิ (Total)', 'right'),
    makeThCell('สกุลเงิน', 'center'),
    makeThCell('แหล่งที่มา', 'center'),
    makeThCell('บันทึกเพิ่มเติม (Note)', 'left'),
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

    s2.push([
      makeTextCell(String(index + 1), index, 'center'),
      makeTextCell(dateStr, index, 'center'),
      makeTextCell(t.asset?.ticker || '-', index, 'center'),
      makeTextCell(t.asset?.assetName || t.asset?.ticker || '-', index, 'left'),
      makeTextCell(t.asset?.assetType || '-', index, 'center'),
      makeTextCell(t.asset?.market || '-', index, 'center'),
      makeTextCell(t.account?.accountName || 'บัญชีหลัก', index, 'left'),
      makeTypeBadgeCell(t.txnType, index),
      makeNumCell(qty, index, '#,##0.000000'),
      makeNumCell(price, index, '#,##0.00'),
      makeNumCell(fee, index, '#,##0.00'),
      makeNumCell(tax, index, '#,##0.00'),
      makeNumCell(total, index, '#,##0.00', true),
      makeTextCell(t.asset?.currency || t.account?.currency || 'THB', index, 'center'),
      makeTextCell(t.source || 'manual', index, 'center'),
      makeTextCell(t.note || '', index, 'left'),
    ])
  })

  // Total Row
  s2.push([
    makeTotalCell(`รวมทั้งสิ้น (${transactions.length} รายการ)`, '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'left'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'left'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell(sumQty, '#,##0.000000'),
    makeTotalCell('-', '#,##0.00', 'center'),
    makeTotalCell(sumFee, '#,##0.00'),
    makeTotalCell(sumTax, '#,##0.00'),
    makeTotalCell(sumTotal, '#,##0.00'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'center'),
    makeTotalCell('', '#,##0.00', 'left'),
  ])

  const wsLedger = XLSX.utils.aoa_to_sheet(s2)
  wsLedger['!cols'] = calculateColWidths(s2, 11, 45)
  wsLedger['!views'] = [{ showGridLines: true, freeze: { xSplit: 0, ySplit: 4 } }]
  XLSX.utils.book_append_sheet(wb, wsLedger, '📑 สมุดธุรกรรม (Ledger)')

  const filename = `Transactions_Ledger_${new Date().toISOString().slice(0, 10)}_InvestmentPro.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}
