import { normalizeGoldTicker } from '../market-data/gold'
import { hasNonemptyText, isModelRecord } from './model-contracts'

export interface ExtractionAccount {
  id: string
  accountName: string
  currency: string
  accountType: string
}

export function isExtractionEnvelope(value: unknown): value is Record<string, unknown> & {
  transactions: unknown[]
  cashBalances?: unknown[]
} {
  return isModelRecord(value) && Array.isArray(value.transactions)
    && (value.cashBalances === undefined || Array.isArray(value.cashBalances))
}

const txnTypes = ['BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAW'] as const
const markets = ['TH', 'US', 'CRYPTO'] as const
const assetTypes = ['stock', 'fund', 'crypto', 'bond', 'gold'] as const

function enumValue<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.find((item) => item === value)
}

function optionalNumber(value: unknown, allowNegative = false) {
  const num = typeof value === 'number' || hasNonemptyText(value) ? Number(value) : NaN
  return Number.isFinite(num) && (allowNegative || num >= 0) ? num : null
}

function readDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null
  const datePart = value.slice(0, 10)
  const midnight = new Date(`${datePart}T00:00:00Z`)
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== datePart) return null
  return Number.isFinite(Date.parse(value)) ? value : null
}

export function normalizeExtraction(raw: unknown, accounts: ExtractionAccount[], imageCount?: number) {
  if (!isExtractionEnvelope(raw)) {
    throw new Error('โครงสร้างผลอ่านธุรกรรมไม่ถูกต้อง')
  }
  const matchAccount = (item: Record<string, unknown>, currency: string | null) => {
    const inCurrency = accounts.filter((account) => account.currency.toUpperCase() === currency)
    const name = typeof item.accountName === 'string' ? item.accountName.trim().toLowerCase() : ''
    if (hasNonemptyText(item.matchedAccountId)) {
      const account = inCurrency.find((candidate) => candidate.id === item.matchedAccountId)
      return account && (!name || account.accountName.trim().toLowerCase() === name) ? account : null
    }
    const matches = name ? inCurrency.filter((account) => account.accountName.trim().toLowerCase() === name) : []
    return matches.length === 1 ? matches[0] : null
  }
  const transactions = raw.transactions.slice(0, 250).flatMap((item, index) => {
    if (!isModelRecord(item)) return []
    const txnType = enumValue(txnTypes, item.txnType)
    if (!txnType) return []
    const ticker = hasNonemptyText(item.ticker) ? item.ticker.trim().toUpperCase().slice(0, 32) : null
    const assetType = enumValue(assetTypes, item.assetType)
    const currency = typeof item.currency === 'string' && /^[A-Z]{3}$/i.test(item.currency) ? item.currency.toUpperCase() : null
    const gold = ticker ? normalizeGoldTicker(ticker, assetType, currency ?? undefined) : null
    const canonicalCurrency = gold?.currency ?? currency
    const account = matchAccount(item, canonicalCurrency)
    return [{
      id: `txn_${index + 1}`,
      sourceImageIndex: Number.isInteger(item.sourceImageIndex) && Number(item.sourceImageIndex) >= 0 && Number(item.sourceImageIndex) < (imageCount ?? 0)
        ? Number(item.sourceImageIndex) : null,
      txnType,
      ticker: gold?.ticker ?? ticker,
      assetName: gold?.assetName ?? (hasNonemptyText(item.assetName) ? item.assetName.trim().slice(0, 160) : ticker),
      market: gold?.market ?? enumValue(markets, item.market) ?? null,
      assetType: gold ? 'gold' : assetType ?? null,
      quantity: optionalNumber(item.quantity),
      pricePerUnit: optionalNumber(item.pricePerUnit),
      fee: optionalNumber(item.fee),
      taxWithheld: optionalNumber(item.taxWithheld),
      totalAmount: optionalNumber(item.totalAmount),
      currency: canonicalCurrency,
      txnDate: readDate(item.txnDate),
      matchedAccountId: account?.id ?? null,
      accountName: account?.accountName ?? (hasNonemptyText(item.accountName) ? item.accountName.trim().slice(0, 120) : null),
      note: hasNonemptyText(item.note) ? item.note.trim().slice(0, 300) : '',
    }]
  })
  const cashBalances = (raw.cashBalances ?? []).slice(0, 80).flatMap((item) => {
    if (!isModelRecord(item)) return []
    const amount = optionalNumber(item.cashAmount, true)
    const currency = typeof item.currency === 'string' && /^[A-Z]{3}$/i.test(item.currency) ? item.currency.toUpperCase() : null
    if (amount === null || !currency) return []
    const account = matchAccount(item, currency)
    return [{
      matchedAccountId: account?.id ?? null,
      accountName: account?.accountName ?? (hasNonemptyText(item.accountName) ? item.accountName.trim().slice(0, 120) : null),
      accountType: account?.accountType ?? enumValue(['bank', 'brokerage', 'cash'], item.accountType) ?? null,
      cashAmount: amount,
      currency,
      accruedInterest: optionalNumber(item.accruedInterest),
      interestDays: optionalNumber(item.interestDays),
      balanceDate: readDate(item.balanceDate),
    }]
  })
  return {
    transactions,
    cashBalances,
    summary: `พบ ${transactions.length} รายการธุรกรรมและ ${cashBalances.length} รายการยอดเงินสด กรุณาตรวจข้อมูลก่อนบันทึก`,
  }
}
