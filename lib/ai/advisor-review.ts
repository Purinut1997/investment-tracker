import { fetchYahooDailySeries } from '@/lib/analytics/portfolio-analytics'
import { prisma } from '@/lib/prisma'

export const reviewHorizons = [1, 5, 20] as const

export function reviewClosingPrices(anchor: string, price: number, closes: { date: string; price: number }[]) {
  const sessions = [...new Map(closes.filter((item) => item.date > anchor && item.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date)).map((item) => [item.date, item])).values()]
  return reviewHorizons.map((sessionsLater) => {
    const close = sessions[sessionsLater - 1]
    return close && price > 0
      ? { sessionsLater, date: close.date, price: close.price, returnPercent: (close.price / price - 1) * 100 }
      : { sessionsLater, date: null, price: null, returnPercent: null }
  })
}

export async function loadAdvisorReview(userId: string) {
  const runs = await prisma.advisorRun.findMany({
    where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
    select: { id: true, asOf: true, result: true, durationMs: true },
  })
  const calls = runs.flatMap((run) => {
    const plan = run.result as { orders?: { assetId: string; ticker: string; market: string; price: number; observedAt: string }[] }
    return (plan.orders ?? []).map((order) => ({ ...order, runId: run.id, asOf: run.asOf }))
  }).slice(0, 40)
  const anchorDate = (date: Date, market: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: market === 'TH' ? 'Asia/Bangkok' : 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
  const assets = [...new Map(calls.map((call) => [call.assetId, call])).values()]
  const series = new Map<string, { closes: Map<string, number>; raw: Map<string, number> }>()
  for (let offset = 0; offset < assets.length; offset += 8) {
    await Promise.all(assets.slice(offset, offset + 8).map(async (asset) => {
      const ticker = asset.market === 'TH' && !asset.ticker.endsWith('.BK') ? asset.ticker + '.BK' : asset.ticker
      const floor = Math.min(...calls.filter((call) => call.assetId === asset.assetId)
        .map((call) => Date.parse(call.observedAt))) - 86_400_000 * 5
      // Use Yahoo's split-adjusted closes, with a separate raw anchor to adjust the original quote.
      const [raw, closes] = await Promise.all([
        fetchYahooDailySeries(ticker, floor, Date.now(), false, { market: asset.market }),
        fetchYahooDailySeries(ticker, floor, Date.now(), false, { market: asset.market, skipSplitUnadjust: true }),
      ])
      series.set(asset.assetId, { closes, raw })
    }))
  }
  return {
    sampleSize: calls.length,
    runs: runs.map(({ id, asOf, durationMs, result }) => {
      const plan = result as { cashAfter?: number; fees?: number; spent?: number; baseline?: { totalAllocated: number } }
      return { id, asOf, durationMs, cashAfter: plan.cashAfter, fees: plan.fees, spent: plan.spent, baselineAllocated: plan.baseline?.totalAllocated ?? null }
    }),
    observations: calls.map((call) => {
      const prices = series.get(call.assetId)
      const quoteDate = anchorDate(new Date(call.observedAt), call.market)
      const anchor = anchorDate(call.asOf, call.market)
      const today = anchorDate(new Date(), call.market)
      const raw = prices?.raw.get(quoteDate)
      const adjusted = prices?.closes.get(quoteDate)
      const entry = raw && adjusted ? call.price * adjusted / raw : 0
      return {
        runId: call.runId, ticker: call.ticker, market: call.market, asOf: call.asOf, entryPrice: call.price,
        horizons: reviewClosingPrices(anchor, entry, [...(prices?.closes ?? [])]
          .filter(([date]) => date < today).map(([date, price]) => ({ date, price }))),
      }
    }),
  }
}
