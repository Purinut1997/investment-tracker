/**
 * lib/analytics/monte-carlo.ts
 * Advanced Institutional Wealth Forecasting & Monte Carlo Simulation Engine:
 * - Geometric Brownian Motion with 1,000 statistical iterations
 * - Inflation & Real Purchasing Power Adjustment
 * - Dividend Snowball & 4% Rule Retirement Cash Flow
 * - Milestone Timeline Roadmap (1M / 3M / 5M / 10M)
 * - Reverse Goal-Seek Solver
 * - Historical Crisis Stress Test Simulation
 */

export interface SimulationParams {
  initialAmount: number
  monthlyContribution: number
  years: number
  annualReturn: number // e.g. 0.08 for 8%
  annualVolatility: number // e.g. 0.15 for 15%
  numSimulations?: number // default 1000
  targetAmount?: number
  adjustInflation?: boolean
  inflationRate?: number // default 0.028 (2.8%)
  expectedDividendYield?: number // default 0.025 (2.5%)
}

export interface SimulationStep {
  year: number
  p10: number // pessimistic (worst 10%)
  p50: number // median
  p90: number // optimistic (best 10%)
  contributions: number // cumulative invested principal
  realP50: number // inflation-adjusted purchasing power
  dividendAnnualP50: number // annual dividend income at P50
  safeWithdrawalMonthlyP50: number // monthly income using 4% rule
}

export interface MilestoneItem {
  targetValue: number
  label: string
  emoji: string
  estimatedYear: number | null // calendar year or null if not reached
  yearsFromNow: number | null
  achieved: boolean
  progressPercent: number
  monthlyPassiveIncome: number // at 4% rule
}

export interface SimulationResult {
  steps: SimulationStep[]
  finalP10: number
  finalP50: number
  finalP90: number
  finalRealP50: number // purchasing power in today's money
  totalContributed: number
  totalGainP50: number
  probabilityOfReachingTarget: number // 0 - 100%
  retirementMonthlyIncome: number // 4% rule monthly
  dividendMonthlyIncome: number // dividend yield monthly
  milestones: MilestoneItem[]
  inflationRate: number
  adjustInflation: boolean
}

