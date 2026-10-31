/**
 * lib/export/tax-excel-export.ts
 * Luxury Financial Multi-Sheet Excel (.xlsx) Export Engine
 * Powered by xlsx-js-style for complete cell styling, borders, colors, and freeze panes
 */

import type { TaxReportSummary } from '@/lib/analytics/tax-fifo'

export interface TaxExportOptions {
  selectedYear: number
  usdThbRate: number
  repatriated: boolean
  aiExplanation?: string | null
  userName?: string
  currencyMode?: 'dual' | 'thb_only'
  includeSummary?: boolean
  includeDividends?: boolean
  includeForeign?: boolean
  includeThai?: boolean
  includeAiAdvice?: boolean
}

// ─── Color Palette & Styling Tokens ─────────────────────────
const C = {
  navyDark: '0F172A',      // Slate 900
  navyMedium: '1E293B',    // Slate 800
  indigoDark: '1E1B4B',    // Indigo 950
  indigoSoft: 'EEF2FF',    // Indigo 50
  slateLight: 'F8FAFC',    // Slate 50
  slateZebra: 'F1F5F9',    // Slate 100
  slateBorder: 'CBD5E1',   // Slate 300
  borderSoft: 'E2E8F0',    // Slate 200
  emeraldBg: 'D1FAE5',     // Green 100
  emeraldText: '065F46',   // Green 800
  emeraldBorder: 'A7F3D0', // Green 200
  roseBg: 'FFE4E6',        // Rose 100
  roseText: '9F1239',       // Rose 800
  amberBg: 'FEF3C7',       // Amber 100
  amberText: '92400E',      // Amber 800
  blueBg: 'E0E7FF',        // Blue 100
  blueText: '3730A3',       // Blue 800
  textDark: '0F172A',      // Primary Text
  textMuted: '475569',     // Secondary Text
  white: 'FFFFFF',
}

// ─── Style Factory Helpers ──────────────────────────────────
const borderThin = {
  top: { style: 'thin', color: { rgb: C.slateBorder } },
  bottom: { style: 'thin', color: { rgb: C.slateBorder } },
  left: { style: 'thin', color: { rgb: C.slateBorder } },
  right: { style: 'thin', color: { rgb: C.slateBorder } },
}

const borderAccountingTotal = {
  top: { style: 'thin', color: { rgb: C.navyMedium } },
  bottom: { style: 'double', color: { rgb: C.navyDark } }, // Accounting double underline
  left: { style: 'thin', color: { rgb: C.slateBorder } },
  right: { style: 'thin', color: { rgb: C.slateBorder } },
}

// Title banner cell (Sheet Main Title)
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

// Subtitle / Metadata cell
function makeMetaCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, italic: true, color: { rgb: C.textMuted } },
      fill: { fgColor: { rgb: C.slateLight } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: {
        bottom: { style: 'thin', color: { rgb: C.slateBorder } },
      },
    },
  }
}

// Section Header Banner
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

// Table Header Column
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

// Data Text Cell with zebra striping
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

// Data Number Cell with currency/accounting format
function makeNumCell(
  val: number,
  rowIndex: number,
  format = '#,##0.00',
  opts?: { bold?: boolean; colorRgb?: string }
) {
  const isEven = rowIndex % 2 === 0
  return {
    v: Math.round(val * 100) / 100,
    t: 'n',
    z: format,
    s: {
      font: {
        name: 'Segoe UI',
        sz: 9.5,
        bold: opts?.bold ?? false,
        color: { rgb: opts?.colorRgb ?? C.textDark },
      },
      fill: { fgColor: { rgb: isEven ? C.white : C.slateZebra } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderThin,
    },
  }
}

// Percentage Cell
function makePctCell(val: number, rowIndex: number) {
  const isEven = rowIndex % 2 === 0
  return {
    v: Math.round(val * 100) / 10000,
    t: 'n',
    z: '0.00%',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, color: { rgb: C.textDark } },
      fill: { fgColor: { rgb: isEven ? C.white : C.slateZebra } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderThin,
    },
  }
}

// Status / Badge Cell
function makeBadgeCell(
  text: string,
  rowIndex: number,
  type: 'exempt' | 'taxable' | 'gain' | 'loss' | 'neutral' = 'neutral'
) {
  let fgColor = C.white
  let fontColor = C.textDark

  if (type === 'exempt' || type === 'gain') {
    fgColor = C.emeraldBg
    fontColor = C.emeraldText
  } else if (type === 'taxable' || type === 'loss') {
    fgColor = C.roseBg
    fontColor = C.roseText
  } else if (type === 'neutral') {
    fgColor = C.blueBg
    fontColor = C.blueText
  }

  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: fontColor } },
      fill: { fgColor: { rgb: fgColor } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderThin,
    },
  }
}

// Total / Summary Row Cell
function makeTotalCell(
  val: string | number,
  type: 'text' | 'number' | 'percent' = 'text',
  format = '#,##0.00',
  align: 'left' | 'center' | 'right' = 'right'
) {
  if (type === 'number' && typeof val === 'number') {
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

  if (type === 'percent' && typeof val === 'number') {
    return {
      v: Math.round(val * 100) / 10000,
      t: 'n',
      z: '0.00%',
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

// Blank spacing cell
function makeBlankCell(bg = C.white) {
  return {
    v: '',
    t: 's',
    s: { fill: { fgColor: { rgb: bg } } },
  }
}

// Auto-fit column widths calculator
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
      // Calculate visual width considering Thai glyphs
      const len = Math.ceil(str.length * 1.15)
      widths[i] = Math.max(widths[i] || minWidth, len)
    })
  })
  return widths.map((w) => ({ wch: Math.min(Math.max(w, minWidth), maxWidth) }))
}

