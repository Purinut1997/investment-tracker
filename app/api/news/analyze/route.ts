import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateNewsDeepDive } from '@/lib/news/news-analyzer'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const { headline, summary, symbol } = body

    if (!headline) {
      return NextResponse.json({ error: 'Headline is required' }, { status: 400 })
    }

    const deepDive = await generateNewsDeepDive(userId, headline, summary, symbol)

    return NextResponse.json({ deepDive })
  } catch (error: any) {
    console.error('[news analyze POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to analyze news' }, { status: 500 })
  }
}
