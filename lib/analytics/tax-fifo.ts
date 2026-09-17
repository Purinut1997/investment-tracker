/**
 * lib/analytics/tax-fifo.ts
 * FIFO (First-In-First-Out) cost basis and tax report calculation engine.
 * Separates into 3 categories according to Thai Revenue Department rules:
 * 1. Dividends & Withheld Tax
 * 2. Thai SET Capital Gains (tax exempt for individuals)
 * 3. Foreign Stocks & Crypto Realized Capital Gains
 */

export interface TaxTxnInput {
  id: string
  assetId: string
  ticker: string
  assetName: string
  market: string // 'TH' | 'US' | 'CRYPTO'
  assetType: string // 'stock' | 'fund' | 'crypto' | 'bond' | 'gold'
  txnDate: Date | string
  txnType: string // 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  pricePerUnit: number
  fee: number
  taxWithheld: number
  totalAmount: number
}

export interface FifoLot {
  date: Date
  quantity: number
  pricePerUnit: number
  fee: number
}

export interface RealizedTrade {
  sellDate: Date
  ticker: string
  market: string
  quantity: number
  sellPrice: number
  sellProceeds: number
  costBasis: number
  realizedGain: number
  fee: number
}

export interface TaxReportSummary {
  year: number
  dividends: {
    totalDividendGross: number
    totalTaxWithheld: number
    totalDividendNet: number
    items: {
      date: Date
      ticker: string
      amount: number
      taxWithheld: number
    }[]
  }
  thaiSetCapitalGains: {
    totalRealizedGain: number
    totalVolume: number
    taxExempt: boolean // true for individuals in Thailand
    trades: RealizedTrade[]
  }
  foreignAndCryptoGains: {
    totalRealizedGain: number
    totalProceeds: number
    totalCost: number
    trades: RealizedTrade[]
  }
}

export function calculateTaxReportFIFO(
  transactions: TaxTxnInput[],
  taxYear: number
): TaxReportSummary {
  // Sort all transactions chronologically
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime()
  )

  // Map of assetId -> FIFO queue of buy lots
  const buyLots = new Map<string, FifoLot[]>()

  const summary: TaxReportSummary = {
    year: taxYear,
    dividends: {
      totalDividendGross: 0,
      totalTaxWithheld: 0,
      totalDividendNet: 0,
      items: [],
    },
    thaiSetCapitalGains: {
      totalRealizedGain: 0,
      totalVolume: 0,
      taxExempt: true,
      trades: [],
    },
    foreignAndCryptoGains: {
      totalRealizedGain: 0,
      totalProceeds: 0,
      totalCost: 0,
      trades: [],
    },
  }

  for (const txn of sorted) {
    const txnDate = new Date(txn.txnDate)
    const year = txnDate.getUTCFullYear()
    const assetId = txn.assetId

    if (!buyLots.has(assetId)) {
      buyLots.set(assetId, [])
    }

    if (txn.txnType === 'BUY') {
      buyLots.get(assetId)!.push({
        date: txnDate,
        quantity: txn.quantity,
        pricePerUnit: txn.pricePerUnit,
        fee: txn.fee || 0,
      })
    } else if (txn.txnType === 'DIVIDEND') {
      if (year === taxYear) {
        const gross = Number(txn.totalAmount) + Number(txn.taxWithheld || 0)
        const withheld = Number(txn.taxWithheld || 0)
        summary.dividends.totalDividendGross += gross
        summary.dividends.totalTaxWithheld += withheld
        summary.dividends.totalDividendNet += Number(txn.totalAmount)
        summary.dividends.items.push({
          date: txnDate,
          ticker: txn.ticker,
          amount: gross,
          taxWithheld: withheld,
        })
      }
    } else if (txn.txnType === 'SELL') {
      let qtyToSell = txn.quantity
      let totalCostBasis = 0
      const lots = buyLots.get(assetId)!

      // Match against FIFO lots
      while (qtyToSell > 0 && lots.length > 0) {
        const currentLot = lots[0]
        if (currentLot.quantity <= qtyToSell) {
          totalCostBasis += currentLot.quantity * currentLot.pricePerUnit + currentLot.fee
          qtyToSell -= currentLot.quantity
          lots.shift() // consumed lot entirely
        } else {
          // partially consume lot
          const fraction = qtyToSell / currentLot.quantity
          totalCostBasis += qtyToSell * currentLot.pricePerUnit + currentLot.fee * fraction
          currentLot.quantity -= qtyToSell
          currentLot.fee -= currentLot.fee * fraction
          qtyToSell = 0
        }
      }

      // Record trade if in the requested tax year
      if (year === taxYear) {
        const proceeds = txn.quantity * txn.pricePerUnit - (txn.fee || 0)
        const realizedGain = proceeds - totalCostBasis

        const trade: RealizedTrade = {
          sellDate: txnDate,
          ticker: txn.ticker,
          market: txn.market,
          quantity: txn.quantity,
          sellPrice: txn.pricePerUnit,
          sellProceeds: proceeds,
          costBasis: totalCostBasis,
          realizedGain,
          fee: txn.fee || 0,
        }

        if (txn.market === 'TH') {
          summary.thaiSetCapitalGains.trades.push(trade)
          summary.thaiSetCapitalGains.totalRealizedGain += realizedGain
          summary.thaiSetCapitalGains.totalVolume += proceeds
        } else {
          // US Stocks, Crypto, Foreign
          summary.foreignAndCryptoGains.trades.push(trade)
          summary.foreignAndCryptoGains.totalRealizedGain += realizedGain
          summary.foreignAndCryptoGains.totalProceeds += proceeds
          summary.foreignAndCryptoGains.totalCost += totalCostBasis
        }
      }
    }
  }

  return summary
}
