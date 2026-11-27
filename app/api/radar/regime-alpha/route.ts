import { adviceCacheKey } from '@/lib/ai/advice-cache-key'
import { getPositionLimit, positionBasisLabel } from '@/lib/ai/portfolio-position-limit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { valueCashAccounts } from '@/lib/market-data/frankfurter'
import { parseUserInvestmentMemory } from '@/lib/ai/outcome-evaluator'
import { callGemini } from '@/lib/ai/gemini-client'
import { parseModelJson } from '@/lib/ai/model-contracts'
import {
  formatRegimeOpportunitiesForPrompt,
  getLiveRegimeOpportunities,
  type RegimeOpportunitiesReport,
} from '@/lib/analytics/regime-opportunities'
import {
  formatUnifiedContextPrompt,
  getUnifiedPortfolioContext,
  invalidateUnifiedContextCache,
} from '@/lib/ai/unified-context'

export const maxDuration = 45

const text = z.string().trim().min(1).max(1200)

const regimeAlphaAiSchema = z.object({
  regimeHeadline: text,
  portfolioDefenseStrategy: text,
  picks: z
    .array(
      z.object({
        ticker: z.string().trim().min(1).max(24),
        roleLabelTh: text,
        whyNowTh: text,
        entryPlanTh: text,
        invalidationTh: text,
        exitTriggerTh: text,
      })
    )
    .min(1)
    .max(5),
  watchoutTh: text,
})

export type RegimeAlphaAiReport = z.infer<typeof regimeAlphaAiSchema>

function getBangkokDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getTodayTag(dateKey = getBangkokDateKey()) {
  return `[regime-alpha:v2:${dateKey}]`
}

