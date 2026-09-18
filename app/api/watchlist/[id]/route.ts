import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Missing item id' }, { status: 400 })
    }

    const item = await prisma.watchlistItem.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.watchlistItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'ลบรายการเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('[watchlist DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete watchlist item' }, { status: 500 })
  }
}
