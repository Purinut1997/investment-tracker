import assert from 'node:assert/strict'
import { advisorDate, advisorDayBounds, matchesLegacyReport } from './advisor-date'
import { calculateAdvisorPlan, type AdvisorPlanSnapshot, type AdvisorPolicyConfig } from './advisor-plan'

const snapshot: AdvisorPlanSnapshot = {
  currency: 'THB', asOf: '2026-11-26T03:00:00Z', accountCash: 1000, totalCash: 2000, limitations: [],
  holdings: [
    { assetId: 'a', ticker: 'AAA', market: 'TH', currency: 'THB', price: 10, quantity: 100, valueBase: 1000, observedAt: '2026-11-26T02:00:00Z', source: 'Yahoo' },
    { assetId: 'b', ticker: 'BBB', market: 'TH', currency: 'THB', price: 10, quantity: 700, valueBase: 7000, observedAt: '2026-11-26T02:00:00Z', source: 'Yahoo' },
  ],
}
const policy: AdvisorPolicyConfig = {
  accountId: 'broker', presetId: 'preset', reserve: 2500, monthlyBudget: 2000,
  maxPositionPercent: 25, horizonYears: 10, feePercent: 1, feePerOrder: 5,
  targets: [{ assetId: 'a', weight: 35, lotSize: 10 }],
}
const calculate = (inflow: number, s = snapshot, p = policy) => calculateAdvisorPlan(s, p, { inflow })

assert.equal(advisorDate(new Date('2026-11-25T16:59:59Z')), '2026-11-25')
assert.equal(advisorDate(new Date('2026-11-25T17:00:00Z')), '2026-11-26')
assert.equal(advisorDayBounds('2026-02-30'), null)
assert.equal(advisorDayBounds('2026-11-26')?.gte.toISOString(), '2026-11-25T17:00:00.000Z')
assert.equal(advisorDayBounds('2026-11-26')?.lt.toISOString(), '2026-11-26T17:00:00.000Z')
assert.equal(matchesLegacyReport('[daily-brief:v2] วันที่ 2026-11-25:', '2026-11-26'), false)
assert.equal(matchesLegacyReport('[daily-brief:v2] วันที่ 2026-11-26:', '2026-11-26'), true)

const base = calculate(2000)
assert.equal(base.budget, 1500)
assert.equal(base.orders[0]?.quantity, 140)
assert.equal(base.spent, 1419)
assert.equal(base.cashAfter, 2581)
assert.equal(base.totalAfter, 11981)
assert.ok(base.orders[0].weightAfter <= 25)
assert.equal(calculate(0).status, 'wait')
assert.equal(calculate(200).spent, 0)
assert.equal(calculate(2000, { ...snapshot, spentThisMonth: 2000 }).spent, 0)
assert.equal(calculate(2000, { ...snapshot, accountCash: -2000 }).spent, 0)
assert.equal(calculate(2000, { ...snapshot, availableCash: 0 }).spent, 0)
assert.equal(calculate(2000, { ...snapshot, limitations: ['ไม่มี FX'] }).status, 'review')
assert.equal(calculate(2000, { ...snapshot, holdings: snapshot.holdings.map((h) => ({ ...h, currency: 'USD' })) }).spent, 0)
assert.equal(calculate(2000, snapshot, { ...policy, feePerOrder: 1500 }).spent, 0)
assert.equal(calculate(2000, snapshot, { ...policy, targets: [{ assetId: 'a', weight: 5, lotSize: 10 }] }).spent, 0)

let cases = 0
for (const inflow of [0, 100, 500, 1000, 2000, 3000]) {
  for (const reserve of [0, 500, 1500, 2500, 3500]) {
    const result = calculateAdvisorPlan(snapshot, policy, { inflow, reserve })
    assert.ok(result.spent <= Math.min(inflow, policy.monthlyBudget))
    assert.equal(result.cashAfter, result.cashIfHoldAfterDeposit - result.spent)
    if (result.orders.length) {
      assert.ok(result.cashAfter >= reserve)
      assert.ok(result.accountCashAfter >= 0)
      assert.ok(result.orders.every((order) => order.quantity % 10 === 0 && order.weightAfter <= 25))
    }
    cases++
  }
}
console.log(`Advisor checks passed, including ${cases} combinations of inflow and reserve`)
