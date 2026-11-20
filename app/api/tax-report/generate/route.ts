import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateTaxReportFIFO } from '@/lib/analytics/tax-fifo'
import { getUserAssetSplitsMap } from '@/lib/analytics/stock-splits'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

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
            currency: true,
          },
        },
        account: {
          select: {
            accountName: true,
            accountType: true,
          },
        },
      },
      orderBy: { txnDate: 'asc' },
    })

    const distinctAssetIds = Array.from(new Set(txns.map((t) => t.assetId).filter(Boolean)))

    // Fetch live FX rate and effective stock splits in parallel
    const [usdThbRateRaw, splitsByAsset] = await Promise.all([
      getExchangeRate('USD', 'THB'),
      getUserAssetSplitsMap(session.user.id, distinctAssetIds),
    ])
    const usdThbRate = usdThbRateRaw ?? 35.5

    const formattedTxns = txns.map((t) => ({
      id: t.id,
      assetId: t.assetId,
      ticker: t.asset.ticker,
      assetName: t.asset.assetName,
      market: t.asset.market,
      assetType: t.asset.assetType,
      currency:
        t.asset.currency ||
        (t.asset.market === 'US' || t.asset.market === 'CRYPTO' ? 'USD' : 'THB'),
      txnDate: t.txnDate,
      txnType: t.txnType,
      quantity: Number(t.quantity),
      pricePerUnit: Number(t.pricePerUnit),
      fee: Number(t.fee || 0),
      taxWithheld: Number(t.taxWithheld || 0),
      totalAmount: Number(t.totalAmount),
      accountName: t.account?.accountName || 'บัญชีหลัก',
    }))

    const report = calculateTaxReportFIFO(formattedTxns, year, usdThbRate, splitsByAsset)

    return NextResponse.json(report)
  } catch (error) {
    console.error('[tax-report generate GET]', error)
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 })
  }
}
