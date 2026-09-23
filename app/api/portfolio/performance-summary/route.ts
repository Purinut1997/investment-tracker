import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateAssetPerformance } from '@/lib/analytics/asset-performance'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const performanceSummary = await calculateAssetPerformance(
      session.user.id,
      baseCurrency,
      forceRefresh
    )

    return NextResponse.json(performanceSummary)
  } catch (error) {
    console.error('[portfolio performance-summary GET]', error)
    return NextResponse.json(
      { error: 'Failed to calculate asset performance summary' },
      { status: 500 }
    )
  }
}
