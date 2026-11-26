import { identifyCopilotPlanIntent as intent } from './advisor-copilot'
import { dailyPriority } from './daily-priority'
import assert from 'node:assert/strict'
import {
  extractTacticalContinuity,
  extractRegimeAlphaContinuity,
  extractMarkdownHeadline,
  formatUnifiedContextPrompt,
  buildUnifiedDecisionRules,
  type UnifiedAiContext,
} from './unified-context'
import {
  buildCopilotQuickQuestions,
  buildTacticalQuickQuestions,
  buildCopilotDeepLink,
} from './quick-questions'

console.log('🧪 Starting Unified AI Context & Quick Questions Tests...\n')

// 1. extractTacticalContinuity (valid JSON + malformed fallback)
const validTactical = JSON.stringify({
  asOfDate: '2026-11-26',
  marketRegime: {
    statusLabelTh: 'ตลาดผันผวนระวังตัว',
    riskLevel: 4,
    pillars: {
      formula: { postureLabelTh: '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)' },
    },
  },
  cashStrategy: { recommendedCashPercent: 25 },
  portfolioResilience: { thematicRiskAlert: 'กลุ่ม Tech/AI เกิน 50% ของพอร์ต' },
  tacticalActions: [
    { ticker: 'voo', action: 'ACCUMULATE', actionLabel: 'สะสมไม้แรก' },
    { ticker: 'nvda', action: 'HOLD_WATCH', actionLabel: 'ถือจับตา' },
  ],
})
const extracted = extractTacticalContinuity(validTactical, new Date('2026-11-26T01:00:00Z'))
assert.ok(extracted, 'extractTacticalContinuity should parse valid JSON')
assert.equal(extracted.date, '2026-11-26')
assert.equal(extracted.riskLevel, 4)
assert.equal(extracted.recommendedCashPercent, 25)
assert.equal(extracted.topActions[0].ticker, 'VOO')
assert.equal(extracted.topActions[1].action, 'HOLD_WATCH')
assert.equal(extractTacticalContinuity('not valid json', new Date()), null)
console.log('✅ Test 1 Passed: extractTacticalContinuity handles valid and malformed payloads')

// 2. extractMarkdownHeadline
const md = `
### 🎯 สรุปยุทธศาสตร์พอร์ต
- **พอร์ตกระจุกตัวใน Tech 55%** ควรแบ่งกำไรไปเสริม **XAU** และ **SCB.BK**
- รอบนี้ไม่มีแหล่งอ้างอิงจากการค้นเว็บ
`
const headline = extractMarkdownHeadline(md, 60)
assert.ok(!headline.includes('###') && !headline.includes('**'), 'Markdown symbols should be stripped')
assert.ok(headline.length <= 60 && headline.endsWith('…'), 'Long headline should truncate cleanly')
assert.equal(extractMarkdownHeadline('รอบนี้ไม่มีแหล่งอ้างอิงจากการค้นเว็บ'), '')
console.log('✅ Test 2 Passed: extractMarkdownHeadline strips markdown and truncates cleanly')

// 3. formatUnifiedContextPrompt (excludeSurface, focusSymbol held vs unheld, compactness)
const regimeAlpha = extractRegimeAlphaContinuity(
  JSON.stringify({
    regimeHeadline: 'หุ้นเทคถูกกดดันจาก Yield สูง หมุนเข้าทองคำและปันผล',
    picks: [
      { ticker: 'GLD', roleLabelTh: 'กันกระแทกพอร์ต' },
      { ticker: 'SCHD', roleLabelTh: 'ปันผลรอจังหวะ' },
    ],
  }),
  new Date('2026-11-26T04:00:00Z')
)
assert.ok(regimeAlpha && regimeAlpha.topPicks[0].ticker === 'GLD')
assert.equal(extractRegimeAlphaContinuity('invalid', new Date()), null)

