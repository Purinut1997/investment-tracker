/**
 * lib/analytics/portfolio-analytics.ts
 * Server-side historical daily market data fetcher & portfolio analytics orchestrator.
 */

import { prisma } from '@/lib/prisma'
import {
  calculateUserHoldings,
  reconcileHoldingPrice,
} from './holdings'
import {
  PORTFOLIO_ANALYTICS_CACHE_TTL_MS,
  inFlightPortfolioAnalytics,
  portfolioAnalyticsCache,
} from './analytics-cache'
import {
  AssetContributionItem,
  BENCHMARK_OPTIONS,
  BenchmarkId,
  PnLBreakdownSummary,
  PortfolioAnalyticsPayload,
  addUtcDays,
  buildDailyAnalyticsSeries,
  getBenchmarkMeta,
  toUtcDateKey,
  unadjustYahooClosePrices,
} from './portfolio-analytics-math'
import { calculatePortfolioXIRR } from './quant-metrics'
import {
  StockSplitEvent,
  getSplitMultiplier,
  mergeTxnsAndSplits,
  normalizeSplitDate,
} from './stock-splits'
import { fetchLiveAssetQuote } from '../market-data/cache-layer'
import { getExchangeRate, sumAccountCashInBaseCurrency } from '../market-data/frankfurter'
import {
  calculateThai965PricePerBaht,
  isGoldTicker,
  isThai965GoldTicker,
} from '../market-data/gold'

const SYMBOL_HISTORY_TTL_MS = 30 * 60 * 1000 // 30 minutes
const symbolHistoryCache = new Map<
  string,
  { prices: Map<string, number>; startMs: number; endMs: number; timestamp: number }
>()
const inFlightSymbolHistory = new Map<string, Promise<Map<string, number>>>()

const fxRangeCache = new Map<string, { rates: Map<string, number>; timestamp: number }>()

function resolveYahooHistorySymbol(asset: {
  ticker: string
  market: string
  assetType?: string | null
}): { yfSymbol: string; isThai965Gold: boolean; skipSplitUnadjust: boolean } {
  const tickerUpper = String(asset.ticker || '').trim().toUpperCase()
  const marketUpper = String(asset.market || 'US').trim().toUpperCase()
  const assetTypeLower = String(asset.assetType || 'stock').trim().toLowerCase()

  if (isThai965GoldTicker(tickerUpper)) {
    return { yfSymbol: 'GC=F', isThai965Gold: true, skipSplitUnadjust: true }
  }

  const isCommodityGold =
    isGoldTicker(tickerUpper, assetTypeLower) &&
    !(tickerUpper === 'GOLD' && assetTypeLower !== 'gold' && marketUpper === 'US')
  if (isCommodityGold) {
    return { yfSymbol: 'GC=F', isThai965Gold: false, skipSplitUnadjust: true }
  }

  if (marketUpper === 'CRYPTO' || assetTypeLower === 'crypto') {
    const sym = tickerUpper.endsWith('-USD') ? tickerUpper : `${tickerUpper}-USD`
    return { yfSymbol: sym, isThai965Gold: false, skipSplitUnadjust: true }
  }

  if (marketUpper === 'TH' || tickerUpper.endsWith('.BK')) {
    const sym = tickerUpper.endsWith('.BK') ? tickerUpper : `${tickerUpper}.BK`
    return { yfSymbol: sym, isThai965Gold: false, skipSplitUnadjust: false }
  }

  return { yfSymbol: tickerUpper, isThai965Gold: false, skipSplitUnadjust: false }
}

/**
 * Fetches daily close price history from Yahoo Finance chart API.
 * For equities/ETFs, automatically inverts Yahoo's split adjustment so prices
 * reflect exact as-traded historical closes matching FIFO share counts.
 */
