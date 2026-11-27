/**
 * lib/analytics/cash-ledger.ts
 * Atomic helpers for synchronizing InvestmentAccount.cashBalance with transactions.
 */

export function getTransactionCashDelta(txnType: string, totalAmount: number): number {
  const amt = Math.abs(Number(totalAmount) || 0)
  if (!Number.isFinite(amt) || amt === 0) return 0

  switch (String(txnType || '').toUpperCase()) {
    case 'BUY':
    case 'WITHDRAW':
    case 'FEE':
      return -amt
    case 'SELL':
    case 'DIVIDEND':
    case 'DEPOSIT':
      return amt
    default:
      return 0
  }
}

export function getTransactionNetAmount(type: string, quantity: number, price: number, fee: number, tax: number) {
  const gross = quantity * price
  if (type === 'FEE') return fee || gross
  if (type === 'SELL' || type === 'DIVIDEND') return Math.max(0, gross - fee - tax)
  return gross + fee
}