const mockCtx: UnifiedAiContext = {
  userId: 'user-1',
  baseCurrency: 'THB',
  assembledAt: '2026-11-26T04:00:00Z',
  memory: {
    riskTolerance: 'moderate',
    horizonYears: 10,
    maxSinglePositionPercent: 20,
    maxDrawdownTolerancePercent: 20,
    preferredStyle: 'Core-Satellite Growth + Gold',
    personalRules: 'ห้ามไล่ราคาเมื่อ RSI เกิน 70',
  },
  activePreset: {
    presetName: 'เกษียณ 20M',
    targetAmount: 20_000_000,
    monthlyContribution: 30_000,
    riskProfile: 'moderate',
  },
  portfolio: {
    investedValue: 1_000_000,
    totalCash: 250_000,
    totalWealth: 1_250_000,
    cashPercent: 20,
    unrealizedPnLPercent: 14.5,
    holdingsCount: 3,
    topHoldings: [
      {
        ticker: 'VOO',
        market: 'US',
        assetType: 'stock',
        currency: 'USD',
        quantity: 25,
        avgCost: 450,
        currentPrice: 510,
        allocationPercent: 45,
        unrealizedPnLPercent: 13.3,
      },
      {
        ticker: 'XAU',
        market: 'GLOBAL',
        assetType: 'gold',
        currency: 'USD',
        quantity: 2.5,
        avgCost: 2400,
        currentPrice: 2650,
        allocationPercent: 22,
        unrealizedPnLPercent: 10.4,
      },
      {
        ticker: 'SCB.BK',
        market: 'TH',
        assetType: 'stock',
        currency: 'THB',
        quantity: 2000,
        avgCost: 102,
        currentPrice: 112,
        allocationPercent: 18,
        unrealizedPnLPercent: 9.8,
      },
    ],
    holdingsByTicker: {
      VOO: {
        ticker: 'VOO',
        market: 'US',
        assetType: 'stock',
        currency: 'USD',
        quantity: 25,
        avgCost: 450,
        currentPrice: 510,
        allocationPercent: 45,
        unrealizedPnLPercent: 13.3,
      },
      XAU: {
        ticker: 'XAU',
        market: 'GLOBAL',
        assetType: 'gold',
        currency: 'USD',
        quantity: 2.5,
        avgCost: 2400,
        currentPrice: 2650,
        allocationPercent: 22,
        unrealizedPnLPercent: 10.4,
      },
    },
    assetMix: { usPercent: 60, thPercent: 18, goldPercent: 22, cryptoPercent: 0, otherPercent: 0 },
  },
  riskSnapshot: {
    overallRiskLevel: 'ELEVATED',
    overallRiskScore: 68,
    overweightSectors: ['US Index 45.0%'],
    topWarnings: ['VOO ครองสัดส่วน 45% เกินเกณฑ์ 25%'],
  },
  continuity: {
    tactical: extracted,
    radar: { date: '2026-11-26', summary: 'ลดน้ำหนักหุ้นเดี่ยวที่เกิน 25% แล้วเสริมสินทรัพย์ปันผล' },
    regimeAlpha,
    dailyBrief: { date: '2026-11-26', summary: 'จับตาแนวรับ VOO และกันเงินสด 25%' },
    copilot: { date: '2026-11-26', lastQuestion: 'ซื้อทองเพิ่มดีไหม', lastAnswerSummary: 'รอจังหวะย่อ' },
    unacknowledgedAlert: null,
  },
}

const promptFromRadar = formatUnifiedContextPrompt(mockCtx, {
  excludeSurface: 'radar',
  focusSymbol: 'XAU',
})
assert.match(promptFromRadar, /Tactical Market Climate/)
assert.match(promptFromRadar, /Regime Alpha Opportunities/)
assert.doesNotMatch(promptFromRadar, /Risk Sentinel Briefing/)
assert.match(promptFromRadar, /สถานะ XAU ในพอร์ตของคุณ: ถืออยู่/)
assert.match(promptFromRadar, /เกิน\/ชนเพดาน 20%/)

