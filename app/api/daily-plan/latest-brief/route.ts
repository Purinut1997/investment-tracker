import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { readAdvisorBrief } from '@/lib/ai/advisor-daily'
import { advisorDate } from '@/lib/ai/advisor-date'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const brief = await readAdvisorBrief(session.user.id, advisorDate())
    return NextResponse.json({ brief: brief ? { ...brief, isToday: true } : null })
  } catch (error) {
    console.error('[latest advisor brief]', error)
    return NextResponse.json({ error: 'ไม่สามารถโหลดสรุปประจำวัน' }, { status: 500 })
  }
}
