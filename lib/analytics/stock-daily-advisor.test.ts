/**
 * lib/analytics/stock-daily-advisor.test.ts
 * Pure TypeScript unit tests for:
 * 1. High-risk NVDA-like scenario (4-dim scorecard, breakeven %, distance to S1)
 * 2. Low-risk / unheld stock scenario
 * 3. Interactive DCA simulator (existing loss position + first-entry position + risk-cap warning)
 * 4. 30d annualized volatility calculation & edge guard
 * 5. AI report JSON parser (valid JSON, fenced JSON, malformed, non-Thai rejection)
 * 6. Asia/Bangkok date key formatting
 */

import assert from 'assert'
import {
  computeAnnualizedVolatility30d,
  computeStockRiskAssessment,
  getBangkokDateKey,
  parseDailyStockAiReport,
  simulateDcaPosition,
} from './stock-daily-advisor'

console.log('🧪 Starting Stock Daily Risk & DCA Simulator Unit Tests...\n')

// ── Test 1: High-Risk NVDA-like Scenario ──────────────────────────────────────────────────
{
  const closes = Array.from({ length: 35 }, (_, i) =>
    i % 2 === 0 ? 150 - i * 0.6 : 142 - i * 0.5
  )
  closes[closes.length - 1] = 125.53

  const res = computeStockRiskAssessment({
    currentPrice: 125.53,
    todayChangePercent: -14.01,
    pullbackFrom52wHigh: -48.4,
    dailyCloses: closes,
    rsi: 29.4,
    ema200: 158.0,
    trendVsEma200: 'bearish',
    s1: 118.0,
    s2: 110.0,
    r1: 138.0,
    r2: 148.0,
    pivot: 128.0,
    pe: 48,
    forwardPe: 32,
    debtToEquity: 0.4,
    freeCashflow: 50_000_000_000,
    daysToEarnings: -4,
    vixPrice: 24.5,
    fearGreedScore: 22,
    newsSentiments: ['negative', 'negative', 'neutral'],
    position: {
      shares: 4.141299,
      avgCost: 167.68,
      unrealizedGainPercent: -25.14,
      portfolioWeightPct: 26,
      maxSinglePositionPct: 20,
      stopLossPct: 15,
    },
  })

  assert.ok(res.overallScore >= 75, `Expected high overall risk >=75, got ${res.overallScore}`)
  assert.strictEqual(res.overallLevel, 'high')
  assert.strictEqual(res.dimensions.length, 4)
  assert.ok(
    res.priceZones.breakevenGainPct !== null &&
      Math.abs(res.priceZones.breakevenGainPct - 33.58) < 0.05,
    `Expected breakeven ~+33.58%, got ${res.priceZones.breakevenGainPct}%`
  )
  assert.ok(
    res.priceZones.distToS1Pct !== null && res.priceZones.distToS1Pct < 0,
    'S1 below currentPrice should have negative distToS1Pct'
  )

  console.log('✅ Test 1 Passed: High-risk NVDA-like scenario scorecard & breakeven accurate')
}

// ── Test 2: Low-Risk Unheld Stock Scenario ────────────────────────────────────────────────
{
  const calmCloses = Array.from({ length: 35 }, (_, i) => 100 + i * 0.25)
  const res = computeStockRiskAssessment({
    currentPrice: 108.5,
    todayChangePercent: 0.6,
    pullbackFrom52wHigh: -3.2,
    dailyCloses: calmCloses,
    rsi: 54,
    ema200: 96,
    trendVsEma200: 'bullish',
    s1: 105,
    s2: 102,
    r1: 112,
    r2: 115,
    pivot: 108,
    pe: 14,
    forwardPe: 12.5,
    debtToEquity: 0.35,
    freeCashflow: 10_000_000,
    daysToEarnings: 42,
    vixPrice: 13.8,
    fearGreedScore: 52,
    newsSentiments: ['positive', 'positive'],
    position: null,
  })

  assert.ok(res.overallScore < 40, `Expected low overall risk <40, got ${res.overallScore}`)
  const portDim = res.dimensions.find((d) => d.key === 'portfolio')!
  assert.strictEqual(portDim.score, 30)
  assert.ok(portDim.drivers[0].includes('ยังไม่ได้ถือครอง'))

  console.log('✅ Test 2 Passed: Low-risk unheld stock scenario scored accurately')
}