const promptUnheld = formatUnifiedContextPrompt(mockCtx, {
  excludeSurface: 'stock_insight',
  focusSymbol: 'SCHD',
  compact: true,
})
assert.match(promptUnheld, /SCHD ในพอร์ตของคุณ: ยังไม่ได้ถือครอง/)
assert.doesNotMatch(promptUnheld, /Daily Morning Brief/)
assert.ok(promptUnheld.length < 2500)
assert.match(buildUnifiedDecisionRules('copilot'), /\/tactical-advisor/)
console.log('✅ Test 3 Passed: formatUnifiedContextPrompt & decision rules align surfaces accurately')

// 4. buildCopilotQuickQuestions uses real portfolio tickers & avoids hardcoded stocks
const dynamicQs = buildCopilotQuickQuestions({
  holdings: [
    { ticker: 'XAU', assetType: 'gold', allocationPercent: 40, unrealizedPnLPercent: 18 },
    { ticker: 'SCB.BK', market: 'TH', allocationPercent: 35, unrealizedPnLPercent: 5 },
    { ticker: 'VOO', market: 'US', allocationPercent: 25, unrealizedPnLPercent: 12 },
  ],
  tacticalActions: [
    { ticker: 'VOO', action: 'ACCUMULATE' },
    { ticker: 'XAU', action: 'TRIM_PROFIT' },
  ],
  cashPercent: 20,
  recommendedCashPercent: 25,
  riskLevel: 4,
  maxSinglePositionPercent: 20,
  hasThematicAlert: true,
})
assert.equal(dynamicQs.length, 6)
const joinedQs = dynamicQs.map((q) => q.prompt).join(' ')
assert.doesNotMatch(joinedQs, /Google|Nvidia/i)
assert.match(joinedQs, /XAU/)
assert.match(joinedQs, /SCB\.BK/)
assert.match(joinedQs, /VOO/)
assert.match(joinedQs, /20\.0% เทียบเป้า 25%/)

const emptyQs = buildCopilotQuickQuestions()
assert.equal(emptyQs.length, 6)
const tacticalPills = buildTacticalQuickQuestions({
  marketRegime: { riskLevel: 4 },
  tacticalActions: [{ ticker: 'VOO', action: 'ACCUMULATE' }],
  cashStrategy: { currentCashPercent: 15, recommendedCashPercent: 25 },
})
assert.equal(tacticalPills.length, 4)
assert.match(tacticalPills[1], /VOO/)
assert.equal(buildCopilotDeepLink(' สวัสดี '), '/ai-advisor?q=%E0%B8%AA%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B5')
console.log('✅ Test 4 Passed: Dynamic Quick Questions & Deep Links adapt to real holdings')

console.log('\n🎉 ALL UNIFIED AI CONTEXT & QUICK QUESTION TESTS PASSED!')

// Input and brief formats emitted by both advisor flows.
const scenario = { kind: 'scenario', field: 'inflow', extra: false, amount: 10000, currency: 'THB', reserve: 3000 }
assert.deepEqual(intent('เติมเงิน 10,000 บาท และขอกันเงินสดไว้ 3,000 บาท'), scenario)
assert.deepEqual(intent('ถ้ากันเงินสด ๓,๐๐๐ บาท และอยากลงทุนหนึ่งหมื่นบาท'), scenario)
assert.deepEqual(intent('เติมเงิน 100 บาท และกันเงินสด 40 USD'), { kind: 'clarify' })
assert.equal(intent('ซื้อหุ้น A ที่ 100 บาทดีไหม'), null)
assert.equal(intent('เดือนหน้าผมจะเติมอีกหนึ่งหมื่นบาท ช่วยเทียบกับแผนเดิมให้หน่อย')?.kind, 'scenario')
assert.deepEqual(dailyPriority('1. **ภาพรวมตลาด**\n- ตลาดทรงตัว\n2. **ภาพรวมพอร์ต**\n- ถือเงินสด\n3. **สิ่งที่ต้องตรวจ**\n- ตรวจเวลาราคา'), { context: 'ตลาดทรงตัว', action: 'ตรวจเวลาราคา' })
assert.equal(dailyPriority('3. 📋 **แผนปฏิบัติการ 3 ข้อวันนี้**: รอราคาปิด').action, 'รอราคาปิด')
assert.equal(dailyPriority('ภาพรวมอย่างเดียว').action, undefined)
