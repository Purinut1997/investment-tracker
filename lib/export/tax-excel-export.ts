/**
 * lib/export/tax-excel-export.ts
 * Professional Multi-Sheet Excel (.xlsx) Export Engine for Investment & Tax Compliance
 * Produces structured, executive-grade workbooks for Thai Revenue Department (ภ.ง.ด. 90/91)
 */

import type { TaxReportSummary } from '@/lib/analytics/tax-fifo'

export interface TaxExportOptions {
  selectedYear: number
  usdThbRate: number
  repatriated: boolean
  aiExplanation?: string | null
  userName?: string
  currencyMode?: 'original' | 'thb'
}

// Helper to compute column widths automatically
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
      // Count length, considering Thai characters
      const len = Math.ceil(str.length * 1.15)
      colWidths[colIndex] = Math.max(colWidths[colIndex] || minWidth, len)
    })
  })
  return colWidths.map((w) => ({ wch: Math.min(Math.max(w, minWidth), maxWidth) }))
}

// Number cell builder with Excel formatting
function numCell(val: number, format = '#,##0.00') {
  return { t: 'n', v: Math.round(val * 100) / 100, z: format }
}

function pctCell(val: number) {
  return { t: 'n', v: Math.round(val * 100) / 10000, z: '0.00%' }
}

