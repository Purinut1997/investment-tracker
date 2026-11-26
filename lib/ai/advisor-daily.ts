import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { sumAccountCashInBaseCurrency } from '@/lib/market-data/frankfurter'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { getAdvisorPolicy, getLatestAdvisorRun } from './advisor-planning-service'
import { callGemini } from './gemini-client'
import { formatMarketObservation, getObservationTime } from './advisor-evidence'
import { advisorDate, advisorDayBounds, matchesLegacyReport } from './advisor-date'
import { advisorFlags } from './advisor-rollout'

const legacySelect = { id: true, prompt: true, response: true, modelUsed: true, createdAt: true } as const

export async function readAdvisorBrief(userId: string, date: string) {
  const bounds = advisorDayBounds(date)
  if (!bounds) return null
  if (advisorFlags(userId).daily) {
    const report = await prisma.advisorReport.findFirst({
      where: { userId, reportDate: date }, orderBy: { revision: 'desc' },
      select: { id: true, text: true, modelUsed: true, createdAt: true, asOf: true, revision: true },
    })
    if (report) return report
  }
  const old = await prisma.aiAdviceLog.findFirst({
    where: {
      userId, logType: 'advisor', createdAt: bounds,
      AND: [{ prompt: { contains: '[daily-brief:v2]' } }, { prompt: { contains: `วันที่ ${date}:` } }],
    },
    orderBy: { createdAt: 'desc' }, select: legacySelect,
  })
  return old && matchesLegacyReport(old.prompt, date)
    ? { id: old.id, text: old.response, modelUsed: old.modelUsed, createdAt: old.createdAt, asOf: null, revision: null }
    : null
}

async function loadDailySnapshot(userId: string, forceRefresh: boolean) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const baseCurrency = settings?.baseCurrency ?? 'THB'
  const [portfolio, accounts, benchmarks, news] = await Promise.all([
    calculateUserHoldings(userId, baseCurrency, forceRefresh),
    prisma.investmentAccount.findMany({ where: { userId }, select: { cashBalance: true, currency: true } }),
    Promise.all(['S&P 500', 'NASDAQ', 'VIX', 'SET INDEX'].map(async (symbol) => ({
      symbol, quote: await yahooFinanceProvider.getQuote(symbol).catch(() => null),
    }))),
    prisma.newsItem.findMany({
      where: { publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000), lte: new Date() } },
      orderBy: { publishedAt: 'desc' }, take: 50,
      select: { symbol: true, headline: true, sourceName: true, sourceUrl: true, publishedAt: true },
    }),
  ])
  const [cash, signals] = await Promise.all([
    sumAccountCashInBaseCurrency(accounts, baseCurrency),
    Promise.all([...portfolio.holdings].sort((a, b) => b.currentValueBase - a.currentValueBase)
      .filter((holding) => holding.quantity > 0).slice(0, 8).map(async (holding) => ({
        holding, signal: await fetchSingleTickerTechnicalSignal(holding.ticker, holding.market, false, true).catch(() => null),
      }))),
  ])
  const asOf = new Date()
  const tickers = new Set(portfolio.holdings.map((holding) => holding.ticker.toUpperCase().replace(/\.BK$/, '')))
  const recentNews = [...new Map(news.filter(({ symbol, sourceUrl }) =>
    Boolean(symbol && tickers.has(symbol.toUpperCase().replace(/\.BK$/, '')) && /^https?:\/\//i.test(sourceUrl))
  ).map((item) => [item.headline.trim().toLowerCase(), item])).values()].slice(0, 8)
  return {
    settings, asOf, baseCurrency, cash, invested: portfolio.totalValueBase,
    news: recentNews.map((item) => ({ ...item, publishedAt: item.publishedAt.toISOString() })),
    estimatedTotals: portfolio.holdings.some((h) => h.isStale) || accounts.some((a) => a.currency !== baseCurrency),
    market: benchmarks.map(({ symbol, quote }) => formatMarketObservation(
      symbol, quote ? { ...quote, timestamp: quote.observationTimestamp ?? 0 } : null, +asOf,
    )),
    holdings: signals.map(({ holding, signal }) => {
      const observedAt = getObservationTime(signal?.observationTimestamp, +asOf)
      const valid = observedAt && signal && signal.currentPrice > 0
      return {
        ticker: holding.ticker, market: holding.market, currency: holding.currency,
        allocationPercent: holding.allocationPercent,
        allocationBasis: 'invested_assets',
        observedAt: valid ? observedAt : null, price: valid ? signal.currentPrice : null,
        rsi: valid ? signal.rsi14 : null, support: valid ? signal.supportS1 : null,
      }
    }),
  }
}

