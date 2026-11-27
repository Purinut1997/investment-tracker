import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'
import { getTransactionCashDelta } from '@/lib/analytics/cash-ledger'

const payload = z.object({
  accountId: z.string().optional(),
  usdAccountId: z.string().optional(),
  thbAccountId: z.string().optional(),
  autoRoute: z.boolean().default(true),
  rows: z.array(z.unknown()).min(1),
})

const decimal = z.union([z.string().trim().regex(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i).transform(Number), z.number()]).pipe(z.number().nonnegative())
const rowSchema = z.object({
  txnDate: z.string().trim().min(1),
  txnType: z.string().trim().toUpperCase().pipe(z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE'])),
  ticker: z.string().trim().toUpperCase().min(1),
  market: z.string().trim().toUpperCase().optional(),
  quantity: decimal.refine(quantity => quantity > 0),
  pricePerUnit: decimal,
  fee: decimal.optional().default(0),
  taxWithheld: decimal.optional().default(0),
  note: z.string().optional(),
})

async function importRow(userId: string, settings: z.infer<typeof payload>, row: z.infer<typeof rowSchema>, txnDate: Date, occurrence: number) {
  const market = row.market === 'TH' || row.ticker.endsWith('.BK') ? 'TH' : 'US'
  const currency = market === 'TH' ? 'THB' : 'USD'
  const specifiedAccount = settings.autoRoute
    ? (currency === 'USD' ? settings.usdAccountId : settings.thbAccountId)
    : settings.accountId
  const { txnType, quantity, pricePerUnit, fee, taxWithheld } = row
  const gross = quantity * pricePerUnit
  const totalAmount = txnType === 'FEE' ? fee || gross
    : txnType === 'SELL' || txnType === 'DIVIDEND' ? Math.max(0, gross - fee - taxWithheld)
      : gross + fee
  if (!Number.isFinite(totalAmount)) throw new Error('ยอดรายการไม่ถูกต้อง')

  // Serializable isolation keeps simultaneous retries from creating the same row twice.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        let account = await tx.investmentAccount.findFirst({
          where: { userId, currency, ...(specifiedAccount ? { id: specifiedAccount } : {}) },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
        if (!account) {
          if (specifiedAccount || !settings.autoRoute || currency !== 'USD') {
            throw new Error(`เลือกบัญชีลงทุนสกุล ${currency} ที่ตรงกับไฟล์`)
          }
          account = await tx.investmentAccount.create({
            data: { userId, accountName: 'Dime! USD', accountType: 'brokerage', currency, cashBalance: 0 },
          })
        }

        const ticker = market === 'TH' ? row.ticker.replace(/\.BK$/, '') : row.ticker
        const sameMarketTickers = market === 'TH' ? [ticker, ticker + '.BK'] : [ticker]
        const matchingCount = await tx.transaction.count({
          where: {
            userId, accountId: account.id, asset: { ticker: { in: sameMarketTickers }, market },
            txnType, txnDate, quantity, pricePerUnit, fee, taxWithheld,
          },
        })
        if (matchingCount >= occurrence) return null

        const asset = await tx.asset.findFirst({ where: { ticker: { in: sameMarketTickers }, market }, orderBy: { ticker: 'asc' } })
          ?? await tx.asset.create({ data: { ticker, assetName: ticker, assetType: 'stock', market, currency } })
        if (asset.currency !== currency) throw new Error(`ตรวจสกุลเงินของ ${ticker} ก่อนนำเข้า`)

        await tx.transaction.create({
          data: { userId, accountId: account.id, assetId: asset.id, txnDate, txnType, quantity, pricePerUnit,
            fee, taxWithheld, totalAmount, note: row.note, source: 'csv_import' },
        })
        const delta = getTransactionCashDelta(txnType, totalAmount)
        if (delta) await tx.investmentAccount.update({
          where: { id: account.id }, data: { cashBalance: { increment: delta } },
        })
        return currency
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002')) continue
      throw error
    }
  }
}

export async function POST(req: NextRequest) {
  const userId = (await auth())?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const input = payload.safeParse(await req.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'ไม่พบรายการข้อมูลในไฟล์หรือข้อมูลนำเข้าไม่ถูกต้อง' }, { status: 400 })
  const settings = input.data
  try {
    if (!await prisma.investmentAccount.findFirst({ where: { userId }, select: { id: true } })) {
      return NextResponse.json({ error: 'ไม่พบบัญชีลงทุนในระบบ กรุณาสร้างบัญชีก่อนนำเข้า' }, { status: 400 })
    }
    const results = { imported: 0, skipped: 0, usdCount: 0, thbCount: 0, errors: [] as string[] }
    const occurrences = new Map<string, number>()
    for (const [index, raw] of settings.rows.entries()) {
      const row = rowSchema.safeParse(raw)
      const rawDate = row.success ? row.data.txnDate : ''
      const txnDate = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(rawDate) ? rawDate + 'Z' : rawDate)
      if (!row.success || !txnDate || !Number.isFinite(txnDate.getTime()) ||
          (row.data.market && !['TH', 'US'].includes(row.data.market))) {
        results.errors.push(`แถวที่ ${index + 1}: ตรวจวันที่ ตลาด ประเภทธุรกรรม จำนวน ราคา และค่าธรรมเนียม`)
        continue
      }
      const { ticker, market, txnType, quantity, pricePerUnit, fee, taxWithheld } = row.data
      const key = JSON.stringify([ticker.replace(/\.BK$/, ''), market === 'TH' || ticker.endsWith('.BK'), txnType,
        +txnDate, quantity, pricePerUnit, fee, taxWithheld])
      const occurrence = (occurrences.get(key) ?? 0) + 1
      occurrences.set(key, occurrence)
      try {
        const currency = await importRow(userId, settings, row.data, txnDate, occurrence)
        if (!currency) results.skipped++
        else {
          results.imported++
          if (currency === 'USD') results.usdCount++
          else results.thbCount++
        }
      } catch (error) {
        const message = error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)
          ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองนำเข้าอีกครั้ง'
        results.errors.push(`แถวที่ ${index + 1}: ${message}`)
      }
    }
    if (results.imported) invalidateUserHoldingsCache(userId)
    return NextResponse.json(results)
  } catch (error) {
    console.error('[import-csv]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
