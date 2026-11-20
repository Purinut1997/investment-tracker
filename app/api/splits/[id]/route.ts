import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserPortfolioCache } from '@/lib/analytics/holdings'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const existing = await prisma.assetSplit.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบรายการแตกพาร์นี้' }, { status: 404 })
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        {
          error:
            'ไม่สามารถลบข้อมูลแตกพาร์อัตโนมัติจากตลาดได้ หากต้องการยกเลิกผลในพอร์ตของคุณ ให้บันทึก override อัตรา 1:1 ในวันที่เดียวกันแทน',
        },
        { status: 403 }
      )
    }

    await prisma.assetSplit.delete({ where: { id } })
    invalidateUserPortfolioCache(session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[splits DELETE]', error)
    return NextResponse.json({ error: 'ลบรายการแตกพาร์ไม่สำเร็จ' }, { status: 500 })
  }
}
