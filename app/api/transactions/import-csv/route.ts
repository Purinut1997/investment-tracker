/**
 * POST /api/transactions/import-csv
 * Import transactions from CSV with duplicate detection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface CsvRow {
  txnDate: string
  txnType: string
  ticker: string
  market?: string
  quantity: string
  pricePerUnit: string
  fee?: string
  taxWithheld?: string
  note?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { accountId, rows } = body as { accountId: string; rows: CsvRow[] }

    if (!accountId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Verify account ownership
    const account = await prisma.investmentAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const results = { imported: 0, skipped: 0, errors: [] as string[] }

    for (const [i, row] of rows.entries()) {
      try {
        const txnDate = new Date(row.txnDate)
        if (isNaN(txnDate.getTime())) {
          results.errors.push(`Row ${i + 1}: วันที่ไม่ถูกต้อง "${row.txnDate}"`)
          continue
        }

        const quantity = parseFloat(row.quantity)
        const pricePerUnit = parseFloat(row.pricePerUnit)
        const fee = parseFloat(row.fee ?? '0') || 0
        const taxWithheld = parseFloat(row.taxWithheld ?? '0') || 0

        if (isNaN(quantity) || isNaN(pricePerUnit)) {
          results.errors.push(`Row ${i + 1}: จำนวนหรือราคาไม่ถูกต้อง`)
          continue
        }

        // Find or create asset
        let asset = await prisma.asset.findFirst({
          where: {
            ticker: row.ticker.toUpperCase(),
            ...(row.market && { market: row.market as any }),
          },
        })

        if (!asset) {
          asset = await prisma.asset.create({
            data: {
              ticker: row.ticker.toUpperCase(),
              assetName: row.ticker.toUpperCase(),
              assetType: 'stock',
              market: (row.market as any) ?? 'US',
              currency: account.currency,
            },
          })
        }

        // Duplicate detection: same date + asset + quantity + price
        const duplicate = await prisma.transaction.findFirst({
          where: {
            userId: session.user.id,
            assetId: asset.id,
            txnDate: txnDate,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
          },
        })

        if (duplicate) {
          results.skipped++
          continue
        }

        const upperType = (row.txnType?.toUpperCase() ?? 'BUY') as any
        let totalAmount = quantity * pricePerUnit + fee
        if (upperType === 'SELL') {
          totalAmount = Math.max(0, quantity * pricePerUnit - fee)
        } else if (upperType === 'DIVIDEND') {
          totalAmount = Math.max(0, quantity * pricePerUnit - taxWithheld)
        }

        await prisma.transaction.create({
          data: {
            userId: session.user.id,
            accountId,
            assetId: asset.id,
            txnDate,
            txnType: upperType,
            quantity,
            pricePerUnit,
            fee,
            taxWithheld,
            totalAmount,
            note: row.note,
            source: 'csv_import',
          },
        })

        // Adjust cash balance of the account
        let cashDelta = 0
        if (upperType === 'BUY' || upperType === 'WITHDRAW' || upperType === 'FEE') {
          cashDelta = -totalAmount
        } else if (upperType === 'SELL' || upperType === 'DEPOSIT' || upperType === 'DIVIDEND') {
          cashDelta = totalAmount
        }
        if (cashDelta !== 0) {
          await prisma.investmentAccount.update({
            where: { id: accountId },
            data: { cashBalance: { increment: cashDelta } },
          })
        }

        results.imported++
      } catch (rowError) {
        results.errors.push(`Row ${i + 1}: ${String(rowError)}`)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('[import-csv]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
