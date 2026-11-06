/**
 * lib/market-data/price-sync.test.ts
 * Tests for market-aware quote caching, forceRefresh bypass, cache invalidation,
 * and consistent holding price/P&L reconciliation.
 */

import assert from 'assert'
import { YahooFinanceProvider } from './yahoo'
import { CoinGeckoProvider } from './coingecko'
import {
  fetchSingleTickerTechnicalSignal,
  invalidateTechnicalCache,
} from './technical-signals'
import { resolveMarketQuote } from './resolver'
import { invalidatePriceCache } from './cache-layer'
import { reconcileHoldingPrice } from '../analytics/holdings'

async function runTests() {
  console.log('🧪 Starting Price Sync & Cache Invalidation Unit Tests...\n')

  const originalFetch = global.fetch

  try {
    // ── Test 1: YahooFinanceProvider separates US vs TH market cache & normalizes .BK ──
    {
      let fetchCalls: string[] = []
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url)
        fetchCalls.push(urlStr)
        const isThai = urlStr.includes('.BK')
        const price = isThai ? 110.5 : 42.0
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: price,
                    previousClose: price - 1,
                    shortName: isThai ? 'SCB Thailand' : 'SCB US',
                  },
                },
              ],
            },
          }),
          { status: 200 }
        )
      }) as typeof fetch

      const provider = new YahooFinanceProvider()
      const usQuote = await provider.getQuote('SCB', 'US')
      const thQuote = await provider.getQuote('SCB', 'TH')
      const thDotBkQuote = await provider.getQuote('SCB.BK', 'TH')

      assert.strictEqual(usQuote?.price, 42.0, 'US quote should have US price 42.0')
      assert.strictEqual(thQuote?.price, 110.5, 'TH quote should not collide with US cache and should return 110.5')
      assert.strictEqual(thDotBkQuote?.price, 110.5, 'SCB.BK and SCB (TH) should share normalized cache')
      assert.strictEqual(fetchCalls.length, 2, 'Should have fetched once for US and once for TH (.BK shared)')
      console.log('✅ Test 1 Passed: YahooFinanceProvider isolates US vs TH cache and normalizes .BK')
    }

    // ── Test 2: YahooFinanceProvider & CoinGeckoProvider honor forceRefresh=true ──
    {
      let currentYahooPrice = 200
      let currentBtcPrice = 60000

      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url)
        if (urlStr.includes('coingecko')) {
          return new Response(
            JSON.stringify({
              bitcoin: {
                usd: currentBtcPrice,
                usd_24h_change: 2.5,
              },
            }),
            { status: 200 }
          )
        }
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: currentYahooPrice,
                    previousClose: 195,
                    shortName: 'Apple Inc.',
                  },
                },
              ],
            },
          }),
          { status: 200 }
        )
      }) as typeof fetch

      const yf = new YahooFinanceProvider()
      const cg = new CoinGeckoProvider()

      const q1 = await yf.getQuote('AAPL', 'US')
      const c1 = await cg.getQuote('BTC')
      assert.strictEqual(q1?.price, 200)
      assert.strictEqual(c1?.price, 60000)

      // Market prices move
      currentYahooPrice = 215.75
      currentBtcPrice = 64500

      // Cached calls without forceRefresh should still return cached prices
      const qCached = await yf.getQuote('AAPL', 'US', false)
      const cCached = await cg.getQuote('BTC', false)
      assert.strictEqual(qCached?.price, 200, 'Should return cached Yahoo price when forceRefresh=false')
      assert.strictEqual(cCached?.price, 60000, 'Should return cached CoinGecko price when forceRefresh=false')

      // Calls with forceRefresh=true MUST bypass memory cache and return latest price
      const qFresh = await yf.getQuote('AAPL', 'US', true)
      const cFresh = await cg.getQuote('BTC', true)
      assert.strictEqual(qFresh?.price, 215.75, 'forceRefresh=true must fetch new Yahoo price 215.75')
      assert.strictEqual(cFresh?.price, 64500, 'forceRefresh=true must fetch new CoinGecko price 64500')
      console.log('✅ Test 2 Passed: YahooFinanceProvider & CoinGeckoProvider bypass cache on forceRefresh=true')
    }

    // ── Test 3: Technical signals cache invalidation & forceRefresh ──
    {
      let techPrice = 150
      global.fetch = (async () => {
        const closes = Array.from({ length: 30 }, () => techPrice)
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: techPrice,
                    previousClose: techPrice - 2,
                    fiftyTwoWeekHigh: 180,
                    fiftyTwoWeekLow: 120,
                  },
                  indicators: {
                    quote: [
                      {
                        close: closes,
                        high: closes.map((c) => c + 2),
                        low: closes.map((c) => c - 2),
                      },
                    ],
                  },
                },
              ],
            },
          }),
          { status: 200 }
        )
      }) as typeof fetch

      invalidateTechnicalCache()
      const sig1 = await fetchSingleTickerTechnicalSignal('NVDA', 'US')
      assert.strictEqual(sig1.currentPrice, 150)

      techPrice = 168.5
      const sigCached = await fetchSingleTickerTechnicalSignal('NVDA', 'US')
      assert.strictEqual(sigCached.currentPrice, 150, 'Should return cached technical signal')

      invalidateTechnicalCache()
      const sigAfterClear = await fetchSingleTickerTechnicalSignal('NVDA', 'US')
      assert.strictEqual(sigAfterClear.currentPrice, 168.5, 'Should fetch fresh technical signal after cache invalidation')
      console.log('✅ Test 3 Passed: Technical signals cache invalidates properly')
    }

    // ── Test 4: reconcileHoldingPrice keeps currentPrice, currentValue, and P&L % linked ──
    {
      const holding = {
        assetId: 'a1',
        ticker: 'NVDA',
        assetName: 'NVIDIA Corp',
        market: 'US',
        assetType: 'stock',
        currency: 'USD',
        quantity: 10,
        avgCost: 100,
        totalCost: 1000,
        currentPrice: 120,
        currentValue: 1200,
        currentValueBase: 42000,
        unrealizedPnL: 200,
        unrealizedPnLBase: 7000,
        unrealizedPnLPercent: 20,
        allocationPercent: 50,
        isStale: true,
      }

      const updated = reconcileHoldingPrice(holding, 150, 35)
      assert.strictEqual(updated.currentPrice, 150)
      assert.strictEqual(updated.currentValue, 1500)
      assert.strictEqual(updated.currentValueBase, 52500)
      assert.strictEqual(updated.unrealizedPnL, 500)
      assert.strictEqual(updated.unrealizedPnLBase, 17500)
      assert.strictEqual(updated.unrealizedPnLPercent, 50)
      assert.strictEqual(updated.isStale, false)
      console.log('✅ Test 4 Passed: reconcileHoldingPrice updates value, base value, and P&L % consistently')
    }

    // ── Test 5: invalidatePriceCache() clears Yahoo, CoinGecko, Resolver, and Technical caches ──
    {
      let livePrice = 300
      global.fetch = (async () => {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: livePrice,
                    previousClose: 295,
                    shortName: 'Microsoft Corp',
                  },
                },
              ],
            },
          }),
          { status: 200 }
        )
      }) as typeof fetch

      invalidatePriceCache()
      const r1 = await resolveMarketQuote('MSFT', 'stock', 'US')
      assert.strictEqual(r1.quote?.price, 300)

      livePrice = 312.5
      // Without invalidating, resolverCache returns 300
      const rCached = await resolveMarketQuote('MSFT', 'stock', 'US')
      assert.strictEqual(rCached.quote?.price, 300)

      // Calling global invalidatePriceCache() must clear both resolverCache and yahooFinanceProvider cache
      invalidatePriceCache()
      const rFresh = await resolveMarketQuote('MSFT', 'stock', 'US')
      assert.strictEqual(
        rFresh.quote?.price,
        312.5,
        'invalidatePriceCache() must clear resolverCache and provider caches so resolveMarketQuote gets 312.5'
      )
      console.log('✅ Test 5 Passed: invalidatePriceCache() clears all downstream quote & resolver caches')
    }

    console.log('\n🎉 ALL PRICE SYNC UNIT TESTS PASSED!')
  } finally {
    global.fetch = originalFetch
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
