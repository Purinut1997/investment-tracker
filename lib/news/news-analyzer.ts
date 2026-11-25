/**
 * lib/news/news-analyzer.ts
 * Synthesizes financial news into actionable portfolio intelligence:
 * - Rule-based & AI-assisted Thai synthesis and 3-point takeaways
 * - Sentiment scoring & impact classification
 * - Daily portfolio brief generation
 * - Gemini deep-dive scenario analysis (Bull / Base / Bear)
 */

import { NewsSentiment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { isModelRecord, parseModelJson } from '@/lib/ai/model-contracts'
import { z } from 'zod'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import type { HoldingItem } from '@/lib/analytics/holdings'

export interface SynthesizedTakeaways {
  thaiHeadline: string
  takeaways: [string, string, string] // [เกิดอะไรขึ้น, กระทบพอร์ตอย่างไร, สิ่งที่ต้องจับตา]
  impactTag: string
  impactLevel: 'high' | 'medium' | 'low'
}

export interface NewsDeepDiveResult {
  whyItMatters: string
  fundamentalImpact: string
  scenarios: {
    bull: string
    base: string
    bear: string
  }
  actionPlan: string
  modelUsed?: string
}

export interface TodayMarketHighlight {
  id: string
  title: string
  tag: string
  detail: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relatedSymbol?: string
}

export interface MarketConsensus {
  mood: 'Risk-On' | 'Cautious' | 'Risk-Off' | 'Selective'
  moodLabel: string
  summary: string
  fedExpectation: string
  keyRisksToWatch: string
}

export interface PortfolioAssetImpact {
  symbol: string
  assetName?: string
  allocationPercent?: number
  impact: 'positive' | 'negative' | 'neutral' | 'mixed'
  headline: string
  detail: string
  actionSuggestion: string
}

export interface TimeframeStrategy {
  shortTerm: {
    period: string
    action: string
    focus: string
  }
  mediumTerm: {
    period: string
    action: string
    focus: string
  }
  longTerm: {
    period: string
    action: string
    focus: string
  }
}

export interface ActionPlanItem {
  id: string
  priority: 'high' | 'medium' | 'low'
  type: 'HOLD' | 'BUY_DIP' | 'REBALANCE' | 'WATCH' | 'DIVIDEND'
  badgeText: string
  title: string
  detail: string
}

export interface InterestingStockOpportunity {
  symbol: string
  name: string
  theme: string
  whyInteresting: string
  catalyst: string
  riskNote: string
}

export interface UserHoldingContext {
  ticker: string
  assetName: string
  assetType?: string
  allocationPercent: number
  unrealizedPnLPercent?: number
  currentPrice?: number
  currency?: string
  supportS1?: number | null
  supportS2?: number | null
  resistanceR1?: number | null
  sma50?: number | null
  sma200?: number | null
  rsi14?: number | null
  isNearSupport?: boolean
  isOversold?: boolean
  technicalSummary?: string
}

export async function buildUserHoldingTechnicalContexts(
  activeHoldings: HoldingItem[]
): Promise<UserHoldingContext[]> {
  return Promise.all(
    activeHoldings.map(async (h) => {
      const marketHint = h.market || (h.currency === 'THB' ? 'TH' : 'US')
      let sig = null
      try {
        sig = await fetchSingleTickerTechnicalSignal(h.ticker, marketHint)
      } catch {
        // ignore error and proceed
      }
      const price = h.currentPrice && h.currentPrice > 0 ? h.currentPrice : (sig?.currentPrice || 0)

      return {
        ticker: h.ticker.toUpperCase(),
        assetName: h.assetName,
        assetType: h.assetType,
        allocationPercent: Math.round(h.allocationPercent * 10) / 10,
        unrealizedPnLPercent: Math.round(h.unrealizedPnLPercent * 10) / 10,
        currentPrice: price,
        currency: h.currency,
        supportS1: sig?.supportS1 ?? (price > 0 ? Number((price * 0.975).toFixed(2)) : null),
        supportS2: sig?.supportS2 ?? (price > 0 ? Number((price * 0.95).toFixed(2)) : null),
        resistanceR1: sig?.resistanceR1 ?? (price > 0 ? Number((price * 1.03).toFixed(2)) : null),
        sma50: sig?.sma50 ?? null,
        sma200: sig?.sma200 ?? null,
        rsi14: sig?.rsi14 ?? null,
        isNearSupport: sig?.isNearSupport ?? false,
        isOversold: sig?.isOversold ?? false,
        technicalSummary: sig?.metricSummary ?? '',
      }
    })
  )
}

export interface MacroShockAlert {
  title: string
  severity: 'critical' | 'high' | 'medium'
  explanation: string
  marketDrivers: string[]
  fedInterestRateImpact: string
}

export interface UpcomingCatalystEvent {
  id: string
  eventNameTh: string
  eventNameEn: string
  expectedTiming: string // e.g. "พฤหัสบดีนี้ 19:30 น. (ตามเวลาไทย)"
  importance: 'critical' | 'high' | 'medium'
  category: 'inflation' | 'fed_interest_rate' | 'employment' | 'earnings' | 'policy'
  forecastText: string
  marketImpactScenario: {
    hot: string // if higher than forecast / hawkish
    cool: string // if lower than forecast / dovish / relief
  }
  portfolioPreparation: string // what holding should do
}

export interface HoldingDefensiveAction {
  symbol: string
  stance: 'BUY_DIP' | 'HOLD' | 'COLLECT_DIVIDEND' | 'WAIT' | 'TRIM'
  stanceLabel: string
  rationale: string
  supportOrActionLevel: string
}

export interface PortfolioDefensivePlaybook {
  overallStance: string
  cashBufferAdvice: string
  holdingPlaybook: HoldingDefensiveAction[]
  scenarioAPlan: {
    condition: string
    action: string
  }
  scenarioBPlan: {
    condition: string
    action: string
  }
}

export interface MarketDecisionTierItem {
  id: string
  title: string
  subTitle?: string
  status: 'bullish' | 'bearish' | 'neutral' | 'watch'
  statusLabel: string
  keyMetric?: string
  insight: string
  actionGuidance: string
}

export interface MarketDecisionFramework {
  overallStance: 'BUY' | 'HOLD' | 'WAIT'
  stanceLabel: string
  stanceBadgeColor: string
  summaryHeadline: string
  threeCoreQuestions: {
    marketFacing: string
    earningsTrend: string
    valuationRiskReward: string
  }
  tier1Regular: MarketDecisionTierItem[]
  tier2BuyTiming: MarketDecisionTierItem[]
  tier3EventDriven: MarketDecisionTierItem[]
  officialSources: Array<{
    name: string
    url: string
    description: string
    category: string
  }>
  disciplineRule: string
}

export interface PortfolioDailyBrief {
  evidenceVersion?: number
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
  sentimentScore: number // 0 - 100 (% bullish)
  positiveCount: number
  negativeCount: number
  neutralCount: number
  summaryOneLiner: string
  readingTimeMinutes?: number

  // 🧭 กรอบติดตามตลาด 3 ระดับ & แผนตัดสินใจ (ซื้อ • ถือ • รอ)
  decisionFramework?: MarketDecisionFramework

  // 🚨 แรงกระแทกสำคัญระดับมหภาค (Fed, CPI, Inflation Shock)
  macroShockAlert?: MacroShockAlert

  // 📅 เรดาร์เหตุการณ์ & ประกาศตัวเลขสำคัญเร็วๆ นี้ (Macro Catalyst Radar)
  upcomingCatalysts?: UpcomingCatalystEvent[]

  // 🛡️ แผนรับมือความผันผวน & กลยุทธ์พอร์ตของคุณ (Defensive Playbook)
  defensivePlaybook?: PortfolioDefensivePlaybook

  // 1. วันนี้เกิดอะไรขึ้น / ช่วงนี้เกิดอะไรขึ้น
  todayHighlights: TodayMarketHighlight[]

  // 2. คนคาดการณ์ตลาดว่ายังไง
  marketConsensus: MarketConsensus

  // 3. ส่งผลอย่างไรต่อพอร์ตของผม
  holdingsImpact: PortfolioAssetImpact[]

  // 4. แนวทางระยะสั้น กลาง ยาว
  timeframeStrategy: TimeframeStrategy

  // 5. ของพอร์ตผมควรทำยังไง (Action Checklist)
  actionPlan: ActionPlanItem[]

  // 6. หุ้น/สินทรัพย์ที่น่าสนใจในช่วงนี้ พร้อมเหตุผล
  interestingStocks: InterestingStockOpportunity[]

  tailwinds: string // ปัจจัยสนับสนุน (compatibility)
  headwinds: string // ปัจจัยเฝ้าระวัง/ความเสี่ยง (compatibility)
  strategicTakeaway: string // คำแนะนำกลยุทธ์วันนี้ (compatibility)
  generatedAt: string
  modelUsed?: string
}

// ============================================================
// 1. Keyword-based Sentiment Analyzer
// ============================================================
export { detectSentiment } from './sentiment'

// ============================================================
// 2. Smart Category Classifier
// ============================================================
export type NewsCategory = 'portfolio' | 'earnings' | 'macro' | 'general'

export function classifyNewsCategory(
  headline: string,
  summary?: string | null,
  isHeld: boolean = false
): NewsCategory {
  const text = `${headline} ${summary || ''}`.toLowerCase()

  // Macro & Interest Rates
  if (
    text.includes('fed') ||
    text.includes('federal reserve') ||
    text.includes('jerome powell') ||
    text.includes('interest rate') ||
    text.includes('cpi') ||
    text.includes('inflation') ||
    text.includes('treasury yield') ||
    text.includes('jobs report') ||
    text.includes('gdp') ||
    text.includes('recession')
  ) {
    return 'macro'
  }

  // Earnings & Financials
  if (
    text.includes('earnings') ||
    text.includes('quarterly revenue') ||
    text.includes('q1') ||
    text.includes('q2') ||
    text.includes('q3') ||
    text.includes('q4') ||
    text.includes('eps') ||
    text.includes('dividend') ||
    text.includes('guidance') ||
    text.includes('financial results') ||
    text.includes('operating profit')
  ) {
    return 'earnings'
  }

  // Direct Portfolio
  if (isHeld) {
    return 'portfolio'
  }

  return 'general'
}

// ============================================================
// 3. Ticker Relevance Check
// ============================================================
export function isHeadlineRelevantToTicker(headline: string, symbol: string | null, summary?: string | null): boolean {
  if (!symbol) return true
  const combined = `${headline} ${summary || ''}`.toUpperCase()
  const cleanSym = symbol.toUpperCase().trim()

  // Common ticker company & ETF name map
  const nameMap: Record<string, string[]> = {
    NVDA: ['NVIDIA', 'NVDA'],
    META: ['META', 'FACEBOOK'],
    AAPL: ['APPLE', 'AAPL', 'IPHONE'],
    MSFT: ['MICROSOFT', 'MSFT', 'AZURE'],
    GOOGL: ['GOOGLE', 'ALPHABET', 'GOOGL', 'GOOG'],
    GOOG: ['GOOGLE', 'ALPHABET', 'GOOGL', 'GOOG'],
    AMZN: ['AMAZON', 'AMZN', 'AWS'],
    TSLA: ['TESLA', 'TSLA', 'MUSK'],
    WDC: ['WESTERN DIGITAL', 'WDC'],
    SNDK: ['SANDISK', 'SNDK'],
    AMD: ['ADVANCED MICRO DEVICES', 'AMD'],
    AVGO: ['BROADCOM', 'AVGO'],
    TSM: ['TSMC', 'TAIWAN SEMICONDUCTOR', 'TSM'],
    MU: ['MICRON', 'MU'],
    INTC: ['INTEL', 'INTC'],
    BTC: ['BITCOIN', 'BTC', 'CRYPTO'],
    ETH: ['ETHEREUM', 'ETH'],
    SPY: ['S&P 500', 'SPY', 'S&P'],
    VOO: ['VOO', 'VANGUARD S&P 500', 'S&P 500', 'VANGUARD'],
    QQQ: ['NASDAQ', 'QQQ', 'TECH STOCKS'],
    QQQM: ['QQQM', 'NASDAQ 100', 'NASDAQ-100', 'INVESCO NASDAQ'],
    SCHD: ['SCHD', 'SCHWAB U.S. DIVIDEND', 'DIVIDEND ETF', 'SCHWAB DIVIDEND'],
    SCB: ['SCB', 'SCBX', 'ไทยพาณิชย์', 'เอสซีบี'],
    KBANK: ['KBANK', 'กสิกร', 'KASIKORN'],
    PTT: ['PTT', 'ปตท.'],
    ADVANC: ['ADVANC', 'AIS', 'แอดวานซ์'],
    AOT: ['AOT', 'ท่าอากาศยาน'],
    DELTA: ['DELTA', 'เดลต้า'],
    BDMS: ['BDMS', 'กรุงเทพดุสิต'],
    CPALL: ['CPALL', 'ซีพี ออลล์'],
    GULF: ['GULF', 'กัลฟ์'],
  }

  const aliases = nameMap[cleanSym] || [cleanSym]
  return aliases.some((alias) => combined.includes(alias))
}

// ============================================================
// 4. Fast Thai Synthesis & Key Takeaway Generator
// ============================================================
export function generateThaiSynthesis(
  headline: string,
  summary: string | null | undefined,
  symbol: string | null,
  sentiment: NewsSentiment
): SynthesizedTakeaways {
  const text = `${headline} ${summary || ''}`.toLowerCase()
  const cleanSym = symbol ? symbol.toUpperCase() : 'ตลาด'

  let thaiHeadline = headline
  let tag = 'ภาพรวมตลาด'
  let impactLevel: 'high' | 'medium' | 'low' = 'medium'

  // Pattern detection for Thai headline & tag
  if (text.includes('chip') || text.includes('ai') || text.includes('semiconductor')) {
    tag = 'อุตสาหกรรมชิป & AI'
    impactLevel = 'high'
  } else if (text.includes('earnings') || text.includes('revenue') || text.includes('profit')) {
    tag = 'ผลประกอบการ'
    impactLevel = 'high'
  } else if (text.includes('rate') || text.includes('fed') || text.includes('inflation')) {
    tag = 'นโยบายดอกเบี้ย & มหภาค'
    impactLevel = 'high'
  } else if (text.includes('dividend') || text.includes('buyback')) {
    tag = 'เงินปันผล & คืนทุน'
    impactLevel = 'medium'
  } else if (text.includes('upgrade') || text.includes('price target')) {
    tag = 'เป้าหมายราคาโบรกเกอร์'
    impactLevel = 'medium'
  } else if (text.includes('investigation') || text.includes('lawsuit') || text.includes('risk')) {
    tag = 'ประเด็นความเสี่ยง'
    impactLevel = 'high'
  }

  // Generate 3 crisp takeaways
  let bullet1 = `ความเคลื่อนไหวล่าสุดของ ${cleanSym}: มีรายงานประเด็นสำคัญเกี่ยวกับทิศทางธุรกิจหรือภาวะตลาด`
  let bullet2 = `ผลกระทบต่อพอร์ต: ข้อมูลนี้อยู่ในกลุ่ม sentiment ${
    sentiment === 'positive' ? 'เชิงบวก เสริมความเชื่อมั่นพื้นฐาน' : sentiment === 'negative' ? 'เฝ้าระวัง อาจสร้างความผันผวนระยะสั้น' : 'เป็นกลาง ยังไม่กระทบการจัดสรรสินทรัพย์หลัก'
  }`
  let bullet3 = `สิ่งที่ควรจับตา: ติดตามการตอบสนองของราคา และรายงานงบการเงินงวดถัดไปเพื่อยืนยันแนวโน้ม`

  if (sentiment === 'positive') {
    bullet1 = `ปัจจัยบวกสำหรับ ${cleanSym}: ตลาดตอบรับต่อแนวโน้มการเติบโตหรือสัญญาณผลการดำเนินงานที่แข็งแกร่ง`
    bullet2 = `ผลกระทบต่อพอร์ต: ช่วยสนับสนุนมูลค่าสินทรัพย์และลดความเสี่ยงจากการปรับฐานของกลุ่มนี้`
    bullet3 = `สิ่งที่ควรจับตา: ปริมาณการซื้อขายและเป้าหมายราคาเฉลี่ยของนักวิเคราะห์หลังมีข่าว`
  } else if (sentiment === 'negative') {
    bullet1 = `ปัจจัยเฝ้าระวังสำหรับ ${cleanSym}: มีประเด็นความกังวลหรือแรงกดดันที่อาจส่งผลกระทบต่อราคา`
    bullet2 = `ผลกระทบต่อพอร์ต: อาจเผชิญแรงขายทำกำไรหรือความผันผวน ควรประเมินสัดส่วนในพอร์ตเพื่อควบคุม Drawdown`
    bullet3 = `สิ่งที่ควรจับตา: แนวรับสำคัญทางเทคนิค และแถลงการณ์ชี้แจงจากฝ่ายบริหาร`
  }

  return {
    thaiHeadline,
    takeaways: [bullet1, bullet2, bullet3],
    impactTag: tag,
    impactLevel,
  }
}

// ============================================================
// 5. Portfolio Daily Brief Generator
// ============================================================

interface BriefCacheEntry {
  brief: PortfolioDailyBrief
  timestamp: number
}

const briefCache = new Map<string, BriefCacheEntry>()
const BRIEF_CACHE_TTL_MS = 20 * 60 * 1000 // 20 minutes

export function getTodayBangkokDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

export interface DailyBriefHistoryMeta {
  briefDate: string
  overallSentiment: string
  sentimentScore: number
  summaryHeadline: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getDailyBriefHistoryList(userId: string): Promise<DailyBriefHistoryMeta[]> {
  try {
    return await prisma.dailyBriefHistory.findMany({
      where: { userId, briefData: { path: ['evidenceVersion'], equals: 2 } },
      select: {
        briefDate: true,
        overallSentiment: true,
        sentimentScore: true,
        summaryHeadline: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { briefDate: 'desc' },
      take: 30,
    })
  } catch (error) {
    console.error('[getDailyBriefHistoryList]', error)
    return []
  }
}

export async function getDailyBriefByDate(userId: string, briefDate: string): Promise<PortfolioDailyBrief | null> {
  try {
    const record = await prisma.dailyBriefHistory.findUnique({
      where: {
        userId_briefDate: {
          userId,
          briefDate,
        },
      },
    })
    if (!record || !isModelRecord(record.briefData) || record.briefData.evidenceVersion !== 2) return null
    return record.briefData as unknown as PortfolioDailyBrief
  } catch (error) {
    console.error('[getDailyBriefByDate]', error)
    return null
  }
}

export function invalidateDailyBriefCache(userId?: string, date?: string) {
  if (userId) {
    if (date) {
      briefCache.delete(`${userId}:${date}`)
    } else {
      for (const key of briefCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          briefCache.delete(key)
        }
      }
      briefCache.delete(userId)
    }
  } else {
    briefCache.clear()
  }
}

export async function generateDailyBrief(
  userId: string,
  userHoldingsInput: UserHoldingContext[] | string[],
  recentNews: Array<{ headline: string; symbol: string | null; sentiment: NewsSentiment | null; publishedAt?: Date | string; sourceName?: string; sourceUrl?: string }>,
  geminiApiKeyConfigured: boolean,
  forceRefresh: boolean = false,
  targetDate?: string
): Promise<PortfolioDailyBrief> {
  const briefDate = targetDate || getTodayBangkokDateString()
  const cacheKey = `${userId}:${briefDate}`

  // Normalize user holdings
  const holdings: UserHoldingContext[] = (userHoldingsInput || []).map((item) => {
    if (typeof item === 'string') {
      return {
        ticker: item.toUpperCase(),
        assetName: item.toUpperCase(),
        allocationPercent: 0,
      }
    }
    return item
  })

  const userTickers = holdings.map((h) => h.ticker)

  // Check in-memory cache first
  if (!forceRefresh) {
    const cached = briefCache.get(cacheKey) || briefCache.get(userId)
    if (cached && Date.now() - cached.timestamp < BRIEF_CACHE_TTL_MS) {
      return cached.brief
    }

    // Check DB history
    try {
      const dbBrief = await getDailyBriefByDate(userId, briefDate)
      if (dbBrief) {
        briefCache.set(cacheKey, { brief: dbBrief, timestamp: Date.now() })
        return dbBrief
      }
    } catch (err) {
      console.warn('[News Analyzer] Failed to fetch brief from DB:', err)
    }
  }

  // News without a verified publication date is excluded from the current brief.
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const freshFilteredNews = recentNews.filter((n) => {
    if (!n.publishedAt) return false
    const ts = new Date(n.publishedAt).getTime()
    return Number.isFinite(ts) && ts >= sevenDaysAgoMs && ts <= Date.now()
  })
  const effectiveNews = freshFilteredNews

  // 1. Calculate sentiment metrics
  let positive = 0
  let negative = 0
  let neutral = 0

  for (const n of effectiveNews) {
    if (n.sentiment === 'positive') positive++
    else if (n.sentiment === 'negative') negative++
    else neutral++
  }

  const total = positive + negative + neutral
  const sentimentScore = total ? Math.round(((positive + neutral * 0.5) / total) * 100) : 50
  const overallSentiment = sentimentScore >= 60 ? 'bullish' : sentimentScore <= 35 ? 'bearish' : 'neutral'

  // Generate baseline / heuristic brief first
  const heuristicBrief = generateHeuristicDailyBrief(
    holdings,
    effectiveNews,
    positive,
    negative,
    neutral,
    sentimentScore,
    overallSentiment
  )

  let finalBrief: PortfolioDailyBrief = heuristicBrief

  // If Gemini is available, attempt AI-powered executive synthesis
  if (geminiApiKeyConfigured && effectiveNews.length > 0) {
    try {
      // Build balanced news digest: pick up to 2 latest items per held ticker + latest general market items
      const selectedDigestItems: typeof effectiveNews = []
      const usedHeadlines = new Set<string>()

      for (const ticker of userTickers) {
        const tickerMatches = effectiveNews
          .filter((n) => n.symbol?.toUpperCase() === ticker || isHeadlineRelevantToTicker(n.headline, ticker))
          .slice(0, 2)
        for (const item of tickerMatches) {
          if (selectedDigestItems.length < 18 && !usedHeadlines.has(item.headline)) {
            usedHeadlines.add(item.headline)
            selectedDigestItems.push(item)
          }
        }
      }

      for (const item of effectiveNews) {
        if (selectedDigestItems.length >= 18) break
        if (!usedHeadlines.has(item.headline)) {
          usedHeadlines.add(item.headline)
          selectedDigestItems.push(item)
        }
      }

      const newsDigest = selectedDigestItems
        .map((n) => {
          const dateTag = n.publishedAt
            ? new Date(n.publishedAt).toISOString().split('T')[0]
            : briefDate
          return `- [${dateTag}] [${n.symbol || 'MARKET'}] ${n.headline} | ${n.sourceName || 'ไม่ระบุแหล่งในชุดนี้'} ${n.sourceUrl || ''}`
        })
        .join('\n')

      const holdingsDigest = holdings.slice(0, 15).map((holding) =>
        `- ${holding.ticker} | สัดส่วนตามระบบ ${holding.allocationPercent}%`
      ).join('\n') || 'ไม่มีข้อมูลสินทรัพย์ในพอร์ต'

      const prompt = `[News Portfolio Brief v2] วันที่รายงาน ${briefDate}
สรุปข่าวที่ให้มาเป็นภาษาไทย แยกสิ่งที่รายงานออกจากผลกระทบที่เป็นสมมติฐาน
ข่าว:
${newsDigest}
สินทรัพย์:
${holdingsDigest}
ไม่ได้แนบตัวเลขทางเศรษฐกิจ ราคาตลาด และปฏิทินเหตุการณ์ที่ตรวจยืนยันแล้ว ห้ามแต่งหรือเสนอคำสั่งซื้อขาย
ตอบเป็น JSON {"summaryOneLiner":"สรุปข้อเท็จจริง","tailwinds":"ปัจจัยสนับสนุนที่พบหรือไม่มีข้อมูล","headwinds":"ปัจจัยเสี่ยงที่พบหรือไม่มีข้อมูล","strategicTakeaway":"สิ่งที่ควรตรวจต่อ"}`

      const res = await callGemini({
        userId, prompt, logType: 'advisor', thinkingBudget: 0,
        validateJson: (value) => newsNarrative.safeParse(value).success,
        skipLog: true,
      })
      const narrative = newsNarrative.parse(parseModelJson(res.text))
      finalBrief = { ...heuristicBrief, ...narrative, modelUsed: res.modelUsed }
    } catch (err) {
      console.warn('[News Analyzer] Gemini daily brief error, fallback used:', err)
      finalBrief = heuristicBrief
    }
  }

  // Cache final brief
  briefCache.set(cacheKey, { brief: finalBrief, timestamp: Date.now() })

  // Persist to Database DailyBriefHistory
  try {
    await prisma.dailyBriefHistory.upsert({
      where: {
        userId_briefDate: {
          userId,
          briefDate,
        },
      },
      update: {
        overallSentiment: finalBrief.overallSentiment,
        sentimentScore: finalBrief.sentimentScore,
        summaryHeadline: finalBrief.summaryOneLiner || finalBrief.strategicTakeaway || null,
        briefData: finalBrief as any,
        modelUsed: finalBrief.modelUsed || (geminiApiKeyConfigured ? 'gemini-flash' : 'rule-engine'),
      },
      create: {
        userId,
        briefDate,
        overallSentiment: finalBrief.overallSentiment,
        sentimentScore: finalBrief.sentimentScore,
        summaryHeadline: finalBrief.summaryOneLiner || finalBrief.strategicTakeaway || null,
        briefData: finalBrief as any,
        modelUsed: finalBrief.modelUsed || (geminiApiKeyConfigured ? 'gemini-flash' : 'rule-engine'),
      },
    })
  } catch (dbErr) {
    console.error('[News Analyzer] Failed to persist daily brief to DB:', dbErr)
  }

  return finalBrief
}

const newsText = z.string().trim().min(1).max(2000)
const newsNarrative = z.object({
  summaryOneLiner: newsText, tailwinds: newsText, headwinds: newsText, strategicTakeaway: newsText,
})
const newsDeepDiveSchema = z.object({
  whyItMatters: newsText, fundamentalImpact: newsText,
  scenarios: z.object({ bull: newsText, base: newsText, bear: newsText }),
  actionPlan: newsText,
})

function generateHeuristicDailyBrief(
  holdings: UserHoldingContext[],
  recentNews: Array<{ headline: string; symbol: string | null; sentiment: NewsSentiment | null }>,
  positive: number,
  negative: number,
  neutral: number,
  sentimentScore: number,
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
): PortfolioDailyBrief {
  const count = positive + negative + neutral
  const timeframeStrategy: TimeframeStrategy = {
    shortTerm: { period: 'ระยะสั้น', action: 'ตรวจต้นทางของข่าว', focus: 'วันเผยแพร่และข้อมูลที่บริษัทหรือหน่วยงานยืนยัน' },
    mediumTerm: { period: 'ระยะกลาง', action: 'ติดตามผลที่รายงานจริง', focus: 'งบการเงินและการเปลี่ยนแปลงสมมติฐาน' },
    longTerm: { period: 'ระยะยาว', action: 'ทบทวนความสอดคล้องกับแผน', focus: 'สัดส่วนการลงทุนและความเสี่ยงที่ยอมรับได้' },
  }
  const todayHighlights: TodayMarketHighlight[] = recentNews.slice(0, 8).map((item, index) => ({
    id: `news-${index}`, title: item.headline, tag: item.symbol ?? 'ข่าวทั่วไป',
    detail: 'หัวข้อจากคลังข่าว ตรวจรายละเอียดที่แหล่งต้นทาง',
    sentiment: item.sentiment === 'positive' || item.sentiment === 'negative' ? item.sentiment : 'neutral',
    relatedSymbol: item.symbol ?? undefined,
  }))
  const holdingsImpact: PortfolioAssetImpact[] = holdings.slice(0, 10).flatMap((holding) => {
    const item = recentNews.find((article) => article.symbol?.toUpperCase() === holding.ticker.toUpperCase())
    return item ? [{
      symbol: holding.ticker, assetName: holding.assetName, allocationPercent: holding.allocationPercent,
      impact: item.sentiment === 'positive' || item.sentiment === 'negative' ? item.sentiment : 'neutral',
      headline: item.headline, detail: 'จัดกลุ่มตามอารมณ์ของหัวข้อข่าว ผลต่อรายได้และราคายังไม่ยืนยัน',
      actionSuggestion: 'อ่านต้นฉบับและตรวจความเกี่ยวข้องกับกิจการ',
    }] : []
  })
  const summary = count ? `พบข่าว ${count} รายการใน 7 วันที่ผ่านมา แยกเป็นบวก ${positive} ลบ ${negative} และกลาง ${neutral}`
    : 'ไม่พบข่าวที่มีวันเผยแพร่ในช่วง 7 วันที่ผ่านมา'
  return {
    evidenceVersion: 2,
    overallSentiment, sentimentScore, positiveCount: positive, negativeCount: negative, neutralCount: neutral,
    summaryOneLiner: summary, readingTimeMinutes: 1, todayHighlights, holdingsImpact, timeframeStrategy,
    marketConsensus: {
      mood: 'Selective', moodLabel: 'อารมณ์จากหัวข้อข่าว', summary,
      fedExpectation: 'ยังไม่มีข้อมูลยืนยันนโยบาย Fed จากรายงานนี้',
      keyRisksToWatch: 'จำนวนและอารมณ์ข่าวไม่เพียงพอสำหรับสรุปทิศทางราคา',
    },
    actionPlan: [{
      id: 'verify-headlines', priority: 'medium', type: 'WATCH', badgeText: 'ตรวจสอบ',
      title: 'ตรวจข่าวที่เกี่ยวกับสินทรัพย์ในพอร์ต', detail: 'อ่านต้นฉบับและเปรียบเทียบกับข้อมูลบริษัทก่อนเปลี่ยนแผน',
    }],
    interestingStocks: [],
    tailwinds: positive ? `พบหัวข้อข่าวโทนบวก ${positive} รายการ` : 'ไม่มีหัวข้อข่าวบวกในชุดที่ตรวจ',
    headwinds: negative ? `พบหัวข้อข่าวโทนลบ ${negative} รายการ` : 'ไม่มีหัวข้อข่าวลบในชุดที่ตรวจ',
    strategicTakeaway: 'ใช้รายงานเพื่อเลือกเรื่องที่ต้องตรวจต่อ',
    generatedAt: new Date().toISOString(), modelUsed: 'สรุปจากข้อมูลระบบ',
  }
}

export function buildDefaultMarketDecisionFramework(
  _overallSentiment: 'bullish' | 'bearish' | 'neutral',
  _sentimentScore: number,
  userTickers: string[] = [],
  holdings: UserHoldingContext[] = []
): MarketDecisionFramework {
  const tracked = (holdings.length ? holdings.map((holding) => holding.ticker) : userTickers).slice(0, 5).join(', ')
  return {
    overallStance: 'WAIT',
    stanceLabel: 'ตรวจหลักฐานก่อนตัดสินใจ',
    stanceBadgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    summaryHeadline: 'อารมณ์ข่าวช่วยจัดลำดับเรื่องที่ควรอ่าน แต่ยังใช้ยืนยันแนวโน้มตลาดไม่ได้',
    threeCoreQuestions: {
      marketFacing: 'ข่าวยืนยันว่าเกิดอะไรขึ้น และเกิดเมื่อไร',
      earningsTrend: 'บริษัทเปิดเผยตัวเลขหรือเปลี่ยนประมาณการแล้วหรือยัง',
      valuationRiskReward: 'ข้อมูลนั้นเปลี่ยนสมมติฐานหรือสัดส่วนเป้าหมายของพอร์ตอย่างไร',
    },
    tier1Regular: [{
      id: 'verified-data', title: 'ข้อมูลที่ตรวจได้', status: 'watch', statusLabel: 'ติดตาม',
      insight: 'ให้ใช้วันที่และแหล่งต้นฉบับประกอบการประเมิน',
      actionGuidance: 'เทียบหัวข้อข่าวกับข้อมูลบริษัทหรือหน่วยงานที่เผยแพร่',
    }],
    tier2BuyTiming: tracked ? [{
      id: 'portfolio-context', title: 'สินทรัพย์ที่ติดตาม', status: 'watch', statusLabel: 'ตรวจผลต่อพอร์ต',
      keyMetric: tracked, insight: 'พิจารณาตามสัดส่วนและความเสี่ยงที่ผู้ใช้ตั้งไว้',
      actionGuidance: 'ตรวจราคาและสัญญาณจากกราฟหุ้นก่อนพิจารณาจุดเข้าออก',
    }] : [],
    tier3EventDriven: [],
    officialSources: [],
    disciplineRule: 'ยืนยันตัวเลขจากต้นทางก่อนปรับสัดส่วนหรือใช้ข่าวเป็นเหตุผลซื้อขาย',
  }
}

// ============================================================
// 6. News Deep-Dive Scenario Analysis (Bull / Base / Bear)
// ============================================================
export async function generateNewsDeepDive(
  userId: string,
  headline: string,
  summary: string | null,
  symbol: string | null,
  source?: { sourceName: string; sourceUrl: string; publishedAt: Date } | null,
): Promise<NewsDeepDiveResult> {
  const targetSymbol = symbol ? symbol.toUpperCase() : 'ตลาดการเงินรวม'

  const prompt = `คุณคือ Investment Intelligence AI ประจำระบบ Investment Pro
กรุณาวิเคราะห์ข่าวต่อไปนี้อย่างลึกซึ้งและเป็นกลาง:
สินทรัพย์: ${targetSymbol}
หัวข้อข่าว: ${headline}
แหล่งและวันเผยแพร่: ${source ? `${source.sourceName} | ${source.publishedAt.toISOString()} | ${source.sourceUrl}` : 'ข้อมูลจากผู้ใช้ ยังไม่ยืนยันแหล่งหรือวันเผยแพร่'}
เนื้อหาย่อ: ${summary?.slice(0, 8000) || 'ไม่มีเนื้อหาย่อ'}
จำกัดข้อเท็จจริงไว้ที่เนื้อหาที่ให้มา แยกกรณีสมมติและระบุข้อมูลที่ต้องอ่านต้นฉบับ ห้ามสรุปว่าข่าวนี้เป็นข่าวล่าสุด

ตอบกลับเป็น JSON ภาษาไทยที่มีโครงสร้างดังนี้เท่านั้น:
{
  "whyItMatters": "อธิบายเหตุผลว่าทำไมข่าวนี้ถึงมีนัยสำคัญต่อสินทรัพย์หรือพอร์ตลงทุนนี้ (2-3 บรรทัด)",
  "fundamentalImpact": "วิเคราะห์ผลกระทบต่อพื้นฐานกิจการ (รายได้, อัตรากำไร, ความสามารถในการแข่งขัน หรือ Valuation) (2-3 บรรทัด)",
  "scenarios": {
    "bull": "กรณีปัจจัยนี้ส่งผลดีเกินคาด ราคาและผลการดำเนินงานจะเป็นอย่างไร",
    "base": "กรณีที่เป็นไปตามประมาณการปกติของตลาด",
    "bear": "ความเสี่ยงหรือปัจจัยลบที่อาจเกิดขึ้นหากมีข้อผิดพลาด"
  },
  "actionPlan": "คำแนะนำการตัดสินใจของนักลงทุน (เช่น ถือต่อเพื่อรอปันผล, ทยอยสะสมเมื่อย่อตัว, หรือลดน้ำหนักความเสี่ยง)"
}`

  try {
    const res = await callGemini({
      userId, prompt, logType: 'advisor', thinkingBudget: 0,
      validateJson: (value) => newsDeepDiveSchema.safeParse(value).success,
      skipLog: true,
    })
    return { ...newsDeepDiveSchema.parse(parseModelJson(res.text)), modelUsed: res.modelUsed }
  } catch {
    return {
      whyItMatters: 'ระบบยังไม่มีบทวิเคราะห์ที่ตรวจรูปแบบผ่าน กรุณาอ่านข่าวจากแหล่งต้นทาง',
      fundamentalImpact: 'ข้อมูลที่ให้ยังไม่เพียงพอจะยืนยันผลต่อรายได้ กำไร หรือมูลค่ากิจการ',
      scenarios: { bull: 'ไม่มีข้อมูล', base: 'ไม่มีข้อมูล', bear: 'ไม่มีข้อมูล' },
      actionPlan: 'ตรวจวันเผยแพร่ ข้อมูลบริษัท และตัวเลขที่ข่าวอ้างก่อนนำไปตัดสินใจ',
      modelUsed: 'ข้อมูลไม่เพียงพอ',
    }
  }
}
