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

export function applyCashDeltaClamped(currentCash: number, delta: number): number {
  const cur = Number.isFinite(currentCash) ? currentCash : 0
  const d = Number.isFinite(delta) ? delta : 0
  return Number(Math.max(0, cur + d).toFixed(4))
}
