import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateTaxReportFIFO } from '@/lib/analytics/tax-fifo'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const currentYear = new Date().getFullYear()
  const year = parseInt(searchParams.get('year') ?? currentYear.toString())

  try {
    const txns = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      include: {
        asset: {
          select: {
            ticker: true,
            assetName: true,
            market: true,
            assetType: true,
          },
        },
      },
      orderBy: { txnDate: 'asc' },
    })

    const formattedTxns = txns.map((t) => ({
      id: t.id,
      assetId: t.assetId,
      ticker: t.asset.ticker,
      assetName: t.asset.assetName,
      market: t.asset.market,
      assetType: t.asset.assetType,
      txnDate: t.txnDate,
      txnType: t.txnType,
      quantity: Number(t.quantity),
      pricePerUnit: Number(t.pricePerUnit),
      fee: Number(t.fee || 0),
      taxWithheld: Number(t.taxWithheld || 0),
      totalAmount: Number(t.totalAmount),
    }))

    const report = calculateTaxReportFIFO(formattedTxns, year)

    return NextResponse.json(report)
  } catch (error) {
    console.error('[tax-report generate GET]', error)
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 })
  }
}
