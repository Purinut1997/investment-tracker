/**
 * lib/market-data/yahoo-crumb.ts
 * Manages cached Yahoo Finance cookie and crumb session for quoteSummary & statistics.
 */

interface YahooAuth {
  cookie: string
  crumb: string
  expiresAt: number
}

let cachedAuth: YahooAuth | null = null

export async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
  const now = Date.now()
  if (cachedAuth && cachedAuth.expiresAt > now) {
    return { cookie: cachedAuth.cookie, crumb: cachedAuth.crumb }
  }

  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    })
    const cookieHeader = cookieRes.headers.get('set-cookie')
    if (!cookieHeader) return null
    const cookie = cookieHeader.split(';')[0]

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Cookie: cookie,
      },
    })
    if (!crumbRes.ok) return null
    const crumb = await crumbRes.text()
    if (!crumb || crumb.includes('html')) return null

    cachedAuth = {
      cookie,
      crumb,
      expiresAt: now + 60 * 60 * 1000, // cache for 1 hour
    }

    return { cookie, crumb }
  } catch (err) {
    console.warn('[YahooAuth] Failed to acquire Yahoo crumb session:', err)
    return null
  }
}

export async function getYahooQuoteSummary(symbol: string): Promise<{
  pe: number | null
  marketCap: number | null
  dividendYield: number | null
} | null> {
  try {
    const auth = await getYahooAuth()
    if (!auth) return null

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?crumb=${encodeURIComponent(auth.crumb)}&modules=summaryDetail,defaultKeyStatistics`

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Cookie: auth.cookie,
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return null
    const json = await res.json()
    const summary = json?.quoteSummary?.result?.[0]
    if (!summary) return null

    const detail = summary.summaryDetail || {}
    const stats = summary.defaultKeyStatistics || {}

    const pe = detail.trailingPE?.raw ?? stats.trailingPE?.raw ?? detail.forwardPE?.raw ?? null
    const marketCap = detail.marketCap?.raw ?? stats.enterpriseValue?.raw ?? null
    const dividendYield = detail.dividendYield?.raw ?? detail.trailingAnnualDividendYield?.raw ?? null

    return {
      pe: pe ? Number(pe) : null,
      marketCap: marketCap ? Number(marketCap) : null,
      dividendYield: dividendYield ? Number(dividendYield) * 100 : null, // percentage
    }
  } catch {
    return null
  }
}
