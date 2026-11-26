export type AdvisorPolicyConfig = {
  accountId: string
  presetId: string
  reserve: number
  monthlyBudget: number
  maxPositionPercent: number
  horizonYears: number
  feePercent: number
  feePerOrder: number
  targets: { assetId: string; weight: number; lotSize: number }[]
}
export type AdvisorScenario = { inflow: number; reserve?: number }

export type PlanHolding = {
  assetId: string
  ticker: string
  market: string
  currency: string
  quantity: number
  valueBase: number
  price: number | null
  observedAt: string | null
  source: string | null
}
export type AdvisorPlanSnapshot = {
  currency: string
  asOf: string
  accountCash: number
  totalCash: number
  availableCash?: number
  spentThisMonth?: number
  holdings: PlanHolding[]
  limitations: string[]
}

type AdvisorOrder = {
  assetId: string
  ticker: string
  market: string
  observedAt: string
  source: string | null
  price: number
  quantity: number
  amount: number
  fee: number
  targetWeight: number
  weightBefore: number
}

export const toCents = (value: number) => Math.round(value * 100)
const toMoney = (value: number) => value / 100

export function calculateAdvisorPlan(snapshot: AdvisorPlanSnapshot, policy: AdvisorPolicyConfig, scenario: AdvisorScenario) {
  const sumHoldings = snapshot.holdings.reduce((sum, holding) => sum + toCents(holding.valueBase), 0)
  const cash = toCents(snapshot.totalCash)
  const accountCash = toCents(snapshot.accountCash)
  const availableCash = toCents(snapshot.availableCash ?? snapshot.totalCash)
  const totalBefore = sumHoldings + cash
  const inflow = toCents(scenario.inflow)
  const reserve = Math.ceil((scenario.reserve ?? policy.reserve) * 100 - 1e-8)
  const totalAfterDeposit = totalBefore + inflow
  const monthlyBudgetLeft = Math.max(0, toCents(policy.monthlyBudget) - toCents(snapshot.spentThisMonth ?? 0))
  const budget = Math.max(0, Math.min(inflow, monthlyBudgetLeft, accountCash + inflow, availableCash + inflow - reserve))
  const positionCap = policy.maxPositionPercent / 100
  let spent = 0
  let fees = 0
  const targets = policy.targets.flatMap((target) => {
    const holding = snapshot.holdings.find((item) => item.assetId === target.assetId)
    if (!holding) return []
    const weightBefore = totalBefore > 0 ? toCents(holding.valueBase) / totalBefore * 100 : 0
    return [{ ...target, holding, gap: target.weight - weightBefore, weightBefore }]
  }).sort((a, b) => b.gap - a.gap || a.assetId.localeCompare(b.assetId))
  const positions = new Map(snapshot.holdings.map((holding) => [holding.assetId, toCents(holding.valueBase)]))
  const orders: AdvisorOrder[] = []
  if (!snapshot.limitations.length && totalAfterDeposit > 0) {
    for (const target of targets) {
      const { holding, lotSize, weight, gap } = target
      if (gap <= 0 || !holding.price || !holding.observedAt || holding.currency !== snapshot.currency ||
          (holding.market !== 'US' && holding.market !== 'TH')) continue
      const available = budget - spent
      const lotCost = holding.price * lotSize * 100
      if (available <= 0 || lotCost <= 0) continue
      const position = positions.get(holding.assetId) ?? 0
      const maximum = Math.min(weight / 100, positionCap)
      let low = 0
      let high = Math.min(Math.floor(available / lotCost), Number.MAX_SAFE_INTEGER - 1)
      const priceFor = (lots: number) => Math.ceil(lots * lotCost - 1e-8)
      const feeFor = (amount: number) => Math.ceil(amount * policy.feePercent / 100 + toCents(policy.feePerOrder) - 1e-8)
      while (low < high) {
        const midpoint = low + Math.ceil((high - low) / 2)
        const amount = priceFor(midpoint)
        const fee = feeFor(amount)
        const total = totalAfterDeposit - fees - fee
        const capsHold = total > 0 && [...positions].every(([assetId, value]) => {
          const before = snapshot.holdings.find((item) => item.assetId === assetId)
          const oldWeight = totalBefore > 0 && before ? toCents(before.valueBase) / totalBefore : 0
          const previous = orders.find((order) => order.assetId === assetId)
          const limit = assetId === holding.assetId ? maximum
            : previous ? Math.min(positionCap, previous.targetWeight / 100)
            : Math.max(positionCap, oldWeight)
          return value + (assetId === holding.assetId ? amount : 0) <= total * limit + 1e-8
        })
        if (amount + fee <= available && capsHold) low = midpoint
        else high = midpoint - 1
      }
      if (!low) continue
      const amount = priceFor(low)
      const fee = feeFor(amount)
      spent += amount + fee
      fees += fee
      positions.set(holding.assetId, position + amount)
      orders.push({
        assetId: holding.assetId, ticker: holding.ticker, market: holding.market, observedAt: holding.observedAt,
        source: holding.source, price: holding.price, quantity: low * lotSize, amount: toMoney(amount), fee: toMoney(fee),
        targetWeight: weight, weightBefore: target.weightBefore,
      })
    }
  }

  return {
    currency: snapshot.currency, asOf: snapshot.asOf, inflow: toMoney(inflow), reserve: toMoney(reserve),
    monthlyBudgetLeft: toMoney(monthlyBudgetLeft),
    budget: toMoney(budget), spent: toMoney(spent), fees: toMoney(fees),
    cashBefore: toMoney(cash),
    cashIfHoldAfterDeposit: toMoney(cash + inflow),
    cashAfter: toMoney(cash + inflow - spent),
    availableCashAfter: toMoney(availableCash + inflow - spent),
    accountCashAfter: toMoney(accountCash + inflow - spent),
    totalBefore: toMoney(totalBefore), totalAfter: toMoney(totalAfterDeposit - fees),
    status: snapshot.limitations.length ? 'review' as const : orders.length ? 'fund' as const : 'wait' as const,
    limitations: snapshot.limitations,
    reason: snapshot.limitations.length ? 'ข้อมูลที่ต้องใช้ตรวจพอร์ตยังไม่ครบ'
      : availableCash + inflow < reserve ? 'เงินสดที่ใช้ได้หลังเติมยังต่ำกว่าขั้นต่ำ'
      : !inflow ? 'ไม่มีเงินใหม่ในกรณีนี้'
      : !budget ? 'วงเงินหรือเงินสดของบัญชีไม่พอ'
      : orders.length ? 'สินทรัพย์ต่ำกว่าเป้าและผ่านข้อจำกัดหลังหักค่าธรรมเนียม'
      : 'ยังไม่มีรายการที่ผ่านเป้าหมาย เพดาน น้ำหนัก สกุลบัญชี และจำนวนหน่วยขั้นต่ำ',
    targets: targets.map(({ assetId, weight, holding, weightBefore }) => ({
      assetId, ticker: holding.ticker, market: holding.market, targetWeight: weight, weightBefore,
      weightAfter: totalAfterDeposit > fees ? (positions.get(assetId) ?? 0) / (totalAfterDeposit - fees) * 100 : 0,
    })),
    orders: orders.map((order) => ({
      ...order, weightAfter: (positions.get(order.assetId) ?? 0) / (totalAfterDeposit - fees) * 100,
    })),
  }
}

export type AdvisorPlanResult = ReturnType<typeof calculateAdvisorPlan>
