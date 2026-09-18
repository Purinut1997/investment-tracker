/**
 * lib/analytics/tax-fifo.ts
 * FIFO (First-In-First-Out) cost basis and tax report calculation engine.
 * Separates into 3 categories according to Thai Revenue Department rules:
 * 1. Dividends & Withheld Tax
 * 2. Thai SET Capital Gains (tax exempt for individuals)
 * 3. Foreign Stocks & Crypto Realized Capital Gains
 *
 * All values are stored in BOTH native currency (USD/THB) and THB equivalent
 * so the UI can display correctly in either mode.
 */

export interface TaxTxnInput {
  id: string
  assetId: string
  ticker: string
  assetName: string
  market: string   // 'TH' | 'US' | 'CRYPTO'
  assetType: string // 'stock' | 'fund' | 'crypto' | 'bond' | 'gold'
  currency: string  // 'USD' | 'THB'
  txnDate: Date | string
  txnType: string  // 'BUY' | 'SELL' | 'DIVIDEND'
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
  currency: string      // native currency of the asset ('USD' | 'THB')
  quantity: number
  sellPrice: number     // in native currency
  sellProceeds: number  // in native currency
  costBasis: number     // in native currency
  realizedGain: number  // in native currency
  sellProceedsTHB: number  // converted to THB
  costBasisTHB: number     // converted to THB
  realizedGainTHB: number  // converted to THB
  fee: number
}

export interface DividendItem {
  date: Date
  ticker: string
  currency: string     // native currency ('USD' | 'THB')
  amount: number       // gross in native currency
  taxWithheld: number  // in native currency
  amountTHB: number    // gross converted to THB
  taxWithheldTHB: number
}

export interface TaxReportSummary {
  year: number
  usdThbRate: number  // exchange rate used for conversion
  dividends: {
    // Native currency totals (USD for US stocks, THB for Thai)
    totalDividendGrossUSD: number
    totalTaxWithheldUSD: number
    totalDividendNetUSD: number
    totalDividendGrossTHB: number
    totalTaxWithheldTHB: number
    totalDividendNetTHB: number
    items: DividendItem[]
  }
  thaiSetCapitalGains: {
    totalRealizedGain: number  // THB (Thai stocks are always THB)
    totalVolume: number        // THB
    taxExempt: boolean         // true for individuals in Thailand
    trades: RealizedTrade[]
  }
  foreignAndCryptoGains: {
    // USD figures (native)
    totalRealizedGainUSD: number
    totalProceedsUSD: number
    totalCostUSD: number
    // THB equivalents (converted with FX rate)
    totalRealizedGainTHB: number
    totalProceedsTHB: number
    totalCostTHB: number
    trades: RealizedTrade[]
  }
}

export function calculateTaxReportFIFO(
  transactions: TaxTxnInput[],
  taxYear: number,
  usdThbRate = 35.5  // current exchange rate for conversion
): TaxReportSummary {
  // Sort all transactions chronologically
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime()
  )

  // Map of assetId -> FIFO queue of buy lots
  const buyLots = new Map<string, FifoLot[]>()

  const summary: TaxReportSummary = {
    year: taxYear,
    usdThbRate,
    dividends: {
      totalDividendGrossUSD: 0,
      totalTaxWithheldUSD: 0,
      totalDividendNetUSD: 0,
      totalDividendGrossTHB: 0,
      totalTaxWithheldTHB: 0,
      totalDividendNetTHB: 0,
      items: [],
    },
    thaiSetCapitalGains: {
      totalRealizedGain: 0,
      totalVolume: 0,
      taxExempt: true,
      trades: [],
    },
    foreignAndCryptoGains: {
      totalRealizedGainUSD: 0,
      totalProceedsUSD: 0,
      totalCostUSD: 0,
      totalRealizedGainTHB: 0,
      totalProceedsTHB: 0,
      totalCostTHB: 0,
      trades: [],
    },
  }

  for (const txn of sorted) {
    const txnDate = new Date(txn.txnDate)
    const year = txnDate.getUTCFullYear()
    const assetId = txn.assetId
    const isUSD = txn.currency === 'USD' || txn.market === 'US' || txn.market === 'CRYPTO'
    const fxRate = isUSD ? usdThbRate : 1.0  // THB assets don't need conversion

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
        // totalAmount is the net after tax (what the user actually receives)
        const netAmount = Number(txn.totalAmount)
        const withheld = Number(txn.taxWithheld || 0)
        const gross = netAmount + withheld  // reconstruct gross

        const grossTHB = gross * fxRate
        const withheldTHB = withheld * fxRate
        const netTHB = netAmount * fxRate

        if (isUSD) {
          summary.dividends.totalDividendGrossUSD += gross
          summary.dividends.totalTaxWithheldUSD += withheld
          summary.dividends.totalDividendNetUSD += netAmount
        }
        // Always accumulate THB equivalent
        summary.dividends.totalDividendGrossTHB += grossTHB
        summary.dividends.totalTaxWithheldTHB += withheldTHB
        summary.dividends.totalDividendNetTHB += netTHB

        summary.dividends.items.push({
          date: txnDate,
          ticker: txn.ticker,
          currency: isUSD ? 'USD' : 'THB',
          amount: gross,
          taxWithheld: withheld,
          amountTHB: grossTHB,
          taxWithheldTHB: withheldTHB,
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

        const proceedsTHB = proceeds * fxRate
        const costBasisTHB = totalCostBasis * fxRate
        const realizedGainTHB = realizedGain * fxRate

        const trade: RealizedTrade = {
          sellDate: txnDate,
          ticker: txn.ticker,
          market: txn.market,
          currency: isUSD ? 'USD' : 'THB',
          quantity: txn.quantity,
          sellPrice: txn.pricePerUnit,
          sellProceeds: proceeds,
          costBasis: totalCostBasis,
          realizedGain,
          sellProceedsTHB: proceedsTHB,
          costBasisTHB,
          realizedGainTHB,
          fee: txn.fee || 0,
        }

        if (txn.market === 'TH') {
          summary.thaiSetCapitalGains.trades.push(trade)
          summary.thaiSetCapitalGains.totalRealizedGain += realizedGain  // THB already
          summary.thaiSetCapitalGains.totalVolume += proceeds             // THB already
        } else {
          // US Stocks, Crypto, Foreign
          summary.foreignAndCryptoGains.trades.push(trade)
          summary.foreignAndCryptoGains.totalRealizedGainUSD += realizedGain
          summary.foreignAndCryptoGains.totalProceedsUSD += proceeds
          summary.foreignAndCryptoGains.totalCostUSD += totalCostBasis
          summary.foreignAndCryptoGains.totalRealizedGainTHB += realizedGainTHB
          summary.foreignAndCryptoGains.totalProceedsTHB += proceedsTHB
          summary.foreignAndCryptoGains.totalCostTHB += costBasisTHB
        }
      }
    }
  }

  return summary
}
