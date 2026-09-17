'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { runMonteCarloSimulation, SimulationResult } from '@/lib/analytics/monte-carlo'
import {
  Target,
  Sparkles,
  Loader2,
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
    setAiExplanation(null)
  }

  useEffect(() => {
    handleRunSimulation()
  }, [initialAmount, monthlyContribution, years, annualReturn, annualVolatility, targetAmount])

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
      if (!res.ok) throw new Error(data.error || 'Failed to explain')
      setAiExplanation(data.explanation)
      setModelUsed(data.modelUsed)
    } catch (err: any) {
      alert(err.message || 'Error explaining forecast')
    } finally {
      setAiLoading(false)
    }
  }

  const inputClass = "bg-[#050505] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors w-full font-mono"
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5"

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">แบบจำลองความน่าจะเป็นพอร์ต</h1>
            <p className="text-sm text-zinc-500 mt-1">จำลอง 500 สถานการณ์ล่วงหน้าด้วย Monte Carlo Simulation</p>
          </div>
        </div>

        {/* Input Parameters Controls */}
        <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-6">
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            SIMULATION PARAMETERS
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>เงินต้น (INITIAL) ฿</label>
              <input type="number" step="10000" className={inputClass} value={initialAmount} onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ออมต่อเดือน (MONTHLY) ฿</label>
              <input type="number" step="1000" className={inputClass} value={monthlyContribution} onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ระยะเวลา (YEARS)</label>
              <input type="number" min="1" max="30" className={inputClass} value={years} onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>คาดหวังผลตอบแทน (RETURN) %</label>
              <input type="number" min="1" max="30" step="0.5" className={inputClass} value={annualReturn} onChange={(e) => setAnnualReturn(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>ความผันผวน (VOLATILITY) %</label>
              <input type="number" min="1" max="50" step="1" className={inputClass} value={annualVolatility} onChange={(e) => setAnnualVolatility(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className={labelClass}>เป้าหมาย (TARGET) ฿</label>
              <input type="number" step="500000" className={`${inputClass} font-bold text-white`} value={targetAmount} onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* Results Metrics */}
        {result && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> โอกาสถึงเป้าหมาย
              </span>
              <div>
                <div className="text-3xl font-bold text-white tabular-nums font-mono">
                  {result.probabilityOfReachingTarget ?? 0}%
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-1 uppercase tracking-widest">
                  TARGET ฿{targetAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                กรณีแย่ (P10)
              </span>
              <div>
                <div className="text-2xl font-bold text-rose-300 tabular-nums font-mono">
                  ฿{result.finalP10.toLocaleString()}
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-1 uppercase tracking-widest">
                  10% PROBABILITY
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                มัธยฐาน (P50)
              </span>
              <div>
                <div className="text-2xl font-bold text-zinc-300 tabular-nums font-mono">
                  ฿{result.finalP50.toLocaleString()}
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-1 uppercase tracking-widest">
                  50% PROBABILITY
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                กรณีดีเยี่ยม (P90)
              </span>
              <div>
                <div className="text-2xl font-bold text-emerald-300 tabular-nums font-mono">
                  ฿{result.finalP90.toLocaleString()}
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-1 uppercase tracking-widest">
                  TOTAL SAVED ฿{result.totalContributed.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fan Chart View */}
        {result && (
          <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  เส้นพัดจำลองผลลัพธ์ (Fan Chart)
                </h3>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                  P10 / P50 / P90 PROJECTIONS
                </p>
              </div>
              <button
                onClick={handleExplainAI}
                disabled={aiLoading}
                className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs py-2 px-4 rounded-lg font-bold flex items-center gap-2 transition-colors"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI กำลังวิเคราะห์ผล...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI วิเคราะห์ผล</span>
                  </>
                )}
              </button>
            </div>

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.steps} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d4d4d8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#d4d4d8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="year" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(y) => `YR ${y}`} dy={10} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`} dx={-10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11, color: '#fff' }}
                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                    formatter={(val: any, name: any) => [`฿${Number(val).toLocaleString()}`, name]}
                    labelFormatter={(y) => `YEAR ${y}`}
                  />
                  <Area type="monotone" dataKey="p90" stroke="#34d399" strokeWidth={1} fillOpacity={1} fill="url(#p90Grad)" name="P90 (BEST)" />
                  <Area type="monotone" dataKey="p50" stroke="#d4d4d8" strokeWidth={2} fillOpacity={1} fill="url(#p50Grad)" name="P50 (MEDIAN)" />
                  <Area type="monotone" dataKey="p10" stroke="#fb7185" strokeWidth={1} fillOpacity={0} name="P10 (WORST)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* AI Explanation Box */}
        {aiExplanation && (
          <div className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/10 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>AI ADVISOR SUMMARY</span>
              </div>
              {modelUsed && (
                <span className="text-[9px] px-2 py-0.5 rounded-sm bg-white/5 text-zinc-500 font-mono uppercase tracking-widest">
                  {modelUsed}
                </span>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-[#050505] border border-white/5 text-xs text-zinc-300 leading-relaxed space-y-2 whitespace-pre-line font-mono">
              {aiExplanation}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