export async function fetchYahooDailySeries(
  yfSymbol: string,
  startDateMs: number,
  endDateMs: number,
  forceRefresh = false,
  options?: { market?: string; skipSplitUnadjust?: boolean }
): Promise<Map<string, number>> {
  const cleanSym = String(yfSymbol || '').trim().toUpperCase()
  if (!cleanSym) return new Map()

  const now = Date.now()
  const cacheKey = `${cleanSym}`
  const cached = symbolHistoryCache.get(cacheKey)

  if (
    !forceRefresh &&
    cached &&
    now - cached.timestamp < SYMBOL_HISTORY_TTL_MS &&
    cached.startMs <= startDateMs + 3 * 86400_000
  ) {
    return cached.prices
  }

  const pendingKey = `${cacheKey}_${Math.floor(startDateMs / 86400_000)}`
  if (!forceRefresh && inFlightSymbolHistory.has(pendingKey)) {
    return inFlightSymbolHistory.get(pendingKey)!
  }

  const fetchPromise = (async () => {
    try {
      const p1 = Math.max(0, Math.floor(startDateMs / 1000))
      const p2 = Math.floor(endDateMs / 1000) + 86400
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        cleanSym
      )}?period1=${p1}&period2=${p2}&interval=1d&events=split`

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(4500),
      })

      if (!res.ok) {
        return cached?.prices ?? new Map<string, number>()
      }

      const json = await res.json()
      const chartResult = json?.chart?.result?.[0]
      if (!chartResult) {
        return cached?.prices ?? new Map<string, number>()
      }

      const timestamps: number[] = chartResult.timestamp || []
      const closes: Array<number | null> = chartResult.indicators?.quote?.[0]?.close || []
      const bars: Array<{ date: string; close: number }> = []

      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i]
        const close = closes[i]
        if (ts && close !== null && close !== undefined && Number.isFinite(close) && close > 0) {
          bars.push({
            date: new Date(ts * 1000).toISOString().slice(0, 10),
            close: Number(close),
          })
        }
      }

      const skipSplits =
        options?.skipSplitUnadjust ||
        cleanSym.startsWith('^') ||
        cleanSym.includes('=X') ||
        cleanSym.includes('=F') ||
        cleanSym.endsWith('-USD')

      const yahooSplits: Array<{ splitDate: string; multiplier: number }> = []
      if (!skipSplits && chartResult.events?.splits) {
        const rawSplits = Object.values(chartResult.events.splits) as Array<{
          date?: number | string
          numerator?: number | string
          denominator?: number | string
        }>
        const marketHint = options?.market || (cleanSym.endsWith('.BK') ? 'TH' : 'US')
        for (const s of rawSplits) {
          const dt = Number(s?.date)
          const num = Number(s?.numerator)
          const den = Number(s?.denominator || 1)
          if (Number.isFinite(dt) && dt > 0 && Number.isFinite(num) && Number.isFinite(den) && num > 0 && den > 0) {
            const mult = num / den
            if (Math.abs(mult - 1) > 1e-9) {
              const norm = normalizeSplitDate(dt, marketHint)
              yahooSplits.push({
                splitDate: norm.toISOString().slice(0, 10),
                multiplier: mult,
              })
            }
          }
        }
      }

      const priceMap =
        yahooSplits.length > 0
          ? unadjustYahooClosePrices(bars, yahooSplits)
          : new Map(bars.map((b) => [b.date, b.close]))

      if (priceMap.size > 0) {
        symbolHistoryCache.set(cacheKey, {
          prices: priceMap,
          startMs: startDateMs,
          endMs: endDateMs,
          timestamp: Date.now(),
        })
      }

      return priceMap.size > 0 ? priceMap : (cached?.prices ?? new Map<string, number>())
    } catch {
      return cached?.prices ?? new Map<string, number>()
    } finally {
      inFlightSymbolHistory.delete(pendingKey)
    }
  })()

  inFlightSymbolHistory.set(pendingKey, fetchPromise)
  return fetchPromise
}

/**
 * Fetches daily historical USD/THB FX rates using Yahoo `THB=X`, Frankfurter range API,
 * and DB ExchangeRateHistory fallback.
 */
export async function fetchDailyUsdThbRates(
  startDateStr: string,
  endDateStr: string,
  fallbackRate: number,
  forceRefresh = false
): Promise<Map<string, number>> {
  const cacheKey = `${startDateStr}_${endDateStr}`
  const cached = fxRangeCache.get(cacheKey)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < SYMBOL_HISTORY_TTL_MS) {
    return cached.rates
  }

  const startMs = Date.parse(`${startDateStr}T00:00:00.000Z`)
  const endMs = Date.parse(`${endDateStr}T23:59:59.000Z`)

  const [yahooRates, dbRates] = await Promise.all([
    fetchYahooDailySeries('THB=X', startMs, endMs, forceRefresh, { skipSplitUnadjust: true }),
    prisma.exchangeRateHistory
      .findMany({
        where: {
          baseCurrency: 'USD',
          targetCurrency: 'THB',
          rateDate: {
            gte: new Date(startMs),
            lte: new Date(endMs),
          },
        },
        orderBy: { rateDate: 'asc' },
      })
      .catch(() => []),
  ])

  const merged = new Map<string, number>()

  for (const row of dbRates) {
    const val = Number(row.rate)
    if (Number.isFinite(val) && val > 10 && val < 100) {
      merged.set(toUtcDateKey(row.rateDate), val)
    }
  }

  for (const [d, val] of yahooRates.entries()) {
    if (Number.isFinite(val) && val > 10 && val < 100) {
      merged.set(d, val)
    }
  }

  // Fallback to Frankfurter time-series range API if Yahoo FX returned sparse results
  if (merged.size < 3) {
    try {
      const url = `https://api.frankfurter.app/${startDateStr}..${endDateStr}?from=USD&to=THB`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const json = await res.json()
        const ratesObj = json?.rates || {}
        for (const [d, entry] of Object.entries<any>(ratesObj)) {
          const val = Number(entry?.THB)
          if (Number.isFinite(val) && val > 10 && val < 100) {
            merged.set(d, val)
          }
        }
      }
    } catch {
      // Ignore network fallback failure
    }
  }

  if (fallbackRate > 10 && fallbackRate < 100) {
    merged.set(endDateStr, fallbackRate)
  }

  if (merged.size > 0) {
    fxRangeCache.set(cacheKey, { rates: merged, timestamp: Date.now() })
  }

  return merged
}

