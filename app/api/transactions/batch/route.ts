import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'

const BatchTransactionItemSchema = z.object({
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  currency: z.string().default('USD'),
  accountType: z.enum(['brokerage', 'crypto_exchange', 'bank', 'cash']).default('brokerage'),
  ticker: z.string().min(1),
  assetName: z.string().optional(),
  market: z.enum(['US', 'TH', 'CRYPTO']).default('US'),
  assetType: z.enum(['stock', 'fund', 'crypto', 'bond', 'gold']).default('stock'),
  txnDate: z.string(),
  txnType: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE']),
  quantity: z.preprocess((val) => {
    const num = Number(val)
    return isNaN(num) || num <= 0 ? 1 : num
  }, z.number().positive()),
  pricePerUnit: z.preprocess((val) => {
    const num = Number(val)
    return isNaN(num) || num < 0 ? 0 : num
  }, z.number().nonnegative()),
  fee: z.number().nonnegative().default(0),
  taxWithheld: z.number().nonnegative().default(0),
  totalAmount: z.number().optional(),
  note: z.string().optional(),
})

const BatchCashBalanceItemSchema = z.object({
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  currency: z.string().default('THB'),
  accountType: z.enum(['brokerage', 'crypto_exchange', 'bank', 'cash']).default('bank'),
  cashAmount: z.number(),
  accruedInterest: z.number().default(0),
  interestDays: z.number().nullable().optional(),
  balanceDate: z.string().optional(),
})

