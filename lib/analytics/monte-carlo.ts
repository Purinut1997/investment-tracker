/**
 * lib/analytics/monte-carlo.ts
 * Monte Carlo portfolio simulation engine using Geometric Brownian Motion.
 */

export interface SimulationParams {
  initialAmount: number
  monthlyContribution: number
  years: number
  annualReturn: number // e.g. 0.08 for 8%
  annualVolatility: number // e.g. 0.15 for 15%
  numSimulations?: number // default 500
  targetAmount?: number
}

export interface SimulationStep {
  year: number
  p10: number // pessimistic (worst 10%)
  p50: number // median
  p90: number // optimistic (best 10%)
}

export interface SimulationResult {
  steps: SimulationStep[]
  finalP10: number
  finalP50: number
  finalP90: number
  probabilityOfReachingTarget?: number // 0 - 100%
  totalContributed: number
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
    numSimulations = 500,
    targetAmount = 0,
  } = params

  const totalMonths = Math.max(1, Math.round(years * 12))
  const monthlyReturn = annualReturn / 12
  const monthlyVol = annualVolatility / Math.sqrt(12)

  // Array of paths: paths[simIndex][monthIndex]
  const paths: number[][] = []

  for (let s = 0; s < numSimulations; s++) {
    const path: number[] = [initialAmount]
    let current = initialAmount

    for (let m = 1; m <= totalMonths; m++) {
      // Add monthly DCA contribution
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

  // Calculate annual percentiles
  const steps: SimulationStep[] = []

  for (let y = 0; y <= years; y++) {
    const monthIdx = y * 12
    const valuesAtMonth = paths.map((p) => p[monthIdx]).sort((a, b) => a - b)

    const p10Index = Math.floor(numSimulations * 0.1)
    const p50Index = Math.floor(numSimulations * 0.5)
    const p90Index = Math.floor(numSimulations * 0.9)

    steps.push({
      year: y,
      p10: Math.round(valuesAtMonth[p10Index] ?? 0),
      p50: Math.round(valuesAtMonth[p50Index] ?? 0),
      p90: Math.round(valuesAtMonth[p90Index] ?? 0),
    })
  }

  const finalValues = paths.map((p) => p[totalMonths]).sort((a, b) => a - b)
  const finalP10 = Math.round(finalValues[Math.floor(numSimulations * 0.1)] ?? 0)
  const finalP50 = Math.round(finalValues[Math.floor(numSimulations * 0.5)] ?? 0)
  const finalP90 = Math.round(finalValues[Math.floor(numSimulations * 0.9)] ?? 0)

  let probabilityOfReachingTarget: number | undefined = undefined
  if (targetAmount > 0) {
    const successCount = finalValues.filter((v) => v >= targetAmount).length
    probabilityOfReachingTarget = Math.round((successCount / numSimulations) * 100)
  }

  const totalContributed = initialAmount + monthlyContribution * totalMonths

  return {
    steps,
    finalP10,
    finalP50,
    finalP90,
    probabilityOfReachingTarget,
    totalContributed,
  }
}
