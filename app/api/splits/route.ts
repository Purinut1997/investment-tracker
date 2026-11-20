import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserPortfolioCache } from '@/lib/analytics/holdings'
import { formatSplitRatio, normalizeSplitDate } from '@/lib/analytics/stock-splits'

const CreateSplitSchema = z.object({
  assetId: z.string().min(1).optional(),
  ticker: z.string().trim().min(1).max(30).optional(),
  market: z.enum(['US', 'TH', 'CRYPTO']).optional(),
  splitDate: z.string().min(1),
  numerator: z.number().positive(),
  denominator: z.number().positive(),
  note: z.string().max(300).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const assetIdFilter = req.nextUrl.searchParams.get('assetId') || undefined

    // Fetch distinct assets referenced in user's transactions
    const userAssetRows = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      distinct: ['assetId'],
      select: {
        asset: {
          select: {
            id: true,
            ticker: true,
            assetName: true,
            market: true,
            currency: true,
            assetType: true,
          },
        },
      },
    })

    const assets = userAssetRows
      .map((r) => r.asset)
      .filter(Boolean)
      .sort((a, b) => a.ticker.localeCompare(b.ticker))
    const userAssetIds = assets.map((a) => a.id)

    const splits = await prisma.assetSplit.findMany({
      where: assetIdFilter
        ? {
            assetId: assetIdFilter,
            OR: [{ userId: null }, { userId: session.user.id }],
          }
        : {
            OR: [
              { userId: session.user.id },
              ...(userAssetIds.length > 0
                ? [{ userId: null, assetId: { in: userAssetIds } }]
                : []),
            ],
          },
      include: {
        asset: {
          select: {
            id: true,
            ticker: true,
            assetName: true,
            market: true,
            currency: true,
            assetType: true,
          },
        },
      },
      orderBy: [{ splitDate: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      assets,
      splits: splits.map((s) => ({
        id: s.id,
        assetId: s.assetId,
        userId: s.userId,
        splitDate: s.splitDate.toISOString(),
        numerator: Number(s.numerator),
        denominator: Number(s.denominator),
        splitRatio: s.splitRatio,
        source: s.source,
        note: s.note,
        createdAt: s.createdAt.toISOString(),
        asset: s.asset,
      })),
    })
  } catch (error) {
    console.error('[splits GET]', error)
    return NextResponse.json({ error: 'Failed to load stock splits' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = CreateSplitSchema.safeParse({
      ...body,
      numerator: Number(body?.numerator),
      denominator: Number(body?.denominator ?? 1),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'ข้อมูลการแตกพาร์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const data = parsed.data

    let asset = null
    if (data.assetId) {
      asset = await prisma.asset.findUnique({ where: { id: data.assetId } })
    } else if (data.ticker) {
      const cleanTicker = data.ticker.toUpperCase()
      asset = await prisma.asset.findFirst({
        where: {
          ticker: cleanTicker,
          ...(data.market ? { market: data.market } : {}),
        },
      })
    }

    if (!asset) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลสินทรัพย์ที่ระบุในระบบ' },
        { status: 404 }
      )
    }

    const normalizedDate = normalizeSplitDate(data.splitDate, asset.market)
    const splitRatio = formatSplitRatio(data.numerator, data.denominator)

    const saved = await prisma.assetSplit.upsert({
      where: {
        assetId_splitDate_scopeKey: {
          assetId: asset.id,
          splitDate: normalizedDate,
          scopeKey: session.user.id,
        },
      },
      update: {
        numerator: data.numerator,
        denominator: data.denominator,
        splitRatio,
        source: 'manual',
        note: data.note ?? null,
      },
      create: {
        assetId: asset.id,
        userId: session.user.id,
        scopeKey: session.user.id,
        splitDate: normalizedDate,
        numerator: data.numerator,
        denominator: data.denominator,
        splitRatio,
        source: 'manual',
        note: data.note ?? null,
      },
      include: {
        asset: {
          select: {
            id: true,
            ticker: true,
            assetName: true,
            market: true,
            currency: true,
            assetType: true,
          },
        },
      },
    })

    invalidateUserPortfolioCache(session.user.id)

    return NextResponse.json(
      {
        id: saved.id,
        assetId: saved.assetId,
        userId: saved.userId,
        splitDate: saved.splitDate.toISOString(),
        numerator: Number(saved.numerator),
        denominator: Number(saved.denominator),
        splitRatio: saved.splitRatio,
        source: saved.source,
        note: saved.note,
        asset: saved.asset,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[splits POST]', error)
    return NextResponse.json({ error: 'บันทึกการแตกพาร์ไม่สำเร็จ' }, { status: 500 })
  }
}
