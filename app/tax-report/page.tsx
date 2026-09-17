'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Sparkles,
  Download,
  AlertTriangle,
  Calendar,
  Loader2,
} from 'lucide-react'

export default function TaxReportPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  const { data: report, isLoading, error } = useSWR(`/api/tax-report/generate?year=${selectedYear}`)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string>('')

  async function handleExportExcel() {
    if (!report) return

    const XLSX = await import('xlsx')

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
      alert(err.message || 'Error occurred')
    } finally {
      setAiLoading(false)
    }
  }

  const yearsList = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">รายงานสรุปภาษีการลงทุน</h1>
            <p className="text-sm text-zinc-500 mt-1">คำนวณต้นทุน FIFO แยกปันผล หุ้นไทย และหุ้นนอกหรือคริปโต</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#050505] border border-white/10 rounded-xl px-4 py-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <select
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer uppercase tracking-widest font-mono"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value))
                  setAiExplanation(null)
                }}
              >
                {yearsList.map((y) => (
                  <option key={y} value={y} className="bg-black">
                    YEAR {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={!report}
              className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors h-[34px]"
            >
              <Download className="w-4 h-4" /> EXPORT
            </button>
          </div>
        </div>

        {/* Mandatory Legal Disclaimer Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-200/80 leading-relaxed font-mono">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-400 uppercase tracking-widest mb-1">
              LEGAL DISCLAIMER
            </p>
            <p>
              รายงานนี้สร้างขึ้นเพื่ออำนวยความสะดวกในการจัดหมวดหมู่ข้อมูลการลงทุนส่วนบุคคลด้วยวิธี FIFO เท่านั้น ไม่ถือเป็นการยื่นแบบภาษีจริง และคำอธิบายจาก AI ไม่ใช่คำแนะนำด้านภาษีที่มีใบอนุญาต ผู้เสียภาษีมีหน้าที่ตรวจสอบความถูกต้องกับหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)
            </p>
          </div>
        </div>

        {/* 3 Main Tax Category KPI Cards */}
        {isLoading ? (
           <div className="py-24 flex flex-col items-center justify-center gap-4 text-zinc-500">
             <Loader2 className="w-8 h-8 animate-spin" />
             <span className="text-[10px] font-mono tracking-widest uppercase">Calculating Taxes...</span>
           </div>
        ) : error ? (
           <div className="p-8 text-center text-rose-400 text-xs font-mono">Error generating tax report</div>
        ) : report ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category 1: Dividends */}
            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-4 flex flex-col justify-between min-h-[160px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  DIVIDENDS
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-sm bg-white/5 font-mono text-zinc-500 tracking-widest">
                  {report.dividends.items.length} ITEMS
                </span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight font-mono">
                ฿{Number(report.dividends.totalDividendGross).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-500 space-y-1.5 pt-4 border-t border-white/5 font-mono tracking-widest">
                <div className="flex justify-between">
                  <span>TAX WITHHELD:</span>
                  <span className="font-bold text-rose-400">
                    -฿{Number(report.dividends.totalTaxWithheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>NET DIVIDENDS:</span>
                  <span className="font-bold text-white">
                    ฿{Number(report.dividends.totalDividendNet).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Category 2: Thai SET Capital Gains */}
            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-4 flex flex-col justify-between min-h-[160px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  THAI SET GAINS
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-sm bg-emerald-500/10 font-mono text-emerald-400 tracking-widest">
                  EXEMPT
                </span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight font-mono">
                ฿{Number(report.thaiSetCapitalGains.totalRealizedGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-500 pt-4 border-t border-white/5 flex justify-between font-mono tracking-widest">
                <span>TOTAL VOLUME:</span>
                <span className="font-bold text-white">
                  ฿{Number(report.thaiSetCapitalGains.totalVolume).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Category 3: Foreign & Crypto Gains */}
            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-4 flex flex-col justify-between min-h-[160px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  FOREIGN & CRYPTO GAINS
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-sm bg-white/5 font-mono text-zinc-500 tracking-widest">
                  {report.foreignAndCryptoGains.trades.length} TRADES
                </span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight font-mono">
                ฿{Number(report.foreignAndCryptoGains.totalRealizedGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-500 space-y-1.5 pt-4 border-t border-white/5 font-mono tracking-widest">
                <div className="flex justify-between">
                  <span>TOTAL PROCEEDS:</span>
                  <span className="font-bold text-white">
                    ฿{Number(report.foreignAndCryptoGains.totalProceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>FIFO COST:</span>
                  <span className="font-bold text-zinc-400">
                    ฿{Number(report.foreignAndCryptoGains.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* AI Explain Tax Button & Card */}
        <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                AI TAX ADVISOR
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                Get AI analysis and explanations for your tax year {selectedYear}
              </p>
            </div>

            <button
              onClick={handleExplainAI}
              disabled={aiLoading || !report}
              className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors self-start sm:self-auto"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ANALYZING...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>GENERATE REPORT</span>
                </>
              )}
            </button>
          </div>

          {aiExplanation && (
            <div className="p-5 rounded-2xl bg-[#050505] border border-white/5 text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-mono animate-in fade-in">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">ANALYSIS COMPLETE</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">{modelUsed}</span>
              </div>
              {aiExplanation}
            </div>
          )}
        </div>

        {/* Detailed Breakdown Tables */}
        {report && (
          <div className="space-y-6">
            {/* Table 1: Dividends */}
            <div className="rounded-3xl bg-[#0a0a0a] border border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">DIVIDENDS DETAIL</h3>
              </div>
              {report.dividends.items.length === 0 ? (
                <div className="p-8 text-center text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  No dividends received in {selectedYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-[#050505] text-zinc-500 uppercase tracking-widest">
                      <tr>
                        <th className="py-3 px-5 font-bold">DATE</th>
                        <th className="py-3 px-5 font-bold">TICKER</th>
                        <th className="py-3 px-5 text-right font-bold">GROSS</th>
                        <th className="py-3 px-5 text-right font-bold">TAX WITHHELD</th>
                        <th className="py-3 px-5 text-right font-bold">NET</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.dividends.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-5 text-zinc-400">
                            {new Date(item.date).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: '2-digit' })}
                          </td>
                          <td className="py-3 px-5 font-bold text-white">{item.ticker}</td>
                          <td className="py-3 px-5 text-right text-white tabular-nums">
                            {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-5 text-right text-rose-400 tabular-nums">
                            -{Number(item.taxWithheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-5 text-right font-bold text-emerald-400 tabular-nums">
                            {Number(item.amount - item.taxWithheld).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Table 2: Foreign & Crypto Trades */}
            <div className="rounded-3xl bg-[#0a0a0a] border border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">FOREIGN & CRYPTO TRADES (FIFO)</h3>
              </div>
              {report.foreignAndCryptoGains.trades.length === 0 ? (
                <div className="p-8 text-center text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  No foreign or crypto trades in {selectedYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-[#050505] text-zinc-500 uppercase tracking-widest">
                      <tr>
                        <th className="py-3 px-5 font-bold">DATE</th>
                        <th className="py-3 px-5 font-bold">TICKER</th>
                        <th className="py-3 px-5 text-right font-bold">QTY</th>
                        <th className="py-3 px-5 text-right font-bold">PRICE</th>
                        <th className="py-3 px-5 text-right font-bold">PROCEEDS</th>
                        <th className="py-3 px-5 text-right font-bold">FIFO COST</th>
                        <th className="py-3 px-5 text-right font-bold">REALIZED P/L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.foreignAndCryptoGains.trades.map((t: any, idx: number) => {
                        const isGain = t.realizedGain >= 0
                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-5 text-zinc-400">
                              {new Date(t.sellDate).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: '2-digit' })}
                            </td>
                            <td className="py-3 px-5 font-bold text-white">
                              {t.ticker}
                              <span className="text-[9px] text-zinc-500 ml-1">({t.market})</span>
                            </td>
                            <td className="py-3 px-5 text-right text-white tabular-nums">
                              {Number(t.quantity).toLocaleString()}
                            </td>
                            <td className="py-3 px-5 text-right text-zinc-400 tabular-nums">
                              {Number(t.sellPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-5 text-right text-white tabular-nums">
                              {Number(t.sellProceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-5 text-right text-zinc-500 tabular-nums">
                              {Number(t.costBasis).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td
                              className={`py-3 px-5 text-right font-bold tabular-nums ${
                                isGain ? 'text-emerald-400' : 'text-rose-400'
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
