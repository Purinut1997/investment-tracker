'use client'

import React, { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { StrategicRoadmapDisplay } from '@/components/forecast/StrategicRoadmapDisplay'
import {
  runMonteCarloSimulation,
  solveRequiredMonthlyDCA,
  solveRequiredYears,
  runCrisisStressTest,
  SimulationResult,
  MilestoneItem,
  CrisisScenario,
} from '@/lib/analytics/monte-carlo'
import {
  Target,
  Sparkles,
  Loader2,
  TrendingUp,
  Play,
  RotateCcw,
  Clock,
  Coins,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Zap,
  DollarSign,
  Compass,
  CheckCircle2,
  Calendar,
  Flame,
  Award,
  Wallet,
  Activity,
  Calculator,
} from 'lucide-react'
import CountUp from 'react-countup'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

export default function ForecastPage() {
  const { data: summary } = useSWR('/api/portfolio/summary')
  const { data: plansData } = useSWR('/api/plans')

  // Core Simulation Inputs
  const [initialAmount, setInitialAmount] = useState<number>(350000)
  const [monthlyContribution, setMonthlyContribution] = useState<number>(20000)
  const [years, setYears] = useState<number>(10)
  const [annualReturn, setAnnualReturn] = useState<number>(9.5) // 9.5%
  const [annualVolatility, setAnnualVolatility] = useState<number>(14.0) // 14%
  const [targetAmount, setTargetAmount] = useState<number>(5000000)

  // Advanced Practical Toggles
  const [adjustInflation, setAdjustInflation] = useState<boolean>(true)
  const [inflationRate, setInflationRate] = useState<number>(2.8) // 2.8% per year
  const [expectedDividendYield, setExpectedDividendYield] = useState<number>(2.5) // 2.5%

  // Simulation State
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string>('')

  // Reverse Goal-Seek State
  const [goalSeekTarget, setGoalSeekTarget] = useState<number>(10000000)
  const [goalSeekYears, setGoalSeekYears] = useState<number>(10)
  const [activeTab, setActiveTab] = useState<'forecast' | 'goalSeek' | 'stressTest'>('forecast')

  // Load persistent latest AI explanation from database
  const { data: aiForecastData, mutate: mutateAiForecast } = useSWR(
    '/api/ai-advisor/explain-forecast',
    { revalidateOnFocus: false }
  )

  const currentExplanation = aiExplanation || aiForecastData?.explanation
  const currentModel = modelUsed || aiForecastData?.modelUsed
  const currentUpdatedAt = aiForecastData?.updatedAt

  // Auto-seed initial amount from live portfolio if available
  useEffect(() => {
    if (summary?.totalValue && summary.totalValue > 0) {
      setInitialAmount(Math.round(summary.totalValue))
    }
  }, [summary?.totalValue])

  // Auto-seed target and monthly contribution from default active preset if available
  useEffect(() => {
    if (plansData?.presets && plansData.presets.length > 0) {
      const def = plansData.presets.find((p: any) => p.isDefault) || plansData.presets[0]
      if (def?.monthlyContribution && Number(def.monthlyContribution) > 0) {
        setMonthlyContribution(Number(def.monthlyContribution))
      }
      if (def?.targetAmount && Number(def.targetAmount) > 0) {
        setTargetAmount(Number(def.targetAmount))
        setGoalSeekTarget(Number(def.targetAmount))
      }
    }
  }, [plansData])

  function handleRunSimulation() {
    const sim = runMonteCarloSimulation({
      initialAmount,
      monthlyContribution,
      years,
      annualReturn: annualReturn / 100,
      annualVolatility: annualVolatility / 100,
      targetAmount,
      numSimulations: 1000,
      adjustInflation,
      inflationRate: inflationRate / 100,
      expectedDividendYield: expectedDividendYield / 100,
    })
    setResult(sim)
  }

  useEffect(() => {
    handleRunSimulation()
  }, [adjustInflation, inflationRate, expectedDividendYield])

  // Sync from Real Portfolio & Active Plan
  function handleSyncFromPortfolio() {
    if (summary?.totalValue && summary.totalValue > 0) {
      setInitialAmount(Math.round(summary.totalValue))
    }
    if (plansData?.presets && plansData.presets.length > 0) {
      const def = plansData.presets.find((p: any) => p.isDefault) || plansData.presets[0]
      if (def?.monthlyContribution) setMonthlyContribution(Number(def.monthlyContribution))
      if (def?.targetAmount) setTargetAmount(Number(def.targetAmount))
      if (def?.riskProfile === 'conservative') {
        setAnnualReturn(7.0)
        setAnnualVolatility(10.0)
      } else if (def?.riskProfile === 'aggressive') {
        setAnnualReturn(12.0)
        setAnnualVolatility(18.0)
      } else {
        setAnnualReturn(9.5)
        setAnnualVolatility(14.0)
      }
    }
    handleRunSimulation()
  }

  // Reverse Goal-Seek Computations
  const requiredMonthlyDCA = useMemo(() => {
    return solveRequiredMonthlyDCA({
      initialAmount,
      targetAmount: goalSeekTarget,
      years: goalSeekYears,
      annualReturn: annualReturn / 100,
    })
  }, [initialAmount, goalSeekTarget, goalSeekYears, annualReturn])

  const requiredYearsWithCurrentDCA = useMemo(() => {
    return solveRequiredYears({
      initialAmount,
      targetAmount: goalSeekTarget,
      monthlyContribution,
      annualReturn: annualReturn / 100,
    })
  }, [initialAmount, goalSeekTarget, monthlyContribution, annualReturn])

  // Crisis Scenarios Computations
  const crisisScenarios: CrisisScenario[] = useMemo(() => {
    return runCrisisStressTest({
      initialAmount,
      monthlyContribution,
      years,
      annualReturn: annualReturn / 100,
    })
  }, [initialAmount, monthlyContribution, years, annualReturn])

  async function handleExplainAI() {
    if (!result) return
    setAiLoading(true)
    try {
      const milestonesSummary = result.milestones
        .map(
          (m) =>
            `${m.label}: ${m.achieved ? 'สำเร็จแล้ว' : m.estimatedYear ? `ปี ${m.estimatedYear}` : 'ยังไม่ถึง'}`
        )
        .join(', ')

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
          adjustInflation,
          finalRealP50: result.finalRealP50,
          retirementMonthlyIncome: result.retirementMonthlyIncome,
          dividendMonthlyIncome: result.dividendMonthlyIncome,
          milestonesSummary,
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

  const inputClass =
    'w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono'
  const labelClass = 'block text-xs font-semibold text-slate-300 mb-1.5'

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-16">
        {/* Header */}
        <PageHeader
          eyebrow="Monte Carlo Wealth Horizon"
          title="แบบจำลองพยากรณ์พอร์ตการลงทุน & เกษียณอายุ"
          description="จำลองความน่าจะเป็น 1,000 สถานการณ์ล่วงหน้าด้วยหลักสถิติ Geometric Brownian Motion ผสานการหักเงินเฟ้อจริง (Real Purchasing Power) และคำนวณเงินเดือนเกษียณตามกฎ 4% Rule"
          action={
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSyncFromPortfolio}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="ดึงมูลค่าพอร์ตปัจจุบันและสัดส่วนเป้าหมายจากแผน"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>ดึงค่าจริงจากพอร์ต</span>
              </button>
              <button
                type="button"
                onClick={handleRunSimulation}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>ประมวลผลจำลองพอร์ต</span>
              </button>
            </div>
          }
        />

        {/* ── TOP KPI SUMMARY CARDS ───────────────────────────── */}
        {result && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            {/* 1. Probability of Target Success */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    โอกาสพิชิตเป้าหมาย
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Success Probability</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                    result.probabilityOfReachingTarget >= 75
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : result.probabilityOfReachingTarget >= 50
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      result.probabilityOfReachingTarget >= 75
                        ? 'bg-emerald-500'
                        : result.probabilityOfReachingTarget >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  {result.probabilityOfReachingTarget >= 75
                    ? 'ความเป็นไปได้สูงมาก'
                    : result.probabilityOfReachingTarget >= 50
                    ? 'อยู่ในเกณฑ์เป็นไปได้'
                    : 'ต้องเร่งออมเพิ่ม'}
                </span>
              </div>

              <div className="my-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight font-mono">
                    {result.probabilityOfReachingTarget}%
                  </span>
                  <span className="text-xs text-slate-500 font-mono">โอกาสสำเร็จ</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  เป้าหมาย ฿{targetAmount.toLocaleString()} ใน {years} ปี
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>เงินต้นรวม DCA:</span>
                <span className="font-semibold text-white font-mono">
                  ฿{result.totalContributed.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 2. Expected Wealth (P50 Median) */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    มูลค่ามัธยฐานคาดการณ์ (P50)
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Median Expected Wealth</p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>

              <div className="my-4">
                <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight leading-none font-mono">
                  ฿<CountUp end={result.finalP50} decimals={0} separator="," duration={1.2} />
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  กำไรจากการทบต้น: <span className="text-emerald-400 font-semibold font-mono">+฿{result.totalGainP50.toLocaleString()}</span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>อำนาจซื้อจริง (หักเงินเฟ้อ):</span>
                <span className="font-semibold text-indigo-300 font-mono">
                  ฿{result.finalRealP50.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 3. Retirement Monthly Income (4% Rule) */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    เงินเดือนเกษียณ (4% Rule)
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Safe Monthly Withdrawal</p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </span>
              </div>

              <div className="my-4">
                <p className="text-3xl sm:text-4xl font-bold text-emerald-400 tabular-nums tracking-tight leading-none font-mono">
                  ฿<CountUp end={result.retirementMonthlyIncome} decimals={0} separator="," duration={1.2} />
                  <span className="text-xs font-normal text-slate-400 font-sans ml-1">/เดือน</span>
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  ถอนใช้ได้เดือนละ ฿{result.retirementMonthlyIncome.toLocaleString()} โดยเงินต้นไม่หมด
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>กระแสปันผลรับแท้จริง:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  ~฿{result.dividendMonthlyIncome.toLocaleString()}/เดือน
                </span>
              </div>
            </div>

            {/* 4. Best vs Worst Case Spread */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    กรอบผลลัพธ์ P10 - P90
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Market Outcome Range</p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </span>
              </div>

              <div className="my-4 space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">P90 (ตลาดกระทิง):</span>
                  <span className="font-bold text-emerald-300 font-mono">
                    ฿{result.finalP90.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">P10 (ตลาดซบเซา):</span>
                  <span className="font-bold text-rose-300 font-mono">
                    ฿{result.finalP10.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>ความผันผวนต่อปี:</span>
                <span className="font-mono text-slate-300">{annualVolatility}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── SIMULATION CONTROLS & PRACTICAL TOGGLES ────────────────── */}
        <div className="p-6 rounded-3xl bg-[#12151C] border border-white/[0.08] shadow-xl shadow-black/40 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                พารามิเตอร์การจำลองพอร์ต (Simulation Controls)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ปรับแต่งตัวแปรการลงทุนเพื่อสะท้อนแผนชีวิตและประเมินผลกระทบของเงินเฟ้อ
              </p>
            </div>

            {/* Quick Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('forecast')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'forecast'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📈 เส้นพัดจำลอง (Fan Chart)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('goalSeek')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'goalSeek'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔍 คำนวณย้อนกลับ (Goal-Seek)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stressTest')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'stressTest'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🛡️ ทดสอบวิกฤต (Stress Test)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div>
              <label className={labelClass}>เงินต้นเริ่มต้น (฿)</label>
              <input
                type="number"
                step="10000"
                className={inputClass}
                value={initialAmount}
                onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>ออมต่อเดือน DCA (฿)</label>
              <input
                type="number"
                step="1000"
                className={inputClass}
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>ระยะเวลา (ปี)</label>
              <input
                type="number"
                min="1"
                max="40"
                className={inputClass}
                value={years}
                onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className={labelClass}>ผลตอบแทน (%/ปี)</label>
              <input
                type="number"
                min="1"
                max="35"
                step="0.5"
                className={inputClass}
                value={annualReturn}
                onChange={(e) => setAnnualReturn(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>ความผันผวน (%/ปี)</label>
              <input
                type="number"
                min="1"
                max="50"
                step="0.5"
                className={inputClass}
                value={annualVolatility}
                onChange={(e) => setAnnualVolatility(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>เป้าหมายพอร์ต (฿)</label>
              <input
                type="number"
                step="500000"
                className={`${inputClass} font-bold text-indigo-300`}
                value={targetAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setTargetAmount(val)
                  setGoalSeekTarget(val)
                }}
              />
            </div>
          </div>

          {/* Quick DCA Chips & Practical Toggles */}
          <div className="pt-3 border-t border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400">ปุ่มลัด DCA:</span>
              {[5000, 10000, 20000, 35000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setMonthlyContribution(amt)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    monthlyContribution === amt
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  }`}
                >
                  +฿{amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Inflation and Dividend DRIP Toggles */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={adjustInflation}
                  onChange={(e) => setAdjustInflation(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
                />
                <span>หักเงินเฟ้อจริง ({inflationRate}% ต่อปี)</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>ปันผลคาดหวัง:</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  className="w-14 bg-[#181C25] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white font-mono text-right outline-none"
                  value={expectedDividendYield}
                  onChange={(e) => setExpectedDividendYield(parseFloat(e.target.value) || 0)}
                />
                <span>%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TAB 1: FAN CHART PROJECTION VIEW ─────────────────────────── */}
        {activeTab === 'forecast' && result && (
          <div className="p-6 sm:p-7 rounded-3xl bg-[#12151C] border border-white/[0.08] space-y-6 shadow-xl shadow-black/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>เส้นพัดจำลองผลลัพธ์ (Fan Chart Projection)</span>
                  {adjustInflation && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                      สะท้อนเงินเฟ้อ Real Purchasing Power
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ช่วงการกระจายตัวของมูลค่าพอร์ต P10 (แย่) / P50 (มัธยฐาน) / P90 (ดีเยี่ยม) ตลอด {years} ปี
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExplainAI}
                  disabled={aiLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs py-2 px-4 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer self-start sm:self-auto active:scale-95"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>AI กำลังวิเคราะห์ผล...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{currentExplanation ? 'ขอคำแนะนำ AI ใหม่' : 'วิเคราะห์พอร์ตด้วย AI'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Recharts Fan Chart */}
            <div className="h-[360px] sm:h-[420px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={result.steps}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    {/* Optimistic P90 Gradient */}
                    <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    {/* Median P50 Gradient */}
                    <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#222736" vertical={false} />

                  <XAxis
                    dataKey="year"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `ปีที่ ${v}`}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (val >= 1e6) return `฿${(val / 1e6).toFixed(1)}M`
                      if (val >= 1e3) return `฿${(val / 1e3).toFixed(0)}k`
                      return `฿${val}`
                    }}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#181C25] border border-white/[0.1] rounded-2xl p-4 shadow-2xl text-xs space-y-2 min-w-[220px]">
                          <div className="font-bold text-white border-b border-white/[0.08] pb-1.5 flex items-center justify-between">
                            <span>ปีที่ {d.year} (พ.ศ. {new Date().getFullYear() + 543 + d.year})</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              เงินต้น ฿{d.contributions.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1 font-mono">
                            <div className="flex items-center justify-between text-emerald-400">
                              <span>P90 (ตลาดดี):</span>
                              <span className="font-bold">฿{d.p90.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-indigo-300">
                              <span>P50 (มัธยฐาน):</span>
                              <span className="font-bold">฿{d.p50.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-rose-400">
                              <span>P10 (ตลาดซบเซา):</span>
                              <span className="font-bold">฿{d.p10.toLocaleString()}</span>
                            </div>
                            {adjustInflation && (
                              <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-white/[0.06]">
                                <span>อำนาจซื้อจริง (Real):</span>
                                <span className="font-bold">฿{d.realP50.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-cyan-300 pt-1 border-t border-white/[0.06]">
                              <span>เงินเดือนเกษียณ (4%):</span>
                              <span className="font-bold">฿{d.safeWithdrawalMonthlyP50.toLocaleString()}/ด</span>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />

                  {targetAmount > 0 && (
                    <ReferenceLine
                      y={targetAmount}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `เป้าหมาย ฿${(targetAmount / 1e6).toFixed(1)}M`,
                        fill: '#fbbf24',
                        fontSize: 11,
                        position: 'top',
                      }}
                    />
                  )}

                  {/* Areas */}
                  <Area
                    type="monotone"
                    dataKey="p90"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#p90Grad)"
                    name="P90 (ตลาดดีเยี่ยม)"
                  />
                  <Area
                    type="monotone"
                    dataKey="p50"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#p50Grad)"
                    name="P50 (มัธยฐานหลัก)"
                  />
                  <Area
                    type="monotone"
                    dataKey="p10"
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    fill="transparent"
                    name="P10 (ตลาดแย่)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ─── MILESTONE ROADMAP TIMELINE ─────────────────────────── */}
            <div className="pt-4 border-t border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    เส้นทางพิชิตหลักไมล์ความมั่งคั่ง (Milestone Roadmap Timeline)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    คาดการณ์ปีที่พอร์ตจะเติบโตแตะหลักไมล์สำคัญ พร้อมประมาณการเงินเดือนใช้ชีวิตยามเกษียณ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {result.milestones.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      m.achieved
                        ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                        : m.estimatedYear
                        ? 'bg-white/[0.02] border-white/[0.08] hover:border-indigo-500/30'
                        : 'bg-white/[0.01] border-white/[0.04] opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{m.emoji}</span>
                        <div>
                          <span className="text-xs font-bold text-white block">{m.label}</span>
                          <span className="text-sm font-bold text-indigo-300 font-mono">
                            ฿{m.targetValue >= 1e6 ? `${(m.targetValue / 1e6).toFixed(1)} ล้านบาท` : m.targetValue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {m.achieved ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                          สำเร็จแล้ว ✅
                        </span>
                      ) : m.estimatedYear ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 font-mono">
                          ปี {m.estimatedYear}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 shrink-0">
                          {`> ${years} ปี`}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.04] space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>ความคืบหน้า:</span>
                        <span className="font-mono font-semibold text-white">{m.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            m.achieved ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, m.progressPercent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>เงินเดือนถอนใช้ (4%):</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          ฿{m.monthlyPassiveIncome.toLocaleString()}/ด
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: REVERSE GOAL-SEEK CALCULATOR ────────────────────────── */}
        {activeTab === 'goalSeek' && (
          <div className="p-6 sm:p-7 rounded-3xl bg-[#12151C] border border-amber-500/30 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Reverse Goal-Seek Engine (เครื่องยนต์คำนวณเป้าหมายย้อนกลับ)
                </h3>
                <p className="text-xs text-slate-400">
                  ตั้งเป้าหมายในฝัน แล้วให้ระบบคำนวณเม็ดเงิน DCA ที่ต้องออมต่อเดือน หรือจำนวนปีที่ต้องใช้
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Question 1: How much to save per month? */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <span>🎯 โจทย์ที่ 1: อยากมีเงินก้อน ต้องออมเดือนละเท่าไหร่?</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>เป้าหมายเงินก้อน (฿)</label>
                    <input
                      type="number"
                      step="500000"
                      className={inputClass}
                      value={goalSeekTarget}
                      onChange={(e) => setGoalSeekTarget(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ภายในกี่ปี (ปี)</label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      className={inputClass}
                      value={goalSeekYears}
                      onChange={(e) => setGoalSeekYears(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                  <span className="text-xs text-slate-300 block">คุณต้องเติมเงินออม DCA เดือนละ:</span>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-300">
                    ฿{requiredMonthlyDCA.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 font-sans ml-1">/เดือน</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block pt-1">
                    (อิงเงินต้น ฿{initialAmount.toLocaleString()} และผลตอบแทน {annualReturn}% ต่อปี)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMonthlyContribution(requiredMonthlyDCA)
                    setTargetAmount(goalSeekTarget)
                    setYears(goalSeekYears)
                    setActiveTab('forecast')
                    handleRunSimulation()
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  นำตัวเลขนี้ไปใช้จำลองพอร์ตทันที ➔
                </button>
              </div>

              {/* Question 2: How many years with current contribution? */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <span>⏱️ โจทย์ที่ 2: ถ้าออมได้เดือนละเท่านี้ จะถึงเป้าในกี่ปี?</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>เงินออมที่มีไหว (฿/เดือน)</label>
                    <input
                      type="number"
                      step="1000"
                      className={inputClass}
                      value={monthlyContribution}
                      onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>เป้าหมายเงินก้อน (฿)</label>
                    <input
                      type="number"
                      step="500000"
                      className={inputClass}
                      value={goalSeekTarget}
                      onChange={(e) => setGoalSeekTarget(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-1">
                  <span className="text-xs text-slate-300 block">คุณจะบรรลุเป้าหมายในอีกประมาณ:</span>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-indigo-300">
                    {requiredYearsWithCurrentDCA} ปี
                    <span className="text-xs font-normal text-slate-400 font-sans ml-1">
                      (ราวปี พ.ศ. {new Date().getFullYear() + 543 + Math.round(requiredYearsWithCurrentDCA)})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block pt-1">
                    (อิงเงินต้น ฿{initialAmount.toLocaleString()} และผลตอบแทน {annualReturn}% ต่อปี)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setYears(Math.max(1, Math.round(requiredYearsWithCurrentDCA)))
                    setTargetAmount(goalSeekTarget)
                    setActiveTab('forecast')
                    handleRunSimulation()
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  ตั้งเวลาจำลองพอร์ตตามนี้ ➔
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: CRISIS STRESS TEST VIEW ─────────────────────────────── */}
        {activeTab === 'stressTest' && (
          <div className="p-6 sm:p-7 rounded-3xl bg-[#12151C] border border-rose-500/30 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
              <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Historical Crisis Stress Test (ทดสอบพอร์ตลุยวิกฤตจริงในอดีต)
                </h3>
                <p className="text-xs text-slate-400">
                  จำลองผลกระทบหากพอร์ตเกิดเผชิญวิกฤตหนักกลางทาง และพลังของวินัย DCA ในการซื้อของถูกเพื่อเร่งฟื้นตัว
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {crisisScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                        {sc.dropPercent}% Crash
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5">{sc.name}</h4>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{sc.description}</p>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04] space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">มูลค่าจบ (ทำ DCA สม่ำเสมอ):</span>
                      <span className="text-emerald-400 font-bold">
                        ฿{sc.finalValueWithDCA.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">มูลค่าจบ (ถ้าหยุดเติมเงิน):</span>
                      <span className="text-slate-400">
                        ฿{sc.finalValueWithoutDCA.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>DCA ต่อเนื่องช่วยให้พอร์ตฟื้นตัวเร็วขึ้น {sc.speedupYearsFromDCA} ปี</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── GEMINI AI STRATEGIC WEALTH ROADMAP CARD ───────────────────── */}
        <div className="rounded-3xl glass-panel p-6 sm:p-7 border border-indigo-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08] relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Gemini AI Strategic Wealth Roadmap
                  {currentModel && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-normal">
                      {currentModel}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  สังเคราะห์และตีความผลจำลองพอร์ตอย่างลึกซึ้ง โดยคำนึงถึงเงินเฟ้อ วินัย DCA และเงินเดือนเกษียณจริง
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {currentUpdatedAt && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.06] font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  อัปเดตล่าสุด:{' '}
                  {new Date(currentUpdatedAt).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  น.
                </span>
              )}
              <button
                type="button"
                onClick={handleExplainAI}
                disabled={aiLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'กำลังประมวลผล AI...' : currentExplanation ? 'วิเคราะห์ใหม่ด้วย AI' : 'วิเคราะห์พอร์ตด้วย AI'}</span>
              </button>
            </div>
          </div>

          {currentExplanation ? (
            <div className="mt-5 relative z-10">
              <StrategicRoadmapDisplay
                explanation={currentExplanation}
                modelUsed={currentModel}
                updatedAt={currentUpdatedAt}
                probabilityOfSuccess={result?.probabilityOfReachingTarget}
                p50Value={result?.finalP50}
                realP50Value={result?.finalRealP50}
                monthlyRetirementIncome={result?.retirementMonthlyIncome}
              />
            </div>
          ) : (
            <div className="mt-6 py-6 text-center space-y-3 relative z-10">
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                คลิกปุ่ม <strong>&quot;วิเคราะห์พอร์ตด้วย AI&quot;</strong> ด้านบน เพื่อให้ Gemini ประมวลผลและสร้างพิมพ์เขียวกลยุทธ์พิชิตเป้าหมายทางการเงินของคุณฉบับภาษาไทยแบบมืออาชีพ
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
