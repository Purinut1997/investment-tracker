/**
 * POST /api/portfolio/refresh-prices
 * Force refreshes live market closing prices from Yahoo Finance for all active assets in user's portfolio.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { stooqProvider } from '@/lib/market-data/stooq'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Fetch user's active assets from transactions
    const txns = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      include: { asset: true },
    })

    if (txns.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, prices: [] })
    }

    // Determine assets that have active quantity
    const quantityMap = new Map<string, { asset: any; qty: number }>()
    for (const t of txns) {
      const aid = t.assetId
      if (!quantityMap.has(aid)) {
        quantityMap.set(aid, { asset: t.asset, qty: 0 })
      }
      const item = quantityMap.get(aid)!
      const q = Number(t.quantity)
      if (t.txnType === 'BUY') item.qty += q
      else if (t.txnType === 'SELL') item.qty = Math.max(0, item.qty - q)
    }

    const activeAssets = Array.from(quantityMap.values())
      .filter((i) => i.qty > 0.00001)
      .map((i) => i.asset)

    const dateKey = new Date()
    dateKey.setUTCHours(0, 0, 0, 0)

    const updatedPrices: Array<{
      ticker: string
      market: string
      currency: string
      price: number
      change: number
      changePercent: number
      source: string
    }> = []

    for (const asset of activeAssets) {
      try {
        let quote: any = null

        if (asset.market === 'CRYPTO' || asset.assetType === 'crypto') {
          quote = await coinGeckoProvider.getQuote(asset.ticker)
        } else if (asset.market === 'TH' || asset.ticker.endsWith('.BK')) {
          quote = await yahooFinanceProvider.getQuote(asset.ticker, 'TH')
          if (!quote) quote = await stooqProvider.getQuote(asset.ticker, 'TH')
        } else {
          // US / Global
          quote = await yahooFinanceProvider.getQuote(asset.ticker, 'US')
          if (!quote) quote = await stooqProvider.getQuote(`${asset.ticker}.US`, 'US')
        }

        if (quote && quote.price > 0) {
          // Upsert into PriceHistory
          await prisma.priceHistory.upsert({
            where: {
              assetId_priceDate: {
                assetId: asset.id,
                priceDate: dateKey,
              },
            },
            update: {
              closePrice: quote.price,
              sourceProvider: quote.provider || 'yahoo',
            },
            create: {
              assetId: asset.id,
              priceDate: dateKey,
              closePrice: quote.price,
              sourceProvider: quote.provider || 'yahoo',
            },
          })

          // Ensure asset has correct currency and market
          if (asset.market === 'US' && asset.currency !== 'USD') {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { currency: 'USD' },
            })
          }

          updatedPrices.push({
            ticker: asset.ticker,
            market: asset.market,
            currency: quote.currency || (asset.market === 'US' ? 'USD' : 'THB'),
            price: quote.price,
            change: quote.change || 0,
            changePercent: quote.changePercent || 0,
            source: quote.provider || 'yahoo',
          })
        }
      } catch (assetError) {
        console.error(`[refresh-prices] Failed for ${asset.ticker}:`, assetError)
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedPrices.length,
      prices: updatedPrices,
    })
  } catch (error) {
    console.error('[refresh-prices POST]', error)
    return NextResponse.json({ error: 'Failed to refresh prices' }, { status: 500 })
  }
}
