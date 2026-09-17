import { Building2, Coins, Landmark, Banknote, type LucideIcon } from 'lucide-react'
import type { AccountType } from '@prisma/client'

export type AccountTypeValue = AccountType

export interface InvestmentAccountRecord {
  id: string
  accountName: string
  accountType: AccountTypeValue
  currency: string
  _count?: { transactions: number }
}

export const ACCOUNT_TYPES: {
  value: AccountTypeValue
  label: string
  icon: LucideIcon
  desc: string
  color: string
}[] = [
  { value: 'brokerage', label: 'โบรกเกอร์', icon: Building2, desc: 'Dime, InnovestX, IBKR', color: 'text-blue-400' },
  { value: 'crypto_exchange', label: 'คริปโต', icon: Coins, desc: 'Bitkub, Binance, OKX', color: 'text-amber-400' },
  { value: 'bank', label: 'ธนาคาร', icon: Landmark, desc: 'บัญชีออมทรัพย์ / กระแสรายวัน', color: 'text-emerald-400' },
  { value: 'cash', label: 'เงินสด', icon: Banknote, desc: 'เงินสดหรือเงินพัก', color: 'text-zinc-400' },
]

export function accountTypeLabel(value: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value
}

export function parseAccountsPayload(data: unknown): InvestmentAccountRecord[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && 'accounts' in data
      ? (data as { accounts?: unknown }).accounts
      : []

  if (!Array.isArray(list)) return []

  return list.filter((item): item is InvestmentAccountRecord => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.accountName === 'string'
  })
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
