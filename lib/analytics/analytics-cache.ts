/**
 * lib/analytics/analytics-cache.ts
 * Zero-dependency in-memory cache registry for Portfolio Analytics to avoid circular imports.
 */

export const PORTFOLIO_ANALYTICS_CACHE_TTL_MS = 60 * 1000

export const portfolioAnalyticsCache = new Map<string, { result: any; timestamp: number }>()
export const inFlightPortfolioAnalytics = new Map<string, Promise<any>>()

export function invalidatePortfolioAnalyticsCache(userId?: string) {
  for (const cache of [portfolioAnalyticsCache, inFlightPortfolioAnalytics]) {
    if (!userId) cache.clear()
    else for (const key of cache.keys()) {
      if (key.startsWith(`${userId}_`)) cache.delete(key)
    }
  }
}
