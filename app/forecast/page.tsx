'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { runMonteCarloSimulation, SimulationResult } from '@/lib/analytics/monte-carlo'
import {
  TrendingUp,
  Sparkles,
  Play,
  RotateCcw,
  Target,
  ShieldAlert,
  Loader2,
  HelpCircle,
  CheckCircle2,
  Calendar
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
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

  // Set default initial amount from current portfolio value once loaded
  useEffect(() => {
    if (summary?.totalValue && summary.totalValue > 0) {
      setInitialAmount(Math.round(summary.totalValue))
    }
  }, [summary?.totalValue])

  // Run simulation on button or parameter change
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
    setAiExplanation(null) // reset previous AI explanation
  }

  useEffect(() => {
    handleRunSimulation()
  }, [initialAmount, monthlyContribution, years, annualReturn, annualVolatility, targetAmount])

  // Request AI Explanation
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
      alert(err.message || 'ไม่สามารถขอคำอธิบายจาก AI ได้')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <TrendingUp className="w-7 h-7 text-[var(--cyan-400)]" />
              <span>แบบจำลองความน่าจะเป็นพอร์ต (Monte Carlo Forecast)</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              จำลอง 500 สถานการณ์ตลาดล่วงหน้า ด้วย Geometric Brownian Motion เพื่อหาค่า P10, P50, P90
            </p>
          </div>
        </div>

        {/* Input Parameters Controls */}
        <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] space-y-5">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            กำหนดตัวแปรการจำลอง (Simulation Parameters)
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="label">เงินต้นเริ่มต้น (฿)</label>
              <input
                type="number"
                step="10000"
                className="input text-xs sm:text-sm font-semibold rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={initialAmount}
                onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="label">เงินออมต่อเดือน (฿)</label>
              <input
                type="number"
                step="1000"
                className="input text-xs sm:text-sm font-semibold rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="label">ระยะเวลา (ปี)</label>
              <input
                type="number"
                min="1"
                max="30"
                className="input text-xs sm:text-sm font-semibold rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={years}
                onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="label">ผลตอบแทนคาดหวัง (%)</label>
              <input
                type="number"
                min="1"
                max="30"
                step="0.5"
                className="input text-xs sm:text-sm font-semibold rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={annualReturn}
                onChange={(e) => setAnnualReturn(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="label">ความผันผวน Volatility (%)</label>
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                className="input text-xs sm:text-sm font-semibold rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={annualVolatility}
                onChange={(e) => setAnnualVolatility(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <label className="label">เป้าหมายที่ต้องการ (฿)</label>
              <input
                type="number"
                step="500000"
                className="input text-xs sm:text-sm font-bold text-[var(--violet)] rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={targetAmount}
                onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Results Metrics */}
        {result && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Target Probability */}
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-violet-500/30 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[var(--violet)]" />
                โอกาสถึงเป้าหมาย
              </span>
              <div className="mt-1 text-2xl sm:text-3xl font-black text-[var(--violet)] tabular-nums">
                {result.probabilityOfReachingTarget ?? 0}%
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                เป้าหมาย ฿{targetAmount.toLocaleString()}
              </p>
            </div>

            {/* P10 Pessimistic */}
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
                กรณีตลาดแย่ (P10)
              </span>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-rose-300 tabular-nums">
                ฿{result.finalP10.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                มีโอกาส 90% ที่จะได้สูงกว่านี้
              </p>
            </div>

            {/* P50 Median */}
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                กรณีตลาดกลาง (P50 มัธยฐาน)
              </span>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-amber-300 tabular-nums">
                ฿{result.finalP50.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                ค่ากึ่งกลางที่น่าจะเกิดขึ้นมากที่สุด
              </p>
            </div>

            {/* P90 Optimistic */}
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                กรณีตลาดดีเยี่ยม (P90)
              </span>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-emerald-300 tabular-nums">
                ฿{result.finalP90.toLocaleString()}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                เงินออมสะสมรวม ฿{result.totalContributed.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Fan Chart View */}
        {result && (
          <div className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  เส้นพัดจำลองผลลัพธ์ (Fan Chart P10 / P50 / P90)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  แกนนอนแสดงจำนวนปี แกนตั้งแสดงมูลค่าพอร์ตการลงทุน (บาท)
                </p>
              </div>

              <button
                onClick={handleExplainAI}
                disabled={aiLoading}
                className="btn btn-primary text-xs py-2.5 px-5 flex items-center gap-2 self-start sm:self-auto rounded-xl shadow-[0_0_20px_rgba(167,139,250,0.25)]"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังวิเคราะห์ผล...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>อธิบายผลลัพธ์นี้ด้วย AI</span>
                  </>
                )}
              </button>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.steps} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="year" stroke="#6b7280" tickFormatter={(y) => `ปีที่ ${y}`} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d0a2e',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: 16,
                      fontSize: 12,
                      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                    }}
                    formatter={(val: any, name: any) => [`฿${Number(val).toLocaleString()}`, name]}
                    labelFormatter={(y) => `เมื่อครบปีที่ ${y}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="p90"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#p90Grad)"
                    name="P90 (กรณีดีเยี่ยม)"
                  />
                  <Area
                    type="monotone"
                    dataKey="p50"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#p50Grad)"
                    name="P50 (กรณีมัธยฐาน)"
                  />
                  <Area
                    type="monotone"
                    dataKey="p10"
                    stroke="#f87171"
                    strokeWidth={1.5}
                    fillOpacity={0}
                    name="P10 (กรณีแย่)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* AI Explanation Box */}
        {aiExplanation && (
          <div className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-violet-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.36)] space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-white font-bold text-base">
                <Sparkles className="w-5 h-5 text-[var(--violet)]" />
                <span>คำอธิบายผลลัพธ์จาก AI Advisor</span>
              </div>
              {modelUsed && (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/20 text-[var(--violet)] border border-violet-500/30 font-mono">
                  Model: {modelUsed}
                </span>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2 whitespace-pre-line font-sans">
              {aiExplanation}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
