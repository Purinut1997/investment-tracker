/**
 * lib/news/fetch-news.ts
 * Fetches market and company news from Finnhub and persists to database with deduplication.
 */

import { prisma } from '@/lib/prisma'

interface RawNewsItem {
  category?: string
  datetime: number
  headline: string
  id: number
  image?: string
  related?: string
  source: string
  summary?: string
  url: string
}

export async function fetchMarketNews(): Promise<number> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.warn('[News] FINNHUB_API_KEY is not set. Skipping live news fetch.')
    return 0
  }

  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 1800 } })

    if (!res.ok) {
      console.warn(`[News] Finnhub returned status ${res.status}`)
      return 0
    }

    const items: RawNewsItem[] = await res.json()
    if (!Array.isArray(items)) return 0

    let addedCount = 0

    for (const item of items.slice(0, 30)) {
      if (!item.url || !item.headline) continue

      try {
        await prisma.newsItem.upsert({
          where: { sourceUrl: item.url },
          update: {
            headline: item.headline,
            summary: item.summary || null,
          },
          create: {
            symbol: null, // general market news
            headline: item.headline,
            summary: item.summary || null,
            sourceName: item.source || 'Market News',
            sourceUrl: item.url,
            publishedAt: new Date(item.datetime ? item.datetime * 1000 : Date.now()),
            fetchedAt: new Date(),
          },
        })
        addedCount++
      } catch {
        // Skip duplicate or constraint failure silently
      }
    }

    return addedCount
  } catch (error) {
    console.error('[News] Error fetching market news:', error)
    return 0
  }
}

export async function fetchCompanyNews(symbol: string): Promise<number> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return 0

  const toDate = new Date().toISOString().split('T')[0]
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const cleanSymbol = symbol.trim().toUpperCase()

  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(cleanSymbol)}&from=${fromDate}&to=${toDate}&token=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 1800 } })

    if (!res.ok) return 0

    const items: RawNewsItem[] = await res.json()
    if (!Array.isArray(items)) return 0

    let count = 0
    for (const item of items.slice(0, 15)) {
      if (!item.url || !item.headline) continue
      try {
        await prisma.newsItem.upsert({
          where: { sourceUrl: item.url },
          update: {},
          create: {
            symbol: cleanSymbol,
            headline: item.headline,
            summary: item.summary || null,
            sourceName: item.source || cleanSymbol,
            sourceUrl: item.url,
            publishedAt: new Date(item.datetime ? item.datetime * 1000 : Date.now()),
            fetchedAt: new Date(),
          },
        })
        count++
      } catch {
        // Skip duplicate
      }
    }

    return count
  } catch (error) {
    console.error(`[News] Error fetching company news for ${symbol}:`, error)
    return 0
  }
}
