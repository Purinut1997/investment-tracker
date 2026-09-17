import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const result = await calculateUserHoldings(session.user.id, baseCurrency)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[portfolio holdings GET]', error)
    return NextResponse.json({ error: 'Failed to calculate holdings' }, { status: 500 })
  }
}
