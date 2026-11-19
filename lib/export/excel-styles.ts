/**
 * lib/export/excel-styles.ts
 * Shared Excel styling palette, cell factories, and column width calculator
 * used by tax-excel-export.ts and transactions-excel-export.ts.
 */

export const EXCEL_COLORS = {
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
  cyanBg: 'CFFAFE',        // Cyan 100
  cyanText: '155E75',      // Cyan 800
  amberBg: 'FEF3C7',       // Amber 100
  amberText: '92400E',     // Amber 800
  blueBg: 'E0E7FF',        // Blue 100
  blueText: '3730A3',      // Blue 800
  indigoBg: 'E0E7FF',      // Indigo 100
  indigoText: '3730A3',    // Indigo 800
  textDark: '0F172A',      // Primary Text
  textMuted: '475569',     // Secondary Text
  white: 'FFFFFF',
}

export const borderThin = {
  top: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
  bottom: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
  left: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
  right: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
}

export const borderAccountingTotal = {
  top: { style: 'thin', color: { rgb: EXCEL_COLORS.navyMedium } },
  bottom: { style: 'double', color: { rgb: EXCEL_COLORS.navyDark } },
  left: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
  right: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
}

export function makeTitleCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: EXCEL_COLORS.white } },
      fill: { fgColor: { rgb: EXCEL_COLORS.navyDark } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    },
  }
}

export function makeMetaCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, italic: true, color: { rgb: EXCEL_COLORS.textMuted } },
      fill: { fgColor: { rgb: EXCEL_COLORS.slateLight } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: {
        bottom: { style: 'thin', color: { rgb: EXCEL_COLORS.slateBorder } },
      },
    },
  }
}

export function makeSectionHeaderCell(text: string) {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: EXCEL_COLORS.white } },
      fill: { fgColor: { rgb: EXCEL_COLORS.indigoDark } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    },
  }
}

export function makeThCell(text: string, align: 'left' | 'center' | 'right' = 'center') {
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: EXCEL_COLORS.white } },
      fill: { fgColor: { rgb: EXCEL_COLORS.navyMedium } },
      alignment: { horizontal: align, vertical: 'center', wrapText: true },
      border: {
        top: { style: 'medium', color: { rgb: EXCEL_COLORS.navyDark } },
        bottom: { style: 'medium', color: { rgb: EXCEL_COLORS.navyDark } },
        left: { style: 'thin', color: { rgb: '475569' } },
        right: { style: 'thin', color: { rgb: '475569' } },
      },
    },
  }
}

export function makeTextCell(text: string, rowIndex: number, align: 'left' | 'center' | 'right' = 'left') {
  const isEven = rowIndex % 2 === 0
  return {
    v: text,
    t: 's',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, color: { rgb: EXCEL_COLORS.textDark } },
      fill: { fgColor: { rgb: isEven ? EXCEL_COLORS.white : EXCEL_COLORS.slateZebra } },
      alignment: { horizontal: align, vertical: 'center' },
      border: borderThin,
    },
  }
}

export function roundForExcelFormat(val: number, format: string): number {
  const decPart = format.split('.')[1]
  const decimals = decPart ? (decPart.match(/0/g)?.length ?? 2) : 0
  const factor = Math.pow(10, decimals)
  return Math.round((Number(val) || 0) * factor) / factor
}

export function makePctCell(val: number, rowIndex: number) {
  const isEven = rowIndex % 2 === 0
  return {
    v: Math.round(val * 100) / 10000,
    t: 'n',
    z: '0.00%',
    s: {
      font: { name: 'Segoe UI', sz: 9.5, color: { rgb: EXCEL_COLORS.textDark } },
      fill: { fgColor: { rgb: isEven ? EXCEL_COLORS.white : EXCEL_COLORS.slateZebra } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: borderThin,
    },
  }
}

export function makeBlankCell(bg: string = EXCEL_COLORS.white) {
  return {
    v: '',
    t: 's',
    s: { fill: { fgColor: { rgb: bg } } },
  }
}

export function calculateColWidths(rows: any[][], minWidth = 11, maxWidth = 55) {
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