// ─── Main Export Function ───────────────────────────────────
export async function exportTaxReportToExcel(
  report: TaxReportSummary,
  options: TaxExportOptions
) {
  // Use xlsx-js-style for complete styling support
  const XLSX = await import('xlsx-js-style')
  const wb = XLSX.utils.book_new()

  const {
    selectedYear,
    usdThbRate,
    repatriated,
    aiExplanation,
    userName,
    currencyMode = 'dual',
    includeSummary = true,
    includeDividends = true,
    includeForeign = true,
    includeThai = true,
    includeAiAdvice = true,
  } = options

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
  if (includeSummary) {
    const s1: any[][] = []

    // 1. Header Banner
    s1.push([makeTitleCell('รายงานสรุปภาษีและการจัดการลงทุนประจำปี (Annual Investment & Tax Return Summary)')])
    s1.push([
      makeMetaCell(
        `ปีภาษี: พ.ศ. ${selectedYear + 543} (ค.ศ. ${selectedYear}) | วันที่จัดทำ: ${exportedAtStr} | อัตราแลกเปลี่ยน: 1 USD = ฿${usdThbRate.toFixed(
          2
        )} THB | สถานะนำเงินกลับไทย: ${
          repatriated ? 'นำเงินกลับไทยแล้ว' : 'ยังไม่นำเงินกลับไทย'
        }${userName ? ` | ผู้เสียภาษี: ${userName}` : ''}`
      ),
    ])
    s1.push([makeBlankCell()])

    // 2. Section 1: Executive Financial Dashboard
    s1.push([makeSectionHeaderCell('[1] สรุปกระแสเงินได้และกำไรจากการลงทุน (Executive Financial Dashboard)')])
    s1.push([
      makeThCell('หมวดหมู่เงินได้', 'left'),
      makeThCell('จำนวนรายการ', 'center'),
      makeThCell('ยอดเงินรวม/ยอดขาย (Gross)', 'right'),
      makeThCell('ต้นทุน FIFO / ภาษีหัก (Cost/Tax)', 'right'),
      makeThCell('เงินได้สุทธิ/กำไร (Net)', 'right'),
      makeThCell('สกุลเงิน', 'center'),
      makeThCell('เทียบเท่าเงินบาท (฿ THB)', 'right'),
      makeThCell('สถานะภาษีเงินได้บุคคลธรรมดาไทย', 'center'),
    ])

    // Row 1: Dividends
    s1.push([
      makeTextCell('เงินปันผลรับสะสม (Dividends - ม.40(4)(ข))', 0),
      makeTextCell(`${report.dividends.items.length} รายการ`, 0, 'center'),
      makeNumCell(
        report.dividends.totalDividendGrossUSD > 0
          ? report.dividends.totalDividendGrossUSD
          : report.dividends.totalDividendGrossTHB,
        0,
        report.dividends.totalDividendGrossUSD > 0 ? '$#,##0.00' : '฿#,##0.00'
      ),
      makeNumCell(
        report.dividends.totalTaxWithheldUSD > 0
          ? report.dividends.totalTaxWithheldUSD
          : report.dividends.totalTaxWithheldTHB,
        0,
        report.dividends.totalTaxWithheldUSD > 0 ? '$#,##0.00' : '฿#,##0.00'
      ),
      makeNumCell(
        report.dividends.totalDividendNetUSD > 0
          ? report.dividends.totalDividendNetUSD
          : report.dividends.totalDividendNetTHB,
        0,
        report.dividends.totalDividendNetUSD > 0 ? '$#,##0.00' : '฿#,##0.00',
        { bold: true, colorRgb: C.emeraldText }
      ),
      makeTextCell(report.dividends.totalDividendGrossUSD > 0 ? 'USD / THB' : 'THB', 0, 'center'),
      makeNumCell(report.dividends.totalDividendNetTHB, 0, '฿#,##0.00', { bold: true }),
      makeBadgeCell('ยื่น ภ.ง.ด.90 (ขอเครดิตภาษี W-8BEN หรือ Final Tax)', 0, 'neutral'),
    ])

    // Row 2: Thai SET Capital Gains
    s1.push([
      makeTextCell('กำไรส่วนต่างราคาหุ้นไทยในตลาด (SET Capital Gains - ม.40(4)(ช))', 1),
      makeTextCell(`${report.thaiSetCapitalGains.trades.length} รายการ`, 1, 'center'),
      makeNumCell(report.thaiSetCapitalGains.totalVolume, 1, '฿#,##0.00'),
      makeNumCell(report.thaiSetCapitalGains.totalCost ?? 0, 1, '฿#,##0.00'),
      makeNumCell(report.thaiSetCapitalGains.totalRealizedGain, 1, '฿#,##0.00', {
        bold: true,
        colorRgb: C.emeraldText,
      }),
      makeTextCell('THB', 1, 'center'),
      makeNumCell(report.thaiSetCapitalGains.totalRealizedGain, 1, '฿#,##0.00', { bold: true }),
      makeBadgeCell('ได้รับการยกเว้นภาษี (กฎกระทรวง 126)', 1, 'exempt'),
    ])

    // Row 3: Foreign & Crypto
    const fGainUSD = report.foreignAndCryptoGains.totalRealizedGainUSD
    const fGainTHB = report.foreignAndCryptoGains.totalRealizedGainTHB
    s1.push([
      makeTextCell('กำไรหุ้นต่างประเทศและคริปโต (Foreign & Crypto - ม.40(4)(ช))', 2),
      makeTextCell(`${report.foreignAndCryptoGains.trades.length} รายการ`, 2, 'center'),
      makeNumCell(report.foreignAndCryptoGains.totalProceedsUSD, 2, '$#,##0.00'),
      makeNumCell(report.foreignAndCryptoGains.totalCostUSD, 2, '$#,##0.00'),
      makeNumCell(fGainUSD, 2, '$#,##0.00', {
        bold: true,
        colorRgb: fGainUSD >= 0 ? C.emeraldText : C.roseText,
      }),
      makeTextCell('USD / Crypto', 2, 'center'),
      makeNumCell(fGainTHB, 2, '฿#,##0.00', {
        bold: true,
        colorRgb: fGainTHB >= 0 ? C.emeraldText : C.roseText,
      }),
      makeBadgeCell(
        isTaxableInThailand ? 'มีภาระภาษีไทย (ป.161/2566)' : 'ยังไม่มีภาระภาษี (เงินก่อนปี 67)',
        2,
        isTaxableInThailand ? 'taxable' : 'exempt'
      ),
    ])

    // Total Flow Row
    const totalTaxableFlowTHB =
      report.dividends.totalDividendNetTHB +
      (report.foreignAndCryptoGains.totalRealizedGainTHB > 0
        ? report.foreignAndCryptoGains.totalRealizedGainTHB
        : 0)

    s1.push([
      makeTotalCell('รวมกระแสเงินได้ที่ต้องพิจารณาภาษี (Taxable Net Flow)', 'text', '', 'left'),
      makeTotalCell(
        report.dividends.items.length + report.foreignAndCryptoGains.trades.length,
        'number',
        '#,##0'
      ),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell('THB', 'text', '', 'center'),
      makeTotalCell(totalTaxableFlowTHB, 'number', '฿#,##0.00'),
      makeTotalCell(
        isTaxableInThailand ? 'อัตราก้าวหน้า 0-35%' : 'เฉพาะเงินปันผล',
        'text',
        '',
        'center'
      ),
    ])
    s1.push([makeBlankCell()])

    // 3. Section 2: Revenue Code Schedule (มาตราประมวลรัษฎากร)
    s1.push([makeSectionHeaderCell('[2] ตารางจัดหมวดหมู่เพื่อการยื่นแบบ ภ.ง.ด. 90/91 (Revenue Code Filing Schedule)')])
    s1.push([
      makeThCell('มาตราประมวลรัษฎากร', 'center'),
      makeThCell('ประเภทเงินได้พึงประเมิน', 'left'),
      makeThCell('ยอดเงินได้พึงประเมิน (THB)', 'right'),
      makeThCell('ภาษีหัก ณ ที่จ่าย (THB)', 'right'),
      makeThCell('แนวทางการยื่นภาษีและสิทธิประโยชน์', 'left'),
      makeThCell('เอกสารประกอบการยื่นในระบบ e-Filing', 'left'),
    ])

    s1.push([
      makeTextCell('มาตรา 40(4)(ข)', 0, 'center'),
      makeTextCell('เงินปันผลในประเทศ (SET/TFEX/กองทุน)', 0),
      makeNumCell(
        report.dividends.items
          .filter((i) => i.currency === 'THB' || i.market === 'TH')
          .reduce((sum, i) => sum + i.amountTHB, 0),
        0,
        '฿#,##0.00'
      ),
      makeNumCell(
        report.dividends.items
          .filter((i) => i.currency === 'THB' || i.market === 'TH')
          .reduce((sum, i) => sum + i.taxWithheldTHB, 0),
        0,
        '฿#,##0.00'
      ),
      makeTextCell('เลือก Final Tax 10% หรือยื่นรวมเพื่อขอเครดิตภาษีเงินปันผลตามมาตรา 47 ทวิ', 0),
      makeTextCell('หนังสือรับรองหักภาษี ณ ที่จ่าย (50 ทวิ) จาก TSD หรือโบรกเกอร์ไทย', 0),
    ])

    s1.push([
      makeTextCell('มาตรา 40(4)(ข)', 1, 'center'),
      makeTextCell('เงินปันผลต่างประเทศ (US Stocks/ETFs)', 1),
      makeNumCell(
        report.dividends.items
          .filter((i) => i.currency === 'USD' || i.market === 'US')
          .reduce((sum, i) => sum + i.amountTHB, 0),
        1,
        '฿#,##0.00'
      ),
      makeNumCell(
        report.dividends.items
          .filter((i) => i.currency === 'USD' || i.market === 'US')
          .reduce((sum, i) => sum + i.taxWithheldTHB, 0),
        1,
        '฿#,##0.00'
      ),
      makeTextCell('ถูกหัก W-8BEN 15% สามารถนำมาขอเป็นเครดิตภาษีต่างประเทศตามอนุสัญญาภาษีซ้อน (DTA)', 1),
      makeTextCell('1042-S หรือ Dividend Statement จากโบรกเกอร์ต่างประเทศ (Dime, InnovestX)', 1),
    ])

    s1.push([
      makeTextCell('มาตรา 40(4)(ช)', 2, 'center'),
      makeTextCell('กำไรจากการขายหุ้นในตลาดหลักทรัพย์ไทย (SET)', 2),
      makeNumCell(report.thaiSetCapitalGains.totalRealizedGain, 2, '฿#,##0.00'),
      makeNumCell(0, 2, '฿#,##0.00'),
      makeTextCell('ยกเว้นภาษีเงินได้บุคคลธรรมดาโดยเด็ดขาดตามกฎกระทรวง ฉบับที่ 126 ข้อ 2(23)', 2),
      makeTextCell('ไม่ต้องแนบเอกสาร (เป็นเงินได้ที่ได้รับการยกเว้นตามกฎหมาย)', 2),
    ])

    s1.push([
      makeTextCell('มาตรา 40(4)(ช)', 3, 'center'),
      makeTextCell('กำไรจากการขายหุ้นต่างประเทศ & คริปโต', 3),
      makeNumCell(report.foreignAndCryptoGains.totalRealizedGainTHB, 3, '฿#,##0.00'),
      makeNumCell(0, 3, '฿#,##0.00'),
      makeTextCell(
        isTaxableInThailand
          ? 'คำสั่งกรมสรรพากร ที่ ป.161/2566 และ ป.162/2566 ยื่น ภ.ง.ด.90 อัตราก้าวหน้า 0-35%'
          : 'เงินลงทุนก่อนปี 2567 และยังไม่นำเงินกลับไทย ไม่เข้าเกณฑ์เสียภาษี',
        3
      ),
      makeTextCell('FIFO Realized Gain/Loss Report (ตามชีต 3 ของไฟล์นี้) พร้อมหลักฐานการโอนเงิน', 3),
    ])
    s1.push([makeBlankCell()])

    // 4. Section 3: Non-Netting Audit Drilldown
    s1.push([makeSectionHeaderCell('[3] รายละเอียดแยกกำไร-ขาดทุน สำหรับการตรวจสอบภาษี (Non-Netting Audit Drilldown)')])
    s1.push([
      makeThCell('รายการวิเคราะห์', 'left'),
      makeThCell('มูลค่าสกุลเดิม (USD)', 'right'),
      makeThCell('มูลค่าเทียบเท่าเงินบาท (฿ THB)', 'right'),
      makeThCell('ข้อพิจารณาทางภาษีของกรมสรรพากรไทย', 'left'),
    ])

    s1.push([
      makeTextCell('ยอดขายรวมสินทรัพย์ต่างประเทศ (Total Proceeds)', 0),
      makeNumCell(report.foreignAndCryptoGains.totalProceedsUSD, 0, '$#,##0.00'),
      makeNumCell(report.foreignAndCryptoGains.totalProceedsTHB, 0, '฿#,##0.00'),
      makeTextCell('ยอดเงินรวมจากการขายสินทรัพย์ทั้งหมดก่อนหักต้นทุน', 0),
    ])
    s1.push([
      makeTextCell('ต้นทุนรวมคำนวณตามหลัก FIFO (Total Cost Basis)', 1),
      makeNumCell(report.foreignAndCryptoGains.totalCostUSD, 1, '$#,##0.00'),
      makeNumCell(report.foreignAndCryptoGains.totalCostTHB, 1, '฿#,##0.00'),
      makeTextCell('ต้นทุนตามวิธีเข้าก่อน-ออกก่อน (First-In, First-Out) ตามมาตรฐานบัญชีและสรรพากร', 1),
    ])
    s1.push([
      makeTextCell('ผลรวมเฉพาะรายการที่ได้กำไร (Gross Realized Gains)', 2),
      makeNumCell(report.foreignAndCryptoGains.totalGrossGainsUSD ?? 0, 2, '$#,##0.00', {
        bold: true,
        colorRgb: C.emeraldText,
      }),
      makeNumCell(report.foreignAndCryptoGains.totalGrossGainsTHB ?? 0, 2, '฿#,##0.00', {
        bold: true,
        colorRgb: C.emeraldText,
      }),
      makeTextCell('⚠️ สำคัญ: แนวทางกรมสรรพากรไทยอาจไม่อนุญาตให้นำผลขาดทุนต่างตัวมาหักกลบกำไร (Non-netting)', 2),
    ])
    s1.push([
      makeTextCell('ผลรวมเฉพาะรายการที่ขาดทุน (Gross Realized Losses)', 3),
      makeNumCell(report.foreignAndCryptoGains.totalGrossLossesUSD ?? 0, 3, '$#,##0.00', {
        bold: true,
        colorRgb: C.roseText,
      }),
      makeNumCell(report.foreignAndCryptoGains.totalGrossLossesTHB ?? 0, 3, '฿#,##0.00', {
        bold: true,
        colorRgb: C.roseText,
      }),
      makeTextCell('ผลขาดทุนที่เกิดขึ้นจริงจากการขายสินทรัพย์', 3),
    ])
    s1.push([
      makeTotalCell('กำไร/ขาดทุนสุทธิจากการขาย (Net Realized Capital Gain)', 'text', '', 'left'),
      makeTotalCell(report.foreignAndCryptoGains.totalRealizedGainUSD, 'number', '$#,##0.00'),
      makeTotalCell(report.foreignAndCryptoGains.totalRealizedGainTHB, 'number', '฿#,##0.00'),
      makeTotalCell(
        report.foreignAndCryptoGains.totalRealizedGainUSD >= 0
          ? 'กำไรสุทธิจากการลงทุนต่างประเทศในปีภาษีนี้'
          : 'ผลขาดทุนสุทธิสะสม',
        'text',
        '',
        'left'
      ),
    ])

    const wsSummary = XLSX.utils.aoa_to_sheet(s1)
    wsSummary['!cols'] = calculateColWidths(s1, 13, 65)
    wsSummary['!views'] = [{ showGridLines: true }]
    XLSX.utils.book_append_sheet(wb, wsSummary, '📊 สรุปภาพรวมภาษี (Summary)')
  }

  // =========================================================================
  // SHEET 2: 💵 เงินปันผลรับสะสม (Dividends Statement)
  // =========================================================================
  if (includeDividends) {
    const s2: any[][] = []

    s2.push([makeTitleCell(`รายงานรายละเอียดเงินปันผลรับสะสม (Dividends Statement) - ปีภาษี ${selectedYear}`)])
    s2.push([
      makeMetaCell(
        `วันที่จัดทำ: ${exportedAtStr} | อัตราแลกเปลี่ยนอ้างอิง: 1 USD = ฿${usdThbRate.toFixed(
          2
        )} THB | รายการทั้งหมด: ${report.dividends.items.length} รายการ`
      ),
    ])
    s2.push([makeBlankCell()])

    // Table Header
    s2.push([
      makeThCell('ลำดับ', 'center'),
      makeThCell('วันที่รับเงิน', 'center'),
      makeThCell('สัญลักษณ์', 'center'),
      makeThCell('ชื่อหลักทรัพย์ / บริษัท', 'left'),
      makeThCell('ตลาด', 'center'),
      makeThCell('สกุลเงิน', 'center'),
      makeThCell('บัญชี / โบรกเกอร์', 'left'),
      makeThCell('ปันผลก่อนหัก [สกุลเดิม]', 'right'),
      makeThCell('ภาษีหัก [สกุลเดิม]', 'right'),
      makeThCell('ปันผลสุทธิ [สกุลเดิม]', 'right'),
      makeThCell('อัตราหัก (%)', 'right'),
      makeThCell('ปันผลก่อนหัก [฿ THB]', 'right'),
      makeThCell('ภาษีหัก [฿ THB]', 'right'),
      makeThCell('ปันผลสุทธิ [฿ THB]', 'right'),
      makeThCell('อัตราแลกเปลี่ยน', 'right'),
      makeThCell('สิทธิประโยชน์ทางภาษี / หมายเหตุ', 'left'),
    ])

    let sumGrossUSD = 0
    let sumTaxUSD = 0
    let sumNetUSD = 0
    let sumGrossTHB = 0
    let sumTaxTHB = 0
    let sumNetTHB = 0

    report.dividends.items.forEach((item, index) => {
      const isUSD = item.currency === 'USD'
      const grossNative = item.amount
      const taxNative = item.taxWithheld
      const netNative = grossNative - taxNative

      const grossTHB = item.amountTHB ?? (isUSD ? grossNative * usdThbRate : grossNative)
      const taxTHB = item.taxWithheldTHB ?? (isUSD ? taxNative * usdThbRate : taxNative)
      const netTHB = grossTHB - taxTHB

      if (isUSD) {
        sumGrossUSD += grossNative
        sumTaxUSD += taxNative
        sumNetUSD += netNative
      }
      sumGrossTHB += grossTHB
      sumTaxTHB += taxTHB
      sumNetTHB += netTHB

      const taxRate = grossNative > 0 ? (taxNative / grossNative) * 100 : 0
      const taxNote = isUSD
        ? 'W-8BEN 15% (ขอเครดิตภาษีต่างประเทศ DTA)'
        : 'หัก ณ ที่จ่าย 10% (ขอเครดิตภาษี ม.47 ทวิ หรือ Final Tax)'

      s2.push([
        makeTextCell(String(index + 1), index, 'center'),
        makeTextCell(new Date(item.date).toLocaleDateString('th-TH'), index, 'center'),
        makeTextCell(item.ticker, index, 'center'),
        makeTextCell(item.assetName || item.ticker, index, 'left'),
        makeTextCell(item.market || (isUSD ? 'US' : 'TH'), index, 'center'),
        makeTextCell(item.currency || 'USD', index, 'center'),
        makeTextCell(item.accountName || 'บัญชีหลัก', index, 'left'),
        makeNumCell(grossNative, index, isUSD ? '$#,##0.00' : '฿#,##0.00'),
        makeNumCell(taxNative, index, isUSD ? '$#,##0.00' : '฿#,##0.00'),
        makeNumCell(netNative, index, isUSD ? '$#,##0.00' : '฿#,##0.00', {
          bold: true,
          colorRgb: C.emeraldText,
        }),
        makePctCell(taxRate, index),
        makeNumCell(grossTHB, index, '฿#,##0.00'),
        makeNumCell(taxTHB, index, '฿#,##0.00'),
        makeNumCell(netTHB, index, '฿#,##0.00', { bold: true }),
        makeNumCell(isUSD ? usdThbRate : 1.0, index, '#,##0.00'),
        makeTextCell(taxNote, index, 'left'),
      ])
    })

    // Total Row
    s2.push([
      makeTotalCell(`รวมทั้งสิ้น (${report.dividends.items.length} รายการ)`, 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'left'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('USD / THB', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'left'),
      makeTotalCell(sumGrossUSD, 'number', '$#,##0.00'),
      makeTotalCell(sumTaxUSD, 'number', '$#,##0.00'),
      makeTotalCell(sumNetUSD, 'number', '$#,##0.00'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell(sumGrossTHB, 'number', '฿#,##0.00'),
      makeTotalCell(sumTaxTHB, 'number', '฿#,##0.00'),
      makeTotalCell(sumNetTHB, 'number', '฿#,##0.00'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell('ยอดรวมเงินปันผลสุทธิเพื่อการยื่นภาษี', 'text', '', 'left'),
    ])

    const wsDiv = XLSX.utils.aoa_to_sheet(s2)
    wsDiv['!cols'] = calculateColWidths(s2, 11, 45)
    wsDiv['!views'] = [{ showGridLines: true, freeze: { xSplit: 0, ySplit: 4 } }]
    XLSX.utils.book_append_sheet(wb, wsDiv, '💵 เงินปันผล (Dividends)')
  }

  // =========================================================================
  // SHEET 3: 🌐 กำไรหุ้นต่างประเทศและคริปโต (Foreign & Crypto Capital Gains)
  // =========================================================================
  if (includeForeign) {
    const s3: any[][] = []

    s3.push([
      makeTitleCell(
        `รายงานการขายและกำไร/ขาดทุนสินทรัพย์ต่างประเทศ & คริปโต (FIFO Lots) - ปีภาษี ${selectedYear}`
      ),
    ])
    s3.push([
      makeMetaCell(
        `เกณฑ์คำนวณ: First-In, First-Out (FIFO) | อัตราแลกเปลี่ยน: 1 USD = ฿${usdThbRate.toFixed(
          2
        )} THB | สถานะ: ${isTaxableInThailand ? 'ต้องยื่นแบบ ภ.ง.ด.90 (ป.161/2566)' : 'เงินก่อนปี 2567 และยังไม่นำเงินกลับไทย'}`
      ),
    ])
    s3.push([makeBlankCell()])

    s3.push([
      makeThCell('ลำดับ', 'center'),
      makeThCell('วันที่ขาย', 'center'),
      makeThCell('สัญลักษณ์', 'center'),
      makeThCell('ชื่อสินทรัพย์', 'left'),
      makeThCell('ประเภท', 'center'),
      makeThCell('ตลาด', 'center'),
      makeThCell('บัญชี / โบรกเกอร์', 'left'),
      makeThCell('สกุลเงิน', 'center'),
      makeThCell('จำนวนที่ขาย', 'right'),
      makeThCell('ราคาขาย/หน่วย', 'right'),
      makeThCell('ยอดขายรวม [สกุลเดิม]', 'right'),
      makeThCell('ต้นทุน FIFO [สกุลเดิม]', 'right'),
      makeThCell('กำไร/ขาดทุน [สกุลเดิม]', 'right'),
      makeThCell('ผลตอบแทน (%)', 'right'),
      makeThCell('ยอดขายรวม [฿ THB]', 'right'),
      makeThCell('ต้นทุน FIFO [฿ THB]', 'right'),
      makeThCell('กำไร/ขาดทุน [฿ THB]', 'right'),
      makeThCell('สถานะ', 'center'),
      makeThCell('ค่าธรรมเนียม', 'right'),
      makeThCell('สถานะทางภาษีไทย', 'center'),
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
      const statusType = gain >= 0 ? 'gain' : 'loss'
      const statusStr = gain >= 0 ? 'กำไร (Gain)' : 'ขาดทุน (Loss)'
      const taxStatus = isTaxableInThailand
        ? isNewRuleYear
          ? 'ต้องยื่นภาษีไทย (ปี 67+)'
          : 'นำเงินกลับไทย'
        : 'ไม่ต้องเสียภาษีไทย'

      s3.push([
        makeTextCell(String(index + 1), index, 'center'),
        makeTextCell(new Date(t.sellDate).toLocaleDateString('th-TH'), index, 'center'),
        makeTextCell(t.ticker, index, 'center'),
        makeTextCell(t.assetName || t.ticker, index, 'left'),
        makeTextCell(t.assetType || (t.market === 'CRYPTO' ? 'crypto' : 'stock'), index, 'center'),
        makeTextCell(t.market, index, 'center'),
        makeTextCell(t.accountName || 'บัญชีต่างประเทศ', index, 'left'),
        makeTextCell(t.currency || 'USD', index, 'center'),
        makeNumCell(t.quantity, index, '#,##0.000000'),
        makeNumCell(t.sellPrice, index, isUSD ? '$#,##0.00' : '#,##0.00'),
        makeNumCell(proceeds, index, isUSD ? '$#,##0.00' : '#,##0.00'),
        makeNumCell(cost, index, isUSD ? '$#,##0.00' : '#,##0.00'),
        makeNumCell(gain, index, isUSD ? '$#,##0.00' : '#,##0.00', {
          bold: true,
          colorRgb: gain >= 0 ? C.emeraldText : C.roseText,
        }),
        makePctCell(returnPct, index),
        makeNumCell(proceedsTHB, index, '฿#,##0.00'),
        makeNumCell(costTHB, index, '฿#,##0.00'),
        makeNumCell(gainTHB, index, '฿#,##0.00', {
          bold: true,
          colorRgb: gainTHB >= 0 ? C.emeraldText : C.roseText,
        }),
        makeBadgeCell(statusStr, index, statusType),
        makeNumCell(t.fee || 0, index, isUSD ? '$#,##0.00' : '#,##0.00'),
        makeBadgeCell(taxStatus, index, isTaxableInThailand ? 'taxable' : 'exempt'),
      ])
    })

    // Total Row
    s3.push([
      makeTotalCell(
        `รวมทั้งสิ้น (${report.foreignAndCryptoGains.trades.length} รายการ)`,
        'text',
        '',
        'center'
      ),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'left'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'left'),
      makeTotalCell('USD / Crypto', 'text', '', 'center'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell(fSumProceedsUSD, 'number', '$#,##0.00'),
      makeTotalCell(fSumCostUSD, 'number', '$#,##0.00'),
      makeTotalCell(fSumGainUSD, 'number', '$#,##0.00'),
      makeTotalCell(
        fSumCostUSD > 0 ? (fSumGainUSD / fSumCostUSD) * 100 : 0,
        'percent',
        '0.00%'
      ),
      makeTotalCell(fSumProceedsTHB, 'number', '฿#,##0.00'),
      makeTotalCell(fSumCostTHB, 'number', '฿#,##0.00'),
      makeTotalCell(fSumGainTHB, 'number', '฿#,##0.00'),
      makeTotalCell(fSumGainTHB >= 0 ? 'กำไรสุทธิรวม' : 'ขาดทุนสุทธิรวม', 'text', '', 'center'),
      makeTotalCell(fSumFee, 'number', '$#,##0.00'),
      makeTotalCell(isTaxableInThailand ? 'ภาระภาษีอัตราก้าวหน้า' : 'ได้รับการยกเว้น', 'text', '', 'center'),
    ])

    // Non-netting drilldown box
    s3.push([makeBlankCell()])
    s3.push([makeSectionHeaderCell('สรุปเจาะลึกเกณฑ์ภาษีสรรพากร (Tax Audit Drilldown - กำไร vs ขาดทุน)')])
    s3.push([
      makeThCell('รายการ', 'left'),
      makeThCell('มูลค่ารวม (USD)', 'right'),
      makeThCell('มูลค่ารวมเทียบเท่าเงินบาท (฿ THB)', 'right'),
      makeThCell('หมายเหตุการตีความทางภาษี', 'left'),
    ])
    s3.push([
      makeTextCell('รวมเฉพาะรายการที่ทำกำไร (Gross Realized Gains)', 0),
      makeNumCell(fGrossGainsUSD, 0, '$#,##0.00', { bold: true, colorRgb: C.emeraldText }),
      makeNumCell(fGrossGainsTHB, 0, '฿#,##0.00', { bold: true, colorRgb: C.emeraldText }),
      makeTextCell('กรณีสรรพากรไม่อนุญาตให้นำผลขาดทุนมาหักกลบ (Non-netting interpretation)', 0),
    ])
    s3.push([
      makeTextCell('รวมเฉพาะรายการที่ขาดทุน (Gross Realized Losses)', 1),
      makeNumCell(fGrossLossesUSD, 1, '$#,##0.00', { bold: true, colorRgb: C.roseText }),
      makeNumCell(fGrossLossesTHB, 1, '฿#,##0.00', { bold: true, colorRgb: C.roseText }),
      makeTextCell('ผลขาดทุนที่เกิดขึ้นจริงจากการขายสินทรัพย์', 1),
    ])
    s3.push([
      makeTotalCell('กำไร/ขาดทุนสุทธิ (Net Realized Capital Gain)', 'text', '', 'left'),
      makeTotalCell(fSumGainUSD, 'number', '$#,##0.00'),
      makeTotalCell(fSumGainTHB, 'number', '฿#,##0.00'),
      makeTotalCell('กำไรสุทธิตามมาตรฐานการบัญชีสากล', 'text', '', 'left'),
    ])

    const wsForeign = XLSX.utils.aoa_to_sheet(s3)
    wsForeign['!cols'] = calculateColWidths(s3, 11, 45)
    wsForeign['!views'] = [{ showGridLines: true, freeze: { xSplit: 0, ySplit: 4 } }]
    XLSX.utils.book_append_sheet(wb, wsForeign, '🌐 หุ้นนอก & คริปโต (Foreign)')
  }

  // =========================================================================
  // SHEET 4: 🇹🇭 กำไรหุ้นไทยในตลาด (Thai SET Capital Gains - Tax Exempt)
  // =========================================================================
  if (includeThai) {
    const s4: any[][] = []

    s4.push([
      makeTitleCell(
        `รายงานกำไรจากการซื้อขายหุ้นในตลาดหลักทรัพย์แห่งประเทศไทย (SET/mai) - ปีภาษี ${selectedYear}`
      ),
    ])
    s4.push([
      makeMetaCell(
        `สถานะทางกฎหมาย: ได้รับการยกเว้นภาษีเงินได้บุคคลธรรมดาตามกฎกระทรวง ฉบับที่ 126 (พ.ศ. 2509) ข้อ 2(23)`
      ),
    ])
    s4.push([makeBlankCell()])

    s4.push([
      makeThCell('ลำดับ', 'center'),
      makeThCell('วันที่ขาย', 'center'),
      makeThCell('สัญลักษณ์', 'center'),
      makeThCell('ชื่อหลักทรัพย์ / บริษัท', 'left'),
      makeThCell('บัญชี / โบรกเกอร์', 'left'),
      makeThCell('จำนวนหุ้นที่ขาย', 'right'),
      makeThCell('ราคาขายต่อหุ้น (฿)', 'right'),
      makeThCell('ยอดขายรวม (฿)', 'right'),
      makeThCell('ต้นทุนรวม FIFO (฿)', 'right'),
      makeThCell('กำไร/ขาดทุน (฿)', 'right'),
      makeThCell('ผลตอบแทน (%)', 'right'),
      makeThCell('ค่าธรรมเนียม (฿)', 'right'),
      makeThCell('สถานะทางภาษี', 'center'),
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

      s4.push([
        makeTextCell(String(index + 1), index, 'center'),
        makeTextCell(new Date(t.sellDate).toLocaleDateString('th-TH'), index, 'center'),
        makeTextCell(t.ticker, index, 'center'),
        makeTextCell(t.assetName || t.ticker, index, 'left'),
        makeTextCell(t.accountName || 'โบรกเกอร์ไทย', index, 'left'),
        makeNumCell(t.quantity, index, '#,##0'),
        makeNumCell(t.sellPrice, index, '฿#,##0.00'),
        makeNumCell(t.sellProceeds, index, '฿#,##0.00'),
        makeNumCell(t.costBasis, index, '฿#,##0.00'),
        makeNumCell(t.realizedGain, index, '฿#,##0.00', {
          bold: true,
          colorRgb: t.realizedGain >= 0 ? C.emeraldText : C.roseText,
        }),
        makePctCell(returnPct, index),
        makeNumCell(t.fee || 0, index, '฿#,##0.00'),
        makeBadgeCell('ยกเว้นภาษีเงินได้บุคคลธรรมดา', index, 'exempt'),
      ])
    })

    // Total Row
    s4.push([
      makeTotalCell(
        `รวมทั้งสิ้น (${report.thaiSetCapitalGains.trades.length} รายการ)`,
        'text',
        '',
        'center'
      ),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'center'),
      makeTotalCell('', 'text', '', 'left'),
      makeTotalCell('', 'text', '', 'left'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell('-', 'text', '', 'center'),
      makeTotalCell(thaiSumProceeds, 'number', '฿#,##0.00'),
      makeTotalCell(thaiSumCost, 'number', '฿#,##0.00'),
      makeTotalCell(thaiSumGain, 'number', '฿#,##0.00'),
      makeTotalCell(
        thaiSumCost > 0 ? (thaiSumGain / thaiSumCost) * 100 : 0,
        'percent',
        '0.00%'
      ),
      makeTotalCell(thaiSumFee, 'number', '฿#,##0.00'),
      makeTotalCell('ได้รับการยกเว้นภาษี 100% ไม่ต้องกรอกใน ภ.ง.ด.', 'text', '', 'center'),
    ])

    const wsThai = XLSX.utils.aoa_to_sheet(s4)
    wsThai['!cols'] = calculateColWidths(s4, 11, 45)
    wsThai['!views'] = [{ showGridLines: true, freeze: { xSplit: 0, ySplit: 4 } }]
    XLSX.utils.book_append_sheet(wb, wsThai, '🇹🇭 กำไรหุ้นไทย (SET Exempt)')
  }

  // =========================================================================
  // SHEET 5: 📜 คำแนะนำ AI และกฎหมายภาษี (AI Advice & Tax Code)
  // =========================================================================
  if (includeAiAdvice) {
    const s5: any[][] = []

    s5.push([makeTitleCell('คำแนะนำเชิงภาษีและการยื่นแบบ ภ.ง.ด. (Tax Filing Guidelines & AI Insights)')])
    s5.push([
      makeMetaCell(`ปีภาษี: พ.ศ. ${selectedYear + 543} (ค.ศ. ${selectedYear}) | จัดทำโดย AI Tax Advisor`),
    ])
    s5.push([makeBlankCell()])

    s5.push([makeSectionHeaderCell('[ส่วนที่ 1] สรุปข้อกฎหมายภาษีการลงทุนที่สำคัญสำหรับบุคคลธรรมดา')])
    s5.push([
      makeThCell('หัวข้อ', 'left'),
      makeThCell('กฎหมาย / คำสั่งอ้างอิง', 'left'),
      makeThCell('หลักการสำคัญและแนวทางปฏิบัติ', 'left'),
    ])

    s5.push([
      makeTextCell('1. ภาษีกำไรหุ้นไทย', 0),
      makeTextCell('กฎกระทรวง ฉบับที่ 126 (พ.ศ. 2509) ข้อ 2(23)', 0),
      makeTextCell(
        'กำไรจากการขายหุ้นในตลาดหลักทรัพย์แห่งประเทศไทย (SET/mai) ของบุคคลธรรมดา ได้รับการยกเว้นภาษีเงินได้ ไม่ต้องนำมารวมคำนวณใน ภ.ง.ด.90/91',
        0
      ),
    ])

    s5.push([
      makeTextCell('2. ภาษีเงินปันผลหุ้นไทย', 1),
      makeTextCell('ประมวลรัษฎากร มาตรา 40(4)(ข) และมาตรา 47 ทวิ', 1),
      makeTextCell(
        'ถูกหักภาษี ณ ที่จ่าย 10% สามารถเลือกเป็น Final Tax (ไม่ต้องนำมายื่น) หรือนำมารวมยื่นเพื่อขอเครดิตภาษีเงินปันผลตามอัตราภาษีนิติบุคคลของบริษัทผู้จ่าย',
        1
      ),
    ])

    s5.push([
      makeTextCell('3. ภาษีสินทรัพย์ต่างประเทศ', 2),
      makeTextCell('คำสั่งกรมสรรพากร ที่ ป.161/2566 และ ป.162/2566', 2),
      makeTextCell(
        'ผู้มีถิ่นที่อยู่ในไทย (อยู่เกิน 180 วันในปีปฏิทิน) ที่มีเงินได้พึงประเมินจากต่างประเทศตั้งแต่วันที่ 1 ม.ค. 2567 เป็นต้นไป และนำเงินได้นั้นเข้ามาในไทย ต้องนำมารวมคำนวณภาษีในปีที่นำเข้า',
        2
      ),
    ])

    s5.push([
      makeTextCell('4. อนุสัญญาภาษีซ้อนไทย-สหรัฐฯ', 3),
      makeTextCell('Double Tax Agreement (DTA) & Form W-8BEN', 3),
      makeTextCell(
        'นักลงทุนไทยไม่เสียภาษี Capital Gains ในสหรัฐฯ และเสีย Withholding Tax เงินปันผลในอัตราลดหย่อน 15% ซึ่งนำมาใช้เป็นเครดิตภาษีต่างประเทศในไทยได้',
        3
      ),
    ])
    s5.push([makeBlankCell()])

    if (aiExplanation) {
      s5.push([makeSectionHeaderCell('[ส่วนที่ 2] ผลการวิเคราะห์เฉพาะบุคคลจาก AI Tax Advisor')])
      s5.push([])
      const lines = aiExplanation.split('\n')
      lines.forEach((line, idx) => {
        const trimmed = line.trim()
        if (trimmed) {
          s5.push([makeTextCell(trimmed, idx, 'left')])
        }
      })
    } else {
      s5.push([makeSectionHeaderCell('[ส่วนที่ 2] คำแนะนำการเตรียมเอกสารสำหรับการยื่นแบบ ภ.ง.ด. 90')])
      s5.push([makeTextCell('1. หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) สำหรับเงินปันผลหุ้นไทยและกองทุนรวม', 0)])
      s5.push([makeTextCell('2. รายงานยอดเงินปันผลและภาษี W-8BEN 15% จากแอปหรือโบรกเกอร์ (Dime, InnovestX, IBKR)', 1)])
      s5.push([makeTextCell('3. ตารางคำนวณต้นทุน FIFO และกำไรจากการขายสินทรัพย์ต่างประเทศ (ใช้ชีตที่ 3 ในไฟล์นี้)', 2)])
      s5.push([makeTextCell('4. สลิปหรือหลักฐานการโอนเงินกลับเข้าสู่บัญชีธนาคารไทย เพื่อยืนยันปีภาษีที่มีการนำเงินเข้า', 3)])
    }

    const wsAdvice = XLSX.utils.aoa_to_sheet(s5)
    wsAdvice['!cols'] = calculateColWidths(s5, 15, 85)
    wsAdvice['!views'] = [{ showGridLines: true }]
    XLSX.utils.book_append_sheet(wb, wsAdvice, '📜 คำแนะนำ AI & กฎหมาย')
  }

  // Save Workbook
  const filename = `Tax_Report_${selectedYear}_InvestmentPro_Comprehensive.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}