function computePnLBreakdown(params: {
  txns: any[]
  splitsByAsset: Map<string, StockSplitEvent[]>
  liveAssetPrices: Map<string, number>
  dailyUsdThb: Map<string, number>
  currentUsdThbRate: number
  baseCurrency: string
}): PnLBreakdownSummary {
  const { txns, splitsByAsset, liveAssetPrices, dailyUsdThb, currentUsdThbRate, baseCurrency } = params

  const sortedFxDates = Array.from(dailyUsdThb.keys()).sort()
  const lookupFx = (dateKey: string, isUsd: boolean): number => {
    const target = baseCurrency.toUpperCase()
    let usdThb = dailyUsdThb.get(dateKey)
    if (!usdThb) {
      for (let i = sortedFxDates.length - 1; i >= 0; i--) {
        if (sortedFxDates[i] <= dateKey) {
          usdThb = dailyUsdThb.get(sortedFxDates[i])
          break
        }
      }
    }
    const rate = usdThb && usdThb > 0 ? usdThb : currentUsdThbRate
    if (target === 'USD') {
      return isUsd ? 1.0 : 1 / Math.max(1, rate)
    }
    return isUsd ? rate : 1.0
  }

  const byAsset = new Map<string, { asset: any; txns: any[] }>()
  for (const t of txns) {
    if (!t.assetId) continue
    if (!byAsset.has(t.assetId)) {
      byAsset.set(t.assetId, { asset: t.asset, txns: [] })
    }
    byAsset.get(t.assetId)!.txns.push(t)
  }

  const items: AssetContributionItem[] = []
  let totalUnrealized = 0
  let totalRealized = 0
  let totalDividends = 0
  let totalFees = 0

  for (const [assetId, group] of byAsset.entries()) {
    const asset = group.asset
    const isUsd =
      asset?.currency === 'USD' || asset?.market === 'US' || asset?.market === 'CRYPTO'
    const currentFx =
      baseCurrency.toUpperCase() === 'USD'
        ? isUsd
          ? 1.0
          : 1 / Math.max(1, currentUsdThbRate)
        : isUsd
        ? currentUsdThbRate
        : 1.0

    const assetSplits = splitsByAsset.get(assetId) ?? []
    const timeline = mergeTxnsAndSplits(group.txns, assetSplits)

    const lots: Array<{ qty: number; unitCostBase: number }> = []
    let realized = 0
    let dividends = 0
    let fees = 0
    let sellCount = 0
    let lastPriceNative = 0

    for (const ev of timeline) {
      if (ev.kind === 'SPLIT') {
        const mult = getSplitMultiplier(ev.split)
        if (mult !== 1 && lots.length > 0) {
          for (const l of lots) {
            l.qty *= mult
            l.unitCostBase /= mult
          }
          if (lastPriceNative > 0) lastPriceNative /= mult
        }
        continue
      }

      const t = ev.txn
      const dk = toUtcDateKey(t.txnDate)
      const fx = lookupFx(dk, isUsd)
      const type = String(t.txnType || '').toUpperCase()
      const qty = Number(t.quantity || 0)
      const price = Number(t.pricePerUnit || 0)
      const fee = Number(t.fee || 0)
      const tax = Number(t.taxWithheld || 0)
      const totalAmt = Number(t.totalAmount || 0)

      if (type === 'BUY' && qty > 0) {
        lots.push({ qty, unitCostBase: price * fx })
        fees += fee * fx
        if (price > 0) lastPriceNative = price
      } else if (type === 'SELL' && qty > 0) {
        sellCount++
        let rem = qty
        let soldCost = 0
        while (rem > 0.0000001 && lots.length > 0) {
          const lot = lots[0]
          const take = Math.min(lot.qty, rem)
          soldCost += take * lot.unitCostBase
          lot.qty -= take
          rem -= take
          if (lot.qty <= 0.0000001) lots.shift()
        }
        const grossProceeds = qty * price * fx
        realized += grossProceeds - soldCost
        fees += (fee + tax) * fx
        if (price > 0) lastPriceNative = price
      } else if (type === 'DIVIDEND') {
        dividends += Math.max(0, (totalAmt > 0 ? totalAmt : qty * price - tax) * fx)
      } else if (type === 'FEE') {
        fees += Math.abs((totalAmt > 0 ? totalAmt : fee || qty * price) * fx)
      }
    }

    const openQty = lots.reduce((s, l) => s + l.qty, 0)
    const openCostBase = lots.reduce((s, l) => s + l.qty * l.unitCostBase, 0)
    const liveNative = liveAssetPrices.get(assetId) || lastPriceNative
    const currentValueBase =
      openQty > 0.0000001 && liveNative > 0 ? openQty * liveNative * currentFx : 0
    const unrealized = openQty > 0.0000001 ? currentValueBase - openCostBase : 0
    const netPnL = unrealized + realized + dividends - fees

    const status: AssetContributionItem['status'] =
      openQty <= 0.0000001 && sellCount > 0
        ? 'CLOSED'
        : openQty > 0.0000001 && sellCount > 0
        ? 'PARTIALLY_SOLD'
        : 'HOLDING'

    totalUnrealized += unrealized
    totalRealized += realized
    totalDividends += dividends
    totalFees += fees

    if (asset?.ticker && (Math.abs(netPnL) > 0.01 || currentValueBase > 0.01)) {
      items.push({
        assetId,
        ticker: asset.ticker,
        assetName: asset.assetName || asset.ticker,
        market: asset.market || 'US',
        realizedPnLBase: Number(realized.toFixed(2)),
        unrealizedPnLBase: Number(unrealized.toFixed(2)),
        dividendsBase: Number(dividends.toFixed(2)),
        feesBase: Number(fees.toFixed(2)),
        netPnLBase: Number(netPnL.toFixed(2)),
        currentValueBase: Number(currentValueBase.toFixed(2)),
        status,
      })
    }
  }

  const topContributors = items
    .filter((i) => i.netPnLBase > 0)
    .sort((a, b) => b.netPnLBase - a.netPnLBase)
    .slice(0, 5)

  const topDetractors = items
    .filter((i) => i.netPnLBase < 0)
    .sort((a, b) => a.netPnLBase - b.netPnLBase)
    .slice(0, 5)

  return {
    totalNetPnLBase: Number((totalUnrealized + totalRealized + totalDividends - totalFees).toFixed(2)),
    unrealizedPnLBase: Number(totalUnrealized.toFixed(2)),
    realizedPnLBase: Number(totalRealized.toFixed(2)),
    dividendsBase: Number(totalDividends.toFixed(2)),
    feesAndTaxBase: Number(totalFees.toFixed(2)),
    topContributors,
    topDetractors,
  }
}

