/**
 * lib/news/fetch-news.ts
 * Fetches market and company news from Finnhub or Yahoo Finance RSS and persists to database with deduplication.
 */

import { prisma } from '@/lib/prisma'

interface RawNewsItem {
  category?: string
  datetime: number
  headline: string
  id?: number
  image?: string
  related?: string
  source: string
  summary?: string
  url: string
}

async function fetchYahooRssNews(tickers: string[] = []): Promise<RawNewsItem[]> {
  try {
    const symbolQuery = tickers.length > 0 ? tickers.join(',') : '^GSPC,^IXIC,^DJI,SPY,QQQ'
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbolQuery)}&region=US&lang=en-US`

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      next: { revalidate: 1800 },
    })

    if (!res.ok) return []
    const xml = await res.text()

    const items: RawNewsItem[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1]
      const headline =
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        block.match(/<title>(.*?)<\/title>/)?.[1]
      const url = block.match(/<link>(.*?)<\/link>/)?.[1]
      const pubDateStr = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
      const summary =
        block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
        block.match(/<description>(.*?)<\/description>/)?.[1]
      const source =
        block.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || 'Yahoo Finance'

      if (headline && url) {
        const datetime = pubDateStr ? Math.floor(new Date(pubDateStr).getTime() / 1000) : Math.floor(Date.now() / 1000)
        items.push({
          headline: headline.trim(),
          url: url.trim(),
          datetime,
          summary: summary ? summary.trim() : undefined,
          source: source.trim(),
        })
      }
    }

    return items
  } catch (err) {
    console.warn('[News] Yahoo RSS fetch error:', err)
    return []
  }
}

export async function fetchMarketNews(): Promise<number> {
  const apiKey = process.env.FINNHUB_API_KEY
  let items: RawNewsItem[] = []

  if (apiKey) {
    try {
      const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
      const res = await fetch(url, { next: { revalidate: 1800 } })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json)) items = json
      }
    } catch {
      // fallback to Yahoo RSS
    }
  }

  // Fallback to Yahoo RSS if Finnhub is unavailable or key is missing
  if (items.length === 0) {
    items = await fetchYahooRssNews(['^GSPC', '^IXIC', '^DJI', 'SPY', 'VOO', 'QQQ'])
  }

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
      // Skip duplicate
    }
  }

  return addedCount
}

export async function fetchCompanyNews(symbol: string): Promise<number> {
  const cleanSymbol = symbol.trim().toUpperCase()
  const apiKey = process.env.FINNHUB_API_KEY
  let items: RawNewsItem[] = []

  if (apiKey) {
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(cleanSymbol)}&from=${fromDate}&to=${toDate}&token=${apiKey}`
      const res = await fetch(url, { next: { revalidate: 1800 } })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json)) items = json
      }
    } catch {
      // fallback to Yahoo RSS
    }
  }

  // Fallback to Yahoo Finance RSS for the specific company ticker
  if (items.length === 0) {
    items = await fetchYahooRssNews([cleanSymbol])
  }

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
}