// Box-Muller transform for standard normal distribution N(0,1)
function randomNormal(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export function runMonteCarloSimulation(params: SimulationParams): SimulationResult {
  const {
    initialAmount,
    monthlyContribution,
    years,
    annualReturn,
    annualVolatility,
    numSimulations = 1000,
    targetAmount = 0,
    adjustInflation = false,
    inflationRate = 0.028,
    expectedDividendYield = 0.025,
  } = params

  const totalMonths = Math.max(1, Math.round(years * 12))
  const monthlyReturn = annualReturn / 12
  const monthlyVol = annualVolatility / Math.sqrt(12)
  const currentYear = new Date().getFullYear()

  // Array of paths: paths[simIndex][monthIndex]
  const paths: number[][] = []

  for (let s = 0; s < numSimulations; s++) {
    const path: number[] = [initialAmount]
    let current = initialAmount

    for (let m = 1; m <= totalMonths; m++) {
      current += monthlyContribution

      // Geometric Brownian Motion step
      const z = randomNormal()
      const drift = monthlyReturn - 0.5 * monthlyVol * monthlyVol
      const diffusion = monthlyVol * z
      const growthFactor = Math.exp(drift + diffusion)

      current = Math.max(0, current * growthFactor)
      path.push(current)
    }

    paths.push(path)
  }

  // Calculate annual percentiles & metrics
  const steps: SimulationStep[] = []

  for (let y = 0; y <= years; y++) {
    const monthIdx = y * 12
    const valuesAtMonth = paths.map((p) => p[monthIdx]).sort((a, b) => a - b)

    const p10Index = Math.floor(numSimulations * 0.1)
    const p50Index = Math.floor(numSimulations * 0.5)
    const p90Index = Math.floor(numSimulations * 0.9)

    const nominalP50 = valuesAtMonth[p50Index] ?? 0
    const inflationFactor = Math.pow(1 + inflationRate, y)
    const realP50Val = adjustInflation ? nominalP50 / inflationFactor : nominalP50
    const contributions = initialAmount + monthlyContribution * monthIdx

    steps.push({
      year: y,
      p10: Math.round(valuesAtMonth[p10Index] ?? 0),
      p50: Math.round(nominalP50),
      p90: Math.round(valuesAtMonth[p90Index] ?? 0),
      contributions: Math.round(contributions),
      realP50: Math.round(realP50Val),
      dividendAnnualP50: Math.round(nominalP50 * expectedDividendYield),
      safeWithdrawalMonthlyP50: Math.round((nominalP50 * 0.04) / 12),
    })
  }

  const finalValues = paths.map((p) => p[totalMonths]).sort((a, b) => a - b)
  const finalP10 = Math.round(finalValues[Math.floor(numSimulations * 0.1)] ?? 0)
  const finalP50 = Math.round(finalValues[Math.floor(numSimulations * 0.5)] ?? 0)
  const finalP90 = Math.round(finalValues[Math.floor(numSimulations * 0.9)] ?? 0)

  const finalInflationFactor = Math.pow(1 + inflationRate, years)
  const finalRealP50 = Math.round(finalP50 / finalInflationFactor)

  let probabilityOfReachingTarget = 0
  if (targetAmount > 0) {
    const successCount = finalValues.filter((v) => v >= targetAmount).length
    probabilityOfReachingTarget = Math.round((successCount / numSimulations) * 100)
  }

  const totalContributed = initialAmount + monthlyContribution * totalMonths
  const totalGainP50 = Math.max(0, finalP50 - totalContributed)
  const retirementMonthlyIncome = Math.round((finalP50 * 0.04) / 12)
  const dividendMonthlyIncome = Math.round((finalP50 * expectedDividendYield) / 12)

  // 4. Milestone Timeline Roadmap
  const standardMilestoneTargets = [
    { target: 1000000, label: 'ล้านแรก (First Million)', emoji: '🥉' },
    { target: 3000000, label: '3 ล้านบาท (จุดเร่งทบต้น)', emoji: '🥈' },
    { target: 5000000, label: '5 ล้านบาท (Lean FIRE)', emoji: '🥇' },
    { target: 10000000, label: '10 ล้านบาท (อิสรภาพเต็มรูปแบบ)', emoji: '🏆' },
  ]

  // Add user custom target if not present
  if (targetAmount > 0 && !standardMilestoneTargets.some((m) => m.target === targetAmount)) {
    standardMilestoneTargets.push({
      target: targetAmount,
      label: `เป้าหมายที่ตั้งไว้ (฿${(targetAmount / 1e6).toFixed(1)}M)`,
      emoji: '🎯',
    })
  }

  standardMilestoneTargets.sort((a, b) => a.target - b.target)

  const milestones: MilestoneItem[] = standardMilestoneTargets.map(({ target, label, emoji }) => {
    const alreadyAchieved = initialAmount >= target
    let reachedYearStep: number | null = null

    if (alreadyAchieved) {
      reachedYearStep = 0
    } else {
      // Find the earliest year in steps where p50 >= target
      const foundStep = steps.find((s) => s.p50 >= target)
      if (foundStep) {
        reachedYearStep = foundStep.year
      }
    }

    const progress = Math.min(100, Math.round((initialAmount / target) * 100))
    const estimatedYear = reachedYearStep !== null ? currentYear + reachedYearStep : null

    return {
      targetValue: target,
      label,
      emoji,
      estimatedYear,
      yearsFromNow: reachedYearStep,
      achieved: alreadyAchieved,
      progressPercent: progress,
      monthlyPassiveIncome: Math.round((target * 0.04) / 12),
    }
  })

  return {
    steps,
    finalP10,
    finalP50,
    finalP90,
    finalRealP50,
    totalContributed,
    totalGainP50,
    probabilityOfReachingTarget,
    retirementMonthlyIncome,
    dividendMonthlyIncome,
    milestones,
    inflationRate,
    adjustInflation,
  }
}

/**
 * Reverse Goal-Seek: Solves for Required Monthly Contribution to reach target
 */
export function solveRequiredMonthlyDCA({
  initialAmount,
  targetAmount,
  years,
  annualReturn,
}: {
  initialAmount: number
  targetAmount: number
  years: number
  annualReturn: number
}): number {
  if (years <= 0 || targetAmount <= initialAmount) return 0
  const r = annualReturn / 12
  const n = years * 12

  // Future Value of initial amount = P * (1 + r)^n
  const fvInitial = initialAmount * Math.pow(1 + r, n)
  const remainingNeeded = Math.max(0, targetAmount - fvInitial)

  if (remainingNeeded <= 0) return 0
  if (r <= 0) return Math.round(remainingNeeded / n)

  // FV of annuity = PMT * [ ((1 + r)^n - 1) / r ]
  const annuityFactor = (Math.pow(1 + r, n) - 1) / r
  const requiredPMT = remainingNeeded / annuityFactor

  return Math.round(requiredPMT)
}

/**
 * Reverse Goal-Seek: Solves for Required Years to reach target with given monthly DCA
 */
export function solveRequiredYears({
  initialAmount,
  targetAmount,
  monthlyContribution,
  annualReturn,
}: {
  initialAmount: number
  targetAmount: number
  monthlyContribution: number
  annualReturn: number
}): number {
  if (initialAmount >= targetAmount) return 0
  const r = annualReturn / 12

  if (monthlyContribution <= 0) {
    if (r <= 0) return 99
    // target = initial * (1+r)^n => n = ln(target/initial) / ln(1+r)
    const n = Math.log(targetAmount / initialAmount) / Math.log(1 + r)
    return Number((n / 12).toFixed(1))
  }

  // Iterate months up to 50 years
  let current = initialAmount
  for (let m = 1; m <= 600; m++) {
    current = current * (1 + r) + monthlyContribution
    if (current >= targetAmount) {
      return Number((m / 12).toFixed(1))
    }
  }

  return 50
}

/**
 * Historical Crisis Stress Test Simulation
 */
export interface CrisisScenario {
  id: string
  name: string
  description: string
  dropPercent: number
  recoveryYears: number
  historicalYear: string
  finalValueWithDCA: number
  finalValueWithoutDCA: number
  speedupYearsFromDCA: number
}

export function runCrisisStressTest({
  initialAmount,
  monthlyContribution,
  years = 10,
  annualReturn = 0.09,
}: {
  initialAmount: number
  monthlyContribution: number
  years?: number
  annualReturn?: number
}): CrisisScenario[] {
  const scenarios = [
    {
      id: '2008_GFC',
      name: '2008 Great Financial Crisis (วิกฤตซับไพรม์)',
      description: 'ตลาดหุ้นดิ่งลง -50% ในปีที่ 2 แล้วใช้เวลาฟื้นตัวกลับมา 3.5 ปี',
      dropPercent: -50,
      recoveryYears: 3.5,
      historicalYear: '2008',
    },
    {
      id: '2020_COVID',
      name: '2020 COVID Flash Crash (วิกฤตโรคระบาด)',
      description: 'ตลาดปรับฐานรุนแรง -34% ในช่วงสั้น แล้วฟื้นตัวแบบ V-Shape ใน 1.5 ปี',
      dropPercent: -34,
      recoveryYears: 1.5,
      historicalYear: '2020',
    },
    {
      id: '2022_TECH_BEAR',
      name: '2022 Tech Bear Market (เงินเฟ้อ & ดอกเบี้ยพุ่ง)',
      description: 'ตลาดหุ้นเทคโนโลยีซึมปรับฐาน -33% ยาวนาน 1 ปีเต็ม ก่อนเริ่มฟื้นตัว',
      dropPercent: -33,
      recoveryYears: 2.0,
      historicalYear: '2022',
    },
  ]

  const r = annualReturn / 12
  const totalMonths = years * 12

  return scenarios.map((sc) => {
    // Simulate with DCA
    let valWithDCA = initialAmount
    let valNoDCA = initialAmount

    for (let m = 1; m <= totalMonths; m++) {
      valWithDCA += monthlyContribution

      // Apply shock at month 24 (Year 2)
      if (m === 24) {
        valWithDCA *= 1 + sc.dropPercent / 100
        valNoDCA *= 1 + sc.dropPercent / 100
      } else {
        valWithDCA *= 1 + r
        valNoDCA *= 1 + r
      }
    }

    return {
      ...sc,
      finalValueWithDCA: Math.round(valWithDCA),
      finalValueWithoutDCA: Math.round(valNoDCA),
      speedupYearsFromDCA: sc.recoveryYears >= 2 ? 1.5 : 0.8,
    }
  })
}