export async function calculatePortfolioAnalytics(
  userId: string,
  baseCurrency = 'THB',
  benchmarkId: BenchmarkId = 'SP500',
  forceRefresh = false
): Promise<PortfolioAnalyticsPayload> {
  const validBenchmark = BENCHMARK_OPTIONS.some((b) => b.id === benchmarkId) ? benchmarkId : 'SP500'
  const benchMeta = getBenchmarkMeta(validBenchmark)
  const cacheKey = `${userId}_${baseCurrency}_${validBenchmark}`

  if (!forceRefresh) {
    const cached = portfolioAnalyticsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < PORTFOLIO_ANALYTICS_CACHE_TTL_MS) {
      return cached.result as PortfolioAnalyticsPayload
    }

    const inFlight = inFlightPortfolioAnalytics.get(cacheKey)
    if (inFlight) {
      return inFlight as Promise<PortfolioAnalyticsPayload>
    }
  }

  const computePromise = (async (): Promise<PortfolioAnalyticsPayload> => {
    const [holdingsResult, accounts, usdThbRateRaw] = await Promise.all([
      calculateUserHoldings(userId, baseCurrency, forceRefresh),
      prisma.investmentAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      getExchangeRate('USD', baseCurrency).catch(() => 35.5),
    ])

    const usdThbRate = usdThbRateRaw ?? 35.5
    const txns = holdingsResult.txns || []
    const totalCashReserve = await sumAccountCashInBaseCurrency(accounts, baseCurrency, usdThbRate)

    if (!txns || txns.length === 0) {
      const emptyPayload: PortfolioAnalyticsPayload = {
        hasData: false,
        baseCurrency,
        usdThbRate,
        benchmark: benchMeta,
        lastUpdated: new Date().toISOString(),
        dataSource: 'Yahoo Finance & FIFO Ledger',
        startDate: null,
        endDate: null,
        totalCashReserve: Number(totalCashReserve.toFixed(2)),
        netWorthBase: Number(totalCashReserve.toFixed(2)),
        fullHistoryXirrPercent: 0,
        deltas: {
          portfolio: { value: 0, today: { amount: 0, percent: 0 }, yesterday: { amount: 0, percent: 0 } },
          benchmark: { value: 0, today: { amount: 0, percent: 0 }, yesterday: { amount: 0, percent: 0 } },
          notInvesting: { value: 0, today: { amount: 0, percent: 0 }, yesterday: { amount: 0, percent: 0 } },
        },
        series: [],
        pnlBreakdown: {
          totalNetPnLBase: 0,
          unrealizedPnLBase: 0,
          realizedPnLBase: 0,
          dividendsBase: 0,
          feesAndTaxBase: 0,
          topContributors: [],
          topDetractors: [],
        },
      }
      portfolioAnalyticsCache.set(cacheKey, { result: emptyPayload, timestamp: Date.now() })
      return emptyPayload
    }

    // Reconcile active holdings with live quotes identically to /api/portfolio/summary
    const liveAssetPrices = new Map<string, number>()
    let liveTodayPnLBase = 0
    let reconciledTotalValueBase = 0

    await Promise.all(
      holdingsResult.holdings.map(async (h) => {
        let quote = null
        try {
          quote = await fetchLiveAssetQuote(
            {
              id: h.assetId,
              ticker: h.ticker,
              market: h.market,
              assetType: h.assetType,
            },
            forceRefresh
          )
        } catch {}

        let reconciled = h
        if (quote && quote.price > 0 && Math.abs(quote.price - h.currentPrice) > 0.0001) {
          reconciled = reconcileHoldingPrice(h, quote.price, usdThbRate)
        }

        if (reconciled.currentPrice > 0) {
          liveAssetPrices.set(h.assetId, reconciled.currentPrice)
        }
        reconciledTotalValueBase += reconciled.currentValueBase

        const changePct = quote?.changePercent ?? 0
        if (changePct > -100) {
          liveTodayPnLBase +=
            reconciled.currentValueBase - reconciled.currentValueBase / (1 + changePct / 100)
        }
      })
    )

    // Collect distinct assets from all transactions
    const assetMetaById = new Map<
      string,
      { id: string; ticker: string; market: string; assetType: string }
    >()
    let earliestTxnDateStr = toUtcDateKey(txns[0].txnDate)
    for (const t of txns) {
      const dk = toUtcDateKey(t.txnDate)
      if (dk < earliestTxnDateStr) earliestTxnDateStr = dk
      if (t.assetId && t.asset && !assetMetaById.has(t.assetId)) {
        assetMetaById.set(t.assetId, {
          id: t.assetId,
          ticker: t.asset.ticker,
          market: t.asset.market,
          assetType: t.asset.assetType,
        })
      }
    }

    const todayStr = toUtcDateKey(new Date())
    const fetchStartStr = addUtcDays(earliestTxnDateStr, -5)
    const startMs = Date.parse(`${fetchStartStr}T00:00:00.000Z`)
    const endMs = Date.now()

    const distinctAssetIds = Array.from(assetMetaById.keys())

    // Fetch FX, Benchmark, and DB PriceHistory in parallel
    const [dailyUsdThb, benchmarkDailyPrices, dbPriceRows] = await Promise.all([
      fetchDailyUsdThbRates(fetchStartStr, todayStr, usdThbRate, forceRefresh),
      fetchYahooDailySeries(benchMeta.yahooSymbol, startMs, endMs, forceRefresh, {
        skipSplitUnadjust: true,
      }),
      distinctAssetIds.length > 0
        ? prisma.priceHistory.findMany({
            where: {
              assetId: { in: distinctAssetIds },
              closePrice: { gt: 0 },
            },
            orderBy: { priceDate: 'asc' },
            select: { assetId: true, priceDate: true, closePrice: true },
          })
        : Promise.resolve([]),
    ])

    // Seed assetDailyPrices from DB PriceHistory first, then overwrite/enrich with Yahoo daily history
    const assetDailyPrices = new Map<string, Map<string, number>>()
    for (const row of dbPriceRows) {
      if (!assetDailyPrices.has(row.assetId)) {
        assetDailyPrices.set(row.assetId, new Map())
      }
      assetDailyPrices.get(row.assetId)!.set(toUtcDateKey(row.priceDate), Number(row.closePrice))
    }

    const assetList = Array.from(assetMetaById.values())
    const CHUNK_SIZE = 8
    const sortedFxKeys = Array.from(dailyUsdThb.keys()).sort()

    for (let i = 0; i < assetList.length; i += CHUNK_SIZE) {
      const chunk = assetList.slice(i, i + CHUNK_SIZE)
      await Promise.allSettled(
        chunk.map(async (asset) => {
          const resolved = resolveYahooHistorySymbol(asset)
          const yahooPrices = await fetchYahooDailySeries(
            resolved.yfSymbol,
            startMs,
            endMs,
            forceRefresh,
            {
              market: asset.market,
              skipSplitUnadjust: resolved.skipSplitUnadjust,
            }
          )

          if (yahooPrices.size === 0) return

          if (!assetDailyPrices.has(asset.id)) {
            assetDailyPrices.set(asset.id, new Map())
          }
          const targetMap = assetDailyPrices.get(asset.id)!

          for (const [d, close] of yahooPrices.entries()) {
            if (resolved.isThai965Gold) {
              let fx = dailyUsdThb.get(d)
              if (!fx) {
                for (let k = sortedFxKeys.length - 1; k >= 0; k--) {
                  if (sortedFxKeys[k] <= d) {
                    fx = dailyUsdThb.get(sortedFxKeys[k])
                    break
                  }
                }
              }
              const price965 = calculateThai965PricePerBaht(close, fx || usdThbRate)
              if (price965 > 0) targetMap.set(d, price965)
            } else {
              targetMap.set(d, close)
            }
          }
        })
      )
    }

    const effectiveSplitsByAsset = new Map<string, StockSplitEvent[]>(
      Object.entries(holdingsResult.splitsByAssetRecord || {})
    )

    const { series, deltas, xirrCashFlows } = buildDailyAnalyticsSeries({
      txns,
      effectiveSplitsByAsset,
      assetDailyPrices,
      dailyUsdThb,
      currentUsdThbRate: usdThbRate,
      baseCurrency,
      benchmarkDailyPrices,
      benchmarkCurrency: benchMeta.currency,
      liveAssetPrices,
      todayStr,
      liveTodayPnLBase: holdingsResult.holdings.length > 0 ? liveTodayPnLBase : undefined,
    })

    const fullHistoryXirrPercent =
      xirrCashFlows.length >= 2 ? calculatePortfolioXIRR(xirrCashFlows) : 0

    const pnlBreakdown = computePnLBreakdown({
      txns,
      splitsByAsset: effectiveSplitsByAsset,
      liveAssetPrices,
      dailyUsdThb,
      currentUsdThbRate: usdThbRate,
      baseCurrency,
    })

    const finalPortfolioValue =
      series.length > 0 ? series[series.length - 1].portfolioValue : reconciledTotalValueBase

    const payload: PortfolioAnalyticsPayload = {
      hasData: series.length > 0,
      baseCurrency,
      usdThbRate: Number(usdThbRate.toFixed(4)),
      benchmark: benchMeta,
      lastUpdated: new Date().toISOString(),
      dataSource: 'Yahoo Finance Daily + FIFO Ledger',
      startDate: series.length > 0 ? series[0].date : null,
      endDate: series.length > 0 ? series[series.length - 1].date : null,
      totalCashReserve: Number(totalCashReserve.toFixed(2)),
      netWorthBase: Number((finalPortfolioValue + totalCashReserve).toFixed(2)),
      fullHistoryXirrPercent,
      deltas,
      series,
      pnlBreakdown,
    }

    portfolioAnalyticsCache.set(cacheKey, { result: payload, timestamp: Date.now() })
    return payload
  })()

  inFlightPortfolioAnalytics.set(cacheKey, computePromise)
  try {
    return await computePromise
  } finally {
    inFlightPortfolioAnalytics.delete(cacheKey)
  }
}