// ── Test 3: Interactive DCA Simulator Math ────────────────────────────────────────────────
{
  // NVDA example: holding 4.141299 shares @ $167.68, current $125.53, add $200 @ $125.53
  const sim = simulateDcaPosition({
    currentShares: 4.141299,
    currentAvgCost: 167.68,
    currentPrice: 125.53,
    addedAmount: 200,
    entryPrice: 125.53,
    totalPortfolioValueNative: 2000,
    maxSinglePositionPct: 20,
  })

  assert.ok(Math.abs(sim.addedShares - 200 / 125.53) < 0.0001)
  assert.ok(sim.newAvgCost < 167.68 && sim.avgCostReductionPct < 0)
  assert.ok(
    sim.currentBreakevenPct !== null &&
      sim.newBreakevenPct !== null &&
      sim.newBreakevenPct < sim.currentBreakevenPct,
    'DCA below avg cost must reduce breakeven percentage'
  )
  // Current pos = 519.86; +$200 -> 719.86 / 2200 = 32.72% > 20% cap
  assert.ok(sim.newPortfolioWeightPct !== null && sim.newPortfolioWeightPct > 30)
  assert.strictEqual(sim.exceedsRiskCap, true)

  // First entry (0 current shares)
  const firstEntry = simulateDcaPosition({
    currentShares: 0,
    currentAvgCost: 0,
    currentPrice: 100,
    addedAmount: 500,
    entryPrice: 95,
    totalPortfolioValueNative: 5000,
    maxSinglePositionPct: 20,
  })
  assert.strictEqual(firstEntry.newAvgCost, 95)
  assert.strictEqual(firstEntry.exceedsRiskCap, false)

  console.log('✅ Test 3 Passed: DCA Simulator cost reduction, breakeven, and risk-cap math accurate')
}

// ── Test 4: 30-Day Annualized Volatility ──────────────────────────────────────────────────
{
  assert.strictEqual(computeAnnualizedVolatility30d([100, 102, 101]), null, 'Short series must return null')
  const volatileCloses = Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 100 : 103))
  const vol = computeAnnualizedVolatility30d(volatileCloses)
  assert.ok(vol !== null && vol > 30, `Expected high annualized vol > 30%, got ${vol}`)

  console.log('✅ Test 4 Passed: computeAnnualizedVolatility30d accuracy & guard')
}

// ── Test 5: AI Report JSON Parser ─────────────────────────────────────────────────────────
{
  const validPayload = {
    verdict: 'WAIT_AT_SUPPORT',
    verdictLabelTh: 'รอรับแนวรับ',
    confidence: 'HIGH',
    executiveSummary: 'ราคาย่อตัวแรงหลังประกาศงบ แนะนำรอตั้งรับใกล้แนวรับ S1',
    historicalContext: 'ย่อจากจุดสูงสุด 52 สัปดาห์ -48.4%',
    liveMarketContext: 'RSI เข้าโซน Oversold แต่ความผันผวนสูง',
    forwardOutlook: 'เป้านักวิเคราะห์ยังมี Upside เมื่อเทียบ Forward P/E',
    riskAnalysis: {
      technical: 'หลุด EMA200 ระยะสั้น',
      fundamental: 'งบเพิ่งออก ตลาดปรับประมาณการ',
      portfolio: 'ติดลบ -25.14% เกินเกณฑ์เฝ้าระวัง',
      sentiment: 'VIX สูงและมีข่าวลบระยะสั้น',
    },
    scenarios: {
      bull: 'กลับมายืนเหนือ R1 ได้',
      base: 'แกว่งสร้างฐานระหว่าง S1-R1',
      bear: 'หลุด S1 ลงทดสอบ S2',
    },
    actionPlan: {
      entryPlan: 'รอแท่งกลับตัวแถว S1',
      exitOrTrimPlan: 'รอรีบาวด์ทดสอบแนวต้าน',
      riskControlPlan: 'คุมน้ำหนักไม่เกิน 20%',
    },
    dailyChecklist: ['เช็กพื้นฐานหลังงบ', 'ไม่เข้าเต็มไม้ทีเดียว'],
  }

  const parsedFenced = parseDailyStockAiReport('```json\n' + JSON.stringify(validPayload) + '\n```')
  assert.ok(parsedFenced !== null)
  assert.strictEqual(parsedFenced!.verdict, 'WAIT_AT_SUPPORT')
  assert.strictEqual(parsedFenced!.dailyChecklist.length, 2)

  // English-only response rejected
  const englishOnly = parseDailyStockAiReport(
    JSON.stringify({ ...validPayload, executiveSummary: 'Stock dropped sharply today.' })
  )
  assert.strictEqual(englishOnly, null, 'Non-Thai executiveSummary should be rejected')

  assert.strictEqual(parseDailyStockAiReport('not json'), null)

  console.log('✅ Test 5 Passed: parseDailyStockAiReport handles fenced JSON & enforces Thai')
}

// ── Test 6: Bangkok Date Key ──────────────────────────────────────────────────────────────
{
  // 2026-11-21T18:00:00Z is 2026-11-22 01:00 Asia/Bangkok
  const dt = new Date('2026-11-21T18:00:00Z')
  assert.strictEqual(getBangkokDateKey(dt), '2026-11-22')

  console.log('✅ Test 6 Passed: getBangkokDateKey converts UTC to Asia/Bangkok date cleanly')
}

console.log('\n🎉 ALL STOCK DAILY RISK & DCA SIMULATOR UNIT TESTS PASSED!')