const BatchPayloadSchema = z.object({
  transactions: z.array(BatchTransactionItemSchema).default([]),
  cashBalances: z.array(BatchCashBalanceItemSchema).default([]),
  updateCashBalances: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const rawBody = await req.json()
    const parsed = BatchPayloadSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { transactions, cashBalances, updateCashBalances } = parsed.data

    if (transactions.length === 0 && cashBalances.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการธุรกรรมหรือยอดเงินสดให้บันทึก' }, { status: 400 })
    }

    // Cache user accounts for quick lookup
    const existingAccounts = await prisma.investmentAccount.findMany({
      where: { userId },
    })

    const accountMap = new Map<string, string>() // Name -> ID
    existingAccounts.forEach((acc) => {
      accountMap.set(acc.accountName.toLowerCase(), acc.id)
    })

    // Helper to get or create account
    async function resolveAccountId(name?: string, currency = 'USD', accountType: any = 'brokerage', explicitId?: string): Promise<string> {
      if (explicitId) {
        const found = existingAccounts.find((a) => a.id === explicitId)
        if (found) return found.id
      }

      const cleanName = (name || 'Dime! USD').trim()
      const existingId = accountMap.get(cleanName.toLowerCase())
      if (existingId) return existingId

      // Create new account for user
      const created = await prisma.investmentAccount.create({
        data: {
          userId,
          accountName: cleanName,
          accountType: accountType || 'brokerage',
          currency: currency.toUpperCase(),
        },
      })

      accountMap.set(cleanName.toLowerCase(), created.id)
      existingAccounts.push(created)
      return created.id
    }

    // Helper to get or create asset
    const assetMap = new Map<string, string>() // "TICKER_MARKET" -> ID
    async function resolveAssetId(ticker: string, market: any, assetName?: string, assetType: any = 'stock', currency = 'USD'): Promise<string> {
      const cleanTicker = ticker.trim().toUpperCase()
      const key = `${cleanTicker}_${market}`
      if (assetMap.has(key)) return assetMap.get(key)!

      let asset = await prisma.asset.findUnique({
        where: { ticker_market: { ticker: cleanTicker, market } },
      })

      if (!asset) {
        asset = await prisma.asset.create({
          data: {
            ticker: cleanTicker,
            market,
            assetName: assetName?.trim() || cleanTicker,
            assetType: assetType || 'stock',
            currency: currency || (market === 'US' ? 'USD' : 'THB'),
          },
        })
      }

      assetMap.set(key, asset.id)
      return asset.id
    }

    const createdTransactions: any[] = []
    const updatedCashAccounts: any[] = []

    // 1. Process and save Transactions
    for (const item of transactions) {
      const resolvedAccountId = await resolveAccountId(
        item.accountName,
        item.currency,
        item.accountType,
        item.accountId
      )

      const resolvedAssetId = await resolveAssetId(
        item.ticker,
        item.market,
        item.assetName,
        item.assetType,
        item.currency
      )

      // Calculate proper total amount
      let computedTotal = item.totalAmount
      if (
        computedTotal === undefined ||
        isNaN(computedTotal) ||
        computedTotal === 0 ||
        (item.txnType === 'SELL' && item.quantity > 0 && item.pricePerUnit > 0 && item.fee > 0 && computedTotal > item.quantity * item.pricePerUnit)
      ) {
        if (item.txnType === 'BUY') {
          computedTotal = item.quantity * item.pricePerUnit + item.fee
        } else if (item.txnType === 'SELL') {
          computedTotal = Math.max(0, item.quantity * item.pricePerUnit - item.fee - (item.taxWithheld || 0))
        } else if (item.txnType === 'DIVIDEND') {
          computedTotal = Math.max(0, item.quantity * item.pricePerUnit - item.taxWithheld - item.fee)
        } else if (item.txnType === 'FEE') {
          computedTotal = item.fee
        } else {
          computedTotal = item.quantity * item.pricePerUnit
        }
      }

      let effectiveQuantity = item.quantity > 0 ? item.quantity : 1
      let effectivePrice = item.pricePerUnit
      if (effectivePrice === 0 && computedTotal > 0) {
        if (item.txnType === 'SELL') {
          effectivePrice = Math.max(0, (computedTotal + item.fee + (item.taxWithheld || 0)) / effectiveQuantity)
        } else {
          effectivePrice = Math.max(0, (computedTotal - item.fee) / effectiveQuantity)
        }
      }

      const txnDate = new Date(item.txnDate)

      const createdTxn = await prisma.transaction.create({
        data: {
          userId,
          accountId: resolvedAccountId,
          assetId: resolvedAssetId,
          txnDate: isNaN(txnDate.getTime()) ? new Date() : txnDate,
          txnType: item.txnType,
          quantity: effectiveQuantity,
          pricePerUnit: effectivePrice,
          fee: item.fee,
          taxWithheld: item.taxWithheld,
          totalAmount: computedTotal,
          note: item.note || undefined,
          source: 'quick_add',
        },
        include: {
          asset: { select: { ticker: true, assetName: true, market: true } },
          account: { select: { accountName: true, currency: true } },
        },
      })

      createdTransactions.push(createdTxn)

      // Automatically adjust cash balance of the account if enabled
      if (updateCashBalances) {
        let delta = 0
        if (item.txnType === 'BUY' || item.txnType === 'WITHDRAW' || item.txnType === 'FEE') {
          delta = -Number(computedTotal)
        } else if (item.txnType === 'SELL' || item.txnType === 'DEPOSIT' || item.txnType === 'DIVIDEND') {
          delta = Number(computedTotal)
        }

        if (delta !== 0) {
          await prisma.investmentAccount.update({
            where: { id: resolvedAccountId },
            data: {
              cashBalance: { increment: delta },
            },
          })
        }
      }
    }

    // 2. Process and save explicit Cash Balances (from cash screenshots)
    for (const cash of cashBalances) {
      const resolvedAccountId = await resolveAccountId(
        cash.accountName,
        cash.currency,
        cash.accountType,
        cash.accountId
      )

      const balanceDate = cash.balanceDate ? new Date(cash.balanceDate) : new Date()
      const normalizedDate = isNaN(balanceDate.getTime()) ? new Date() : balanceDate

      const updated = await prisma.investmentAccount.update({
        where: { id: resolvedAccountId },
        data: {
          cashBalance: cash.cashAmount,
          accruedInterest: cash.accruedInterest || 0,
          interestDays: cash.interestDays ?? 0,
        },
      })

      // Also record snapshot in CashBalance table
      const dayStart = new Date(normalizedDate)
      dayStart.setUTCHours(0, 0, 0, 0)

      await prisma.cashBalance.upsert({
        where: {
          accountId_balanceDate: {
            accountId: resolvedAccountId,
            balanceDate: dayStart,
          },
        },
        update: {
          cashAmount: cash.cashAmount,
          accruedInterest: cash.accruedInterest || 0,
          note: 'อัปเดตจากภาพถ่ายสลิปเงินสด',
        },
        create: {
          accountId: resolvedAccountId,
          balanceDate: dayStart,
          cashAmount: cash.cashAmount,
          accruedInterest: cash.accruedInterest || 0,
          note: 'อัปเดตจากภาพถ่ายสลิปเงินสด',
        },
      })

      updatedCashAccounts.push(updated)
    }

    invalidateUserHoldingsCache(userId)

    return NextResponse.json({
      success: true,
      importedTransactionsCount: createdTransactions.length,
      updatedCashAccountsCount: updatedCashAccounts.length,
      transactions: createdTransactions,
      cashAccounts: updatedCashAccounts,
      message: `บันทึกรายการสำเร็จ ${createdTransactions.length} รายการ และปรับปรุงยอดเงินสด ${updatedCashAccounts.length} บัญชี`,
    })
  } catch (error: any) {
    console.error('[transactions/batch POST]', error)
    return NextResponse.json(
      { error: error.message || 'บันทึกข้อมูลธุรกรรมแบบกลุ่มล้มเหลว' },
      { status: 500 }
    )
  }
}
