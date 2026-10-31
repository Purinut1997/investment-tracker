'use client'

import React, { useState } from 'react'
import {
  FileSpreadsheet,
  X,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Loader2,
  AlertTriangle,
  Coins,
  Building2,
  Receipt,
  DollarSign,
  HelpCircle,
} from 'lucide-react'
import type { TaxReportSummary } from '@/lib/analytics/tax-fifo'
import { exportTaxReportToExcel } from '@/lib/export/tax-excel-export'

export interface TaxExportModalProps {
  isOpen: boolean
  onClose: () => void
  report: TaxReportSummary
  selectedYear: number
  usdThbRate: number
  repatriated: boolean
  aiExplanation?: string | null
  userName?: string
}

export function TaxExportModal({
  isOpen,
  onClose,
  report,
  selectedYear,
  usdThbRate,
  repatriated,
  aiExplanation,
  userName,
}: TaxExportModalProps) {
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeDividends, setIncludeDividends] = useState(true)
  const [includeForeign, setIncludeForeign] = useState(true)
  const [includeThai, setIncludeThai] = useState(true)
  const [includeAiAdvice, setIncludeAiAdvice] = useState(true)
  const [currencyMode, setCurrencyMode] = useState<'dual' | 'thb_only'>('dual')
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  if (!isOpen) return null

  const isNewRuleYear = selectedYear >= 2024
  const isTaxableInThailand = isNewRuleYear || repatriated

  const handleDownload = async () => {
    setIsExporting(true)
    setExportSuccess(false)
    try {
      await exportTaxReportToExcel(report, {
        selectedYear,
        usdThbRate,
        repatriated,
        aiExplanation,
        userName,
        currencyMode,
        includeSummary,
        includeDividends,
        includeForeign,
        includeThai,
        includeAiAdvice,
      })
      setExportSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      console.error('Export Excel failed:', err)
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const selectedCount = [
    includeSummary,
    includeDividends,
    includeForeign,
    includeThai,
    includeAiAdvice,
  ].filter(Boolean).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="glass-panel bg-slate-950/95 border border-slate-700/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                <span>จัดแบบฟอร์มส่งออกรายงานภาษีและการลงทุน</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  EXCEL .XLSX
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                ปีภาษี {selectedYear} (พ.ศ. {selectedYear + 543}) · พร้อมเส้นตาราง จัดกว้างคอลัมน์ และไฮไลต์สรุปยอด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Pre-export KPI Preview Strip */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>สรุปตัวเลขที่จะบรรจุในรายงาน (Pre-Export Overview)</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                1 USD = ฿{usdThbRate.toFixed(2)} THB
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Box 1: Dividends */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> เงินปันผลรับรวม
                  </span>
                  <span className="font-mono text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                    {report.dividends.items.length} รายการ
                  </span>
                </div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  ฿{report.dividends.totalDividendGrossTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
                  <span>หัก ณ ที่จ่าย:</span>
                  <span className="text-rose-400">
                    -฿{report.dividends.totalTaxWithheldTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Box 2: Thai SET */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> กำไรหุ้นไทย (SET)
                  </span>
                  <span className="font-mono text-emerald-300 text-[10px] bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                    ยกเว้นภาษี
                  </span>
                </div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  ฿{report.thaiSetCapitalGains.totalRealizedGain.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  ยอดขายรวม: ฿{report.thaiSetCapitalGains.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Box 3: Foreign & Crypto */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] text-blue-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" /> กำไรหุ้นนอก & คริปโต
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                      isTaxableInThailand
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {isTaxableInThailand ? 'มีภาระภาษี' : 'ยกเว้น'}
                  </span>
                </div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  ฿{report.foreignAndCryptoGains.totalRealizedGainTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  ${report.foreignAndCryptoGains.totalRealizedGainUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </div>
              </div>
            </div>
          </div>

          {/* Section: Select Sheets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                เลือกชีตที่ต้องการจัดลงไฟล์ ({selectedCount}/5 ชีต)
              </span>
              <button
                type="button"
                onClick={() => {
                  const allOn = selectedCount === 5
                  setIncludeSummary(!allOn)
                  setIncludeDividends(!allOn)
                  setIncludeForeign(!allOn)
                  setIncludeThai(!allOn)
                  setIncludeAiAdvice(!allOn)
                }}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {selectedCount === 5 ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>

            <div className="space-y-2">
              {/* Sheet 1 */}
              <label
                onClick={() => setIncludeSummary(!includeSummary)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  includeSummary
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {includeSummary ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold flex items-center gap-2">
                      <span>📊 ชีต 1: สรุปภาพรวมภาษี (Executive Summary)</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-mono">
                        แนะนำ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      รวมตัวเลข KPI หลัก, ตารางจัดหมวดหมู่ตาม ม.40(4)(ข)/(ช) สำหรับยื่น ภ.ง.ด. 90/91 และแยก Gross Gains vs Losses
                    </p>
                  </div>
                </div>
              </label>

              {/* Sheet 2 */}
              <label
                onClick={() => setIncludeDividends(!includeDividends)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  includeDividends
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {includeDividends ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">💵 ชีต 2: เงินปันผลรับสะสม (Dividends Statement)</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      แจกแจงรายรายการพร้อมชื่อหุ้น, บัญชีโบรกเกอร์, อัตราภาษีหัก (10% หรือ W-8BEN 15%) และแถวรวม TOTAL
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.dividends.items.length} รายการ
                </span>
              </label>

              {/* Sheet 3 */}
              <label
                onClick={() => setIncludeForeign(!includeForeign)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  includeForeign
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {includeForeign ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">🌐 ชีต 3: หุ้นต่างประเทศ & คริปโต (Foreign & Crypto FIFO)</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ต้นทุน FIFO, % ผลตอบแทน, ยอดขายรวม, กำไร/ขาดทุนรับรู้, สถานะภาษีไทย และกล่องแยกยอดกำไร vs ขาดทุน
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.foreignAndCryptoGains.trades.length} รายการ
                </span>
              </label>

              {/* Sheet 4 */}
              <label
                onClick={() => setIncludeThai(!includeThai)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  includeThai
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {includeThai ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">🇹🇭 ชีต 4: กำไรหุ้นไทยในตลาด (SET Capital Gains Exempt)</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      กำไรที่ได้รับการยกเว้นภาษีตามกฎกระทรวง ฉบับที่ 126 ข้อ 2(23) พร้อมต้นทุนและแถวรวม TOTAL
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.thaiSetCapitalGains.trades.length} รายการ
                </span>
              </label>

              {/* Sheet 5 */}
              <label
                onClick={() => setIncludeAiAdvice(!includeAiAdvice)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  includeAiAdvice
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {includeAiAdvice ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">📜 ชีต 5: คำแนะนำ AI Tax Advisor & สรุปกฎหมาย</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      บทวิเคราะห์ภาษีเฉพาะบุคคลจาก AI, คำสั่งสรรพากร ป.161/2566 และ Checklist เอกสารที่ต้องแนบยื่น
                    </p>
                  </div>
                </div>
                {aiExplanation && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">
                    มีผลวิเคราะห์ AI
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Section: Formatting Standards Notice */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>✨ มาตรฐานการจัดแบบฟอร์มไฟล์ Excel ที่เปิดใช้งาน:</span>
            </div>
            <ul className="list-disc ml-5 space-y-1 text-slate-300 text-[11px]">
              <li>
                <strong>ตรึงหัวตาราง (Freeze Panes):</strong> เลื่อนดูข้อมูลแถวล่างได้สะดวกโดยหัวคอลัมน์ไม่หาย
              </li>
              <li>
                <strong>ระบบสีและเส้นตาราง (Financial Grid & Border):</strong> ตีเส้นขอบทุกช่องพร้อมสลับสีแถวอ่อน (Zebra) อ่านง่ายสบายตา
              </li>
              <li>
                <strong>แถวสรุปผลรวมมาตรฐานบัญชี (Double Underline Total):</strong> เส้นขีดคู่ด้านล่างสำหรับยอดผลรวมทุกชีต
              </li>
              <li>
                <strong>ปรับความกว้างคอลัมน์อัตโนมัติ (Auto Column Fit):</strong> ตัวเลขและวันที่ไม่ถูกตัดหรือกลายเป็น <code>###</code>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || selectedCount === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/25 active:scale-[0.98] cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>กำลังจัดฟอร์มและสร้างไฟล์ Excel...</span>
              </>
            ) : exportSuccess ? (
              <>
                <span>✅ ดาวน์โหลดเรียบร้อย!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์ Excel ฉบับจัดฟอร์มสมบูรณ์ ({selectedCount} ชีต)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
