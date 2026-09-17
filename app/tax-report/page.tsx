'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  ReceiptText,
  Sparkles,
  Download,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Building2,
  Coins,
  DollarSign
} from 'lucide-react'
import * as XLSX from 'xlsx'

export default function TaxReportPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  const { data: report, isLoading, error } = useSWR(`/api/tax-report/generate?year=${selectedYear}`)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string>('')

  // Export to Excel using xlsx package
  function handleExportExcel() {
    if (!report) return

    const wb = XLSX.utils.book_new()

    // 1. Dividends Sheet
    const divRows = report.dividends.items.map((item: any) => ({
      'วันที่รับ': new Date(item.date).toLocaleDateString('th-TH'),
      'สัญลักษณ์ (Ticker)': item.ticker,
      'เงินปันผลรวม (Gross)': item.amount,
      'ภาษีหัก ณ ที่จ่าย': item.taxWithheld,
      'เงินปันผลสุทธิ': item.amount - item.taxWithheld,
    }))
    const wsDiv = XLSX.utils.json_to_sheet(divRows)
    XLSX.utils.book_append_sheet(wb, wsDiv, 'เงินปันผล (Dividends)')

    // 2. Thai SET Capital Gains Sheet
    const thaiRows = report.thaiSetCapitalGains.trades.map((t: any) => ({
      'วันที่ขาย': new Date(t.sellDate).toLocaleDateString('th-TH'),
      'Ticker': t.ticker,
      'จำนวนที่ขาย': t.quantity,
      'ราคาขาย': t.sellPrice,
      'ยอดขายรวม': t.sellProceeds,
      'ต้นทุน FIFO': t.costBasis,
      'กำไร/ขาดทุน': t.realizedGain,
      'ค่าธรรมเนียม': t.fee,
      'สถานะภาษี': 'ยกเว้นภาษี (Exempt)',
    }))
    const wsThai = XLSX.utils.json_to_sheet(thaiRows)
    XLSX.utils.book_append_sheet(wb, wsThai, 'กำไรหุ้นไทย (SET)')

    // 3. Foreign & Crypto Sheet
    const foreignRows = report.foreignAndCryptoGains.trades.map((t: any) => ({
      'วันที่ขาย': new Date(t.sellDate).toLocaleDateString('th-TH'),
      'Ticker / ตลาด': `${t.ticker} (${t.market})`,
      'จำนวนที่ขาย': t.quantity,
      'ราคาขาย': t.sellPrice,
      'ยอดขายรวม': t.sellProceeds,
      'ต้นทุน FIFO': t.costBasis,
      'กำไร/ขาดทุน': t.realizedGain,
      'ค่าธรรมเนียม': t.fee,
    }))
    const wsForeign = XLSX.utils.json_to_sheet(foreignRows)
    XLSX.utils.book_append_sheet(wb, wsForeign, 'หุ้นนอก & คริปโต')

    XLSX.writeFile(wb, `Tax_Report_${selectedYear}_InvestmentTracker.xlsx`)
  }

  // Request AI Explanation
  async function handleExplainAI() {
    if (!report) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/tax-report/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          dividends: report.dividends,
          thaiSetCapitalGains: report.thaiSetCapitalGains,
          foreignAndCryptoGains: report.foreignAndCryptoGains,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to explain')
      setAiExplanation(data.explanation)
      setModelUsed(data.modelUsed)
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถขอคำอธิบายภาษีจาก AI ได้')
    } finally {
      setAiLoading(false)
    }
  }

  const yearsList = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="วางแผนการลงทุน"
          title="รายงานสรุปภาษีการลงทุน"
          description="คำนวณต้นทุน FIFO แยกปันผล หุ้นไทย และหุ้นนอกหรือคริปโต"
          action={<div className="flex flex-wrap items-center gap-2.5">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-[var(--cyan-400)]" />
              <select
                className="bg-transparent text-xs sm:text-sm font-bold text-white focus:outline-none cursor-pointer"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value))
                  setAiExplanation(null)
                }}
              >
                {yearsList.map((y) => (
                  <option key={y} value={y} className="bg-slate-900">
                    ปีภาษี {y} ({y + 543})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportExcel}
              disabled={!report}
              className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
          </div>}
        />

        {/* Mandatory Legal Disclaimer Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300">
              ⚠️ คำเตือนและข้อสงวนสิทธิ์ทางกฎหมาย (Legal Disclaimer)
            </p>
            <p className="mt-0.5">
              รายงานนี้สร้างขึ้นเพื่ออำนวยความสะดวกในการจัดหมวดหมู่ข้อมูลการลงทุนส่วนบุคคลด้วยวิธี FIFO เท่านั้น
              ไม่ถือเป็นการยื่นแบบภาษีจริง และคำอธิบายจาก AI ไม่ใช่คำแนะนำด้านภาษีที่มีใบอนุญาต
              ผู้เสียภาษีมีหน้าที่ตรวจสอบความถูกต้องกับหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) และเอกสารทางการจากสถาบันการเงินก่อนยื่นแบบแสดงรายการภาษีเงินได้บุคคลธรรมดา (ภ.ง.ด.90/91) จริง
            </p>
          </div>
        </div>

        {/* 3 Main Tax Category KPI Cards */}
        {report && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Category 1: Dividends */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  1. เงินปันผลรับรวม
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                  {report.dividends.items.length} รายการ
                </span>
              </div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tight">
                ฿{Number(report.dividends.totalDividendGross).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-[var(--text-secondary)] space-y-1.5 pt-3 border-t border-white/[0.06]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">ภาษีหัก ณ ที่จ่ายรวม:</span>
                  <span className="font-semibold text-rose-400">
                    -฿{Number(report.dividends.totalTaxWithheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">ปันผลสุทธิที่ได้รับ:</span>
                  <span className="font-bold text-white">
                    ฿{Number(report.dividends.totalDividendNet).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Category 2: Thai SET Capital Gains */}
            <div className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  2. กำไรหุ้นไทย (SET)
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold">
                  ยกเว้นภาษี (Exempt)
                </span>
              </div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tight">
                ฿{Number(report.thaiSetCapitalGains.totalRealizedGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-[var(--text-secondary)] pt-3 border-t border-white/[0.06] flex justify-between">
                <span className="text-[var(--text-muted)]">ปริมาณขายรวม:</span>
                <span className="font-semibold text-white">
                  ฿{Number(report.thaiSetCapitalGains.totalVolume).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Category 3: Foreign & Crypto Gains */}
            <div className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                  3. กำไรหุ้นนอก & คริปโต
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 font-medium">
                  {report.foreignAndCryptoGains.trades.length} รายการ
                </span>
              </div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tight">
                ฿{Number(report.foreignAndCryptoGains.totalRealizedGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-[var(--text-secondary)] space-y-1.5 pt-3 border-t border-white/[0.06]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">ยอดขายรวม:</span>
                  <span className="font-semibold text-white">
                    ฿{Number(report.foreignAndCryptoGains.totalProceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">ต้นทุน FIFO:</span>
                  <span className="font-semibold text-[var(--text-muted)]">
                    ฿{Number(report.foreignAndCryptoGains.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Explain Tax Button & Card */}
        <div className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-violet-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.36)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--violet)]" />
                <span>วิเคราะห์และสรุปผลภาษีด้วย AI</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                ให้ AI อธิบายประเด็นภาษีสำคัญประจำปี {selectedYear} สิทธิประโยชน์ทางภาษี และข้อควรระวัง
              </p>
            </div>

            <button
              onClick={handleExplainAI}
              disabled={aiLoading || !report}
              className="btn btn-primary text-xs py-2.5 px-5 flex items-center gap-2 self-start sm:self-auto rounded-xl shadow-[0_0_20px_rgba(167,139,250,0.25)]"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI กำลังวิเคราะห์ภาษี...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>สรุปผลภาษีด้วย AI</span>
                </>
              )}
            </button>
          </div>

          {aiExplanation && (
            <div className="mt-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-sans animate-scale-in">
              {aiExplanation}
            </div>
          )}
        </div>

        {/* Detailed Breakdown Tables */}
        {report && (
          <div className="space-y-6">
            {/* Table 1: Dividends */}
            <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] overflow-hidden">
              <div className="p-5 border-b border-white/[0.06]">
                <h3 className="text-base font-bold text-white">รายการเงินปันผลรับ (Dividends Detail)</h3>
              </div>
              {report.dividends.items.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  ไม่มีรายการรับเงินปันผลในปี {selectedYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3.5 px-5">วันที่รับ</th>
                        <th className="py-3.5 px-5">สัญลักษณ์ (Ticker)</th>
                        <th className="py-3.5 px-5 text-right">เงินปันผลรวม</th>
                        <th className="py-3.5 px-5 text-right">ภาษีหัก ณ ที่จ่าย</th>
                        <th className="py-3.5 px-5 text-right">เงินปันผลสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {report.dividends.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-5 text-[var(--text-secondary)]">
                            {new Date(item.date).toLocaleDateString('th-TH')}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-white">{item.ticker}</td>
                          <td className="py-3.5 px-5 text-right text-white tabular-nums">
                            ฿{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-5 text-right text-rose-400 tabular-nums">
                            -฿{Number(item.taxWithheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-emerald-400 tabular-nums">
                            ฿{Number(item.amount - item.taxWithheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Table 2: Foreign & Crypto Trades */}
            <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] overflow-hidden">
              <div className="p-5 border-b border-white/[0.06]">
                <h3 className="text-base font-bold text-white">รายการขายสินทรัพย์ต่างประเทศ / คริปโต (FIFO Basis)</h3>
              </div>
              {report.foreignAndCryptoGains.trades.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  ไม่มีรายการขายสินทรัพย์ต่างประเทศหรือคริปโตในปี {selectedYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">วันที่ขาย</th>
                        <th className="py-3 px-4">Ticker</th>
                        <th className="py-3 px-4 text-right">จำนวน</th>
                        <th className="py-3 px-4 text-right">ราคาขาย</th>
                        <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                        <th className="py-3 px-4 text-right">ต้นทุน FIFO</th>
                        <th className="py-3 px-4 text-right">กำไร/ขาดทุน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {report.foreignAndCryptoGains.trades.map((t: any, idx: number) => {
                        const isGain = t.realizedGain >= 0
                        return (
                          <tr key={idx} className="hover:bg-[var(--bg-elevated)]/30">
                            <td className="py-3 px-4 text-[var(--text-secondary)]">
                              {new Date(t.sellDate).toLocaleDateString('th-TH')}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {t.ticker}
                              <span className="text-[10px] text-[var(--text-muted)] ml-1">({t.market})</span>
                            </td>
                            <td className="py-3 px-4 text-right text-white tabular-nums">
                              {Number(t.quantity).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--text-secondary)] tabular-nums">
                              {Number(t.sellPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right text-white tabular-nums">
                              {Number(t.sellProceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--text-muted)] tabular-nums">
                              {Number(t.costBasis).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-bold tabular-nums ${
                                isGain ? 'text-[var(--green-400)]' : 'text-[var(--red-400)]'
                              }`}
                            >
                              {isGain ? '+' : ''}
                              {Number(t.realizedGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
