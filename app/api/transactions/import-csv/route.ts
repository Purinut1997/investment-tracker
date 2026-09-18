/**
 * POST /api/transactions/import-csv
 * Import transactions from CSV with duplicate detection and smart wallet auto-routing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'

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
    const {
      accountId,
      autoRoute = true,
      usdAccountId,
      thbAccountId,
      rows,
    } = body as {
      accountId?: string
      autoRoute?: boolean
      usdAccountId?: string
      thbAccountId?: string
      rows: CsvRow[]
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการข้อมูลในไฟล์' }, { status: 400 })
    }

    // Fetch user's existing accounts
    const userAccounts = await prisma.investmentAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    })

    if (userAccounts.length === 0) {
      return NextResponse.json({ error: 'ไม่พบบัญชีลงทุนในระบบ กรุณาสร้างบัญชีก่อนนำเข้า' }, { status: 400 })
    }

    // Resolve USD Account
    let resolvedUsdAccount = userAccounts.find(
      (a) => a.id === usdAccountId || a.currency === 'USD' || a.accountName.toLowerCase().includes('usd')
    )

    // If autoRoute is enabled and no USD account exists, automatically create Dime! USD
    if (autoRoute && !resolvedUsdAccount) {
      resolvedUsdAccount = await prisma.investmentAccount.create({
        data: {
          userId: session.user.id,
          accountName: 'Dime! USD',
          accountType: 'brokerage',
          currency: 'USD',
          cashBalance: 0,
        },
      })
    }

    // Resolve THB Account
    const resolvedThbAccount =
      userAccounts.find(
        (a) => a.id === thbAccountId || a.accountName.toLowerCase().includes('save') || a.currency === 'THB'
      ) ||
      userAccounts.find((a) => a.currency === 'THB') ||
      userAccounts[0]

    // Fallback single account
    const fallbackAccount =
      userAccounts.find((a) => a.id === accountId) || resolvedThbAccount || userAccounts[0]

    const results = {
      imported: 0,
      skipped: 0,
      usdCount: 0,
      thbCount: 0,
      errors: [] as string[],
    }

    for (const [i, row] of rows.entries()) {
      try {
        const txnDate = new Date(row.txnDate)
        if (isNaN(txnDate.getTime())) {
          results.errors.push(`แถวที่ ${i + 1}: วันที่ไม่ถูกต้อง "${row.txnDate}"`)
          continue
        }

        const quantity = parseFloat(row.quantity)
        const pricePerUnit = parseFloat(row.pricePerUnit)
        const fee = parseFloat(row.fee ?? '0') || 0
        const taxWithheld = parseFloat(row.taxWithheld ?? '0') || 0

        if (isNaN(quantity) || isNaN(pricePerUnit)) {
          results.errors.push(`แถวที่ ${i + 1}: จำนวนหรือราคาไม่ถูกต้อง`)
          continue
        }

        const rawTicker = (row.ticker || '').trim().toUpperCase()
        if (!rawTicker) {
          results.errors.push(`แถวที่ ${i + 1}: ไม่พบรหัสหุ้น (Ticker)`)
          continue
        }

        // Determine Market & Currency
        const explicitMarket = (row.market || '').trim().toUpperCase()
        const isExplicitTh = explicitMarket === 'TH' || rawTicker.endsWith('.BK')
        const isUs = !isExplicitTh // Default to US if not explicit Thai (Dime is mostly US equities for foreign stocks)

        const resolvedMarket = isUs ? 'US' : 'TH'
        const resolvedCurrency = isUs ? 'USD' : 'THB'

        // Choose target account based on autoRoute
        let targetAccount = fallbackAccount
        if (autoRoute) {
          if (isUs && resolvedUsdAccount) {
            targetAccount = resolvedUsdAccount
          } else if (!isUs && resolvedThbAccount) {
            targetAccount = resolvedThbAccount
          }
        }

        // Find or create asset
        let asset = await prisma.asset.findFirst({
          where: {
            ticker: rawTicker,
            market: resolvedMarket as any,
          },
        })

        if (!asset) {
          asset = await prisma.asset.create({
            data: {
              ticker: rawTicker,
              assetName: rawTicker,
              assetType: 'stock',
              market: resolvedMarket as any,
              currency: resolvedCurrency,
            },
          })
        } else if (resolvedMarket === 'US' && asset.currency !== 'USD') {
          // Auto-heal existing asset currency if it was wrongly saved as THB before
          asset = await prisma.asset.update({
            where: { id: asset.id },
            data: { currency: 'USD', market: 'US' },
          })
        }

        // Duplicate detection: same date + asset + quantity + price (approx within 1 min or exact)
        const duplicate = await prisma.transaction.findFirst({
          where: {
            userId: session.user.id,
            assetId: asset.id,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            txnDate: {
              gte: new Date(txnDate.getTime() - 60000),
              lte: new Date(txnDate.getTime() + 60000),
            },
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
            accountId: targetAccount.id,
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

        // Adjust cash balance of the target account
        let cashDelta = 0
        if (upperType === 'BUY' || upperType === 'WITHDRAW' || upperType === 'FEE') {
          cashDelta = -totalAmount
        } else if (upperType === 'SELL' || upperType === 'DEPOSIT' || upperType === 'DIVIDEND') {
          cashDelta = totalAmount
        }

        if (cashDelta !== 0) {
          await prisma.investmentAccount.update({
            where: { id: targetAccount.id },
            data: { cashBalance: { increment: cashDelta } },
          })
        }

        if (isUs) results.usdCount++
        else results.thbCount++

        results.imported++
      } catch (rowError: any) {
        results.errors.push(`แถวที่ ${i + 1}: ${rowError?.message || String(rowError)}`)
      }
    }

    invalidateUserHoldingsCache(session.user.id)

    return NextResponse.json(results)
  } catch (error) {
    console.error('[import-csv]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
