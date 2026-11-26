/**
 * lib/ai/unified-context.ts
 * Shared fast, cached cross-AI intelligence layer that keeps all AI surfaces aligned:
 * - Zero external HTTP calls (DB + in-memory cache only, <20ms hot / <80ms cold)
 * - Unifies Portfolio DNA, Deterministic Risk Sentinel check, AI Memory, Active Preset,
 *   and a Cross-AI Continuity Ledger of recent outputs across surfaces.
 */

import { prisma } from '../prisma'
import { calculateUserHoldings, type PortfolioHoldingsResult } from '../analytics/holdings'
import { analyzePortfolioRisks } from '../analytics/risk-sentinel'
import { sumAccountCashInBaseCurrency } from '../market-data/frankfurter'
import { parseUserInvestmentMemory, type UserInvestmentMemory } from './outcome-evaluator'

export type AiSurface =
  | 'tactical'
  | 'copilot'
  | 'radar'
  | 'daily_brief'
  | 'plans_analyze'
  | 'bucket_chat'
  | 'forecast'
  | 'tax'
  | 'stock_insight'
  | 'daily_stock_risk'
  | 'news'
  | 'weekly_digest'

export interface TacticalContinuitySummary {
  date: string
  statusLabelTh: string
  riskLevel: number
  postureLabelTh: string
  recommendedCashPercent: number
  thematicRiskAlert: string | null
  topActions: Array<{ ticker: string; action: string; actionLabel: string }>
}

export interface UnifiedHoldingLite {
  ticker: string
  market: string
  assetType: string
  currency: string
  quantity: number
  avgCost: number
  currentPrice: number
  allocationPercent: number
  unrealizedPnLPercent: number
}

export interface UnifiedAiContext {
  userId: string
  baseCurrency: string
  assembledAt: string
  memory: UserInvestmentMemory
  activePreset: {
    presetName: string
    targetAmount: number | null
    monthlyContribution: number | null
    riskProfile: string | null
  } | null
  portfolio: {
    investedValue: number
    totalCash: number
    totalWealth: number
    cashPercent: number
    unrealizedPnLPercent: number
    holdingsCount: number
    topHoldings: UnifiedHoldingLite[]
    holdingsByTicker: Record<string, UnifiedHoldingLite>
    assetMix: {
      usPercent: number
      thPercent: number
      goldPercent: number
      cryptoPercent: number
      otherPercent: number
    }
  }
  riskSnapshot: {
    overallRiskLevel: string
    overallRiskScore: number
    overweightSectors: string[]
    topWarnings: string[]
  }
  continuity: {
    tactical: TacticalContinuitySummary | null
    radar: { date: string; summary: string } | null
    regimeAlpha: {
      date: string
      headline: string
      topPicks: Array<{ ticker: string; role: string }>
    } | null
    dailyBrief: { date: string; summary: string } | null
    copilot: { date: string; lastQuestion: string; lastAnswerSummary: string } | null
    unacknowledgedAlert: { date: string; summary: string } | null
  }
}

const UNIFIED_CONTEXT_TTL_MS = 120 * 1000
const unifiedContextCache = new Map<string, { data: UnifiedAiContext; timestamp: number }>()

export function invalidateUnifiedContextCache(userId?: string) {
  if (userId) {
    for (const key of unifiedContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        unifiedContextCache.delete(key)
      }
    }
  } else {
    unifiedContextCache.clear()
  }
}

