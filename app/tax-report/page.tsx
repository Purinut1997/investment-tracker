'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Sparkles,
  AlertTriangle,
  Calendar,
  Loader2,
  FileSpreadsheet,
  Coins,
  Building2,
  Receipt,
  CheckCircle2,
  DollarSign,
  Clock,
  RefreshCw,
} from 'lucide-react'

// Helper: format a number with the correct currency symbol
function fmt(value: number, currency: 'USD' | 'THB', opts?: { prefix?: boolean }) {
  const sym = currency === 'USD' ? '$' : '฿'
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${sym}${formatted}`
}

function fmtWithSign(value: number, currency: 'USD' | 'THB') {
  const sym = currency === 'USD' ? '$' : '฿'
  const sign = value >= 0 ? '+' : '-'
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${sign}${sym}${formatted}`
}

export default function TaxReportPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  // showTHB = true -> show THB equivalent everywhere, false -> show native currency (USD for US stocks)
  const [showTHB, setShowTHB] = useState(false)
  // repatriated = true -> user brought money back to Thailand (affects tax liability for foreign gains)
  const [repatriated, setRepatriated] = useState(false)

  const { data: report, isLoading, error } = useSWR(`/api/tax-report/generate?year=${selectedYear}`)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string>('')

  // Load persistent latest AI tax explanation for this year from database
  const { data: cachedTaxAi, mutate: mutateCachedTaxAi } = useSWR(
    `/api/tax-report/explain?year=${selectedYear}`,
    { revalidateOnFocus: false }
  )

  const currentExplanation = aiExplanation || cachedTaxAi?.explanation
  const currentModel = modelUsed || cachedTaxAi?.modelUsed
  const currentUpdatedAt = cachedTaxAi?.updatedAt

  const usdThbRate: number = report?.usdThbRate ?? 35.5

  async function handleExportExcel() {
    if (!report) return

    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // 1. Dividends Sheet — include both USD and THB columns
    const divRows = report.dividends.items.map((item: any) => ({
      'วันที่รับ': new Date(item.date).toLocaleDateString('th-TH'),
      'สัญลักษณ์ (Ticker)': item.ticker,
      'สกุลเงิน': item.currency || 'USD',
      'เงินปันผลรวม (Gross) - สกุลเดิม': item.amount,
      'ภาษีหัก ณ ที่จ่าย - สกุลเดิม': item.taxWithheld,
      'เงินปันผลสุทธิ - สกุลเดิม': item.amount - item.taxWithheld,
      'เงินปันผลรวม (Gross) - THB (฿)': item.amountTHB ?? item.amount,
      'ภาษีหัก ณ ที่จ่าย - THB (฿)': item.taxWithheldTHB ?? item.taxWithheld,
      'เงินปันผลสุทธิ - THB (฿)': (item.amountTHB ?? item.amount) - (item.taxWithheldTHB ?? item.taxWithheld),
      'อัตราแลกเปลี่ยนอ้างอิง (1 USD = THB)': usdThbRate,
    }))
    const wsDiv = XLSX.utils.json_to_sheet(divRows)
    XLSX.utils.book_append_sheet(wb, wsDiv, 'เงินปันผล (Dividends)')

    // 2. Thai SET Capital Gains Sheet (always THB)
    const thaiRows = report.thaiSetCapitalGains.trades.map((t: any) => ({
      'วันที่ขาย': new Date(t.sellDate).toLocaleDateString('th-TH'),
      'Ticker': t.ticker,
      'จำนวนที่ขาย': t.quantity,
      'ราคาขาย (THB)': t.sellPrice,
      'ยอดขายรวม (THB)': t.sellProceeds,
      'ต้นทุน FIFO (THB)': t.costBasis,
      'กำไร/ขาดทุน (THB)': t.realizedGain,
      'ค่าธรรมเนียม (THB)': t.fee,
      'สถานะภาษี': 'ยกเว้นภาษี (Exempt)',
    }))
    const wsThai = XLSX.utils.json_to_sheet(thaiRows)
    XLSX.utils.book_append_sheet(wb, wsThai, 'กำไรหุ้นไทย (SET)')

    // 3. Foreign & Crypto Sheet — include both USD and THB
    const foreignRows = report.foreignAndCryptoGains.trades.map((t: any) => ({
      'วันที่ขาย': new Date(t.sellDate).toLocaleDateString('th-TH'),
      'Ticker / ตลาด': `${t.ticker} (${t.market})`,
      'สกุลเงิน': t.currency || 'USD',
      'จำนวนที่ขาย': t.quantity,
      'ราคาขาย - สกุลเดิม': t.sellPrice,
      'ยอดขายรวม - สกุลเดิม': t.sellProceeds,
      'ต้นทุน FIFO - สกุลเดิม': t.costBasis,
      'กำไร/ขาดทุน - สกุลเดิม': t.realizedGain,
      'ยอดขายรวม - THB (฿)': t.sellProceedsTHB ?? t.sellProceeds,
      'ต้นทุน FIFO - THB (฿)': t.costBasisTHB ?? t.costBasis,
      'กำไร/ขาดทุน - THB (฿)': t.realizedGainTHB ?? t.realizedGain,
      'อัตราแลกเปลี่ยนอ้างอิง': usdThbRate,
      'ค่าธรรมเนียม - สกุลเดิม': t.fee,
    }))
    const wsForeign = XLSX.utils.json_to_sheet(foreignRows)
    XLSX.utils.book_append_sheet(wb, wsForeign, 'หุ้นนอก & คริปโต')

    XLSX.writeFile(wb, `Tax_Report_${selectedYear}_InvestmentPro.xlsx`)
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
          usdThbRate,
          repatriated,
          dividends: {
            totalDividendGrossUSD: report.dividends.totalDividendGrossUSD,
            totalTaxWithheldUSD: report.dividends.totalTaxWithheldUSD,
            totalDividendNetUSD: report.dividends.totalDividendNetUSD,
            totalDividendGrossTHB: report.dividends.totalDividendGrossTHB,
            totalTaxWithheldTHB: report.dividends.totalTaxWithheldTHB,
            totalDividendNetTHB: report.dividends.totalDividendNetTHB,
          },
          thaiSetCapitalGains: report.thaiSetCapitalGains,
          foreignAndCryptoGains: {
            totalRealizedGainUSD: report.foreignAndCryptoGains.totalRealizedGainUSD,
            totalProceedsUSD: report.foreignAndCryptoGains.totalProceedsUSD,
            totalCostUSD: report.foreignAndCryptoGains.totalCostUSD,
            totalRealizedGainTHB: report.foreignAndCryptoGains.totalRealizedGainTHB,
            totalProceedsTHB: report.foreignAndCryptoGains.totalProceedsTHB,
            totalCostTHB: report.foreignAndCryptoGains.totalCostTHB,
          },
        }),
      })
      const data = await res.json()
      if (data.explanation) {
        setAiExplanation(data.explanation)
        setModelUsed(data.modelUsed || '')
        await mutateCachedTaxAi(data, false)
      }
    } catch {
      setAiExplanation('เกิดข้อผิดพลาดในการประมวลผลคำแนะนำจาก AI กรุณาลองใหม่อีกครั้ง')
    } finally {
      setAiLoading(false)
    }
  }

  const yearsList = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Tax & Compliance"
          title="รายงานภาษีและการจัดการส่วนบุคคล"
          description="จัดหมวดหมู่กระแสเงินสด เงินปันผล และผลกำไรตามหลักเกณฑ์ FIFO เพื่อเตรียมข้อมูลยื่นแบบแสดงรายการภาษี"
          action={
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 bg-[#181C25] border border-white/[0.1] rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(parseInt(e.target.value))
                    setAiExplanation(null)
                  }}
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y} className="bg-[#12151C] text-white">
                      ปีภาษี {y} (พ.ศ. {y + 543})
                    </option>
                  ))}
                </select>
              </div>
              {/* Currency Mode Switcher */}
              <button
                type="button"
                onClick={() => setShowTHB((v) => !v)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                  showTHB
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-[#181C25] border-white/[0.1] text-slate-300 hover:text-white'
                }`}
                title={showTHB ? 'แสดงสกุลเงินเดิม (USD/THB)' : 'แปลงทุกรายการเป็นเงินบาท'}
              >
                <DollarSign className="w-3.5 h-3.5" />
                {showTHB ? 'แสดง: เงินบาท (฿ THB)' : 'แสดง: สกุลเงินเดิม'}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={!report}
                className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ส่งออกไฟล์ Excel (.xlsx)</span>
              </button>
            </div>
          }
        />

        {/* Legal Disclaimer Banner — correct Thai tax rules per ป.161/2566 */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed shadow-lg shadow-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">ข้อควรทราบทางภาษีตาม ป.161/2566 (กรมสรรพากร):</span>
            <p className="mt-1 leading-relaxed">
              <span className="text-amber-200 font-semibold">กำไรหุ้นต่างประเทศ (Capital Gains):</span>{' '}
              นักลงทุนต่างชาติไม่มีภาระภาษีในสหรัฐฯ •{' '}
              เงินที่ลงทุน<span className="font-semibold">ก่อนปี 2567</span> และ<span className="font-semibold">ไม่นำกลับไทย</span> → ไม่ต้องเสียภาษีไทย •{' '}
              เงินที่ลงทุน<span className="font-semibold">ตั้งแต่ปี 2567</span> → ต้องยื่นภาษีไทยไม่ว่าจะนำกลับหรือไม่
            </p>
            <p className="mt-1">
              <span className="text-amber-200 font-semibold">เงินปันผล:</span>{' '}
              ถูกหัก ณ ที่จ่าย 15% (W-8BEN) ในสหรัฐฯ — สามารถนำมาเป็นเครดิตภาษีไทยได้
            </p>
          </div>
        </div>

        {/* Info bar: FX Rate + Repatriation toggle */}
        {report && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#181C25] border border-white/[0.06] text-xs text-slate-400">
              <span className="text-slate-500">อัตราแลกเปลี่ยนอ้างอิง:</span>
              <span className="font-mono font-semibold text-slate-300">1 USD = ฿{usdThbRate.toFixed(2)} THB</span>
              <span className="w-px h-4 bg-white/10 mx-1" />
              <span className={showTHB ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                {showTHB ? '⚡ โหมดเงินบาท' : 'โหมดสกุลเงินเดิม'}
              </span>
            </div>
            {/* Repatriation toggle — key for correct tax liability display */}
            <button
              type="button"
              onClick={() => { setRepatriated(v => !v); setAiExplanation(null) }}
              className={`text-xs font-semibold px-3 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                repatriated
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
              title="กดเพื่อบอกระบบว่าคุณนำเงินกลับไทยหรือไม่ — ส่งผลต่อการแสดงภาระภาษี"
            >
              <span>{repatriated ? '🔴' : '🟢'}</span>
              <span>{repatriated ? 'นำเงินกลับไทยแล้ว → มีภาระภาษีไทย' : 'ยังไม่นำเงินกลับไทย → ไม่มีภาระภาษีไทย (ก่อนปี 2567)'}</span>
            </button>
          </div>
        )}

        {/* 3 Main Tax Category KPI Cards */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">กำลังคำนวณและสรุปข้อมูลภาษีปี {selectedYear}...</span>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center text-rose-300 text-xs font-mono">
            เกิดข้อผิดพลาดในการดึงข้อมูลรายงานภาษี
          </div>
        ) : report ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category 1: Dividends */}
            <div className="p-6 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-4 flex flex-col justify-between min-h-[160px] shadow-xl shadow-black/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" /> เงินปันผลรับสะสม (Dividends)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 font-mono text-slate-400">
                  {report.dividends.items.length} รายการ
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400">ยอดเงินปันผลรวม (ก่อนหักภาษี)</span>
                <div className="text-3xl font-bold text-white tabular-nums tracking-tight font-mono mt-0.5">
                  {showTHB
                    ? `฿${Number(report.dividends.totalDividendGrossTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : report.dividends.totalDividendGrossUSD > 0
                    ? `$${Number(report.dividends.totalDividendGrossUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : `฿${Number(report.dividends.totalDividendGrossTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
                {!showTHB && report.dividends.totalDividendGrossUSD > 0 && (
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    ≈ ฿{Number(report.dividends.totalDividendGrossTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB
                  </p>
                )}
              </div>
              <div className="text-xs text-slate-400 space-y-1.5 pt-3 border-t border-white/[0.06] font-mono">
                <div className="flex justify-between">
                  <span>ภาษีหัก ณ ที่จ่าย W-8BEN (15% สหรัฐฯ):</span>
                  <span className="font-bold text-rose-400">
                    {showTHB
                      ? `-฿${Number(report.dividends.totalTaxWithheldTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : report.dividends.totalTaxWithheldUSD > 0
                      ? `-$${Number(report.dividends.totalTaxWithheldUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : `-฿${Number(report.dividends.totalTaxWithheldTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>เงินปันผลรับสุทธิ:</span>
                  <span className="font-bold text-emerald-400">
                    {showTHB
                      ? `฿${Number(report.dividends.totalDividendNetTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : report.dividends.totalDividendNetUSD > 0
                      ? `$${Number(report.dividends.totalDividendNetUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : `฿${Number(report.dividends.totalDividendNetTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Category 2: Thai SET Capital Gains */}
            <div className="p-6 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-4 flex flex-col justify-between min-h-[160px] shadow-xl shadow-black/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> กำไรหุ้นไทยในตลาด (SET)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 font-mono text-emerald-300 border border-emerald-500/30">
                  ยกเว้นภาษี (Exempt)
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400">กำไรส่วนต่างราคาขายสุทธิ (Capital Gains)</span>
                <div className="text-3xl font-bold text-white tabular-nums tracking-tight font-mono mt-0.5">
                  ฿{Number(report.thaiSetCapitalGains.totalRealizedGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-xs text-slate-400 pt-3 border-t border-white/[0.06] flex justify-between font-mono">
                <span>มูลค่าซื้อขายรวมทั้งสิ้น:</span>
                <span className="font-bold text-white">
                  ฿{Number(report.thaiSetCapitalGains.totalVolume).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Category 3: Foreign & Crypto Gains */}
            {(() => {
              const isNewRuleYear = selectedYear >= 2024
              const isTaxableInThailand = isNewRuleYear || repatriated
              const hasForeignGain = report.foreignAndCryptoGains.trades.length > 0
              return (
                <div className="p-6 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-4 flex flex-col justify-between min-h-[160px] shadow-xl shadow-black/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4" /> กำไรหุ้นต่างประเทศและคริปโต
                    </span>
                    {hasForeignGain ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono border font-semibold ${
                        isTaxableInThailand
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {isTaxableInThailand
                          ? isNewRuleYear ? '⚠️ ต้องยื่นภาษีไทย (ปี 2567+)' : '⚠️ นำเงินกลับไทย'
                          : '✅ ไม่ต้องเสียภาษีไทย'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 font-mono text-slate-400">
                        {report.foreignAndCryptoGains.trades.length} รายการขาย
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">กำไรรับรู้จริงสะสม (FIFO Realized) — บันทึกเพื่อวางแผนภาษี</span>
                    <div className="text-3xl font-bold text-white tabular-nums tracking-tight font-mono mt-0.5">
                      {showTHB
                        ? `฿${Number(report.foreignAndCryptoGains.totalRealizedGainTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : `$${Number(report.foreignAndCryptoGains.totalRealizedGainUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </div>
                    {!showTHB && (
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        ≈ ฿{Number(report.foreignAndCryptoGains.totalRealizedGainTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })} THB
                      </p>
                    )}
                    {/* Tax note */}
                    <p className={`text-[11px] mt-1.5 font-semibold ${
                      isTaxableInThailand ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {isTaxableInThailand
                        ? isNewRuleYear
                          ? '⚠️ ปี 2567+ ต้องยื่นภาษีเงินได้บุคคลธรรมดาไทย (ก้าวหน้า 0-35%)'
                          : '⚠️ นำเงินกลับไทย → ต้องยื่นภาษี ภ.ง.ด. (อัตราก้าวหน้า 0-35%)'
                        : '✅ ยังไม่นำเงินกลับไทย + ลงทุนก่อนปี 2567 → ไม่มีภาระภาษีไทย'}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1.5 pt-3 border-t border-white/[0.06] font-mono">
                    <div className="flex justify-between">
                      <span>ยอดขายรวม:</span>
                      <span className="font-bold text-white">
                        {showTHB
                          ? `฿${Number(report.foreignAndCryptoGains.totalProceedsTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `$${Number(report.foreignAndCryptoGains.totalProceedsUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ต้นทุน FIFO:</span>
                      <span className="font-bold text-slate-300">
                        {showTHB
                          ? `฿${Number(report.foreignAndCryptoGains.totalCostTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `$${Number(report.foreignAndCryptoGains.totalCostUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ภาษีสหรัฐฯ (Capital Gains):</span>
                      <span className="text-emerald-400 font-bold">ไม่ต้องเสีย $0</span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : null}

        {/* AI Tax Advisor Card */}
        <div className="p-6 rounded-3xl glass-panel border border-indigo-500/20 space-y-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>คำแนะนำเชิงภาษีจาก AI Tax Advisor</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                รับการวิเคราะห์ภาพรวมภาษีและการเตรียมเอกสาร ภ.ง.ด. สำหรับปีภาษี {selectedYear}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {currentUpdatedAt && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  วิเคราะห์ล่าสุด: {new Date(currentUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </span>
              )}
              <button
                type="button"
                onClick={handleExplainAI}
                disabled={aiLoading || !report}
                className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังวิเคราะห์ข้อมูลภาษี...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{currentExplanation ? 'วิเคราะห์ภาษีใหม่ด้วย AI' : 'วิเคราะห์ภาษีด้วย AI'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {currentExplanation && (
            <div className="p-5 rounded-2xl bg-black/30 border border-indigo-500/25 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line animate-fade-in relative z-10">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/[0.06]">
                <span className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผลการวิเคราะห์ล่าสุดปีภาษี {selectedYear}
                </span>
                {currentModel && <span className="text-[10px] text-slate-500 font-mono">{currentModel}</span>}
              </div>
              {currentExplanation}
            </div>
          )}
        </div>

        {/* Detailed Breakdown Tables */}
        {report && (
          <div className="space-y-6">
            {/* Table 1: Dividends */}
            <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] overflow-hidden shadow-xl shadow-black/30">
              <div className="px-6 py-4 border-b border-white/[0.06] bg-[#181C25]">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  รายละเอียดเงินปันผลรับสะสม (Dividends Detail)
                </h3>
              </div>
              {report.dividends.items.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  ไม่พบรายการเงินปันผลในปีภาษี {selectedYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="custom-table text-left">
                    <thead>
                      <tr>
                        <th>วันที่รับเงิน</th>
                        <th>สัญลักษณ์ (Ticker)</th>
                        <th className="text-center">สกุลเงิน</th>
                        <th className="text-right">ยอดก่อนหักภาษี (Gross)</th>
                        <th className="text-right">ภาษีหัก ณ ที่จ่าย (10%)</th>
                        <th className="text-right">ยอดสุทธิ (Net)</th>
                        {!showTHB && <th className="text-right text-amber-400/70">เทียบเท่า (฿ THB)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {report.dividends.items.map((item: any, idx: number) => {
                        const isUSD = item.currency === 'USD'
                        const sym = showTHB ? '฿' : (isUSD ? '$' : '฿')
                        const gross = showTHB ? (item.amountTHB ?? item.amount) : item.amount
                        const tax = showTHB ? (item.taxWithheldTHB ?? item.taxWithheld) : item.taxWithheld
                        const net = gross - tax

                        return (
                          <tr key={idx} className="transition-colors">
                            <td className="font-mono text-xs text-slate-400">
                              {new Date(item.date).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: '2-digit' })}
                            </td>
                            <td className="font-bold text-white font-mono">{item.ticker}</td>
                            <td className="text-center">
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isUSD ? 'text-blue-400 bg-blue-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                                {item.currency || 'USD'}
                              </span>
                            </td>
                            <td className="text-right text-white tabular-nums font-mono">
                              {sym}{Number(gross).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right text-rose-400 tabular-nums font-mono">
                              -{sym}{Number(tax).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right font-bold text-emerald-400 tabular-nums font-mono">
                              {sym}{Number(net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            {!showTHB && (
                              <td className="text-right tabular-nums font-mono text-slate-500 text-[11px]">
                                ≈ ฿{Number(item.amountTHB ?? item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Table 2: Foreign & Crypto Trades */}
            <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] overflow-hidden shadow-xl shadow-black/30">
              <div className="px-6 py-4 border-b border-white/[0.06] bg-[#181C25]">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  รายการขายสินทรัพย์ต่างประเทศและคริปโต (FIFO Lots)
                </h3>
              </div>
              {report.foreignAndCryptoGains.trades.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  ไม่พบรายการขายสินทรัพย์ต่างประเทศหรือคริปโตในปีภาษี {selectedYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="custom-table text-left">
                    <thead>
                      <tr>
                        <th>วันที่ขาย</th>
                        <th>สินทรัพย์</th>
                        <th className="text-right">จำนวน</th>
                        <th className="text-right">ราคาขาย/หน่วย</th>
                        <th className="text-right">ยอดขายรวม</th>
                        <th className="text-right">ต้นทุน FIFO</th>
                        <th className="text-right">กำไร/ขาดทุนรับรู้</th>
                        {!showTHB && <th className="text-right text-amber-400/70">กำไร (฿ THB)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {report.foreignAndCryptoGains.trades.map((t: any, idx: number) => {
                        const isUSD = t.currency === 'USD'
                        const sym = showTHB ? '฿' : (isUSD ? '$' : '฿')
                        const proceeds = showTHB ? (t.sellProceedsTHB ?? t.sellProceeds) : t.sellProceeds
                        const cost = showTHB ? (t.costBasisTHB ?? t.costBasis) : t.costBasis
                        const gain = showTHB ? (t.realizedGainTHB ?? t.realizedGain) : t.realizedGain
                        const price = showTHB
                          ? (t.sellProceedsTHB ?? t.sellProceeds) / t.quantity
                          : t.sellPrice
                        const isGain = gain >= 0

                        return (
                          <tr key={idx} className="transition-colors">
                            <td className="font-mono text-xs text-slate-400">
                              {new Date(t.sellDate).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: '2-digit' })}
                            </td>
                            <td className="font-bold text-white font-mono">
                              {t.ticker}
                              <span className="text-[10px] text-slate-500 ml-1 font-normal uppercase">({t.market})</span>
                              {isUSD && (
                                <span className="text-[10px] text-blue-400/80 ml-1 font-mono">USD</span>
                              )}
                            </td>
                            <td className="text-right text-white tabular-nums font-mono">
                              {Number(t.quantity).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                            </td>
                            <td className="text-right text-slate-300 tabular-nums font-mono">
                              {sym}{Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right text-white tabular-nums font-mono">
                              {sym}{Number(proceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right text-slate-400 tabular-nums font-mono">
                              {sym}{Number(cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td
                              className={`text-right font-bold tabular-nums font-mono ${
                                isGain ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isGain ? '+' : ''}
                              {sym}{Number(Math.abs(gain)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            {!showTHB && (
                              <td className="text-right tabular-nums font-mono text-slate-500 text-[11px]">
                                {(t.realizedGainTHB ?? 0) >= 0 ? '+' : ''}฿{Number(Math.abs(t.realizedGainTHB ?? t.realizedGain)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                            )}
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
