import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateNewsDeepDive } from '@/lib/news/news-analyzer'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const input = z.object({
      headline: z.string().trim().min(1).max(800),
      summary: z.string().max(8000).nullish(),
      symbol: z.string().max(30).nullish(),
    }).safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: 'Headline is required' }, { status: 400 })
    }
    const { headline, summary, symbol } = input.data
    const source = await prisma.newsItem.findFirst({
      where: { headline, ...(symbol ? { symbol } : {}) },
      orderBy: { publishedAt: 'desc' },
      select: { sourceName: true, sourceUrl: true, publishedAt: true, summary: true },
    }).catch(() => null)
    const deepDive = await generateNewsDeepDive(userId, headline, source?.summary ?? summary ?? null, symbol ?? null, source)

    return NextResponse.json({ deepDive })
  } catch (error: any) {
    console.error('[news analyze POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to analyze news' }, { status: 500 })
  }
}