async function loadTodayAlphaAiLog(userId: string, todayTag: string, contextTag: string) {
  const log = await prisma.aiAdviceLog.findFirst({
    where: {
      userId,
      logType: 'advisor',
      AND: [
        { prompt: { contains: '[AI Regime Alpha Opportunities]' } },
        { prompt: { contains: todayTag } },
        { prompt: { contains: contextTag } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { response: true, modelUsed: true, createdAt: true },
  })
  if (!log) return null
  try {
    const parsed = regimeAlphaAiSchema.parse(parseModelJson(log.response))
    return {
      aiReport: parsed,
      modelUsed: log.modelUsed,
      updatedAt: log.createdAt.toISOString(),
    }
  } catch {
    return null
  }
}

async function assembleContext(userId: string, forceRefresh = false) {
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { baseCurrency: true, defaultRiskProfile: true },
  })
  const baseCurrency = userSettings?.baseCurrency ?? 'THB'
  const memory = parseUserInvestmentMemory(userSettings?.defaultRiskProfile)

  const [holdingsResult, accounts, watchlists] = await Promise.all([
    calculateUserHoldings(userId, baseCurrency, false),
    prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, currency: true },
    }),
    prisma.watchlistItem.findMany({
      where: { userId },
      select: { symbol: true, displayName: true, itemType: true },
    }),
  ])

  const { totalCash, valuationIssues: cashValuationIssues } = await valueCashAccounts(accounts, baseCurrency)
  const limit = await getPositionLimit(userId, memory.maxSinglePositionPercent)
  const valuationIssues = [...new Set([...(holdingsResult.valuationIssues ?? []), ...cashValuationIssues])]

  const quantReport = await getLiveRegimeOpportunities({
    holdings: holdingsResult.holdings,
    watchlists,
    totalCashBase: totalCash,
    baseCurrency,
    maxSinglePositionPercent: limit.percent,
    positionBasis: limit.basis,
    forceRefresh,
  })

  const contextTag = '[regime-context:' + adviceCacheKey({
    limit, totalCash, valuationIssues, baseCurrency,
    positions: holdingsResult.holdings.map(h => [h.assetId, h.quantity, h.currentValueBase, h.avgCost]),
    market: quantReport?.regime,
    candidates: quantReport?.candidates.map(c => [c.ticker, c.currentPrice, c.entryReadiness, c.supportS1, c.resistanceR1, c.totalScore]),
  }) + ']'

  return {
    baseCurrency,
    limit,
    contextTag,
    valuationIssues,
    cashValuationIssues,
    holdingsResult,
    totalCash,
    quantReport,
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true'

  try {
    const todayTag = getTodayTag()
    const ctx = await assembleContext(userId, forceRefresh)
    const cachedAi = await loadTodayAlphaAiLog(userId, todayTag, ctx.contextTag)

    return NextResponse.json({
      quantReport: ctx.quantReport,
      valuationIssues: ctx.valuationIssues,
      positionLimit: ctx.limit,
      aiReport: cachedAi?.aiReport ?? null,
      modelUsed: cachedAi?.modelUsed ?? null,
      updatedAt: cachedAi?.updatedAt ?? null,
      cached: Boolean(cachedAi),
    })
  } catch (error: any) {
    console.error('[GET /api/radar/regime-alpha]', error)
    return NextResponse.json(
      { error: error.message || 'ไม่สามารถสแกนโอกาสตามสภาวะตลาดได้' },
      { status: 500 }
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
    const body = await req.json().catch(() => ({}))
    const forceRefresh = Boolean(body?.forceRefresh)
    const todayTag = getTodayTag()

    const ctx = await assembleContext(userId, forceRefresh)
    const cachedAi = forceRefresh ? null : await loadTodayAlphaAiLog(userId, todayTag, ctx.contextTag)
    if (cachedAi && ctx.quantReport) {
      return NextResponse.json({
        quantReport: ctx.quantReport,
        valuationIssues: ctx.valuationIssues,
        positionLimit: ctx.limit,
        aiReport: cachedAi.aiReport,
        modelUsed: cachedAi.modelUsed,
        updatedAt: cachedAi.updatedAt,
        cached: true,
      })
    }
    if (!ctx.quantReport || ctx.quantReport.candidates.length === 0) {
      return NextResponse.json(
        { error: 'ข้อมูลตลาดหลักจาก Yahoo Finance ยังไม่พร้อม กรุณาลองใหม่อีกครั้ง' },
        { status: 503 }
      )
    }

    const unifiedCtx = await getUnifiedPortfolioContext(userId, {
      baseCurrency: ctx.baseCurrency,
      holdingsResult: ctx.holdingsResult,
      totalCash: ctx.totalCash,
      cashValuationIssues: ctx.cashValuationIssues,
    }).catch(() => null)

    const report: RegimeOpportunitiesReport = ctx.quantReport
    const candidatesJson = report.candidates.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      category: c.category,
      role: c.roleLabelTh,
      currentPrice: c.currentPrice,
      currency: c.currency,
      observedAt: c.observedAt,
      totalScore: c.totalScore,
      rsVsQqq5D: c.rsVsQqq5D,
      rsVsQqq21D: c.rsVsQqq21D,
      corr60DWithQqq: c.corr60DWithQqq,
      rsi14: c.rsi14,
      sma50: c.sma50,
      supportS1: c.supportS1,
      resistanceR1: c.resistanceR1,
      alreadyHeldPct: c.alreadyHeldPct,
      entryReadiness: c.entryReadiness,
      entryVerdictLabelTh: c.entryVerdictLabelTh,
      distanceAboveSma50Pct: c.distanceAboveSma50Pct,
      upsideToR1Pct: c.upsideToR1Pct,
      downsideToS1Pct: c.downsideToS1Pct,
      riskRewardRatio: c.riskRewardRatio,
      valuationWarningTh: c.valuationWarningTh,
      entryCaution: c.entryCaution,
      hedgeImpactSummary: c.hedgeImpact?.summaryTh ?? null,
    }))

    const prompt = `
[AI Regime Alpha Opportunities]
${todayTag}
${ctx.contextTag}
คุณคือ Chief Tactical Alpha & Hedging Strategist หน้าที่ของคุณคือคัดเลือกและอธิบายโอกาสทำกำไร + กันกระแทกพอร์ต (Long-only) จากผู้ชนะเชิงปริมาณที่ระบบคำนวณจากตลาดจริงด้านล่าง:

${unifiedCtx ? formatUnifiedContextPrompt(unifiedCtx, { excludeSurface: 'radar', compact: true }) : ''}

${formatRegimeOpportunitiesForPrompt(report)}

[รายละเอียดตัวเลขจริงของ Top Candidates (เลือกได้เฉพาะ ticker ในชุดนี้เท่านั้น!)]:
${JSON.stringify(candidatesJson, null, 2)}

[กฎเหล็กที่ต้องปฏิบัติตามอย่างเคร่งครัด]:
1. เลือก "ticker" ได้เฉพาะจากรายการ Top Candidates ข้างต้นเท่านั้น ห้ามสร้าง ticker ใหม่เองโดยเด็ดขาด
2. ห้ามแต่งราคา ผลตอบแทน ยิลด์ หรือวันประกาศเอง ใช้เฉพาะตัวเลขจริงที่แนบมา (ถ้าระบุราคาเข้า/จุดหนีไฟ ให้อิงจาก currentPrice, supportS1, sma50 ที่มีจริงเท่านั้น)
3. ต้องสอดคล้องกับ Market Posture ใน Tactical Advisor และเพดานต่อหุ้น (${ctx.limit.percent}% ของ${positionBasisLabel(ctx.limit)}):
   - หากตัวไหนมี entryReadiness === 'TOO_HIGH_DO_NOT_CHASE' ต้องระบุชัดใน entryPlanTh ว่า "ห้ามไล่ราคาตอนนี้ — รอย่อลงมาใกล้แนวรับ S1" พร้อมอ้างอิงเหตุผลจริง (RSI, ระยะห่าง SMA50, R:R หรือ Valuation P/E)
   - หากตัวไหนมี entryReadiness === 'WAIT_PULLBACK' ให้บอกเงื่อนไขรอจังหวะย่อ
4. ระบุเฉพาะเงื่อนไขติดตาม งดเสนอวงเงิน จำนวนหน่วย หรือเปอร์เซ็นต์ซื้อ
5. ทุกตัวใน "picks" ต้องบอกชัด: ทำไมชนะในสภาวะตลาดนี้ -> เงื่อนไขติดตามก่อนเข้า -> จุดหนีไฟ (Invalidation) -> เงื่อนไขเลิกถือ/หมุนกลับเข้าหุ้นเติบโต

ตอบกลับเป็น JSON Object ตาม Schema นี้เท่านั้น:
{
  "regimeHeadline": "สรุปสภาวะตลาดและทิศทางเงินทุนวันนี้ 1-2 ประโยคที่อ่านแล้วเข้าใจทันที",
  "portfolioDefenseStrategy": "กลยุทธ์ปกป้องพอร์ตและทำกำไรสวนจังหวะสำหรับพอร์ตของคุณ (ระบุ Tech ${report.techExposurePercent}%, Gold ${report.goldExposurePercent}%, Cash ${report.cashPercent}%)",
  "picks": [
    {
      "ticker": "SYMBOL จากชุดข้อมูล",
      "roleLabelTh": "บทบาท เช่น กันกระแทกพอร์ต / หมุนกลุ่มทำกำไร / ปันผลรอจังหวะ",
      "whyNowTh": "เหตุผลเชิงสถิติจริงว่าทำไมเด่นกว่ากลุ่ม Tech ตอนนี้ (อ้าง RS 1M, Corr 60D, และผลลดแรงกระแทกถ้ามี)",
      "entryPlanTh": "เงื่อนไขติดตามก่อนเข้าอ้างอิงราคาและแนวรับ S1 จริง",
      "invalidationTh": "จุดหนีไฟหรือเงื่อนไขหยุดถัวอ้างอิงแนวรับจริง",
      "exitTriggerTh": "เงื่อนไขหมุนเงินกลับเข้าหุ้นเติบโตเมื่อตลาดเปลี่ยนโหมด"
    }
  ],
  "watchoutTh": "ข้อควรระวังสำคัญที่สุด 1-2 ข้อของแผนรอบนี้"
}
`

    const aiRes = await callGemini({
      userId,
      prompt,
      logType: 'advisor',
      systemInstruction:
        'คุณคือ Chief Tactical Alpha & Hedging Strategist ตอบกลับเป็น JSON ภาษาไทย 100% ยึดเฉพาะ ticker และตัวเลขจริงที่แนบมา ห้ามแนะนำ Inverse ETF หรือแต่งตัวเลขเอง',
      responseMimeType: 'application/json',
      validateJson: (val) => regimeAlphaAiSchema.safeParse(val).success,
      thinkingBudget: 512,
      skipLog: true,
    })

    const rawParsed = regimeAlphaAiSchema.parse(parseModelJson(aiRes.text))
    const validTickerMap = new Map(
      report.candidates.map((c) => [c.ticker.toUpperCase(), c])
    )
    const reconciledPicks = rawParsed.picks
      .map((pick) => {
        const clean = pick.ticker.trim().toUpperCase()
        const matched = validTickerMap.get(clean)
        if (!matched) return null
        return {
          ...pick,
          ticker: matched.ticker,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    if (reconciledPicks.length === 0) {
      return NextResponse.json(
        { error: 'AI เลือกสินทรัพย์ไม่ตรงกับข้อมูลยืนยัน กรุณากดสแกนใหม่อีกครั้ง' },
        { status: 502 }
      )
    }

    const finalAiReport: RegimeAlphaAiReport = {
      ...rawParsed,
      picks: reconciledPicks,
    }

    const saved = await prisma.aiAdviceLog.create({
      data: {
        userId,
        logType: 'advisor',
        prompt,
        response: JSON.stringify(finalAiReport),
        modelUsed: aiRes.modelUsed,
      },
      select: { createdAt: true },
    })

    invalidateUnifiedContextCache(userId)

    return NextResponse.json({
      quantReport: report,
      valuationIssues: ctx.valuationIssues,
      positionLimit: ctx.limit,
      aiReport: finalAiReport,
      modelUsed: aiRes.modelUsed,
      updatedAt: saved.createdAt.toISOString(),
      cached: false,
    })
  } catch (error: any) {
    console.error('[POST /api/radar/regime-alpha]', error)
    return NextResponse.json(
      { error: error.message || 'ไม่สามารถวิเคราะห์โอกาสทำกำไรด้วย AI ได้' },
      { status: 500 }
    )
  }
}
