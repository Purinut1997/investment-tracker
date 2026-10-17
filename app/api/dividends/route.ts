import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { getDividendIntelligence, AnalyzedDividendData } from '@/lib/dividends/dividend-analyzer'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

export interface PortfolioDividendItem {
  holding: {
    assetId: string
    ticker: string
    assetName: string
    market: 'TH' | 'US'
    currency: string
    quantity: number
    avgCost: number
    currentPrice: number
    currentValue: number
    currentValueBase: number
  }
  dividendData: AnalyzedDividendData
  userMetrics: {
    estimatedNextPayout: number
    estimatedNextPayoutBase: number
    annualEstimatedIncome: number
    annualEstimatedIncomeBase: number
    yieldOnCostPercent: number
    dividendYieldPercent: number
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const searchTicker = searchParams.get('search')
  const searchMarket = (searchParams.get('market') || 'US').toUpperCase() as 'TH' | 'US'
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const usdThbRate = (await getExchangeRate('USD', baseCurrency)) ?? 35.5

    // Case 1: Search for an individual stock (even if not in portfolio)
    if (searchTicker && searchTicker.trim()) {
      const cleanTicker = searchTicker.trim().toUpperCase()
      const analyzed = await getDividendIntelligence(cleanTicker, searchMarket, forceRefresh)

      if (!analyzed) {
        return NextResponse.json({ error: `Not found dividend data for ${cleanTicker}` }, { status: 404 })
      }

      // Check if user also owns this stock
      const portfolioResult = await calculateUserHoldings(session.user.id, baseCurrency)
      const existingHolding = portfolioResult.holdings.find(
        (h) => h.ticker.toUpperCase() === cleanTicker
      )

      let userHoldingMetrics = null
      if (existingHolding) {
        const fx = existingHolding.currency === 'THB' ? 1 : usdThbRate
        const nextAmt = analyzed.upcomingDividend.estimatedAmount * existingHolding.quantity
        const annualAmt =
          (analyzed.latestDividend?.amount || 0) * analyzed.frequency.timesPerYear * existingHolding.quantity

        userHoldingMetrics = {
          quantity: existingHolding.quantity,
          avgCost: existingHolding.avgCost,
          currentValue: existingHolding.currentValue,
          estimatedNextPayout: Number(nextAmt.toFixed(2)),
          estimatedNextPayoutBase: Number((nextAmt * fx).toFixed(2)),
          annualEstimatedIncome: Number(annualAmt.toFixed(2)),
          annualEstimatedIncomeBase: Number((annualAmt * fx).toFixed(2)),
          yieldOnCostPercent:
            existingHolding.avgCost > 0
              ? Number(
                  (
                    (((analyzed.latestDividend?.amount || 0) * analyzed.frequency.timesPerYear) /
                      existingHolding.avgCost) *
                    100
                  ).toFixed(2)
                )
              : 0,
        }
      }

      return NextResponse.json({
        data: analyzed,
        userHolding: userHoldingMetrics,
      })
    }

    // Case 2: Load user's portfolio dividend calendar and XD intelligence
    const portfolioResult = await calculateUserHoldings(session.user.id, baseCurrency, forceRefresh)
    const stockHoldings = portfolioResult.holdings.filter((h) => {
      // Filter stocks or ETFs with remaining quantity > 0
      const type = (h.assetType || '').toLowerCase()
      return (type === 'stock' || type === 'fund' || type === 'etf' || !type) && h.quantity > 0.0001
    })

    const dividendItems: PortfolioDividendItem[] = []
    let totalPortfolioAnnualIncomeBase = 0
    let totalNextExpectedPayoutBase = 0

    // Fetch and analyze each stock holding in parallel
    const analysisPromises = stockHoldings.map(async (holding) => {
      const market = holding.market === 'TH' ? 'TH' : 'US'
      const dividendData = await getDividendIntelligence(holding.ticker, market, forceRefresh)
      return { holding, dividendData }
    })

    const results = await Promise.all(analysisPromises)

    for (const { holding, dividendData } of results) {
      if (!dividendData) continue

      const fxRate = holding.currency === 'THB' ? 1 : usdThbRate
      const nextPayoutPerShare = dividendData.upcomingDividend.estimatedAmount || 0
      const estimatedNextPayout = Number((holding.quantity * nextPayoutPerShare).toFixed(2))
      const estimatedNextPayoutBase = Number((estimatedNextPayout * fxRate).toFixed(2))

      const annualPerShare = (dividendData.latestDividend?.amount || 0) * dividendData.frequency.timesPerYear
      const annualEstimatedIncome = Number((holding.quantity * annualPerShare).toFixed(2))
      const annualEstimatedIncomeBase = Number((annualEstimatedIncome * fxRate).toFixed(2))

      const yieldOnCostPercent =
        holding.avgCost > 0 ? Number(((annualPerShare / holding.avgCost) * 100).toFixed(2)) : 0

      const dividendYieldPercent =
        holding.currentPrice > 0 ? Number(((annualPerShare / holding.currentPrice) * 100).toFixed(2)) : 0

      totalPortfolioAnnualIncomeBase += annualEstimatedIncomeBase

      // Only count next payout if it's within 60 days
      if (dividendData.upcomingDividend.daysRemaining <= 60) {
        totalNextExpectedPayoutBase += estimatedNextPayoutBase
      }

      dividendItems.push({
        holding: {
          assetId: holding.assetId,
          ticker: holding.ticker,
          assetName: holding.assetName,
          market: holding.market === 'TH' ? 'TH' : 'US',
          currency: holding.currency,
          quantity: holding.quantity,
          avgCost: holding.avgCost,
          currentPrice: holding.currentPrice,
          currentValue: holding.currentValue,
          currentValueBase: holding.currentValueBase,
        },
        dividendData,
        userMetrics: {
          estimatedNextPayout,
          estimatedNextPayoutBase,
          annualEstimatedIncome,
          annualEstimatedIncomeBase,
          yieldOnCostPercent,
          dividendYieldPercent,
        },
      })
    }

    // Sort by nearest upcoming Ex-Dividend date
    dividendItems.sort(
      (a, b) => a.dividendData.upcomingDividend.daysRemaining - b.dividendData.upcomingDividend.daysRemaining
    )

    // Calculate portfolio aggregate metrics
    const totalPortfolioValueBase = portfolioResult.totalValueBase || 1
    const totalPortfolioCostBase = portfolioResult.totalCostBase || 1
    const weightedYieldPercent = Number(
      ((totalPortfolioAnnualIncomeBase / totalPortfolioValueBase) * 100).toFixed(2)
    )
    const weightedYieldOnCostPercent = Number(
      ((totalPortfolioAnnualIncomeBase / totalPortfolioCostBase) * 100).toFixed(2)
    )

    // Calculate average XD recovery days across portfolio holdings
    const validRecoverySamples = dividendItems.filter((i) => i.dividendData.xdDropAnalysis.sampleCount > 0)
    const portfolioAvgRecoveryDays =
      validRecoverySamples.length > 0
        ? Number(
            (
              validRecoverySamples.reduce((s, i) => s + i.dividendData.xdDropAnalysis.avgRecoveryDays, 0) /
              validRecoverySamples.length
            ).toFixed(1)
          )
        : 8.5

    const portfolioAvgDropPercent =
      validRecoverySamples.length > 0
        ? Number(
            (
              validRecoverySamples.reduce((s, i) => s + i.dividendData.xdDropAnalysis.avgDropPercent, 0) /
              validRecoverySamples.length
            ).toFixed(2)
          )
        : -2.15

    return NextResponse.json({
      summary: {
        totalPortfolioAnnualIncomeBase: Number(totalPortfolioAnnualIncomeBase.toFixed(2)),
        totalNextExpectedPayoutBase: Number(totalNextExpectedPayoutBase.toFixed(2)),
        weightedYieldPercent,
        weightedYieldOnCostPercent,
        portfolioAvgRecoveryDays,
        portfolioAvgDropPercent,
        holdingsCount: dividendItems.length,
        baseCurrency,
        usdThbRate,
      },
      items: dividendItems,
    })
  } catch (error) {
    console.error('[Dividends API]', error)
    return NextResponse.json({ error: 'Failed to process dividend intelligence' }, { status: 500 })
  }
}
