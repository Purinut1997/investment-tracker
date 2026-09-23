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
  forwardPe: number | null
  pb: number | null
  evEbitda: number | null
  marketCap: number | null
  dividendYield: number | null
  payoutRatio: number | null
  revenue: number | null
  revenueGrowth: number | null
  eps: number | null
  freeCashflow: number | null
} | null> {
  try {
    const auth = await getYahooAuth()
    if (!auth) return null

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?crumb=${encodeURIComponent(auth.crumb)}&modules=summaryDetail,defaultKeyStatistics,financialData`

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
    const financial = summary.financialData || {}

    const pe = detail.trailingPE?.raw ?? stats.trailingPE?.raw ?? null
    const forwardPe = detail.forwardPE?.raw ?? stats.forwardPE?.raw ?? null
    const pb = stats.priceToBook?.raw ?? null
    const evEbitda = stats.enterpriseToEbitda?.raw ?? null
    const marketCap = detail.marketCap?.raw ?? stats.enterpriseValue?.raw ?? null
    const dividendYield = detail.dividendYield?.raw ?? detail.trailingAnnualDividendYield?.raw ?? null
    const payoutRatio = detail.payoutRatio?.raw ?? null

    const revenue = financial.totalRevenue?.raw ?? null
    const revenueGrowth = financial.revenueGrowth?.raw ?? null
    const eps = stats.trailingEps?.raw ?? financial.revenuePerShare?.raw ?? null
    const freeCashflow = financial.freeCashflow?.raw ?? financial.operatingCashflow?.raw ?? null

    return {
      pe: pe ? Number(pe) : null,
      forwardPe: forwardPe ? Number(forwardPe) : null,
      pb: pb ? Number(pb) : null,
      evEbitda: evEbitda ? Number(evEbitda) : null,
      marketCap: marketCap ? Number(marketCap) : null,
      dividendYield: dividendYield ? Number(dividendYield) * 100 : null, // percentage
      payoutRatio: payoutRatio ? Number(payoutRatio) * 100 : null, // percentage
      revenue: revenue ? Number(revenue) : null,
      revenueGrowth: revenueGrowth ? Number(revenueGrowth) * 100 : null, // percentage
      eps: eps ? Number(eps) : null,
      freeCashflow: freeCashflow ? Number(freeCashflow) : null,
    }
  } catch {
    return null
  }
}
