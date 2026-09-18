'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { runMonteCarloSimulation, SimulationResult } from '@/lib/analytics/monte-carlo'
import {
  Target,
  Sparkles,
  Loader2,
  TrendingUp,
  Play,
  RotateCcw,
  Clock,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export default function ForecastPage() {
  const { data: summary } = useSWR('/api/portfolio/summary')

  // Inputs
  const [initialAmount, setInitialAmount] = useState<number>(100000)
  const [monthlyContribution, setMonthlyContribution] = useState<number>(10000)
  const [years, setYears] = useState<number>(10)
  const [annualReturn, setAnnualReturn] = useState<number>(8) // 8%
  const [annualVolatility, setAnnualVolatility] = useState<number>(15) // 15%
  const [targetAmount, setTargetAmount] = useState<number>(3000000)

  // Simulation State
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string>('')

  // Load persistent latest AI explanation from database
  const { data: aiForecastData, mutate: mutateAiForecast } = useSWR('/api/ai-advisor/explain-forecast', {
    revalidateOnFocus: false,
  })

  const currentExplanation = aiExplanation || aiForecastData?.explanation
  const currentModel = modelUsed || aiForecastData?.modelUsed
  const currentUpdatedAt = aiForecastData?.updatedAt

  useEffect(() => {
    if (summary?.totalValue && summary.totalValue > 0) {
      setInitialAmount(Math.round(summary.totalValue))
    }
  }, [summary?.totalValue])

  function handleRunSimulation() {
    const sim = runMonteCarloSimulation({
      initialAmount,
      monthlyContribution,
      years,
      annualReturn: annualReturn / 100,
      annualVolatility: annualVolatility / 100,
      targetAmount,
      numSimulations: 500,
    })
    setResult(sim)
    // Keep currentExplanation visible so the user can continue reading past analysis
  }

  useEffect(() => {
    handleRunSimulation()
  }, [])

  async function handleExplainAI() {
    if (!result) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-advisor/explain-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialAmount,
          monthlyContribution,
          years,
          finalP10: result.finalP10,
          finalP50: result.finalP50,
          finalP90: result.finalP90,
          targetAmount,
          probabilityOfReachingTarget: result.probabilityOfReachingTarget,
        }),
      })
      const data = await res.json()
      if (data.explanation) {
        setAiExplanation(data.explanation)
        setModelUsed(data.modelUsed || '')
        await mutateAiForecast(data, false)
      }
    } catch {
      setAiExplanation('เกิดข้อผิดพลาดในการขอคำแนะนำจาก AI กรุณาลองใหม่อีกครั้ง')
    } finally {
      setAiLoading(false)
    }
  }

  const inputClass = "w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
  const labelClass = "block text-xs font-semibold text-slate-300 mb-1.5"

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Monte Carlo Simulation"
          title="แบบจำลองพยากรณ์พอร์ตการลงทุน"
          description="จำลองความน่าจะเป็น 500 สถานการณ์ล่วงหน้าด้วยหลักสถิติ เพื่อประเมินโอกาสพิชิตเป้าหมายทางการเงินของคุณ"
          action={
            <button
              onClick={handleRunSimulation}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>ประมวลผลจำลองพอร์ต</span>
            </button>
          }
        />

        {/* Input Parameters Controls */}
        <div className="p-6 rounded-2xl bg-[#12151C] border border-white/[0.08] shadow-xl shadow-black/40 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              พารามิเตอร์การจำลองพอร์ต
            </span>
            <span className="text-[11px] text-slate-500 font-mono">500 Iterations</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>เงินต้นเริ่มต้น (฿)</label>
              <input type="number" step="10000" className={inputClass} value={initialAmount} onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ออมต่อเดือน DCA (฿)</label>
              <input type="number" step="1000" className={inputClass} value={monthlyContribution} onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ระยะเวลา (ปี)</label>
              <input type="number" min="1" max="30" className={inputClass} value={years} onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ผลตอบแทนคาดหวัง (%)</label>
              <input type="number" min="1" max="30" step="0.5" className={inputClass} value={annualReturn} onChange={(e) => setAnnualReturn(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ความผันผวน (%)</label>
              <input type="number" min="1" max="50" step="1" className={inputClass} value={annualVolatility} onChange={(e) => setAnnualVolatility(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>เป้าหมายพอร์ต (฿)</label>
              <input type="number" step="500000" className={`${inputClass} font-bold text-indigo-300`} value={targetAmount} onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* Results Metrics */}
        {result && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col justify-between min-h-[130px] shadow-xl shadow-black/30">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-400" /> โอกาสถึงเป้าหมาย
              </span>
              <div className="mt-3">
                <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums font-mono tracking-tight leading-none">
                  {result.probabilityOfReachingTarget ?? 0}%
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-1.5 truncate">
                  เป้าหมาย ฿{targetAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col justify-between min-h-[130px] shadow-xl shadow-black/30">
              <span className="text-xs font-medium text-rose-400">
                กรณีตลาดแย่ (P10)
              </span>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-rose-300 tabular-nums font-mono tracking-tight leading-none">
                  ฿{result.finalP10.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-1.5">
                  ความน่าจะเป็น 10%
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col justify-between min-h-[130px] shadow-xl shadow-black/30">
              <span className="text-xs font-medium text-slate-300">
                กรณีมัธยฐาน (P50)
              </span>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums font-mono tracking-tight leading-none">
                  ฿{result.finalP50.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-1.5">
                  ความน่าจะเป็น 50%
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col justify-between min-h-[130px] shadow-xl shadow-black/30">
              <span className="text-xs font-medium text-emerald-400">
                กรณีตลาดดีเยี่ยม (P90)
              </span>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-emerald-300 tabular-nums font-mono tracking-tight leading-none">
                  ฿{result.finalP90.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-1.5 truncate">
                  เงินต้นรวม ฿{result.totalContributed.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fan Chart View */}
        {result && (
          <div className="p-6 sm:p-7 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-6 shadow-xl shadow-black/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  เส้นพัดจำลองผลลัพธ์ (Fan Chart Projection)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ช่วงการกระจายตัวของมูลค่าพอร์ตในอนาคต P10 / P50 / P90
                </p>
              </div>
              <button
                onClick={handleExplainAI}
                disabled={aiLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs py-2 px-4 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer self-start sm:self-auto"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI กำลังวิเคราะห์ผล...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>วิเคราะห์ผลลัพธ์ด้วย AI</span>
                  </>
                )}
              </button>
            </div>

            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.steps} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="year" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(y) => `ปีที่ ${y}`} dy={10} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`} dx={-5} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#181C25', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#fff' }}
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                    formatter={(val: any, name: any) => [`฿${Number(val).toLocaleString()}`, name]}
                    labelFormatter={(y) => `ปีที่ ${y}`}
                  />
                  <Area type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#p90Grad)" name="กรณีดีเยี่ยม (P90)" />
                  <Area type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#p50Grad)" name="มัธยฐาน (P50)" />
                  <Area type="monotone" dataKey="p10" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={0} name="กรณีตลาดแย่ (P10)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* AI Explanation Box */}
        {currentExplanation && (
          <div className="p-6 rounded-3xl glass-panel border border-indigo-500/30 space-y-4 animate-fade-in shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>คำแนะนำเชิงกลยุทธ์จาก AI Advisor (การวิเคราะห์ล่าสุด)</span>
              </div>
              <div className="flex items-center gap-2.5">
                {currentUpdatedAt && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1 rounded-xl border border-white/[0.06]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(currentUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                )}
                {currentModel && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                    {currentModel}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-black/30 border border-white/[0.06] text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line relative z-10">
              {currentExplanation}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
