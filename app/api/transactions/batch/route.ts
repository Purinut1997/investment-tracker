import { LedgerRequestError, withLedgerRequest } from '@/lib/analytics/ledger-request'
import { applyLedgerCash, reconcileLedgerCash } from '@/lib/analytics/transaction-ledger'
import { getTransactionCashDelta, getTransactionNetAmount } from '@/lib/analytics/cash-ledger'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'

class StaleCashSnapshot extends Error {}

const BatchTransactionItemSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().optional(),
  currency: z.string().default('USD'),
  accountType: z.enum(['brokerage', 'crypto_exchange', 'bank', 'cash']).default('brokerage'),
  ticker: z.string().trim().min(1).max(32),
  assetName: z.string().optional(),
  market: z.enum(['US', 'TH', 'CRYPTO']).default('US'),
  assetType: z.enum(['stock', 'fund', 'crypto', 'bond', 'gold']).default('stock'),
  txnDate: z.iso.datetime({ offset: true }),
  txnType: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE']),
  quantity: z.number().positive(),
  pricePerUnit: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  taxWithheld: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative(),
  note: z.string().optional(),
}).refine((item) => {
  if (item.txnType === 'DEPOSIT' || item.txnType === 'WITHDRAW' || item.txnType === 'FEE') return item.totalAmount > 0
  const expected = getTransactionNetAmount(item.txnType, item.quantity, item.pricePerUnit, item.fee, item.taxWithheld)
  return Math.abs(expected - item.totalAmount) <= 0.02
}, { message: 'ยอดสุทธิไม่ตรงกับจำนวน ราคา และค่าธรรมเนียม' })

const BatchCashBalanceItemSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().optional(),
  currency: z.string().default('THB'),
  accountType: z.enum(['brokerage', 'crypto_exchange', 'bank', 'cash']).default('bank'),
  cashAmount: z.number(),
  accruedInterest: z.number().default(0),
  interestDays: z.number().nullable().optional(),
  balanceDate: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
})

const BatchPayloadSchema = z.object({
  transactions: z.array(BatchTransactionItemSchema).max(250).default([]),
  cashBalances: z.array(BatchCashBalanceItemSchema).max(80).default([]),
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

    if (new Set(cashBalances.map((item) => item.accountId)).size !== cashBalances.length) {
      return NextResponse.json({ error: 'เลือกยอดเงินสดเพียงหนึ่งรายการต่อบัญชี' }, { status: 400 })
    }

    const { createdTransactions, updatedCashAccounts } = await withLedgerRequest(userId, 'transaction-batch', req.headers.get('Idempotency-Key'), parsed.data, async db => {
      // Cache user accounts for quick lookup
      const existingAccounts = await db.investmentAccount.findMany({
        where: { userId },
      })

      if ([...transactions, ...cashBalances].some((item) =>
        !existingAccounts.some((account) => account.id === item.accountId && account.currency === item.currency)
      )) {
        throw new LedgerRequestError('ตรวจสอบว่าบัญชีและสกุลเงินของทุกรายการตรงกัน', 400)
      }

      // Helper to get or create asset
      const assetMap = new Map<string, string>() // "TICKER_MARKET" -> ID
      async function resolveAssetId(ticker: string, market: any, assetName?: string, assetType: any = 'stock', currency = 'USD'): Promise<string> {
        const cleanTicker = ticker.trim().toUpperCase()
        const key = `${cleanTicker}_${market}`
        if (assetMap.has(key)) return assetMap.get(key)!

        let asset = await db.asset.findUnique({
          where: { ticker_market: { ticker: cleanTicker, market } },
        })

        if (!asset) {
          asset = await db.asset.create({
            data: {
              ticker: cleanTicker,
              market,
              assetName: assetName?.trim() || cleanTicker,
              assetType: assetType || 'stock',
              currency: currency || (market === 'US' ? 'USD' : 'THB'),
            },
          })
        }

        if (asset.currency !== currency) throw new Error('สกุลเงินสินทรัพย์ไม่ตรงกับรายการ')
        assetMap.set(key, asset.id)
        return asset.id
      }

      const createdTransactions: any[] = []
      const updatedCashAccounts: any[] = []

      // 1. Process and save Transactions
      for (const item of transactions) {
        const resolvedAccountId = item.accountId

        const resolvedAssetId = await resolveAssetId(
          item.ticker,
          item.market,
          item.assetName,
          item.assetType,
          item.currency
        )

        const computedTotal = ['BUY', 'SELL', 'DIVIDEND'].includes(item.txnType)
          ? getTransactionNetAmount(item.txnType, item.quantity, item.pricePerUnit, item.fee, item.taxWithheld)
          : item.totalAmount
        const txnDate = new Date(item.txnDate)
        const sync = updateCashBalances && !cashBalances.some(balance => balance.accountId === resolvedAccountId)
        const delta = sync ? getTransactionCashDelta(item.txnType, computedTotal) : 0

        const createdTxn = await db.transaction.create({
          data: {
            userId,
            accountId: resolvedAccountId,
            assetId: resolvedAssetId,
            txnDate,
            txnType: item.txnType,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            fee: item.fee,
            taxWithheld: item.taxWithheld,
            totalAmount: computedTotal,
            cashDeltaApplied: delta,
            cashSyncEnabled: sync,
            note: item.note || undefined,
            source: 'quick_add',
          },
          include: {
            asset: { select: { ticker: true, assetName: true, market: true } },
            account: { select: { accountName: true, currency: true } },
          },
        })

        createdTransactions.push(createdTxn)

        await applyLedgerCash(db, resolvedAccountId, delta)
      }

      // 2. Process and save explicit Cash Balances (from cash screenshots)
      for (const cash of cashBalances) {
        const resolvedAccountId = cash.accountId

        const balanceDay = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date(cash.balanceDate))
        const dayStart = new Date(`${balanceDay}T00:00:00Z`)
        const newerSnapshot = await db.cashBalance.findFirst({
          where: { accountId: resolvedAccountId, balanceDate: { gt: dayStart } }, select: { id: true },
        })
        if (newerSnapshot) throw new StaleCashSnapshot('บัญชีนี้มียอดเงินสดที่ใหม่กว่า กรุณาใช้ข้อมูลล่าสุด')
        const nextBangkokDay = new Date(Date.parse(balanceDay + 'T00:00:00+07:00') + 86_400_000)
        const laterTrade = await db.transaction.findFirst({
          where: { accountId: resolvedAccountId, txnDate: { gte: nextBangkokDay } },
          select: { id: true },
        })
        if (laterTrade) throw new StaleCashSnapshot('พบธุรกรรมหลังวันที่ของยอดเงินสด กรุณาใช้ยอดล่าสุด')

        const updated = await db.investmentAccount.update({
          where: { id: resolvedAccountId },
          data: {
            cashBalance: cash.cashAmount,
            accruedInterest: cash.accruedInterest || 0,
            interestDays: cash.interestDays ?? 0,
          },
        })

        // Also record snapshot in CashBalance table

        await db.cashBalance.upsert({
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

        await reconcileLedgerCash(db, resolvedAccountId)
        updatedCashAccounts.push(updated)
      }
      return { createdTransactions, updatedCashAccounts }
    })

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
    if (error instanceof LedgerRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof StaleCashSnapshot) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('[transactions/batch POST]', error)
    return NextResponse.json(
      { error: error.message || 'บันทึกข้อมูลธุรกรรมแบบกลุ่มล้มเหลว' },
      { status: 500 }
    )
  }
}
