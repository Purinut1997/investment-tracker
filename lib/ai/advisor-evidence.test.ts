import assert from 'node:assert/strict'
import { getQuestionSymbols, prioritizeAdvisorTargets, formatMarketObservation } from './advisor-evidence'
import { foreignIncomeAssessment, taxReportContextTag } from '../analytics/foreign-income-tax'

const holdings = Array.from({ length: 16 }, (_, index) => ({ ticker: `TEST${index + 1}`, market: 'US' }))
assert.deepEqual(
  getQuestionSymbols('เทียบ test16 กับ $NVDA และ SET:PTT กับ CPALL.BK ใช้ RSI และ SMA50', holdings),
  ['TEST16', 'NVDA', 'PTT.BK', 'CPALL.BK'],
)
assert.deepEqual(getQuestionSymbols('How does it compare to TSLA?', holdings, 'วิเคราะห์ NVDA'), ['TSLA', 'NVDA'])
assert.deepEqual(getQuestionSymbols('เทียบ P/E, RSI, DCA และ USD', holdings), [])
assert.deepEqual(getQuestionSymbols('วิเคราะห์หุ้น nvda เทียบกับหุ้น tsla', holdings), ['NVDA', 'TSLA'])
assert.deepEqual(getQuestionSymbols('เทียบ NYSE:SCB กับ SET:SCB', holdings), ['US:SCB', 'SCB.BK'])
assert.deepEqual(
  prioritizeAdvisorTargets([{ ticker: 'TEST16', market: 'US' }, { ticker: 'NVDA', market: 'US' }], holdings, 15)
    .map(({ ticker }) => ticker),
  ['TEST16', 'NVDA', ...holdings.slice(0, 13).map(({ ticker }) => ticker)],
)
assert.equal(prioritizeAdvisorTargets([{ ticker: 'PTT.BK', market: 'TH' }], [{ ticker: 'PTT', market: 'TH' }], 15).length, 1)

const now = Date.parse('2026-11-25T12:00:00Z')
const quote = { price: 19.3, timestamp: now - 60_000, provider: 'Yahoo Finance' }
assert.match(formatMarketObservation('VIX', quote, now), /19\.3.*Yahoo Finance.*2026-11-25/)
assert.doesNotMatch(formatMarketObservation('VIX', { ...quote, timestamp: now - 5 * 86400000 }, now), /19\.3/)
assert.match(formatMarketObservation('VIX', null, now), /ไม่มีข้อมูล/)
assert.match(formatMarketObservation('VIX', { ...quote, price: 0 }, now), /ไม่มีข้อมูล/)

assert.equal(foreignIncomeAssessment(false).status, 'not_remitted')
assert.equal(foreignIncomeAssessment(true).status, 'review_required')
assert.notEqual(taxReportContextTag(2026, false), taxReportContextTag(2026, true))
assert.notEqual(taxReportContextTag(2025, false), taxReportContextTag(2026, false))
console.log('✅ Advisor evidence, question-directed retrieval and foreign-income context checks passed')
