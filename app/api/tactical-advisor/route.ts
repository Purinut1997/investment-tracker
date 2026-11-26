import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { computeAdviceOutcomeMetrics } from '@/lib/ai/outcome-evaluator'
import {
  formatThaiDate, getBangkokDateString, normalizeStoredPayload, parseAdviceResponse,
  runTacticalAnalysis, MarketEvidenceUnavailable,
} from '@/lib/ai/tactical-analysis'

export const maxDuration = 45

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const forceRefresh = searchParams.get('refresh') === 'true'
  const cachedOnly = searchParams.get('cachedOnly') === '1'
  const requestedDate = searchParams.get('date') // e.g. "2026-11-14"

  try {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const todayBangkok = getBangkokDateString()

    // 1. Fetch past tactical advice logs to build timeline of available dates
    const pastLogs = await prisma.aiAdviceLog.findMany({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, createdAt: true, response: true, modelUsed: true },
    })

    // Group logs by Bangkok calendar day (taking the newest log for each day)
    const dayMap = new Map<string, (typeof pastLogs)[0]>()
    for (const log of pastLogs) {
      const dayKey = getBangkokDateString(new Date(log.createdAt))
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, log)
      }
    }

    const availableDates = Array.from(dayMap.entries()).map(([dayKey, log]) => {
      const isToday = dayKey === todayBangkok
      return {
        dateKey: dayKey,
        labelTh: isToday
          ? `วันนี้ (${formatThaiDate(new Date(log.createdAt))})`
          : formatThaiDate(new Date(log.createdAt)),
        createdAt: log.createdAt.toISOString(),
        isToday,
      }
    })

    const computeCachedOutcomeMetrics = async () => {
      try {
        const holdingsRes = await calculateUserHoldings(userId, baseCurrency, false)
        const liveMap = new Map(
          holdingsRes.holdings.map((h) => [h.ticker.toUpperCase(), Number(h.currentPrice || 0)])
        )
        return computeAdviceOutcomeMetrics(pastLogs.slice(0, 15), liveMap)
      } catch {
        return undefined
      }
    }

    // 2. If a specific historical date is requested
    if (requestedDate && requestedDate !== todayBangkok) {
      const targetLog = dayMap.get(requestedDate)
      if (targetLog) {
        try {
          const parsed = parseAdviceResponse(targetLog.response)
          const normalized = normalizeStoredPayload(parsed, targetLog.createdAt, targetLog.modelUsed)
          const liveMetrics = cachedOnly ? undefined : await computeCachedOutcomeMetrics()
          if (liveMetrics && liveMetrics.totalTrackedCalls > 0) {
            normalized.outcomeMetrics = liveMetrics
          }
          return NextResponse.json({
            success: true,
            data: normalized,
            cached: true,
            isHistorical: true,
            selectedDate: requestedDate,
            availableDates,
            generatedAt: targetLog.createdAt.toISOString(),
            modelUsed: targetLog.modelUsed,
          })
        } catch (err) {
          console.error('[Failed to parse historical log]', err)
        }
      }
      return NextResponse.json(
        { error: `ไม่พบบันทึกการวิเคราะห์ของวันที่ ${requestedDate}` },
        { status: 404 }
      )
    }

    // 3. Today's snapshot: if not forcing refresh, check if today's snapshot already exists in DB
    const todayLog = dayMap.get(todayBangkok)
    if (!forceRefresh && todayLog) {
      try {
        const parsed = parseAdviceResponse(todayLog.response)
        const normalized = normalizeStoredPayload(parsed, todayLog.createdAt, todayLog.modelUsed)
        if (!normalized.marketEvidence) throw new Error('Legacy snapshot lacks evidence')
        const liveMetrics = cachedOnly ? undefined : await computeCachedOutcomeMetrics()
        if (liveMetrics && liveMetrics.totalTrackedCalls > 0) {
          normalized.outcomeMetrics = liveMetrics
        }
        return NextResponse.json({
          success: true,
          data: normalized,
          cached: true,
          isHistorical: false,
          selectedDate: todayBangkok,
          availableDates,
          generatedAt: todayLog.createdAt.toISOString(),
          modelUsed: todayLog.modelUsed,
        })
      } catch {
        // Fallback to regenerate
      }
    }

    if (cachedOnly) {
      return NextResponse.json({ success: true, data: null, cached: false, selectedDate: todayBangkok, availableDates })
    }
    // 4. Otherwise, compute fresh analysis for today
    const payload = await runTacticalAnalysis(userId, baseCurrency)

    // Reconstruct availableDates including today's new run if it wasn't there
    const updatedDates = availableDates.some((d) => d.dateKey === todayBangkok)
      ? availableDates
      : [
          {
            dateKey: todayBangkok,
            labelTh: `วันนี้ (${payload.asOfDateThai})`,
            createdAt: payload.generatedAt,
            isToday: true,
          },
          ...availableDates,
        ]

    return NextResponse.json({
      success: true,
      data: payload,
      cached: false,
      isHistorical: false,
      selectedDate: todayBangkok,
      availableDates: updatedDates,
      generatedAt: payload.generatedAt,
      modelUsed: payload.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor GET error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate tactical advice' },
      { status: error instanceof MarketEvidenceUnavailable ? 503 : 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const payload = await runTacticalAnalysis(userId, baseCurrency)

    return NextResponse.json({
      success: true,
      data: payload,
      cached: false,
      generatedAt: payload.generatedAt,
      modelUsed: payload.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor POST error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute tactical analysis' },
      { status: error instanceof MarketEvidenceUnavailable ? 503 : 500 }
    )
  }
}
