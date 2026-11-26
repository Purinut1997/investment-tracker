import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculateStockDcaBreakdown } from '@/lib/analytics/rebalancing'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { advisorDate, advisorDayBounds } from './advisor-date'
import { getObservationTime } from './advisor-evidence'
import { calculateAdvisorPlan, type AdvisorPlanSnapshot, type AdvisorPolicyConfig, type AdvisorScenario } from './advisor-plan'
import { policySchema } from './advisor-policy-schema'
import { advisorFlags } from './advisor-rollout'

export async function getAdvisorPolicy(userId: string) {
  const policy = await prisma.advisorPolicy.findFirst({ where: { userId }, orderBy: { version: 'desc' } })
  return policy ? { version: policy.version, config: policySchema.parse(policy.config) } : null
}

export async function saveAdvisorPolicy(userId: string, config: AdvisorPolicyConfig, expectedVersion: number) {
  return prisma.$transaction(async (tx) => {
    const [settings, account, preset, latest, assets] = await Promise.all([
      tx.userSettings.findUnique({ where: { userId }, select: { baseCurrency: true } }),
      tx.investmentAccount.findFirst({ where: { id: config.accountId, userId, accountType: 'brokerage' } }),
      tx.investmentPreset.findFirst({ where: { id: config.presetId, userId } }),
      tx.advisorPolicy.findFirst({ where: { userId }, orderBy: { version: 'desc' }, select: { version: true } }),
      tx.asset.count({ where: { id: { in: config.targets.map((target) => target.assetId) } } }),
    ])
    if ((latest?.version ?? 0) !== expectedVersion) throw new AdvisorPlanError('โปรไฟล์ถูกอัปเดตแล้ว กรุณาโหลดใหม่', 409)
    if (!preset || !account || account.currency !== (settings?.baseCurrency ?? 'THB') ||
        config.monthlyBudget > Number(preset.monthlyContribution) || assets !== config.targets.length) {
      throw new AdvisorPlanError('ตรวจแผน บัญชี สินทรัพย์ และเพดานงบรายเดือน', 422)
    }
    const { version } = await tx.advisorPolicy.create({
      data: { userId, version: expectedVersion + 1, config }, select: { version: true },
    })
    return { version, config }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export class AdvisorPlanError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

async function verifiedFx(from: string, to: string, now: number) {
  if (from === to) return { rate: 1, observedAt: null, source: 'same_currency' }
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
      next: { revalidate: 900 }, signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) return null
    const payload = await response.json() as { date?: string; rates?: Record<string, number> }
    const rate = payload.rates?.[to]
    const time = Date.parse(payload.date ?? '')
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 &&
      Number.isFinite(time) && time <= now && now - time <= 5 * 86_400_000
      ? { rate, observedAt: payload.date ?? null, source: 'Frankfurter' } : null
  } catch {
    return null
  }
}

async function stateKey(userId: string, presetId: string) {
  const [accountRows, transactions, edits, preset, settings, splits] = await Promise.all([
    prisma.investmentAccount.findMany({
      where: { userId }, orderBy: { id: 'asc' }, select: { id: true, currency: true, cashBalance: true, accountType: true },
    }),
    prisma.transaction.aggregate({
      where: { userId }, _count: true, _max: { createdAt: true }, _sum: { quantity: true, totalAmount: true },
    }),
    prisma.transactionEditHistory.aggregate({ where: { transaction: { userId } }, _count: true, _max: { editedAt: true } }),
    prisma.investmentPreset.findFirst({ where: { id: presetId, userId } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { baseCurrency: true } }),
    prisma.assetSplit.aggregate({
      where: { OR: [{ userId }, { userId: null, asset: { transactions: { some: { userId } } } }] },
      _count: true, _max: { createdAt: true },
    }),
  ])
  return createHash('sha256').update(JSON.stringify([accountRows, transactions, edits, preset, settings, splits])).digest('hex')
}

export async function getLatestAdvisorRun(userId: string, policy: Awaited<ReturnType<typeof getAdvisorPolicy>>) {
  if (!policy) return null
  const run = await prisma.advisorRun.findFirst({
    where: { userId, policyVersion: policy.version }, orderBy: { createdAt: 'desc' },
    select: { id: true, policyVersion: true, asOf: true, result: true, snapshot: true },
  })
  if (!run) return null
  const { snapshot, ...data } = run
  const saved = snapshot as { portfolioKey?: string }
  const stale = !getObservationTime(+run.asOf, Date.now()) ||
    saved.portfolioKey !== await stateKey(userId, policy.config.presetId)
  return { ...data, stale }
}

export async function runAdvisorPlan(userId: string, scenario?: AdvisorScenario, expectedVersion?: number) {
  const started = Date.now()
  const policy = await getAdvisorPolicy(userId)
  if (!policy) throw new AdvisorPlanError('ยืนยันโปรไฟล์ที่ปรึกษาก่อนคำนวณ', 409)
  if (expectedVersion !== undefined && expectedVersion !== policy.version) throw new AdvisorPlanError('กฎพอร์ตเปลี่ยนแล้ว กรุณาตรวจก่อนคำนวณใหม่', 409)
  const portfolioKey = await stateKey(userId, policy.config.presetId)
  const reportDate = advisorDate()
  const monthStart = advisorDayBounds(reportDate.slice(0, 7) + '-01')!.gte
  const todayEnd = advisorDayBounds(reportDate)!.lt
  const [settings, accounts, preset, buys] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { baseCurrency: true } }),
    prisma.investmentAccount.findMany({ where: { userId }, select: { id: true, cashBalance: true, currency: true, accountType: true } }),
    prisma.investmentPreset.findFirst({ where: { userId, id: policy.config.presetId } }),
    prisma.transaction.findMany({
      where: { userId, accountId: policy.config.accountId, txnType: 'BUY', txnDate: { gte: monthStart, lt: todayEnd } },
      select: { totalAmount: true, asset: { select: { currency: true } } },
    }),
  ])
  const currency = settings?.baseCurrency ?? 'THB'
  const account = accounts.find((value) => value.id === policy.config.accountId)
  if (!account || account.currency !== currency || account.accountType !== 'brokerage' || !preset ||
      policy.config.monthlyBudget > Number(preset.monthlyContribution)) {
    throw new AdvisorPlanError('บัญชีหรือแผนเปลี่ยนไป กรุณายืนยันโปรไฟล์ใหม่', 409)
  }
  const portfolio = await calculateUserHoldings(userId, currency, true)
  const liveHoldings = portfolio.holdings.filter((holding) => holding.quantity > 0)
  const limitations: string[] = []
  if (buys.some((buy) => buy.asset.currency !== currency)) {
    limitations.push('พบรายการซื้อเดือนนี้ที่สกุลสินทรัพย์ต่างจากบัญชี จึงยังยืนยันงบคงเหลือไม่ได้')
  }
  if (liveHoldings.length > 40) limitations.push('ข้อมูลราคาที่ตรวจในรอบเดียวรองรับสูงสุด 40 สินทรัพย์')
  const currencies = [...new Set([
    currency, ...accounts.filter((item) => Number(item.cashBalance) !== 0).map((item) => item.currency),
    ...liveHoldings.map((holding) => holding.currency),
  ])]
  const [priced, fx] = await Promise.all([
    Promise.all(liveHoldings.slice(0, 40).map(async (holding) => ({
      quote: holding.market === 'US' || holding.market === 'TH'
        ? await yahooFinanceProvider.getQuote(holding.ticker, holding.market, true).catch(() => null) : null,
    }))),
    Promise.all(currencies.map(async (code) => [code, await verifiedFx(code, currency, Date.now())] as const)),
  ])
  const rates = new Map(fx)
  for (const [code, rate] of fx) if (!rate) limitations.push(`ยังยืนยันอัตราแลกเปลี่ยน ${code}/${currency} ไม่ได้`)
  const asOf = new Date()
  const holdings = liveHoldings.map((holding, index) => {
    const quote = priced[index]?.quote
    const observedAt = quote?.currency === holding.currency ? getObservationTime(quote?.observationTimestamp, +asOf) : null
    const rate = rates.get(holding.currency)
    const price = observedAt && quote && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null
    if (!price) limitations.push(`ยังยืนยันราคาในสกุลที่ถูกต้องของ ${holding.ticker} ไม่ได้`)
    return {
      assetId: holding.assetId, ticker: holding.ticker, market: holding.market, currency: holding.currency,
      quantity: holding.quantity, valueBase: price !== null && rate ? holding.quantity * price * rate.rate : holding.currentValueBase,
      price, observedAt: price === null ? null : observedAt, source: price !== null ? quote?.provider ?? null : null,
    }
  })
  for (const target of policy.config.targets) {
    if (!holdings.some((holding) => holding.assetId === target.assetId)) {
      limitations.push('พบเป้าหมายที่ยังไม่มีรายการถือครอง รุ่นนี้รองรับการเติมสถานะเดิม')
      break
    }
  }
  const snapshot: AdvisorPlanSnapshot = {
    currency, asOf: asOf.toISOString(), accountCash: Number(account.cashBalance),
    spentThisMonth: buys.reduce((sum, buy) => sum + (buy.asset.currency === currency ? Math.max(0, Number(buy.totalAmount)) : 0), 0),
    totalCash: accounts.reduce((sum, item) => sum + Number(item.cashBalance) * (rates.get(item.currency)?.rate ?? 0), 0),
    availableCash: accounts.filter((item) => item.currency === currency)
      .reduce((sum, item) => sum + Number(item.cashBalance), 0),
    holdings, limitations,
  }
  if (advisorDate(asOf) !== reportDate || portfolioKey !== await stateKey(userId, policy.config.presetId) ||
      (await getAdvisorPolicy(userId))?.version !== policy.version) {
    throw new AdvisorPlanError('พอร์ตหรือโปรไฟล์เปลี่ยนระหว่างคำนวณ กรุณาลองใหม่', 409)
  }
  const result = calculateAdvisorPlan(snapshot, policy.config, scenario ?? { inflow: policy.config.monthlyBudget })
  if (scenario) {
    const baseline = calculateAdvisorPlan(snapshot, policy.config, { inflow: policy.config.monthlyBudget })
    return { id: null, policyVersion: policy.version, result, comparison: {
      spent: result.spent - baseline.spent, cashAfter: result.cashAfter - baseline.cashAfter,
    } }
  }
  const baseline = advisorFlags(userId).shadow ? calculateStockDcaBreakdown({
    holdings: liveHoldings.map((holding, index) => ({
      ...holding, currentValueBase: holdings[index].valueBase,
      currentPrice: holdings[index].price ?? holding.currentPrice,
    })),
    totalCashBase: snapshot.totalCash, cashInflow: policy.config.monthlyBudget,
    targetAllocation: Object.fromEntries(policy.config.targets.flatMap((target) => {
      const holding = holdings.find((item) => item.assetId === target.assetId)
      return holding ? [[holding.ticker.toUpperCase(), target.weight]] : []
    })),
  }) : null
  const run = await prisma.advisorRun.create({
    data: { userId, policyVersion: policy.version, asOf, result: { ...result, baseline: baseline ? { totalAllocated: baseline.totalAllocated } : null }, snapshot: { ...snapshot, portfolioKey, fx: Object.fromEntries(rates) }, durationMs: Date.now() - started },
    select: { id: true, policyVersion: true },
  })
  return { ...run, result }
}