function formatShortDateBangkok(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function extractMarkdownHeadline(text: string, maxLen = 190): string {
  if (!text || typeof text !== 'string') return ''
  const lines = text
    .split('\n')
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^[-*•\d.)\s]+/, '')
        .replace(/[*`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((line) => line.length >= 8 && !/^รอบนี้ไม่มีแหล่งอ้างอิง/.test(line))

  if (lines.length === 0) return ''
  const combined = lines.slice(0, 2).join(' | ')
  if (combined.length <= maxLen) return combined
  return `${combined.slice(0, Math.max(20, maxLen - 1)).trimEnd()}…`
}

export function extractRegimeAlphaContinuity(
  rawResponse: string,
  createdAt: Date
): { date: string; headline: string; topPicks: Array<{ ticker: string; role: string }> } | null {
  if (!rawResponse || typeof rawResponse !== 'string') return null
  try {
    const parsed = JSON.parse(rawResponse)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.regimeHeadline !== 'string') {
      return null
    }
    const picksRaw = Array.isArray(parsed.picks) ? parsed.picks : []
    return {
      date: formatShortDateBangkok(createdAt),
      headline: parsed.regimeHeadline.trim().slice(0, 140),
      topPicks: picksRaw
        .slice(0, 4)
        .filter((p: any) => p && typeof p.ticker === 'string')
        .map((p: any) => ({
          ticker: String(p.ticker).toUpperCase(),
          role: String(p.roleLabelTh || '').slice(0, 40),
        })),
    }
  } catch {
    return null
  }
}

export function extractTacticalContinuity(
  rawResponse: string,
  createdAt: Date
): TacticalContinuitySummary | null {
  if (!rawResponse || typeof rawResponse !== 'string') return null
  try {
    const parsed = JSON.parse(rawResponse)
    if (!parsed || typeof parsed !== 'object') return null
    const riskLevel = Number(parsed?.marketRegime?.riskLevel)
    const actionsRaw = Array.isArray(parsed?.tacticalActions) ? parsed.tacticalActions : []
    return {
      date: typeof parsed?.asOfDate === 'string' && parsed.asOfDate
        ? parsed.asOfDate
        : formatShortDateBangkok(createdAt),
      statusLabelTh: String(
        parsed?.marketRegime?.statusLabelTh ||
          parsed?.marketRegime?.pillars?.formula?.postureLabelTh ||
          'ประเมินสภาวะตลาด'
      ),
      riskLevel: Number.isFinite(riskLevel) && riskLevel >= 1 && riskLevel <= 5 ? riskLevel : 3,
      postureLabelTh: String(
        parsed?.marketRegime?.pillars?.formula?.postureLabelTh ||
          parsed?.marketRegime?.statusLabelTh ||
          ''
      ),
      recommendedCashPercent: Number.isFinite(Number(parsed?.cashStrategy?.recommendedCashPercent))
        ? Number(parsed.cashStrategy.recommendedCashPercent)
        : 15,
      thematicRiskAlert:
        typeof parsed?.portfolioResilience?.thematicRiskAlert === 'string' &&
        parsed.portfolioResilience.thematicRiskAlert.trim()
          ? parsed.portfolioResilience.thematicRiskAlert.trim().slice(0, 140)
          : null,
      topActions: actionsRaw
        .slice(0, 6)
        .filter((a: any) => a && typeof a.ticker === 'string' && typeof a.action === 'string')
        .map((a: any) => ({
          ticker: String(a.ticker).toUpperCase(),
          action: String(a.action),
          actionLabel: String(a.actionLabel || a.action),
        })),
    }
  } catch {
    return null
  }
}

function buildPortfolioSummary(
  holdingsResult: PortfolioHoldingsResult | null,
  totalCash: number,
  baseCurrency: string
) {
  const holdings = holdingsResult?.holdings || []
  const investedValue = holdingsResult?.totalValueBase || 0
  const totalWealth = investedValue + totalCash
  const cashPercent = totalWealth > 0 ? Number(((totalCash / totalWealth) * 100).toFixed(1)) : 0

  let usValue = 0
  let thValue = 0
  let goldValue = 0
  let cryptoValue = 0
  let otherValue = 0

  const holdingsByTicker: Record<string, UnifiedHoldingLite> = {}
  const normalizedList: UnifiedHoldingLite[] = []

  for (const h of holdings) {
    const val = Number(h.currentValueBase || 0)
    if (h.assetType === 'gold') goldValue += val
    else if (h.assetType === 'crypto' || h.market === 'CRYPTO') cryptoValue += val
    else if (h.market === 'TH' || h.currency === 'THB') thValue += val
    else if (h.market === 'US' || h.currency === 'USD') usValue += val
    else otherValue += val

    const lite: UnifiedHoldingLite = {
      ticker: h.ticker.toUpperCase(),
      market: h.market,
      assetType: h.assetType,
      currency: h.currency,
      quantity: Number(h.quantity || 0),
      avgCost: Number(h.avgCost || 0),
      currentPrice: Number(h.currentPrice || 0),
      allocationPercent: Number(h.allocationPercent || 0),
      unrealizedPnLPercent: Number(h.unrealizedPnLPercent || 0),
    }
    normalizedList.push(lite)
    const cleanKey = lite.ticker.replace(/\.BK$/, '')
    holdingsByTicker[lite.ticker] = lite
    if (!holdingsByTicker[cleanKey]) holdingsByTicker[cleanKey] = lite
  }

  const pct = (v: number) =>
    investedValue > 0 ? Number(((v / investedValue) * 100).toFixed(1)) : 0

  const riskReport = analyzePortfolioRisks(holdings, totalCash, baseCurrency)

  return {
    portfolio: {
      investedValue,
      totalCash,
      totalWealth,
      cashPercent,
      unrealizedPnLPercent: Number(holdingsResult?.unrealizedPnLPercent || 0),
      holdingsCount: holdings.length,
      topHoldings: normalizedList
        .sort((a, b) => b.allocationPercent - a.allocationPercent)
        .slice(0, 6),
      holdingsByTicker,
      assetMix: {
        usPercent: pct(usValue),
        thPercent: pct(thValue),
        goldPercent: pct(goldValue),
        cryptoPercent: pct(cryptoValue),
        otherPercent: pct(otherValue),
      },
    },
    riskSnapshot: {
      overallRiskLevel: riskReport.overallRiskLevel,
      overallRiskScore: riskReport.overallRiskScore,
      overweightSectors: riskReport.sectorBreakdown
        .filter((s) => s.isOverweight)
        .map((s) => `${s.sector} ${s.percent.toFixed(1)}%`),
      topWarnings: riskReport.keyWarnings.slice(0, 2),
    },
  }
}

export async function getUnifiedPortfolioContext(
  userId: string,
  options?: {
    baseCurrency?: string
    holdingsResult?: PortfolioHoldingsResult
    totalCash?: number
    forceRefresh?: boolean
  }
): Promise<UnifiedAiContext> {
  const requestedBase = options?.baseCurrency
  const canUseCache =
    !options?.forceRefresh &&
    !options?.holdingsResult &&
    options?.totalCash === undefined &&
    requestedBase !== undefined

  if (canUseCache) {
    const cached = unifiedContextCache.get(`${userId}:${requestedBase}`)
    if (cached && Date.now() - cached.timestamp < UNIFIED_CONTEXT_TTL_MS) {
      return cached.data
    }
  }

  type AdvisorReportDelegate = {
    findFirst: (args: {
      where: { userId: string }
      orderBy: Array<{ reportDate?: 'desc'; revision?: 'desc' }>
      select: { reportDate: true; text: true }
    }) => Promise<{ reportDate: string; text: string } | null>
  }
  const advisorReportClient = (prisma as unknown as { advisorReport?: AdvisorReportDelegate }).advisorReport

  const [
    userSettings,
    defaultPreset,
    latestAlert,
    latestAdvisorReport,
    recentLogs,
  ] = await Promise.all([
    prisma.userSettings
      .findUnique({
        where: { userId },
        select: { baseCurrency: true, defaultRiskProfile: true },
      })
      .catch(() => null),
    prisma.investmentPreset
      .findFirst({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: {
          presetName: true,
          targetAmount: true,
          monthlyContribution: true,
          riskProfile: true,
        },
      })
      .catch(() => null),
    prisma.allocationAlert
      .findFirst({
        where: { userId, acknowledged: false },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, aiSummaryText: true },
      })
      .catch(() => null),
    (advisorReportClient
      ? advisorReportClient.findFirst({
          where: { userId },
          orderBy: [{ reportDate: 'desc' }, { revision: 'desc' }],
          select: { reportDate: true, text: true },
        })
      : Promise.resolve(null)
    ).catch(() => null),
    prisma.aiAdviceLog
      .findMany({
        where: { userId, logType: 'advisor' },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { prompt: true, response: true, createdAt: true },
      })
      .catch(() => []),
  ])

  const baseCurrency = requestedBase || userSettings?.baseCurrency || 'THB'

  if (
    !options?.forceRefresh &&
    !options?.holdingsResult &&
    options?.totalCash === undefined &&
    !requestedBase
  ) {
    const cached = unifiedContextCache.get(`${userId}:${baseCurrency}`)
    if (cached && Date.now() - cached.timestamp < UNIFIED_CONTEXT_TTL_MS) {
      return cached.data
    }
  }

  const [holdingsResult, resolvedCash] = await Promise.all([
    options?.holdingsResult
      ? Promise.resolve(options.holdingsResult)
      : calculateUserHoldings(userId, baseCurrency, false).catch(() => null),
    options?.totalCash !== undefined
      ? Promise.resolve(options.totalCash)
      : prisma.investmentAccount
          .findMany({
            where: { userId },
            select: { cashBalance: true, currency: true },
          })
          .then((accounts) => sumAccountCashInBaseCurrency(accounts, baseCurrency))
          .catch(() => 0),
  ])

  const memory = parseUserInvestmentMemory(userSettings?.defaultRiskProfile)
  const { portfolio, riskSnapshot } = buildPortfolioSummary(
    holdingsResult,
    resolvedCash,
    baseCurrency
  )

  let tactical: TacticalContinuitySummary | null = null
  let radar: { date: string; summary: string } | null = null
  let regimeAlpha: {
    date: string
    headline: string
    topPicks: Array<{ ticker: string; role: string }>
  } | null = null
  let dailyBrief: { date: string; summary: string } | null = latestAdvisorReport
    ? {
        date: latestAdvisorReport.reportDate,
        summary: extractMarkdownHeadline(latestAdvisorReport.text, 170),
      }
    : null
  let copilot: { date: string; lastQuestion: string; lastAnswerSummary: string } | null = null

  for (const log of recentLogs) {
    if (!tactical && log.prompt.includes('[AI Tactical Regime & Portfolio Advisor]')) {
      tactical = extractTacticalContinuity(log.response, log.createdAt)
    } else if (!radar && log.prompt.includes('[AI Risk Sentinel]')) {
      const summary = extractMarkdownHeadline(log.response, 170)
      if (summary) radar = { date: formatShortDateBangkok(log.createdAt), summary }
    } else if (!regimeAlpha && log.prompt.includes('[AI Regime Alpha Opportunities]')) {
      regimeAlpha = extractRegimeAlphaContinuity(log.response, log.createdAt)
    } else if (!dailyBrief && log.prompt.includes('[daily-brief:v2]')) {
      const summary = extractMarkdownHeadline(log.response, 170)
      if (summary) dailyBrief = { date: formatShortDateBangkok(log.createdAt), summary }
    } else if (!copilot && log.prompt === '[AI_COPILOT_THREAD]') {
      try {
        const msgs = JSON.parse(log.response)
        if (Array.isArray(msgs) && msgs.length > 0) {
          const lastUser = [...msgs].reverse().find((m: any) => m?.role === 'user')
          const lastBot = [...msgs].reverse().find((m: any) => m?.role === 'assistant')
          if (lastUser?.content && lastBot?.content) {
            copilot = {
              date: formatShortDateBangkok(log.createdAt),
              lastQuestion: String(lastUser.content).slice(0, 90),
              lastAnswerSummary: extractMarkdownHeadline(String(lastBot.content), 150),
            }
          }
        }
      } catch {
        // ignore malformed thread
      }
    }
    if (tactical && radar && regimeAlpha && dailyBrief && copilot) break
  }

  const unacknowledgedAlert =
    latestAlert && latestAlert.aiSummaryText
      ? {
          date: formatShortDateBangkok(latestAlert.createdAt),
          summary: extractMarkdownHeadline(latestAlert.aiSummaryText, 150),
        }
      : null

  const context: UnifiedAiContext = {
    userId,
    baseCurrency,
    assembledAt: new Date().toISOString(),
    memory,
    activePreset: defaultPreset
      ? {
          presetName: defaultPreset.presetName,
          targetAmount: defaultPreset.targetAmount ? Number(defaultPreset.targetAmount) : null,
          monthlyContribution: defaultPreset.monthlyContribution
            ? Number(defaultPreset.monthlyContribution)
            : null,
          riskProfile: defaultPreset.riskProfile,
        }
      : null,
    portfolio,
    riskSnapshot,
    continuity: {
      tactical,
      radar,
      regimeAlpha,
      dailyBrief,
      copilot,
      unacknowledgedAlert,
    },
  }

  unifiedContextCache.set(`${userId}:${baseCurrency}`, {
    data: context,
    timestamp: Date.now(),
  })

  return context
}

export function formatUnifiedContextPrompt(
  ctx: UnifiedAiContext,
  options?: {
    excludeSurface?: AiSurface
    focusSymbol?: string
    compact?: boolean
  }
): string {
  const exclude = options?.excludeSurface
  const compact = Boolean(options?.compact)
  const money = (v: number) => `${Math.round(v).toLocaleString('th-TH')} ${ctx.baseCurrency}`

  const mixParts = [
    ctx.portfolio.assetMix.usPercent > 0 ? `US ${ctx.portfolio.assetMix.usPercent}%` : null,
    ctx.portfolio.assetMix.thPercent > 0 ? `TH ${ctx.portfolio.assetMix.thPercent}%` : null,
    ctx.portfolio.assetMix.goldPercent > 0 ? `Gold ${ctx.portfolio.assetMix.goldPercent}%` : null,
    ctx.portfolio.assetMix.cryptoPercent > 0 ? `Crypto ${ctx.portfolio.assetMix.cryptoPercent}%` : null,
  ].filter(Boolean)

  const topLimit = compact ? 4 : 5
  const topHoldingsLine =
    ctx.portfolio.topHoldings.length > 0
      ? ctx.portfolio.topHoldings
          .slice(0, topLimit)
          .map(
            (h) =>
              `${h.ticker}(${h.allocationPercent.toFixed(1)}%, P&L ${h.unrealizedPnLPercent >= 0 ? '+' : ''}${h.unrealizedPnLPercent.toFixed(1)}%)`
          )
          .join(' | ')
      : 'ยังไม่มีสินทรัพย์ถือครอง'

  const lines: string[] = [
    '=== ศูนย์กลางบริบทพอร์ตและความต่อเนื่องข้ามหน้า (UNIFIED PORTFOLIO & AI CONTINUITY) ===',
    `- ภาพรวมพอร์ตจริง: ลงทุน ${money(ctx.portfolio.investedValue)} + เงินสด ${money(ctx.portfolio.totalCash)} (${ctx.portfolio.cashPercent}% Dry Powder) | P&L รวม ${ctx.portfolio.unrealizedPnLPercent >= 0 ? '+' : ''}${ctx.portfolio.unrealizedPnLPercent.toFixed(1)}% | สัดส่วนตลาด: ${mixParts.join(' · ') || 'ไม่ระบุ'}`,
    `- ตัวหลักในพอร์ต (${ctx.portfolio.holdingsCount} ตัว): ${topHoldingsLine}`,
    `- Risk Sentinel (คำนวณจริง): ระดับ ${ctx.riskSnapshot.overallRiskLevel} (${ctx.riskSnapshot.overallRiskScore}/100)${ctx.riskSnapshot.overweightSectors.length ? ` | Overweight: ${ctx.riskSnapshot.overweightSectors.join(', ')}` : ''}${ctx.riskSnapshot.topWarnings.length ? ` | เตือน: ${ctx.riskSnapshot.topWarnings.join(' ; ')}` : ''}`,
    `- กฎส่วนตัว (AI Memory): รับความเสี่ยง ${ctx.memory.riskTolerance} | กรอบ ${ctx.memory.horizonYears} ปี | เพดานหุ้นเดียวไม่เกิน ${ctx.memory.maxSinglePositionPercent}% | MaxDD ${ctx.memory.maxDrawdownTolerancePercent}% | สไตล์: ${ctx.memory.preferredStyle}${ctx.memory.personalRules ? ` | กฎเหล็ก: ${ctx.memory.personalRules}` : ''}`,
  ]

  if (ctx.activePreset) {
    lines.push(
      `- แผนเป้าหมายที่ใช้อยู่: "${ctx.activePreset.presetName}"${ctx.activePreset.targetAmount ? ` | เป้า ${money(ctx.activePreset.targetAmount)}` : ''}${ctx.activePreset.monthlyContribution ? ` | งบ DCA ${money(ctx.activePreset.monthlyContribution)}/ด.` : ''}`
    )
  }

  if (options?.focusSymbol) {
    const cleanFocus = options.focusSymbol.trim().toUpperCase().replace(/^US:/, '')
    const matched =
      ctx.portfolio.holdingsByTicker[cleanFocus] ||
      ctx.portfolio.holdingsByTicker[cleanFocus.replace(/\.BK$/, '')]
    if (matched) {
      const capWarning =
        matched.allocationPercent >= ctx.memory.maxSinglePositionPercent
          ? ` ⚠️ เกิน/ชนเพดาน ${ctx.memory.maxSinglePositionPercent}% แล้ว!`
          : ''
      lines.push(
        `- สถานะ ${cleanFocus} ในพอร์ตของคุณ: ถืออยู่ ${matched.quantity.toFixed(4)} หน่วย | ต้นทุนเฉลี่ย ${matched.avgCost.toFixed(2)} ${matched.currency} | น้ำหนัก ${matched.allocationPercent.toFixed(1)}% (เพดาน ${ctx.memory.maxSinglePositionPercent}%)${capWarning} | P&L ${matched.unrealizedPnLPercent >= 0 ? '+' : ''}${matched.unrealizedPnLPercent.toFixed(1)}%`
      )
    } else {
      lines.push(
        `- สถานะ ${cleanFocus} ในพอร์ตของคุณ: ยังไม่ได้ถือครอง (ประเมินการเข้าซื้อเทียบเพดาน ${ctx.memory.maxSinglePositionPercent}%/ตัว และเงินสดสำรอง ${ctx.portfolio.cashPercent}%)`
      )
    }
  }

  const continuityLines: string[] = []
  if (exclude !== 'tactical' && ctx.continuity.tactical) {
    const t = ctx.continuity.tactical
    const actionTags = t.topActions.map((a) => `${a.ticker}:${a.action}`).join(', ')
    continuityLines.push(
      `  • Tactical Market Climate (${t.date}): เสี่ยง ${t.riskLevel}/5 — ${t.postureLabelTh || t.statusLabelTh} | เป้าเงินสด ${t.recommendedCashPercent}%${actionTags ? ` | แผนรายตัว: ${actionTags}` : ''}${t.thematicRiskAlert ? ` | เตือนธีม: ${t.thematicRiskAlert}` : ''}`
    )
  }
  if (exclude !== 'radar' && ctx.continuity.radar) {
    continuityLines.push(
      `  • Risk Sentinel Briefing (${ctx.continuity.radar.date}): ${ctx.continuity.radar.summary}`
    )
  }
  if (ctx.continuity.regimeAlpha) {
    const r = ctx.continuity.regimeAlpha
    const picksText = r.topPicks.map((p) => `${p.ticker}${p.role ? `(${p.role})` : ''}`).join(', ')
    continuityLines.push(
      `  • Regime Alpha Opportunities (${r.date}): ${r.headline}${picksText ? ` | ตัวเด่น: ${picksText}` : ''}`
    )
  }
  if (ctx.continuity.unacknowledgedAlert) {
    continuityLines.push(
      `  • 🚨 แจ้งเตือนพอร์ตที่ยังไม่กดรับทราบ (${ctx.continuity.unacknowledgedAlert.date}): ${ctx.continuity.unacknowledgedAlert.summary}`
    )
  }
  if (!compact && exclude !== 'daily_brief' && ctx.continuity.dailyBrief) {
    continuityLines.push(
      `  • Daily Morning Brief (${ctx.continuity.dailyBrief.date}): ${ctx.continuity.dailyBrief.summary}`
    )
  }
  if (!compact && exclude !== 'copilot' && ctx.continuity.copilot) {
    continuityLines.push(
      `  • หัวข้อล่าสุดใน Copilot (${ctx.continuity.copilot.date}): ถาม "${ctx.continuity.copilot.lastQuestion}" -> ${ctx.continuity.copilot.lastAnswerSummary}`
    )
  }

  if (continuityLines.length > 0) {
    lines.push('- ความต่อเนื่องจาก AI หน้าอื่นล่าสุด (ต้องสอดคล้องหรือระบุเหตุผลหากข้อมูลใหม่เปลี่ยน):')
    lines.push(...continuityLines)
  }

  return lines.join('\n')
}

export function buildUnifiedDecisionRules(surface: AiSurface): string {
  const nextLinksBySurface: Record<AiSurface, string> = {
    tactical: '/radar (เช็กกระจุกตัว/หมุนกลุ่ม), /plans (ปรับงบ DCA), /ai-advisor (ถามเจาะจงรายตัว)',
    copilot: '/tactical-advisor (สภาวะ 4 เสา), /radar (ความเสี่ยงโครงสร้าง), /plans (จัดสรร DCA), /tax-report (เช็กภาษีก่อนขาย)',
    radar: '/tactical-advisor (ตรวจจังหวะตลาด), /plans (ปรับสัดส่วน/ตะกร้า DCA), /tax-report (ประเมินภาษีก่อนขายลดน้ำหนัก)',
    daily_brief: '/tactical-advisor (เจาะแผน 4 เสา), /radar (เช็กเตือนกระจุกตัว), /ai-advisor (ถามต่อยอดหรือจำลองงบ)',
    plans_analyze: '/tactical-advisor (เช็กจังหวะตลาดก่อนเคาะ), /radar (กันซื้อซ้ำกลุ่ม Overweight), /forecast (วัดระยะถึงเป้า)',
    bucket_chat: '/tactical-advisor (เทียบสภาวะตลาดรวม), /radar (เช็กน้ำหนักเกินเป้า), /tax-report (เช็กภาษีก่อนขายทำกำไร)',
    forecast: '/plans (ปรับงบ DCA/ตะกร้าเพื่อให้ถึงเป้า), /radar (ลด Drawdown เสี่ยง), /ai-advisor (จำลองสถานการณ์เพิ่มเงิน)',
    tax: '/radar (ตรวจหุ้นที่ควรลดน้ำหนัก), /plans (ปรับแผนเก็บ/ขาย), /ai-advisor (วางแผนสลับจังหวะรับรู้กำไร)',
    stock_insight: '/market-watch (แท็บ Daily Risk & DCA Simulator), /ai-advisor (เทียบผลต่อน้ำหนักพอร์ตและกฎส่วนตัว)',
    daily_stock_risk: '/ai-advisor (ถามเจาะจงเทียบพอร์ตรวม), /plans (ดูสัดส่วนในตะกร้ากลยุทธ์)',
    news: '/tactical-advisor (ดูผลกระทบต่อ 4 เสาตลาด), /ai-advisor (ถามแนวทางรับมือรายตัวจากข่าวนี้)',
    weekly_digest: '/daily-plan (แผนรายวัน), /tactical-advisor (กลยุทธ์สัปดาห์หน้า), /radar (ตรวจสมดุลพอร์ต)',
  }

  return [
    '=== มาตรฐานการตัดสินใจและความสอดคล้องข้ามระบบ ===',
    '1. ยึดความจริงและหลักฐาน: อ้างอิงเฉพาะตัวเลข ราคา สัญญาณ และวันที่ที่แนบมา ห้ามแต่งราคาเป้าหมาย จุดซื้อขาย หรือข้อสรุปภาษีที่ขาดหลักฐาน',
    '2. พูดองค์ประกอบไปทางเดียวกัน: ยึด Market Posture, คำเตือน Risk Sentinel, เพดานต่อหุ้น, และกฎใน AI Memory ให้สอดคล้องกัน หากข้อมูลสดในหน้านี้เปลี่ยนข้อสรุปเดิม ให้ชี้แจงชัดว่าอะไรเปลี่ยน',
    '3. อ่านแล้วรู้ทันทีว่าต้องทำอย่างไรต่อ: สรุป "แปลว่าอะไร -> ทำอะไรต่อเป็นขั้น 1-2-3 -> เงื่อนไขระวัง/เปลี่ยนแผน"',
    `4. เชื่อมต่อใช้งานต่อเนื่องในแอป: ชี้หน้าถัดไปที่ช่วยตัดสินใจต่อได้อย่างเหมาะสม (${nextLinksBySurface[surface]})`,
  ].join('\n')
}
