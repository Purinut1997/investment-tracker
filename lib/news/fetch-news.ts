/**
 * lib/news/fetch-news.ts
 * Fetches market and company news from Finnhub, Yahoo Finance RSS, and Google News RSS,
 * persists fresh items to the database with deduplication, and prunes stale news.
 */

import { prisma } from '@/lib/prisma'
import { detectSentiment, isHeadlineRelevantToTicker } from '@/lib/news/news-analyzer'

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
  fromDedicatedTickerFeed?: boolean
}

const MAX_NEWS_AGE_MS = 7 * 24 * 60 * 60 * 1000 // Only ingest news published within the last 7 days

const KNOWN_THAI_TICKERS = new Set([
  'SCB', 'KBANK', 'BBL', 'KTB', 'TTB', 'TISCO', 'KKP',
  'PTT', 'PTTEP', 'PTTGC', 'TOP', 'OR', 'GULF', 'GPSC', 'BGRIM', 'EA', 'BANPU',
  'ADVANC', 'TRUE', 'INTUCH', 'DELTA', 'HANA', 'KCE',
  'AOT', 'BDMS', 'BH', 'CPALL', 'CPAXT', 'CRC', 'HMPRO', 'MINT', 'CENTEL',
  'SCC', 'SCGP', 'CPN', 'LH', 'AP', 'SIRI', 'SPALI', 'WHA', 'AMATA',
])

function cleanHtmlText(str: string): string {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x2019;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchGenericRss(
  url: string,
  defaultSource: string,
  fromDedicatedTickerFeed: boolean = false
): Promise<RawNewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    })

    if (!res.ok) return []
    const xml = await res.text()

    const items: RawNewsItem[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null
    const nowMs = Date.now()

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1]
      const rawHeadline =
        block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
        block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
      const link =
        block.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/)?.[1] ||
        block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ||
        block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]
      const pubDateStr = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]
      const rawSummary =
        block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
        block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      const source =
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ||
        block.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/)?.[1] ||
        defaultSource

      if (rawHeadline && link) {
        const parsedTimeMs = pubDateStr ? new Date(pubDateStr.trim()).getTime() : nowMs
        const validTimeMs = !Number.isNaN(parsedTimeMs) ? parsedTimeMs : nowMs

        // Skip stale items older than 7 days
        if (nowMs - validTimeMs > MAX_NEWS_AGE_MS) {
          continue
        }

        const headline = cleanHtmlText(rawHeadline)
        const summary = rawSummary ? cleanHtmlText(rawSummary) : undefined

        items.push({
          headline,
          url: link.trim(),
          datetime: Math.floor(validTimeMs / 1000),
          summary: summary && summary !== headline ? summary : undefined,
          source: cleanHtmlText(source) || defaultSource,
          fromDedicatedTickerFeed,
        })
      }
    }

    return items
  } catch (err) {
    console.warn(`[News] Generic RSS fetch error from ${defaultSource}:`, err)
    return []
  }
}

