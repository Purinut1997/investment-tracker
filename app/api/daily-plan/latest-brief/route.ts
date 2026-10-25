import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const latestAiLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: 'AI Daily Investment Strategist' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        response: true,
        modelUsed: true,
        createdAt: true,
      },
    })

    if (!latestAiLog) {
      return NextResponse.json({ brief: null })
    }

    // Check if the brief is from today (Bangkok timezone)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const todayBangkok = formatter.format(new Date())
    const briefDateBangkok = formatter.format(new Date(latestAiLog.createdAt))
    const isToday = todayBangkok === briefDateBangkok

    return NextResponse.json({
      brief: {
        id: latestAiLog.id,
        text: latestAiLog.response,
        modelUsed: latestAiLog.modelUsed,
        createdAt: latestAiLog.createdAt,
        isToday,
      },
    })
  } catch (error: any) {
    console.error('[GET /api/daily-plan/latest-brief error]', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch latest brief' }, { status: 500 })
  }
}
