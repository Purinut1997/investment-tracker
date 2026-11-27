import { isProviderQuotaError } from './gemini-errors'
import { copilotQuotaSummary } from './copilot-quota-summary'
import assert from 'node:assert/strict'
import { parseModelJson, remainingModelBudget, forecastInputSchema, forecastContextKey, planAdviceContextKey, planAdviceInput } from './model-contracts'
import { normalizeExtraction, type ExtractionAccount } from './transaction-extraction'

assert.deepEqual(parseModelJson(' ```json\n{"answer":"ทดสอบ"}\n``` '), { answer: 'ทดสอบ' })
assert.throws(() => parseModelJson('prose {"answer":"also JSON"}'))
assert.equal(remainingModelBudget(1_000, 25_000, 16_000), 10_000)
assert.equal(remainingModelBudget(1_000, 25_000, 26_000), 0)

const simulation = {
  initialAmount: 0, monthlyContribution: 1000, years: 5, targetAmount: 100_000,
  finalP10: 50_000, finalP50: 60_000, finalP90: 80_000, probabilityOfReachingTarget: 0,
}
assert.ok(forecastInputSchema.safeParse(simulation).success)
assert.ok(!forecastInputSchema.safeParse({ ...simulation, finalP10: 100_000 }).success)
assert.ok(!forecastInputSchema.safeParse({ ...simulation, probabilityOfReachingTarget: 120 }).success)
assert.notEqual(forecastContextKey(simulation), forecastContextKey({ ...simulation, finalP50: 61_000 }))
const plan = { monthlyContribution: 0, targetAllocation: { CORE: 60, CASH: 40 }, subAllocations: { CORE: { VOO: 50, QQQ: 50 } } }
assert.ok(planAdviceInput.safeParse(plan).success)
assert.equal(planAdviceContextKey(plan), planAdviceContextKey({ ...plan, targetAllocation: { CASH: 40, CORE: 60 } }))
assert.notEqual(planAdviceContextKey(plan), planAdviceContextKey({ ...plan, monthlyContribution: 1000 }))
assert.ok(!planAdviceInput.safeParse({ ...plan, subAllocations: { CORE: { VOO: 120 } } }).success)

const accounts: ExtractionAccount[] = [{ id: 'mine', accountName: 'Dime USD', currency: 'USD', accountType: 'brokerage' }]
const complete = {
  txnType: 'SELL', ticker: 'nvda', market: 'US', assetType: 'stock', quantity: 2,
  pricePerUnit: 10, totalAmount: 19, fee: 1, currency: 'USD', txnDate: '2026-11-24T10:00:00+07:00',
}
const imported = normalizeExtraction({
  transactions: [
    { ...complete, matchedAccountId: 'someone-else' },
    { ...complete, quantity: null, pricePerUnit: null, accountName: 'Dime USD' },
    { ...complete, sourceImageIndex: 0, matchedAccountId: 'mine' },
    { ...complete, sourceImageIndex: 9, matchedAccountId: 'mine' },
    { ...complete, ticker: 'OTHER', txnDate: 'invalid' },
  ],
  cashBalances: [{ accountName: 'Dime USD', currency: 'USD', cashAmount: null }],
}, accounts, 2)
assert.equal(imported.transactions[0].matchedAccountId, null)
assert.equal(imported.transactions[1].quantity, null)
assert.equal(imported.transactions[1].pricePerUnit, null)
assert.equal(imported.transactions[1].matchedAccountId, 'mine')
assert.equal(imported.transactions[2].ticker, 'NVDA')
assert.equal(imported.transactions[3].sourceImageIndex, null)
assert.equal(imported.transactions[4].txnDate, null)
assert.equal(imported.cashBalances.length, 0)
assert.throws(() => normalizeExtraction({ transactions: 'invalid' }, accounts))
console.log('✅ Model JSON, request budgets, forecast inputs and extraction safety checks passed')

assert.equal(isProviderQuotaError({ status: 429 }), true)
assert.equal(isProviderQuotaError(new Error('RESOURCE_EXHAUSTED')), true)
assert.equal(isProviderQuotaError(new Error('request 14291 failed')), false)
assert.equal(isProviderQuotaError({ status: 403, message: 'Quota settings' }), false)
const limited = copilotQuotaSummary({ requestedEvidence: ['GOOGL · ไม่มีข้อมูลกราฟที่ใหม่พอ'], unresolvedSymbols: [], cash: 200, baseCurrency: 'THB', holdingsCount: 3 })
assert.match(limited, /GOOGL/)
assert.doesNotMatch(limited, /200 THB/)
assert.match(copilotQuotaSummary({ requestedEvidence: [], unresolvedSymbols: [], cash: 0, baseCurrency: 'THB', holdingsCount: 0 }), /0 THB/)