export async function exportTaxReportToExcel(
  report: TaxReportSummary,
  options: TaxExportOptions
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const { selectedYear, usdThbRate, repatriated, aiExplanation, userName } = options
  const isNewRuleYear = selectedYear >= 2024
  const isTaxableInThailand = isNewRuleYear || repatriated
  const exportedAtStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // =========================================================================
  // SHEET 1: 📊 สรุปภาพรวมภาษีและการลงทุน (Executive Summary)
  // =========================================================================
  const summaryAoa: any[][] = []

  // Header Title Block
  summaryAoa.push(['รายงานสรุปภาษีและการลงทุนประจำปี (Annual Investment & Tax Return Summary)'])
  summaryAoa.push([
    `ระบบ: Investment Pro - Wealth & Tax Engine | ปีภาษี: พ.ศ. ${selectedYear + 543} (ค.ศ. ${selectedYear}) | วันที่จัดทำ: ${exportedAtStr}`,
  ])
  summaryAoa.push([
    `อัตราแลกเปลี่ยนอ้างอิง: 1 USD = ฿${usdThbRate.toFixed(2)} THB | สถานะการนำเงินกลับไทย: ${
      repatriated
        ? '🔴 นำเงินกลับไทยแล้ว (มีภาระภาษีเงินได้บุคคลธรรมดาไทย)'
        : '🟢 ยังไม่นำเงินกลับไทย (เงินลงทุนก่อนปี 2567 ไม่มีภาระภาษีไทย)'
    }${userName ? ` | ผู้เสียภาษี: ${userName}` : ''}`,
  ])
  summaryAoa.push([]) // empty row

  // Section 1: Executive KPI Cards
  summaryAoa.push(['[1] สรุปกระแสเงินได้และกำไรจากการลงทุน (Executive Financial Dashboard)'])
  summaryAoa.push([
    'หมวดหมู่เงินได้',
    'จำนวนรายการ',
    'ยอดรวมก่อนหัก/ยอดขาย (Gross)',
    'ต้นทุน FIFO / ภาษีหัก (Cost/Tax)',
    'เงินได้สุทธิ/กำไร (Net)',
    'สกุลเงินเดิม',
    'เทียบเท่าเงินบาท (฿ THB)',
    'สถานะทางภาษีไทย',
  ])

  // 1.1 Dividends Row
  summaryAoa.push([
    'เงินปันผลรับสะสม (Dividends - ม.40(4)(ข))',
    report.dividends.items.length,
    report.dividends.totalDividendGrossUSD > 0
      ? numCell(report.dividends.totalDividendGrossUSD, '$#,##0.00')
      : numCell(report.dividends.totalDividendGrossTHB, '฿#,##0.00'),
    report.dividends.totalTaxWithheldUSD > 0
      ? numCell(report.dividends.totalTaxWithheldUSD, '$#,##0.00')
      : numCell(report.dividends.totalTaxWithheldTHB, '฿#,##0.00'),
    report.dividends.totalDividendNetUSD > 0
      ? numCell(report.dividends.totalDividendNetUSD, '$#,##0.00')
      : numCell(report.dividends.totalDividendNetTHB, '฿#,##0.00'),
    report.dividends.totalDividendGrossUSD > 0 ? 'USD / THB' : 'THB',
    numCell(report.dividends.totalDividendNetTHB, '฿#,##0.00'),
    'ยื่น ภ.ง.ด.90 (ขอเครดิตภาษี W-8BEN 15% หรือ Final Tax 10%)',
  ])

  // 1.2 Thai SET Capital Gains Row
  summaryAoa.push([
    'กำไรส่วนต่างราคาหุ้นไทยในตลาด (SET Capital Gains - ม.40(4)(ช))',
    report.thaiSetCapitalGains.trades.length,
    numCell(report.thaiSetCapitalGains.totalVolume, '฿#,##0.00'),
    numCell(report.thaiSetCapitalGains.totalCost ?? 0, '฿#,##0.00'),
    numCell(report.thaiSetCapitalGains.totalRealizedGain, '฿#,##0.00'),
    'THB',
    numCell(report.thaiSetCapitalGains.totalRealizedGain, '฿#,##0.00'),
    'ได้รับการยกเว้นภาษีเงินได้ (กฎกระทรวง ฉบับที่ 126 ข้อ 2(23))',
  ])

  // 1.3 Foreign & Crypto Capital Gains Row
  summaryAoa.push([
    'กำไรหุ้นต่างประเทศและคริปโต (Foreign & Crypto - ม.40(4)(ช))',
    report.foreignAndCryptoGains.trades.length,
    numCell(report.foreignAndCryptoGains.totalProceedsUSD, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalCostUSD, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalRealizedGainUSD, '$#,##0.00'),
    'USD / Crypto',
    numCell(report.foreignAndCryptoGains.totalRealizedGainTHB, '฿#,##0.00'),
    isTaxableInThailand
      ? isNewRuleYear
        ? '⚠️ ต้องยื่นภาษีเงินได้บุคคลธรรมดาไทย (ปี 2567+ ตาม ป.161/2566)'
        : '⚠️ นำเงินกลับไทยในปีภาษีเดียวกัน → ต้องยื่นภาษีไทย'
      : '✅ ยังไม่นำเงินกลับไทย (ลงทุนก่อนปี 2567 ไม่ต้องเสียภาษีไทย)',
  ])

  // 1.4 Grand Totals
  const totalIncomeTHB =
    report.dividends.totalDividendNetTHB +
    (report.foreignAndCryptoGains.totalRealizedGainTHB > 0
      ? report.foreignAndCryptoGains.totalRealizedGainTHB
      : 0)

  summaryAoa.push([
    '--- รวมกระแสเงินได้ที่อาจมีภาระภาษี (Taxable Net Flow) ---',
    report.dividends.items.length + report.foreignAndCryptoGains.trades.length,
    '-',
    '-',
    '-',
    '-',
    numCell(totalIncomeTHB, '฿#,##0.00'),
    isTaxableInThailand
      ? 'คำนวณตามอัตราภาษีเงินได้บุคคลธรรมดาอัตราก้าวหน้า (0 - 35%)'
      : 'เฉพาะเงินปันผล (กรณีไม่นำเงินกำไรกลับไทยก่อนปี 67)',
  ])
  summaryAoa.push([]) // empty row

  // Section 2: Revenue Code Schedule (ตารางจัดหมวดหมู่ยื่นแบบ ภ.ง.ด.)
  summaryAoa.push(['[2] ตารางจัดหมวดหมู่เพื่อการยื่นแบบ ภ.ง.ด. 90/91 (Revenue Code Filing Schedule)'])
  summaryAoa.push([
    'มาตราตามประมวลรัษฎากร',
    'ประเภทเงินได้พึงประเมิน',
    'ยอดเงินได้พึงประเมิน (THB)',
    'ภาษีหัก ณ ที่จ่ายรวม (THB)',
    'แนวทางการยื่นภาษีและสิทธิประโยชน์',
    'เอกสารประกอบการยื่น',
  ])

  summaryAoa.push([
    'มาตรา 40(4)(ข)',
    'เงินปันผล/ส่วนแบ่งกำไร (ในประเทศ)',
    numCell(
      report.dividends.items
        .filter((i) => i.currency === 'THB' || i.market === 'TH')
        .reduce((sum, i) => sum + i.amountTHB, 0),
      '฿#,##0.00'
    ),
    numCell(
      report.dividends.items
        .filter((i) => i.currency === 'THB' || i.market === 'TH')
        .reduce((sum, i) => sum + i.taxWithheldTHB, 0),
      '฿#,##0.00'
    ),
    'เลือก Final Tax 10% (ไม่ต้องยื่น) หรือยื่นรวมเพื่อขอเครดิตภาษีเงินปันผลตามมาตรา 47 ทวิ',
    'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) จาก TSD หรือโบรกเกอร์',
  ])

  summaryAoa.push([
    'มาตรา 40(4)(ข)',
    'เงินปันผลจากหุ้นต่างประเทศ (US / Foreign)',
    numCell(
      report.dividends.items
        .filter((i) => i.currency === 'USD' || i.market === 'US')
        .reduce((sum, i) => sum + i.amountTHB, 0),
      '฿#,##0.00'
    ),
    numCell(
      report.dividends.items
        .filter((i) => i.currency === 'USD' || i.market === 'US')
        .reduce((sum, i) => sum + i.taxWithheldTHB, 0),
      '฿#,##0.00'
    ),
    'ถูกหัก W-8BEN 15% ในสหรัฐฯ สามารถนำมาขอเป็นเครดิตภาษีต่างประเทศตามอนุสัญญาภาษีซ้อน (DTA)',
    '1042-S หรือ Dividend Statement จากโบรกเกอร์ต่างประเทศ (Dime, InnovestX ฯลฯ)',
  ])

  summaryAoa.push([
    'มาตรา 40(4)(ช)',
    'กำไรจากการโอนหุ้นในตลาดหลักทรัพย์ไทย (SET/mai)',
    numCell(report.thaiSetCapitalGains.totalRealizedGain, '฿#,##0.00'),
    numCell(0, '฿#,##0.00'),
    'ยกเว้นภาษีเงินได้บุคคลธรรมดาโดยเด็ดขาดตามกฎกระทรวง ฉบับที่ 126 ข้อ 2(23) ไม่ต้องกรอกใน ภ.ง.ด.',
    'Confirmation Note / รายงานการซื้อขายประจำปีจากโบรกเกอร์ไทย',
  ])

  summaryAoa.push([
    'มาตรา 40(4)(ช)',
    'กำไรจากการขายหุ้นต่างประเทศ & คริปโต (Realized Gain)',
    numCell(report.foreignAndCryptoGains.totalRealizedGainTHB, '฿#,##0.00'),
    numCell(0, '฿#,##0.00'),
    isTaxableInThailand
      ? 'คำสั่งกรมสรรพากร ที่ ป.161/2566 และ ป.162/2566 นำมารวมคำนวณในแบบ ภ.ง.ด.90 อัตราก้าวหน้า'
      : 'ยังไม่เข้าเกณฑ์ต้องเสียภาษีไทย (เงินลงทุนก่อนปี 2567 และยังไม่นำเงินกลับเข้าประเทศ)',
    'FIFO Realized Gain/Loss Report (ตามชีต 3 ของไฟล์นี้) พร้อมหลักฐานการโอนเงิน',
  ])
  summaryAoa.push([]) // empty row

  // Section 3: Tax Audit Drilldown (Gains vs Losses separation)
  summaryAoa.push(['[3] รายละเอียดแยกกำไร-ขาดทุน สำหรับการตรวจสอบภาษี (Non-Netting Audit Drilldown)'])
  summaryAoa.push([
    'รายการวิเคราะห์',
    'มูลค่าสกุลเดิม (USD)',
    'มูลค่าเทียบเท่าเงินบาท (฿ THB)',
    'ข้อพิจารณาทางภาษีสรรพากรไทย',
  ])
  summaryAoa.push([
    'ยอดขายรวมสินทรัพย์ต่างประเทศ (Total Proceeds)',
    numCell(report.foreignAndCryptoGains.totalProceedsUSD, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalProceedsTHB, '฿#,##0.00'),
    'ยอดเงินรวมจากการขายสินทรัพย์ทั้งหมดก่อนหักต้นทุน',
  ])
  summaryAoa.push([
    'ต้นทุนรวมคำนวณตามหลัก FIFO (Total Cost Basis)',
    numCell(report.foreignAndCryptoGains.totalCostUSD, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalCostTHB, '฿#,##0.00'),
    'ต้นทุนตามวิธีเข้าก่อน-ออกก่อน (First-In, First-Out) ตามมาตรฐานบัญชีและสรรพากร',
  ])
  summaryAoa.push([
    'ผลรวมเฉพาะรายการที่ได้กำไร (Gross Realized Gains)',
    numCell(report.foreignAndCryptoGains.totalGrossGainsUSD ?? 0, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalGrossGainsTHB ?? 0, '฿#,##0.00'),
    '⚠️ สำคัญ: แนวทางกรมสรรพากรไทยอาจไม่อนุญาตให้นำผลขาดทุนต่างตัวมาหักกลบกำไร (Non-netting)',
  ])
  summaryAoa.push([
    'ผลรวมเฉพาะรายการที่ขาดทุน (Gross Realized Losses)',
    numCell(report.foreignAndCryptoGains.totalGrossLossesUSD ?? 0, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalGrossLossesTHB ?? 0, '฿#,##0.00'),
    'ผลขาดทุนที่เกิดขึ้นจากการขายสินทรัพย์ (ใช้เป็นข้อมูลบริหารจัดการภาษี)',
  ])
  summaryAoa.push([
    'กำไร/ขาดทุนสุทธิจากการขาย (Net Realized Capital Gain)',
    numCell(report.foreignAndCryptoGains.totalRealizedGainUSD, '$#,##0.00'),
    numCell(report.foreignAndCryptoGains.totalRealizedGainTHB, '฿#,##0.00'),
    report.foreignAndCryptoGains.totalRealizedGainUSD >= 0
      ? 'กำไรสุทธิจากการลงทุนต่างประเทศในปีภาษีนี้'
      : 'ผลขาดทุนสุทธิสะสมจากการขายสินทรัพย์ต่างประเทศ',
  ])
  summaryAoa.push([]) // empty row

  // Section 4: AI & Legal Advice Summary
  summaryAoa.push(['[4] ข้อสังเกตและคำแนะนำทางภาษี (Tax Checklist & Guidelines)'])
  summaryAoa.push([
    '1. คำสั่งกรมสรรพากร ที่ ป.161/2566 & ป.162/2566: ตั้งแต่ 1 ม.ค. 2567 บุคคลธรรมดาที่อยู่ในไทยตั้งแต่ 180 วันขึ้นไป หากมีเงินได้พึงประเมินจากต่างประเทศและนำกลับไทยในปีภาษีใด ต้องนำมารวมคำนวณภาษีในปีภาษีนั้น',
  ])
  summaryAoa.push([
    '2. อนุสัญญาภาษีซ้อน (DTA Thailand-US): นักลงทุนไทยได้รับการยกเว้นภาษี Capital Gains ในสหรัฐฯ และเสียเฉพาะ Withholding Tax เงินปันผล 15% ตามแบบ W-8BEN',
  ])
  summaryAoa.push([
    '3. การขอเครดิตภาษีเงินปันผล: ภาษี 15% ที่ถูกหักในสหรัฐฯ สามารถนำมาขอเป็นเครดิตภาษีตามอนุสัญญาภาษีซ้อนได้ ไม่เกินจำนวนภาษีไทยที่ต้องเสียจากเงินได้ก้อนนั้น',
  ])
  summaryAoa.push([
    '4. การเตรียมเอกสาร: ให้เก็บไฟล์รายงานฉบับนี้พร้อม Statement จากโบรกเกอร์ (Dime, InnovestX, Interactive Brokers ฯลฯ) เพื่อแนบในระบบ e-Filing ของกรมสรรพากร',
  ])

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa)
  wsSummary['!cols'] = autoFitColumns(summaryAoa, 12, 65)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวมภาษี (Summary)')

  // =========================================================================
  // SHEET 2: 💵 เงินปันผลรับสะสม (Dividends Statement)
  // =========================================================================
  const divAoa: any[][] = []
  divAoa.push([`รายงานรายละเอียดเงินปันผลรับสะสม (Dividends Statement) - ปีภาษี ${selectedYear}`])
  divAoa.push([`วันที่จัดทำ: ${exportedAtStr} | อัตราแลกเปลี่ยนอ้างอิง: 1 USD = ฿${usdThbRate.toFixed(2)} THB`])
  divAoa.push([])

  // Table Headers
  divAoa.push([
    'ลำดับ',
    'วันที่รับเงิน',
    'สัญลักษณ์ (Ticker)',
    'ชื่อหลักทรัพย์ / บริษัท',
    'ตลาด',
    'สกุลเงิน',
    'บัญชี / โบรกเกอร์',
    'ปันผลก่อนหัก (Gross) [สกุลเดิม]',
    'ภาษีหัก ณ ที่จ่าย [สกุลเดิม]',
    'ปันผลสุทธิ (Net) [สกุลเดิม]',
    'อัตราภาษีหัก (%)',
    'ปันผลก่อนหัก (Gross) [฿ THB]',
    'ภาษีหัก ณ ที่จ่าย [฿ THB]',
    'ปันผลสุทธิ (Net) [฿ THB]',
    'อัตราแลกเปลี่ยน (USD/THB)',
    'สิทธิประโยชน์ทางภาษี / หมายเหตุ',
  ])

  let totalGrossUSD = 0
  let totalTaxUSD = 0
  let totalNetUSD = 0
  let totalGrossTHB = 0
  let totalTaxTHB = 0
  let totalNetTHB = 0

  report.dividends.items.forEach((item, index) => {
    const isUSD = item.currency === 'USD'
    const grossNative = item.amount
    const taxNative = item.taxWithheld
    const netNative = grossNative - taxNative

    const grossTHB = item.amountTHB ?? (isUSD ? grossNative * usdThbRate : grossNative)
    const taxTHB = item.taxWithheldTHB ?? (isUSD ? taxNative * usdThbRate : taxNative)
    const netTHB = grossTHB - taxTHB

    if (isUSD) {
      totalGrossUSD += grossNative
      totalTaxUSD += taxNative
      totalNetUSD += netNative
    }
    totalGrossTHB += grossTHB
    totalTaxTHB += taxTHB
    totalNetTHB += netTHB

    const taxRate = grossNative > 0 ? (taxNative / grossNative) * 100 : 0
    const taxNote = isUSD
      ? 'W-8BEN 15% (ขอเครดิตภาษีต่างประเทศ DTA)'
      : 'หัก ณ ที่จ่าย 10% (ขอเครดิตภาษี ม.47 ทวิ หรือ Final Tax)'

    divAoa.push([
      index + 1,
      new Date(item.date).toLocaleDateString('th-TH'),
      item.ticker,
      item.assetName || item.ticker,
      item.market || (isUSD ? 'US' : 'TH'),
      item.currency || 'USD',
      item.accountName || 'บัญชีหลัก',
      numCell(grossNative, isUSD ? '$#,##0.00' : '฿#,##0.00'),
      numCell(taxNative, isUSD ? '$#,##0.00' : '฿#,##0.00'),
      numCell(netNative, isUSD ? '$#,##0.00' : '฿#,##0.00'),
      pctCell(taxRate),
      numCell(grossTHB, '฿#,##0.00'),
      numCell(taxTHB, '฿#,##0.00'),
      numCell(netTHB, '฿#,##0.00'),
      numCell(isUSD ? usdThbRate : 1.0, '#,##0.00'),
      taxNote,
    ])
  })

  // Dividends Total Row
  divAoa.push([])
  divAoa.push([
    '--- รวมทั้งสิ้น (TOTAL) ---',
    `${report.dividends.items.length} รายการ`,
    '',
    '',
    '',
    'USD / THB',
    '',
    numCell(totalGrossUSD, '$#,##0.00'),
    numCell(totalTaxUSD, '$#,##0.00'),
    numCell(totalNetUSD, '$#,##0.00'),
    '-',
    numCell(totalGrossTHB, '฿#,##0.00'),
    numCell(totalTaxTHB, '฿#,##0.00'),
    numCell(totalNetTHB, '฿#,##0.00'),
    '-',
    'ยอดรวมเงินปันผลสุทธิเพื่อการยื่นภาษี',
  ])

  const wsDiv = XLSX.utils.aoa_to_sheet(divAoa)
  wsDiv['!cols'] = autoFitColumns(divAoa, 12, 45)
  XLSX.utils.book_append_sheet(wb, wsDiv, 'เงินปันผล (Dividends)')

  // =========================================================================
  // SHEET 3: 🌐 กำไรหุ้นต่างประเทศและคริปโต (Foreign & Crypto Capital Gains)
  // =========================================================================
  const foreignAoa: any[][] = []
  foreignAoa.push([
    `รายงานการขายและกำไร/ขาดทุนสินทรัพย์ต่างประเทศ & คริปโต (FIFO Lots) - ปีภาษี ${selectedYear}`,
  ])
  foreignAoa.push([
    `คำนวณต้นทุนตามเกณฑ์: First-In, First-Out (FIFO) | อัตราแลกเปลี่ยนอ้างอิง: 1 USD = ฿${usdThbRate.toFixed(
      2
    )} THB | สถานะ: ${
      isTaxableInThailand
        ? 'ต้องยื่นแบบ ภ.ง.ด.90 (ตามคำสั่ง ป.161/2566)'
        : 'เงินลงทุนก่อนปี 2567 และยังไม่นำเงินกลับไทย (ได้รับการยกเว้น)'
    }`,
  ])
  foreignAoa.push([])

  // Table Headers
  foreignAoa.push([
    'ลำดับ',
    'วันที่ขาย',
    'สัญลักษณ์ (Ticker)',
    'ชื่อสินทรัพย์',
    'ประเภทสินทรัพย์',
    'ตลาด',
    'บัญชี / โบรกเกอร์',
    'สกุลเงิน',
    'จำนวนที่ขาย',
    'ราคาขาย/หน่วย [สกุลเดิม]',
    'ยอดขายรวมสุทธิ [สกุลเดิม]',
    'ต้นทุน FIFO [สกุลเดิม]',
    'กำไร/ขาดทุน [สกุลเดิม]',
    'ผลตอบแทน (%)',
    'ยอดขายรวม [฿ THB]',
    'ต้นทุน FIFO [฿ THB]',
    'กำไร/ขาดทุน [฿ THB]',
    'สถานะรายการ',
    'ค่าธรรมเนียม [สกุลเดิม]',
    'สถานะทางภาษีไทย',
  ])

  let fSumProceedsUSD = 0
  let fSumCostUSD = 0
  let fSumGainUSD = 0
  let fSumProceedsTHB = 0
  let fSumCostTHB = 0
  let fSumGainTHB = 0
  let fSumFee = 0

  let fGrossGainsUSD = 0
  let fGrossLossesUSD = 0
  let fGrossGainsTHB = 0
  let fGrossLossesTHB = 0

  report.foreignAndCryptoGains.trades.forEach((t, index) => {
    const isUSD = t.currency === 'USD'
    const proceeds = t.sellProceeds
    const cost = t.costBasis
    const gain = t.realizedGain
    const proceedsTHB = t.sellProceedsTHB ?? (isUSD ? proceeds * usdThbRate : proceeds)
    const costTHB = t.costBasisTHB ?? (isUSD ? cost * usdThbRate : cost)
    const gainTHB = t.realizedGainTHB ?? (isUSD ? gain * usdThbRate : gain)

    fSumProceedsUSD += proceeds
    fSumCostUSD += cost
    fSumGainUSD += gain
    fSumProceedsTHB += proceedsTHB
    fSumCostTHB += costTHB
    fSumGainTHB += gainTHB
    fSumFee += t.fee || 0

    if (gain >= 0) {
      fGrossGainsUSD += gain
      fGrossGainsTHB += gainTHB
    } else {
      fGrossLossesUSD += Math.abs(gain)
      fGrossLossesTHB += Math.abs(gainTHB)
    }

    const returnPct = cost > 0 ? (gain / cost) * 100 : 0
    const statusStr = gain >= 0 ? '🟢 กำไร (Gain)' : '🔴 ขาดทุน (Loss)'
    const taxStatus = isTaxableInThailand
      ? isNewRuleYear
        ? '⚠️ ต้องยื่นภาษีไทย (ปี 2567+)'
        : '⚠️ นำเงินกลับไทย'
      : '✅ ไม่ต้องเสียภาษีไทย'

    foreignAoa.push([
      index + 1,
      new Date(t.sellDate).toLocaleDateString('th-TH'),
      t.ticker,
      t.assetName || t.ticker,
      t.assetType || (t.market === 'CRYPTO' ? 'crypto' : 'stock'),
      t.market,
      t.accountName || 'บัญชีต่างประเทศ',
      t.currency || 'USD',
      numCell(t.quantity, '#,##0.000000'),
      numCell(t.sellPrice, isUSD ? '$#,##0.00' : '#,##0.00'),
      numCell(proceeds, isUSD ? '$#,##0.00' : '#,##0.00'),
      numCell(cost, isUSD ? '$#,##0.00' : '#,##0.00'),
      numCell(gain, isUSD ? '$#,##0.00' : '#,##0.00'),
      pctCell(returnPct),
      numCell(proceedsTHB, '฿#,##0.00'),
      numCell(costTHB, '฿#,##0.00'),
      numCell(gainTHB, '฿#,##0.00'),
      statusStr,
      numCell(t.fee || 0, isUSD ? '$#,##0.00' : '#,##0.00'),
      taxStatus,
    ])
  })

  // Total Row
  foreignAoa.push([])
  foreignAoa.push([
    '--- รวมทั้งสิ้น (TOTAL) ---',
    `${report.foreignAndCryptoGains.trades.length} รายการ`,
    '',
    '',
    '',
    '',
    '',
    'USD / Crypto',
    '',
    '-',
    numCell(fSumProceedsUSD, '$#,##0.00'),
    numCell(fSumCostUSD, '$#,##0.00'),
    numCell(fSumGainUSD, '$#,##0.00'),
    pctCell(fSumCostUSD > 0 ? (fSumGainUSD / fSumCostUSD) * 100 : 0),
    numCell(fSumProceedsTHB, '฿#,##0.00'),
    numCell(fSumCostTHB, '฿#,##0.00'),
    numCell(fSumGainTHB, '฿#,##0.00'),
    fSumGainTHB >= 0 ? '🟢 กำไรสุทธิรวม' : '🔴 ขาดทุนสุทธิรวม',
    numCell(fSumFee, '$#,##0.00'),
    isTaxableInThailand ? 'ภาระภาษีอัตราก้าวหน้า' : 'ได้รับการยกเว้น',
  ])

  // Sub-table: Non-netting drilldown
  foreignAoa.push([])
  foreignAoa.push(['สรุปเจาะลึกเกณฑ์ภาษีสรรพากร (Tax Audit Drilldown - กำไร vs ขาดทุน)'])
  foreignAoa.push([
    'รายการ',
    'มูลค่ารวม (USD)',
    'มูลค่ารวมเทียบเท่าเงินบาท (฿ THB)',
    'หมายเหตุการตีความทางภาษี',
  ])
  foreignAoa.push([
    'รวมเฉพาะรายการที่ทำกำไร (Gross Realized Gains)',
    numCell(fGrossGainsUSD, '$#,##0.00'),
    numCell(fGrossGainsTHB, '฿#,##0.00'),
    'กรณีสรรพากรไม่อนุญาตให้นำผลขาดทุนมาหักกลบ (Non-netting interpretation)',
  ])
  foreignAoa.push([
    'รวมเฉพาะรายการที่ขาดทุน (Gross Realized Losses)',
    numCell(fGrossLossesUSD, '$#,##0.00'),
    numCell(fGrossLossesTHB, '฿#,##0.00'),
    'ผลขาดทุนที่เกิดขึ้นจริงจากการขายสินทรัพย์',
  ])
  foreignAoa.push([
    'กำไร/ขาดทุนสุทธิ (Net Realized Capital Gain)',
    numCell(fSumGainUSD, '$#,##0.00'),
    numCell(fSumGainTHB, '฿#,##0.00'),
    'กำไรสุทธิตามมาตรฐานการบัญชีสากล',
  ])

  const wsForeign = XLSX.utils.aoa_to_sheet(foreignAoa)
  wsForeign['!cols'] = autoFitColumns(foreignAoa, 12, 45)
  XLSX.utils.book_append_sheet(wb, wsForeign, 'หุ้นนอก & คริปโต (Foreign)')

  // =========================================================================
  // SHEET 4: 🇹🇭 กำไรหุ้นไทยในตลาด (Thai SET Capital Gains - Tax Exempt)
  // =========================================================================
  const thaiAoa: any[][] = []
  thaiAoa.push([
    `รายงานกำไรจากการซื้อขายหุ้นในตลาดหลักทรัพย์แห่งประเทศไทย (SET/mai) - ปีภาษี ${selectedYear}`,
  ])
  thaiAoa.push([
    `สถานะทางกฎหมาย: ได้รับการยกเว้นภาษีเงินได้บุคคลธรรมดาตามกฎกระทรวง ฉบับที่ 126 (พ.ศ. 2509) ข้อ 2(23)`,
  ])
  thaiAoa.push([])

  // Table Headers
  thaiAoa.push([
    'ลำดับ',
    'วันที่ขาย',
    'สัญลักษณ์ (Ticker)',
    'ชื่อหลักทรัพย์ / บริษัท',
    'บัญชี / โบรกเกอร์',
    'จำนวนหุ้นที่ขาย',
    'ราคาขายต่อหุ้น (฿)',
    'ยอดขายรวม (฿)',
    'ต้นทุนรวม FIFO (฿)',
    'กำไร/ขาดทุน (฿)',
    'ผลตอบแทน (%)',
    'ค่าธรรมเนียม (฿)',
    'สถานะทางภาษี',
  ])

  let thaiSumProceeds = 0
  let thaiSumCost = 0
  let thaiSumGain = 0
  let thaiSumFee = 0

  report.thaiSetCapitalGains.trades.forEach((t, index) => {
    thaiSumProceeds += t.sellProceeds
    thaiSumCost += t.costBasis
    thaiSumGain += t.realizedGain
    thaiSumFee += t.fee || 0

    const returnPct = t.costBasis > 0 ? (t.realizedGain / t.costBasis) * 100 : 0

    thaiAoa.push([
      index + 1,
      new Date(t.sellDate).toLocaleDateString('th-TH'),
      t.ticker,
      t.assetName || t.ticker,
      t.accountName || 'โบรกเกอร์ไทย',
      numCell(t.quantity, '#,##0'),
      numCell(t.sellPrice, '฿#,##0.00'),
      numCell(t.sellProceeds, '฿#,##0.00'),
      numCell(t.costBasis, '฿#,##0.00'),
      numCell(t.realizedGain, '฿#,##0.00'),
      pctCell(returnPct),
      numCell(t.fee || 0, '฿#,##0.00'),
      'ยกเว้นภาษีเงินได้บุคคลธรรมดา (กฎกระทรวง 126)',
    ])
  })

  // Thai SET Total Row
  thaiAoa.push([])
  thaiAoa.push([
    '--- รวมทั้งสิ้น (TOTAL) ---',
    `${report.thaiSetCapitalGains.trades.length} รายการ`,
    '',
    '',
    '',
    '',
    '-',
    numCell(thaiSumProceeds, '฿#,##0.00'),
    numCell(thaiSumCost, '฿#,##0.00'),
    numCell(thaiSumGain, '฿#,##0.00'),
    pctCell(thaiSumCost > 0 ? (thaiSumGain / thaiSumCost) * 100 : 0),
    numCell(thaiSumFee, '฿#,##0.00'),
    'ได้รับการยกเว้นภาษี 100% ไม่ต้องกรอกใน ภ.ง.ด.',
  ])

  const wsThai = XLSX.utils.aoa_to_sheet(thaiAoa)
  wsThai['!cols'] = autoFitColumns(thaiAoa, 12, 45)
  XLSX.utils.book_append_sheet(wb, wsThai, 'กำไรหุ้นไทย (SET Exempt)')

  // =========================================================================
  // SHEET 5: 📜 คำแนะนำ AI และกฎหมายภาษี (AI Advice & Tax Code)
  // =========================================================================
  const adviceAoa: any[][] = []
  adviceAoa.push([`คำแนะนำเชิงภาษีและการยื่นแบบ ภ.ง.ด. (Tax Filing Guidelines & AI Insights)`])
  adviceAoa.push([`ปีภาษี: พ.ศ. ${selectedYear + 543} (ค.ศ. ${selectedYear}) | จัดทำโดย AI Tax Advisor`])
  adviceAoa.push([])

  adviceAoa.push(['[ส่วนที่ 1] สรุปข้อกฎหมายภาษีการลงทุนที่สำคัญสำหรับบุคคลธรรมดา'])
  adviceAoa.push([
    'หัวข้อ',
    'กฎหมาย / คำสั่งอ้างอิง',
    'หลักการสำคัญและแนวทางปฏิบัติ',
  ])
  adviceAoa.push([
    '1. ภาษีกำไรหุ้นไทย',
    'กฎกระทรวง ฉบับที่ 126 (พ.ศ. 2509) ข้อ 2(23)',
    'กำไรจากการขายหุ้นในตลาดหลักทรัพย์แห่งประเทศไทย (SET/mai) ของบุคคลธรรมดา ได้รับการยกเว้นภาษีเงินได้ ไม่ต้องนำมารวมคำนวณใน ภ.ง.ด.90/91',
  ])
  adviceAoa.push([
    '2. ภาษีเงินปันผลหุ้นไทย',
    'ประมวลรัษฎากร มาตรา 40(4)(ข) และมาตรา 47 ทวิ',
    'ถูกหักภาษี ณ ที่จ่าย 10% สามารถเลือกเป็น Final Tax (ไม่ต้องนำมายื่น) หรือนำมารวมยื่นเพื่อขอเครดิตภาษีเงินปันผลตามอัตราภาษีนิติบุคคลของบริษัทผู้จ่าย',
  ])
  adviceAoa.push([
    '3. ภาษีสินทรัพย์ต่างประเทศ',
    'คำสั่งกรมสรรพากร ที่ ป.161/2566 และ ป.162/2566',
    'ผู้มีถิ่นที่อยู่ในไทย (อยู่เกิน 180 วันในปีปฏิทิน) ที่มีเงินได้พึงประเมินจากต่างประเทศตั้งแต่วันที่ 1 ม.ค. 2567 เป็นต้นไป และนำเงินได้นั้นเข้ามาในไทย ต้องนำมารวมคำนวณภาษีในปีที่นำเข้า',
  ])
  adviceAoa.push([
    '4. อนุสัญญาภาษีซ้อนไทย-สหรัฐฯ',
    'Double Tax Agreement (DTA) & Form W-8BEN',
    'นักลงทุนไทยไม่เสียภาษี Capital Gains ในสหรัฐฯ และเสีย Withholding Tax เงินปันผลในอัตราลดหย่อน 15% ซึ่งนำมาใช้เป็นเครดิตภาษีต่างประเทศในไทยได้',
  ])
  adviceAoa.push([])

  if (aiExplanation) {
    adviceAoa.push(['[ส่วนที่ 2] ผลการวิเคราะห์เฉพาะบุคคลจาก AI Tax Advisor'])
    adviceAoa.push([])
    const cleanLines = aiExplanation.split('\n')
    cleanLines.forEach((line) => {
      const trimmed = line.trim()
      if (trimmed) {
        adviceAoa.push([trimmed])
      }
    })
  } else {
    adviceAoa.push(['[ส่วนที่ 2] คำแนะนำการเตรียมเอกสารสำหรับการยื่นแบบ ภ.ง.ด. 90'])
    adviceAoa.push([
      '1. หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) สำหรับเงินปันผลหุ้นไทยและกองทุนรวม',
    ])
    adviceAoa.push([
      '2. รายงานยอดเงินปันผลและภาษี W-8BEN 15% จากแอปหรือโบรกเกอร์ (Dime, InnovestX, IBKR)',
    ])
    adviceAoa.push([
      '3. ตารางคำนวณต้นทุน FIFO และกำไรจากการขายสินทรัพย์ต่างประเทศ (ใช้ชีตที่ 3 ในไฟล์นี้)',
    ])
    adviceAoa.push([
      '4. สลิปหรือหลักฐานการโอนเงินกลับเข้าสู่บัญชีธนาคารไทย เพื่อยืนยันปีภาษีที่มีการนำเงินเข้า',
    ])
  }

  const wsAdvice = XLSX.utils.aoa_to_sheet(adviceAoa)
  wsAdvice['!cols'] = autoFitColumns(adviceAoa, 15, 80)
  XLSX.utils.book_append_sheet(wb, wsAdvice, 'คำแนะนำ AI & กฎหมาย')

  // Save Workbook
  const filename = `Tax_Report_${selectedYear}_InvestmentPro_Comprehensive.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}