export async function generateAdvisorBrief(userId: string, date: string, force: boolean, requestId: string) {
  const startedAt = Date.now()
  const findLatest = () => prisma.advisorReport.findFirst({
    where: { userId, reportDate: date }, orderBy: { revision: 'desc' },
  })
  const replay = await prisma.advisorReport.findUnique({ where: {
    userId_reportDate_requestId: { userId, reportDate: date, requestId },
  } })
  const existing = replay ?? (!force ? await findLatest() : null)
  if (existing) return { status: 'cached' as const, report: existing }
  const token = randomUUID()
  const leaseEnd = new Date(startedAt + 90_000)
  try {
    await prisma.advisorJob.create({ data: { userId, date, token, leaseEnd } })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const claimed = await prisma.advisorJob.updateMany({
      where: { userId, date, leaseEnd: { lte: new Date() } }, data: { token, leaseEnd },
    })
    if (!claimed.count) return { status: 'running' as const }
  }

  try {
    const latest = await findLatest()
    const sameRequest = await prisma.advisorReport.findUnique({
      where: { userId_reportDate_requestId: { userId, reportDate: date, requestId } },
    })
    if (sameRequest || (!force && latest)) return { status: 'cached' as const, report: sameRequest ?? latest! }
    const { settings, asOf, ...marketSnapshot } = await loadDailySnapshot(userId, force)
    const plan = advisorFlags(userId).planning
      ? await getLatestAdvisorRun(userId, await getAdvisorPolicy(userId)) : null
    const snapshot = { ...marketSnapshot, planId: plan && !plan.stale ? plan.id : null }
    if (advisorDate(asOf) !== date) return { status: 'date_changed' as const }
    const estimated = snapshot.estimatedTotals ? ' (ประมาณการ)' : ''
    let text = `1. **ภาพรวมตลาด**\n${snapshot.market.join('\n')}\n\n2. **ภาพรวมพอร์ต**\n- สินทรัพย์ ${snapshot.invested.toLocaleString('th-TH')} ${snapshot.baseCurrency}${estimated} · เงินสด ${snapshot.cash.toLocaleString('th-TH')} ${snapshot.baseCurrency}${estimated}\n\n3. **สิ่งที่ต้องตรวจ**\n- ตรวจเวลาของราคาและแผนที่บันทึกไว้ก่อนเปลี่ยนการจัดสรร`
    let modelUsed = 'rule-engine'
    if (settings?.aiEnabled && snapshot.holdings.some((holding) => holding.price !== null)) {
      try {
        const result = await callGemini({
          userId, logType: 'daily_brief', timeoutMs: 18_000, skipLog: true, thinkingBudget: 0,
          prompt: `สรุปภาพรวมตลาดและข้อสังเกตของพอร์ตวันที่ ${date} จากหลักฐานเท่านั้น ระบุจุดที่ต้องตรวจเพิ่ม งดกำหนดจุดซื้อขายหรือวงเงิน ใช้ภาษาไทย หัวข้อ 1. ภาพรวมตลาด 2. ภาพรวมพอร์ต 3. สิ่งที่ต้องตรวจ\n${JSON.stringify(snapshot)}`,
        })
        text = result.text
        modelUsed = result.modelUsed
      } catch {
        if (latest) return { status: 'refresh_failed' as const, report: latest }
      }
    }
    const report = await prisma.$transaction(async (tx) => {
      const owned = await tx.advisorJob.updateMany({
        where: { userId, date, token, leaseEnd: { gt: new Date() } }, data: { leaseEnd },
      })
      if (!owned.count) return null
      return tx.advisorReport.create({ data: {
        userId, reportDate: date, revision: (latest?.revision ?? 0) + 1, requestId, asOf,
        snapshot, text, modelUsed, durationMs: Date.now() - startedAt,
      } })
    })
    return report ? { status: 'generated' as const, report } : { status: 'running' as const }
  } finally {
    await prisma.advisorJob.deleteMany({ where: { userId, date, token } }).catch(() => undefined)
  }
}
