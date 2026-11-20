import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserPortfolioCache } from '@/lib/analytics/holdings'
import { syncAssetSplitsFromYahoo } from '@/lib/market-data/split-sync'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const targetAssetId = typeof body?.assetId === 'string' && body.assetId.trim() ? body.assetId.trim() : undefined

    let assetsToSync: Array<{ id: string; ticker: string; market: string; assetType: string }> = []

    if (targetAssetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: targetAssetId },
        select: { id: true, ticker: true, market: true, assetType: true },
      })
      if (!asset) {
        return NextResponse.json({ error: 'ไม่พบสินทรัพย์ที่ระบุ' }, { status: 404 })
      }
      assetsToSync = [asset]
    } else {
      const rows = await prisma.transaction.findMany({
        where: { userId: session.user.id },
        distinct: ['assetId'],
        select: {
          asset: {
            select: { id: true, ticker: true, market: true, assetType: true },
          },
        },
      })
      assetsToSync = rows.map((r) => r.asset).filter(Boolean)
    }

    const syncRes = await syncAssetSplitsFromYahoo(assetsToSync, true)
    invalidateUserPortfolioCache(session.user.id)

    return NextResponse.json({
      success: true,
      syncedAssetsCount: syncRes.syncedAssetsCount,
      totalSplitsFound: syncRes.totalSplitsFound,
      newlyAddedSplits: syncRes.newlyAddedSplits,
    })
  } catch (error) {
    console.error('[splits sync POST]', error)
    return NextResponse.json({ error: 'ซิงค์ข้อมูลการแตกพาร์ไม่สำเร็จ' }, { status: 500 })
  }
}
