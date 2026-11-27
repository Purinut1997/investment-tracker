/**
 * lib/analytics/quant-metrics.ts
 * Pure TypeScript quantitative portfolio metrics:
 * - Money-Weighted Annualized Return (XIRR)
 * - Max Drawdown, Annualized Volatility, Sharpe Ratio, and PME Excess Alpha
 */

export interface PerformancePoint {
  month: string
  value: number
  benchmark: number | null
}

export interface PortfolioQuantMetrics {
  xirrPercent: number
  maxDrawdownPercent: number
  annualizedVolatilityPercent: number
  sharpeRatio: number
  pmeExcessPercent: number
  monthsMeasured: number
}

/**
 * Calculates Money-Weighted Annualized Return (XIRR) using Newton-Raphson with bisection fallback.
 * Cash flows: negative for outflows (investments/buys), positive for inflows (sells/dividends/ending value).
 */
export function calculatePortfolioXIRR(
  cashFlows: Array<{ amount: number; date: Date }>
): number {
  if (!cashFlows || cashFlows.length < 2) return 0

  const valid = cashFlows
    .filter((cf) => Number.isFinite(cf.amount) && cf.amount !== 0 && !isNaN(cf.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (valid.length < 2) return 0
  const hasPos = valid.some((c) => c.amount > 0)
  const hasNeg = valid.some((c) => c.amount < 0)
  if (!hasPos || !hasNeg) return 0

  const t0 = valid[0].date.getTime()
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000
  const points = valid.map((cf) => ({
    amount: cf.amount,
    years: (cf.date.getTime() - t0) / MS_PER_YEAR,
  }))

  const npv = (rate: number) => {
    const base = 1 + rate
    if (base <= 0) return Number.POSITIVE_INFINITY
    let sum = 0
    for (const p of points) {
      sum += p.amount / Math.pow(base, p.years)
    }
    return sum
  }

  const dnpv = (rate: number) => {
    const base = 1 + rate
    if (base <= 0) return 0
    let sum = 0
    for (const p of points) {
      if (p.years !== 0) {
        sum -= (p.years * p.amount) / Math.pow(base, p.years + 1)
      }
    }
    return sum
  }

  let rate = 0.1
  for (let i = 0; i < 50; i++) {
    const f = npv(rate)
    if (Math.abs(f) < 1e-6) {
      return Number((rate * 100).toFixed(2))
    }
    const df = dnpv(rate)
    if (!Number.isFinite(df) || Math.abs(df) < 1e-10) break
    const nextRate = rate - f / df
    if (!Number.isFinite(nextRate) || nextRate <= -0.95 || nextRate > 10) break
    if (Math.abs(nextRate - rate) < 1e-7) {
      return Number((nextRate * 100).toFixed(2))
    }
    rate = nextRate
  }

  // Bisection fallback over [-0.95, 5.0]
  let low = -0.95
  let high = 5.0
  let fLow = npv(low)
  const fHigh = npv(high)
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) {
    return 0
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-5 || high - low < 1e-6) {
      return Number((mid * 100).toFixed(2))
    }
    if (fLow * fMid <= 0) {
      high = mid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return Number((((low + high) / 2) * 100).toFixed(2))
}

/**
 * Computes institutional risk & benchmark metrics from monthly valuation points & optional cash flows.
 */
export function calculatePortfolioRiskMetrics(
  points: PerformancePoint[],
  options?: { baseCurrency?: string; cashFlows?: Array<{ amount: number; date: Date }> }
): PortfolioQuantMetrics {
  const cashFlows = options?.cashFlows
  const xirrPercent =
    cashFlows && cashFlows.length >= 2 ? calculatePortfolioXIRR(cashFlows) : 0

  if (!points || points.length === 0) {
    return {
      xirrPercent,
      maxDrawdownPercent: 0,
      annualizedVolatilityPercent: 0,
      sharpeRatio: 0,
      pmeExcessPercent: 0,
      monthsMeasured: 0,
    }
  }

  // 1. Maximum Drawdown across portfolio curve
  let runningPeak = 0
  let maxDrawdownPercent = 0
  for (const p of points) {
    if (p.value > runningPeak) {
      runningPeak = p.value
    }
    if (runningPeak > 0) {
      const dd = ((p.value - runningPeak) / runningPeak) * 100
      if (dd < maxDrawdownPercent) {
        maxDrawdownPercent = dd
      }
    }
  }

  // 2. Monthly returns (filtering artificial cash-inflow jumps so initial deposits don't inflate vol)
  const monthlyReturns: number[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].value
    const curr = points[i].value
    if (prev > 0 && curr > 0) {
      const r = (curr - prev) / prev
      if (r > -0.95 && r < 1.5) {
        monthlyReturns.push(r)
      }
    }
  }

  let annualizedVolatilityPercent = 0
  let sharpeRatio = 0

  if (monthlyReturns.length >= 2) {
    const mean = monthlyReturns.reduce((s, r) => s + r, 0) / monthlyReturns.length
    const variance =
      monthlyReturns.reduce((s, r) => s + (r - mean) * (r - mean), 0) /
      (monthlyReturns.length - 1)
    annualizedVolatilityPercent = Number((Math.sqrt(variance) * Math.sqrt(12) * 100).toFixed(2))

    const rfPercent = options?.baseCurrency?.toUpperCase() === 'USD' ? 4.2 : 2.5
    const annualizedReturnPercent =
      cashFlows && cashFlows.length >= 2 && Number.isFinite(xirrPercent)
        ? xirrPercent
        : mean * 12 * 100

    if (annualizedVolatilityPercent > 0.5) {
      sharpeRatio = Number(
        ((annualizedReturnPercent - rfPercent) / annualizedVolatilityPercent).toFixed(2)
      )
    }
  }

  // 3. S&P 500 Public Market Equivalent (PME) Excess Alpha %
  const lastPoint = points[points.length - 1]
  const pmeExcessPercent =
    lastPoint && lastPoint.benchmark != null && lastPoint.benchmark > 0
      ? Number((((lastPoint.value - lastPoint.benchmark) / lastPoint.benchmark) * 100).toFixed(2))
      : 0

  return {
    xirrPercent,
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    annualizedVolatilityPercent,
    sharpeRatio,
    pmeExcessPercent,
    monthsMeasured: points.length,
  }
}