async function fetchYahooRssNews(
  tickers: string[] = [],
  fromDedicatedTickerFeed: boolean = false
): Promise<RawNewsItem[]> {
  try {
    const symbolQuery = tickers.length > 0 ? tickers.join(',') : '^GSPC,^IXIC,^DJI,SPY,QQQ'
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbolQuery)}&region=US&lang=en-US`
    return await fetchGenericRss(url, 'Yahoo Finance', fromDedicatedTickerFeed)
  } catch (err) {
    console.warn('[News] Yahoo RSS fetch error:', err)
    return []
  }
}

async function fetchGoogleNewsForSymbol(symbol: string, isThai: boolean): Promise<RawNewsItem[]> {
  try {
    const cleanSym = symbol.toUpperCase().replace(/\.BK$/i, '')
    const query = isThai
      ? `หุ้น ${cleanSym} when:7d`
      : `${cleanSym} stock OR ETF when:7d`
    const url = isThai
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

    return await fetchGenericRss(url, 'Google News', true)
  } catch (err) {
    console.warn(`[News] Google News RSS fetch error for ${symbol}:`, err)
    return []
  }
}

export async function pruneStaleNews(maxAgeDays: number = 7): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
    const deleted = await prisma.newsItem.deleteMany({
      where: {
        publishedAt: {
          lt: cutoff,
        },
      },
    })
    return deleted.count
  } catch (err) {
    console.warn('[News] Failed to prune stale news:', err)
    return 0
  }
}

export async function fetchMarketNews(): Promise<number> {
  const apiKey = process.env.FINNHUB_API_KEY
  let items: RawNewsItem[] = []
  const nowMs = Date.now()

  if (apiKey) {
    try {
      const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json)) {
          items = json.filter(
            (i: RawNewsItem) => !i.datetime || nowMs - i.datetime * 1000 <= MAX_NEWS_AGE_MS
          )
        }
      }
    } catch {
      // fallback to RSS
    }
  }

  // Fetch macro & market news from CNBC Economy and MarketWatch
  const [cnbcEconomy, marketWatch] = await Promise.all([
    fetchGenericRss('https://www.cnbc.com/id/20910258/device/rss/rss.html', 'CNBC Economy'),
    fetchGenericRss('https://feeds.content.dowjones.io/public/rss/mw_topstories', 'MarketWatch'),
  ])

  items.push(...cnbcEconomy, ...marketWatch)

  if (items.length < 10) {
    const yahooItems = await fetchYahooRssNews(['^GSPC', '^IXIC', '^DJI', 'SPY', 'VOO', 'QQQ'], false)
    items.push(...yahooItems)
  }

  let addedCount = 0
  for (const item of items.slice(0, 30)) {
    if (!item.url || !item.headline) continue
    const pubMs = item.datetime ? item.datetime * 1000 : nowMs
    if (nowMs - pubMs > MAX_NEWS_AGE_MS) continue

    try {
      const sentiment = detectSentiment(item.headline, item.summary)
      await prisma.newsItem.upsert({
        where: { sourceUrl: item.url },
        update: {
          headline: item.headline,
          summary: item.summary || null,
          sentiment,
          fetchedAt: new Date(),
        },
        create: {
          symbol: null, // general market news
          headline: item.headline,
          summary: item.summary || null,
          sourceName: item.source || 'Market News',
          sourceUrl: item.url,
          publishedAt: new Date(pubMs),
          sentiment,
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

export async function fetchCompanyNews(symbol: string, marketHint?: string): Promise<number> {
  const cleanSymbol = symbol.trim().toUpperCase().replace(/\.BK$/i, '')
  const isThai =
    marketHint?.toUpperCase() === 'TH' ||
    marketHint?.toUpperCase() === 'SET' ||
    symbol.toUpperCase().endsWith('.BK') ||
    KNOWN_THAI_TICKERS.has(cleanSymbol)

  const apiKey = process.env.FINNHUB_API_KEY
  let items: RawNewsItem[] = []
  const nowMs = Date.now()

  if (!isThai && apiKey) {
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(nowMs - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(cleanSymbol)}&from=${fromDate}&to=${toDate}&token=${apiKey}`
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json)) {
          items = json
            .filter((i: RawNewsItem) => !i.datetime || nowMs - i.datetime * 1000 <= MAX_NEWS_AGE_MS)
            .map((i: RawNewsItem) => ({ ...i, fromDedicatedTickerFeed: false }))
        }
      }
    } catch {
      // fallback to RSS
    }
  }

  // Fetch from Yahoo Finance RSS for US tickers or Google News RSS for Thai tickers
  if (isThai) {
    const thaiGoogleItems = await fetchGoogleNewsForSymbol(cleanSymbol, true)
    items.push(...thaiGoogleItems)
  } else {
    const yahooItems = await fetchYahooRssNews([cleanSymbol], true)
    items.push(...yahooItems)

    if (items.length < 2) {
      const googleFallback = await fetchGoogleNewsForSymbol(cleanSymbol, false)
      items.push(...googleFallback)
    }
  }

  let count = 0
  for (const item of items.slice(0, 12)) {
    if (!item.url || !item.headline) continue
    const pubMs = item.datetime ? item.datetime * 1000 : nowMs
    if (nowMs - pubMs > MAX_NEWS_AGE_MS) continue

    try {
      // If fetched from a dedicated single-ticker RSS feed, directly tag with cleanSymbol.
      // Otherwise check headline/summary relevance.
      const isRelevant =
        item.fromDedicatedTickerFeed ||
        isHeadlineRelevantToTicker(item.headline, cleanSymbol, item.summary)
      const assignedSymbol = isRelevant ? cleanSymbol : null
      const sentiment = detectSentiment(item.headline, item.summary)

      await prisma.newsItem.upsert({
        where: { sourceUrl: item.url },
        update: {
          headline: item.headline,
          summary: item.summary || null,
          sentiment,
          fetchedAt: new Date(),
          ...(isRelevant ? { symbol: cleanSymbol } : {}),
        },
        create: {
          symbol: assignedSymbol,
          headline: item.headline,
          summary: item.summary || null,
          sourceName: item.source || cleanSymbol,
          sourceUrl: item.url,
          publishedAt: new Date(pubMs),
          sentiment,
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

export async function refreshPortfolioAndMarketNews(
  holdings: Array<{ ticker: string; market?: string; currency?: string }>
): Promise<{ prunedCount: number; marketCount: number; companyCount: number }> {
  const prunedCount = await pruneStaleNews(7)

  const uniqueHoldings = Array.from(
    new Map(
      holdings.map((h) => [
        h.ticker.trim().toUpperCase(),
        {
          ticker: h.ticker.trim().toUpperCase(),
          marketHint: h.market || (h.currency === 'THB' ? 'TH' : 'US'),
        },
      ])
    ).values()
  ).slice(0, 30)

  const [marketRes, ...companyResults] = await Promise.allSettled([
    fetchMarketNews(),
    ...uniqueHoldings.map((h) => fetchCompanyNews(h.ticker, h.marketHint)),
  ])

  const marketCount = marketRes.status === 'fulfilled' ? marketRes.value : 0
  const companyCount = companyResults.reduce(
    (sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0),
    0
  )

  return { prunedCount, marketCount, companyCount }
}
