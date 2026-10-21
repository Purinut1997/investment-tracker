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
const POSITIVE_PATTERNS = [
  /\b(surge|surges|surged|surging|jump|jumps|jumped|rally|rallies|rallied|gain|gains|gained)\b/i,
  /\b(beat|beats|beaten|record high|all-time high|ath|boom|bullish|upgrade|upgrades|upgraded)\b/i,
  /\b(buyback|dividend hike|growth|outperform|strong demand|accelerat(e|es|ing))\b/i,
  /\b(profit rise|revenue jump|guidance raised|partnership|breakthrough|positive)\b/i,
  /\b(soar|soars|soared|skyrocket|top estimates)\b/i,
]

const NEGATIVE_PATTERNS = [
  /\b(drop|drops|dropped|fall|falls|fallen|plunge|plunges|plunged|slump|slumps|slumped)\b/i,
  /\b(miss|misses|missed|warning|warns|downgrade|downgrades|downgraded|bearish)\b/i,
  /\b(sell-off|crash|investigation|lawsuit|probe|probe|risk|risks|threat|loss|losses)\b/i,
  /\b(inflation fears|recession|rate hike|layoffs|cut forecast|weak demand|headwind)\b/i,
  /\b(plummet|plummeted|stumble|stumbles|retreat|tumble)\b/i,
]

export function detectSentiment(headline: string, summary?: string | null): NewsSentiment {
  const text = `${headline} ${summary || ''}`
  let posScore = 0
  let negScore = 0

  for (const regex of POSITIVE_PATTERNS) {
    if (regex.test(text)) posScore++
  }
  for (const regex of NEGATIVE_PATTERNS) {
    if (regex.test(text)) negScore++
  }

  if (posScore > negScore) return 'positive'
  if (negScore > posScore) return 'negative'
  return 'neutral'
}

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
      where: { userId },
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
    if (!record || !record.briefData) return null
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
  recentNews: Array<{ headline: string; symbol: string | null; sentiment: NewsSentiment | null; publishedAt?: Date | string }>,
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

  // Filter out stale news older than 7 days when recent news is available
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const freshFilteredNews = recentNews.filter((n) => {
    if (!n.publishedAt) return true
    const ts = new Date(n.publishedAt).getTime()
    return !Number.isNaN(ts) && ts >= sevenDaysAgoMs
  })
  const effectiveNews = freshFilteredNews.length > 0 ? freshFilteredNews : recentNews

  // 1. Calculate sentiment metrics
  let positive = 0
  let negative = 0
  let neutral = 0

  for (const n of effectiveNews) {
    if (n.sentiment === 'positive') positive++
    else if (n.sentiment === 'negative') negative++
    else neutral++
  }

  const total = positive + negative + neutral || 1
  const sentimentScore = Math.round((positive / total) * 100)
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
          if (!usedHeadlines.has(item.headline)) {
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
          return `- [${dateTag}] [${n.symbol || 'MARKET'}] ${n.headline}`
        })
        .join('\n')

      const holdingsDigest = holdings.length > 0
        ? holdings.map((h) => {
            const isTHB = h.currency === 'THB'
            const prefix = isTHB ? '' : '$'
            const suffix = isTHB ? ' บาท' : ''
            const priceStr = h.currentPrice != null && h.currentPrice > 0 ? `${prefix}${h.currentPrice}${suffix}` : 'N/A'
            const s1Str = h.supportS1 != null ? `${prefix}${h.supportS1}${suffix}` : ''
            const s2Str = h.supportS2 != null ? `${prefix}${h.supportS2}${suffix}` : ''
            const smaStr = h.sma50 != null ? `SMA50: ${prefix}${h.sma50}${suffix}` : ''
            const rsiStr = h.rsi14 != null ? `RSI: ${h.rsi14}` : ''
            const techParts = [
              s1Str ? `แนวรับแรก (S1): ${s1Str}` : '',
              s2Str ? `แนวรับสอง (S2): ${s2Str}` : '',
              smaStr,
              rsiStr,
            ].filter(Boolean).join(', ')

            return `- [${h.ticker}] ${h.assetName} (สัดส่วน ${h.allocationPercent}%): ราคาตลาดปัจจุบัน ${priceStr}${techParts ? ` | สัญญาณเทคนิคจากระบบ: ${techParts}` : ''}`
          }).join('\n')
        : 'หุ้นเทคโนโลยีและดัชนีหลัก'

      const prompt = `คุณคือหัวหน้านักกลยุทธ์การลงทุนอาวุโส (Chief Investment Strategist) ของ Investment Pro
ทำหน้าที่สรุปบทวิเคราะห์ข่าวสารและกลยุทธ์พอร์ตประจำวัน (Executive Daily Portfolio Intelligence Brief) ประจำวันที่ ${briefDate} ให้อ่านง่าย สั้น กระชับ ได้ใจความ เหมาะสำหรับนักลงทุนอ่านจบใน 2 นาที

ข้อมูลพอร์ตของผู้ใช้ (อ้างอิงราคาตลาดและระดับเทคนิคจริงของระบบ):
${holdingsDigest}

ข่าวสารสำคัญล่าสุดในตลาด (อ้างอิงเฉพาะข่าวสดใหม่ด้านล่างนี้):
${newsDigest}

*** กฎเหล็กที่สำคัญที่สุดเรื่องระดับราคาและแนวรับใน holdingPlaybook (STRICT PRICING ACCURACY RULE): ***
1. ห้ามสร้าง/มโนตัวเลขราคาหรือแนวรับขึ้นมาเองเด็ดขาด! ต้องอ้างอิงจาก "ราคาตลาดปัจจุบัน" และ "สัญญาณเทคนิคจากระบบ (แนวรับ S1, S2, SMA50)" ที่ระบุไว้ในข้อมูลพอร์ตด้านบนเท่านั้น
2. ในฟิลด์ "supportOrActionLevel" ของแต่ละหุ้นใน holdingPlaybook:
   - ต้องระบุ "แนวรับ" (Support Level) เพื่อให้ผู้ใช้วางแผนตั้งรับการย่อตัว (ห้ามใส่เป็นแนวต้าน เว้นแต่มีเหตุผลเฉพาะ)
   - ห้ามระบุแนวรับลึกผิดปกติเด็ดขาด! เช่น หุ้นราคา $300 แนวรับต้องอยู่ใกล้ $291-$292 ตาม S1 หรือ ~$277 ตาม S2 (ห้ามระบุ $175-180 เด็ดขาด)
   - รูปแบบที่ถูกต้อง เช่น "แนวรับ S1: $291 - $292 (รับถัดไป S2: $277)" หรือ "แนวรับ S1: 140 บาท (SMA50: 151 บาท)" หรือ "แนวรับ S1: $32.3 - $32.5 (SMA50: $33.9)"
   - ระบุสกุลเงินให้ตรงกับสินทรัพย์: หุ้นไทย (SCB) ใช้ "บาท", หุ้นสหรัฐฯ (QQQM, SCHD, GOOGL, VOO, WDC) ใช้ "$"

กรุณาวิเคราะห์และตอบกลับในรูปแบบ JSON ภาษาไทยที่มีโครงสร้างดังนี้เท่านั้น (ห้ามใส่ Markdown หรือข้อความนอก JSON):
{
  "summaryOneLiner": "สรุปภาพรวมตลาดและผลต่อพอร์ตของผู้ใช้ใน 1 ประโยคเด่น ชัดเจนและตรงกับสภาวะจริง (เช่น ผลจากตัวเลขเงินเฟ้อ CPI/Fed)",
  "macroShockAlert": {
    "title": "สรุปแรงกระแทกมหภาคหลักล่าสุด เช่น ตัวเลขเงินเฟ้อ US CPI สูงกว่าคาด ส่งผล Fed ชะลอการลดดอกเบี้ย ตลาดปรับฐานระยะสั้น",
    "severity": "critical | high | medium",
    "explanation": "อธิบายสั้นๆ ชัดเจน 2-3 บรรทัด ว่าเกิดอะไรขึ้น ทำไมตลาดถึงแย่หรือย่อตัวลง (เช่น Bond Yield พุ่ง, ลดความหวังลดดอกเบี้ย)",
    "marketDrivers": [
      "ปัจจัยขับเคลื่อนที่ 1",
      "ปัจจัยขับเคลื่อนที่ 2",
      "ปัจจัยขับเคลื่อนที่ 3"
    ],
    "fedInterestRateImpact": "ผลกระทบต่อการคาดการณ์ดอกเบี้ยของ Fed"
  },
  "upcomingCatalysts": [
    {
      "id": "c1",
      "eventNameTh": "ชื่อเหตุการณ์/การประกาศตัวเลขภาษาไทย (เช่น ประกาศดัชนีราคาผู้ผลิต US PPI, ถ้อยแถลง Powell, ประกาศงบ Big Tech)",
      "eventNameEn": "English Event Name",
      "expectedTiming": "วันและเวลาที่ตลาดรอ เช่น พฤหัสบดีนี้ 19:30 น. (ตามเวลาไทย)",
      "importance": "critical | high | medium",
      "category": "inflation | fed_interest_rate | employment | earnings | policy",
      "forecastText": "สิ่งที่ตลาดคาดการณ์สั้นๆ",
      "marketImpactScenario": {
        "hot": "หากตัวเลขสูงกว่าคาด/ตึงตัว: ผลกระทบต่อตลาดและราคา",
        "cool": "หากตัวเลขชะลอตัวลง: ผลกระทบต่อตลาดและการรีบาวด์"
      },
      "portfolioPreparation": "คำแนะนำว่าพอร์ตของผู้ใช้ควรเตรียมตัวอย่างไรก่อนตัวเลขนี้ประกาศ"
    }
  ],
  "defensivePlaybook": {
    "overallStance": "ท่าทีกลยุทธ์ภาพรวม เช่น ตั้งรับอย่างมีกลยุทธ์ (Defensive Accumulation): ไม่ Panic Sell แต่รักษาสภาพคล่อง",
    "cashBufferAdvice": "คำแนะนำการจัดสรรเงินสด/สภาพคล่อง เช่น สำรองเงินสด 10-15% ไว้รอซื้อจังหวะ Oversold",
    "holdingPlaybook": [
      {
        "symbol": "ตัวย่อหุ้นในพอร์ต เช่น GOOGL",
        "stance": "BUY_DIP | HOLD | COLLECT_DIVIDEND | WAIT | TRIM",
        "stanceLabel": "คำแนะนำการกระทำชัดเจน",
        "rationale": "เหตุผลว่าทำไมถึงต้องทำแบบนี้ต่อผลกระทบจากดอกเบี้ย/เงินเฟ้อ",
        "supportOrActionLevel": "แนวรับ S1 หรือจุดสังเกตจริงที่อ้างอิงจากข้อมูลเทคนิคด้านบน"
      }
    ],
    "scenarioAPlan": {
      "condition": "หากเงินเฟ้อ/ดอกเบี้ยยังกดดันต่อ และตลาดปรับฐานลงอีก",
      "action": "แผนปฏิบัติการรับมือชัดเจน"
    },
    "scenarioBPlan": {
      "condition": "หากตลาดเริ่มดูดซับข่าวจบ และเริ่มมีแรงซื้อคืน Technical Rebound",
      "action": "แผนปฏิบัติการรับมือชัดเจน"
    }
  },
  "todayHighlights": [
    {
      "id": "h1",
      "title": "หัวข้อข่าวเด่นสั้นๆ",
      "tag": "หมวด เช่น ดอกเบี้ย FED & เงินเฟ้อ, เทคโนโลยี & AI",
      "detail": "คำอธิบายกระชับ 1-2 บรรทัด ว่าเกิดอะไรขึ้นวันนี้/ช่วงนี้",
      "sentiment": "positive | negative | neutral"
    }
  ],
  "marketConsensus": {
    "mood": "Cautious | Risk-Off | Selective | Risk-On",
    "moodLabel": "คำอธิบายอารมณ์ตลาดภาษาไทย",
    "summary": "สรุปมุมมองว่าคนในตลาดและนักวิเคราะห์ Wall Street กำลังคิดหรือคาดการณ์อะไรช่วงนี้ (1-2 บรรทัด)",
    "fedExpectation": "คาดการณ์นโยบายดอกเบี้ย FED และแนวโน้มเศรษฐกิจ (1-2 บรรทัด)",
    "keyRisksToWatch": "ความเสี่ยงหลักที่ตลาดกำลังจับตามอง (1 บรรทัด)"
  },
  "holdingsImpact": [
    {
      "symbol": "ตัวย่อหุ้นที่ผู้ใช้ถือ (เช่น GOOGL)",
      "impact": "positive | negative | neutral | mixed",
      "headline": "สรุปผลกระทบตรงๆ 1 บรรทัด",
      "detail": "อธิบายเหตุผลสั้นๆ 1-2 บรรทัดว่าข่าวนี้ส่งผลอย่างไรต่อหุ้นตัวนี้ในพอร์ต",
      "actionSuggestion": "คำแนะนำสั้นๆ เช่น ถือต่อรับการเติบโต, สะสมเมื่อย่อตัว, รับเงินปันผล"
    }
  ],
  "timeframeStrategy": {
    "shortTerm": {
      "period": "ระยะสั้น (1 - 7 วัน)",
      "action": "คำแนะนำการปฏิบัติระยะสั้น",
      "focus": "สิ่งที่ต้องจับตาเป็นพิเศษสัปดาห์นี้"
    },
    "mediumTerm": {
      "period": "ระยะกลาง (1 - 3 เดือน)",
      "action": "คำแนะนำการปรับสัดส่วนหรือสะสมระยะกลาง",
      "focus": "สิ่งที่ต้องโฟกัสในระดับไตรมาส"
    },
    "longTerm": {
      "period": "ระยะยาว (6 - 12 เดือน+)",
      "action": "คำแนะนำระยะยาวเพื่อสร้างผลตอบแทนทบต้น",
      "focus": "ธีมเมกะเทรนด์และปัจจัยพื้นฐาน"
    }
  },
  "actionPlan": [
    {
      "id": "a1",
      "priority": "high | medium | low",
      "type": "HOLD | BUY_DIP | REBALANCE | WATCH | DIVIDEND",
      "badgeText": "ถือครองต่อเนื่อง | รอจังหวะสะสม | ปรับสมดุล | เก็บเกี่ยวปันผล | เกาะติดข้อมูล",
      "title": "สิ่งที่พอร์ตควรทำข้อนี้",
      "detail": "เหตุผลและแนวทางปฏิบัติสั้นๆ 1 บรรทัด"
    }
  ],
  "interestingStocks": [
    {
      "symbol": "ชื่อย่อหุ้น",
      "name": "ชื่อบริษัทหรือ ETF",
      "theme": "ธีมการลงทุน",
      "whyInteresting": "ทำไมถึงน่าสนใจในช่วงนี้",
      "catalyst": "ปัจจัยขับเคลื่อนหรือตัวเร่ง",
      "riskNote": "ความเสี่ยงที่ต้องระวัง"
    }
  ],
  "tailwinds": "1 ประโยคสรุปปัจจัยบวกที่หนุนพอร์ต",
  "headwinds": "1 ประโยคสรุปปัจจัยเสี่ยงที่ต้องเฝ้าระวัง",
  "strategicTakeaway": "1 ประโยคสรุปกลยุทธ์ภาพรวมวันนี้"
}`

      const res = await callGemini({
        userId,
        prompt,
        logType: 'advisor',
        responseMimeType: 'application/json',
      })

      const parsed = JSON.parse(res.text)

      finalBrief = {
        overallSentiment,
        sentimentScore,
        positiveCount: positive,
        negativeCount: negative,
        neutralCount: neutral,
        summaryOneLiner: parsed.summaryOneLiner || heuristicBrief.summaryOneLiner,
        readingTimeMinutes: 2,
        macroShockAlert: parsed.macroShockAlert || heuristicBrief.macroShockAlert,
        upcomingCatalysts: Array.isArray(parsed.upcomingCatalysts) && parsed.upcomingCatalysts.length > 0
          ? parsed.upcomingCatalysts
          : heuristicBrief.upcomingCatalysts,
        defensivePlaybook: parsed.defensivePlaybook || heuristicBrief.defensivePlaybook,
        todayHighlights: Array.isArray(parsed.todayHighlights) && parsed.todayHighlights.length > 0
          ? parsed.todayHighlights
          : heuristicBrief.todayHighlights,
        marketConsensus: parsed.marketConsensus || heuristicBrief.marketConsensus,
        holdingsImpact: Array.isArray(parsed.holdingsImpact) && parsed.holdingsImpact.length > 0
          ? parsed.holdingsImpact
          : heuristicBrief.holdingsImpact,
        timeframeStrategy: parsed.timeframeStrategy || heuristicBrief.timeframeStrategy,
        actionPlan: Array.isArray(parsed.actionPlan) && parsed.actionPlan.length > 0
          ? parsed.actionPlan
          : heuristicBrief.actionPlan,
        interestingStocks: Array.isArray(parsed.interestingStocks) && parsed.interestingStocks.length > 0
          ? parsed.interestingStocks
          : heuristicBrief.interestingStocks,
        decisionFramework: parsed.decisionFramework || heuristicBrief.decisionFramework,
        tailwinds: parsed.tailwinds || heuristicBrief.tailwinds,
        headwinds: parsed.headwinds || heuristicBrief.headwinds,
        strategicTakeaway: parsed.strategicTakeaway || heuristicBrief.strategicTakeaway,
        generatedAt: new Date().toISOString(),
        modelUsed: res.modelUsed,
      }
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

function generateHeuristicDailyBrief(
  holdings: UserHoldingContext[],
  recentNews: Array<{ headline: string; symbol: string | null; sentiment: NewsSentiment | null }>,
  positive: number,
  negative: number,
  neutral: number,
  sentimentScore: number,
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
): PortfolioDailyBrief {
  const topTickers = holdings.slice(0, 4).map((h) => h.ticker)
  const holdingsSymbols = new Set(holdings.map((h) => h.ticker.toUpperCase()))

  // 🚨 Macro Shock Alert: Fed & CPI Shock
  const macroShockAlert: MacroShockAlert = {
    title: 'สรุปแรงกระแทกมหภาค: เงินเฟ้อ US CPI สูงกว่าคาด ส่งผล Fed ชะลอการลดดอกเบี้ย ตลาดเผชิญแรงขายปรับฐาน',
    severity: 'high',
    explanation: 'รายงานตัวเลขดัชนีราคาผู้บริโภค (US CPI) สหรัฐฯ ล่าสุดออกมาสูงกว่าที่ตลาดคาดการณ์ ส่งผลให้อัตราผลตอบแทนพันธบัตรรัฐบาลสหรัฐฯ อายุ 10 ปี (US 10-Yr Yield) ปรับตัวสูงขึ้น ตลาดลดความหวังการลดดอกเบี้ยเชิงรุกของ Fed ทำให้เกิดแรงขายทำกำไรในหุ้นกลุ่มเติบโตและเทคโนโลยี ดัชนีหลักจึงเผชิญการย่อตัวปรับฐานระยะสั้น',
    marketDrivers: [
      'เงินเฟ้อภาคบริการและค่าที่พักอาศัยสหรัฐฯ เหนียวแน่นกว่าคาด ส่งผลให้ Fed ต้องดำเนินนโยบาย Higher-for-Longer นานขึ้น',
      'US 10-Year Bond Yield พุ่งขึ้น ส่งผลให้เกิด Multiple Compression กดดันระดับ Valuation ของหุ้นกลุ่ม High-Multiple Tech',
      'ตลาดลดคาดการณ์จำนวนครั้งการลดดอกเบี้ยในปีนี้ ทำให้นักลงทุนสถาบันเข้าสู่โหมดปรับลดความเสี่ยง (De-risking)',
      'ความกังวลว่าต้นทุนทางการเงินของภาคธุรกิจจะยังคงอยู่ในระดับสูงนานกว่าที่คาดการณ์ไว้เดิม',
    ],
    fedInterestRateImpact: 'เฟดมีแนวโน้มคงอัตราดอกเบี้ยสูงนานขึ้น และอาจเลื่อนรอบการปรับลดดอกเบี้ยออกไปจนกว่าจะเห็นตัวเลขเงินเฟ้อเย็นลงอย่างมีนัยสำคัญ',
  }

  // 📅 Upcoming Macro Catalyst Radar: 5 High-Impact Releases
  const upcomingCatalysts: UpcomingCatalystEvent[] = [
    {
      id: 'c1',
      eventNameTh: 'ดัชนีราคาผู้ผลิตสหรัฐฯ (US Producer Price Index - PPI)',
      eventNameEn: 'US Producer Price Index (PPI MoM / YoY)',
      expectedTiming: 'พฤหัสบดีนี้ 19:30 น. (ตามเวลาไทย)',
      importance: 'critical',
      category: 'inflation',
      forecastText: 'ตลาดคาดขยายตัว +0.2% MoM (Core PPI +0.2%)',
      marketImpactScenario: {
        hot: 'หากตัวเลขสูงกว่าคาด (+0.3% ขึ้นไป): ตลาดจะกังวลว่าต้นทุนฝั่งผู้ผลิตจะส่งผ่านไปยังเงินเฟ้อผู้บริโภค (CPI) ต่อเนื่อง Bond Yield จะพุ่งต่อ และหุ้นเทคโนโลยีอาจย่อตัวลงอีก 1-2%',
        cool: 'หากตัวเลขชะลอตัว (+0.1% หรือ 0.0%): จะช่วยปลดล็อกความกังวลเรื่องเงินเฟ้อ หนุนให้ดัชนี S&P 500 และ Nasdaq รีบาวด์กลับทันที',
      },
      portfolioPreparation: 'ถือเงินสดสำรอง 10-15% ไว้ในมือ อย่าเพิ่งรีบ All-in ก่อนทราบผลตัวเลข รอจังหวะตั้งรับหลังตลาดซึมซับข่าว',
    },
    {
      id: 'c2',
      eventNameTh: 'ถ้อยแถลงประธานเฟด Jerome Powell & บันทึกการประชุม FOMC Minutes',
      eventNameEn: 'Fed Chair Powell Speech & FOMC Minutes',
      expectedTiming: 'ศุกร์นี้ 21:00 น. / พุธหน้า 01:00 น. (ตามเวลาไทย)',
      importance: 'critical',
      category: 'fed_interest_rate',
      forecastText: 'คาดส่งสัญญาณเข้มงวดแบบระมัดระวัง (Hawkish Hold) และย้ำว่าการลดดอกเบี้ยต้องเห็นหลักฐานเงินเฟ้อลดลงอย่างชัดเจน',
      marketImpactScenario: {
        hot: 'หากส่งสัญญาณว่า "อาจไม่ลดดอกเบี้ยในเร็วๆ นี้ หรือเปิดช่องขึ้นดอกเบี้ยหากเงินเฟ้อกลับมา": ตลาดหุ้นจะปรับฐานลงอีกระลอก',
        cool: 'หากย้ำว่า "เงินเฟ้อระยะยาวยังคงเข้าสู่เป้าหมาย 2% และนโยบายปัจจุบันตึงตัวเพียงพอแล้ว": ตลาดจะคลายความตึงเครียดและเกิด Relief Rally',
      },
      portfolioPreparation: 'หุ้นกลุ่มปันผล (SCHD, SCB) จะช่วยค้ำพอร์ตได้ดี ไม่ควรตื่นตระหนกเทขายหุ้นพื้นฐานดีอย่าง GOOGL ที่แนวรับ',
    },
    {
      id: 'c3',
      eventNameTh: 'ยอดค้าปลีกสหรัฐฯ & ความเชื่อมั่นผู้บริโภค (US Retail Sales & Sentiment)',
      eventNameEn: 'US Retail Sales & Michigan Consumer Sentiment',
      expectedTiming: 'ศุกร์นี้ 19:30 น. (ตามเวลาไทย)',
      importance: 'high',
      category: 'employment',
      forecastText: 'ตลาดคาดการณ์ยอดค้าปลีกขยายตัว +0.3% MoM บ่งชี้กำลังซื้อผู้บริโภค',
      marketImpactScenario: {
        hot: 'หากตัวเลขร้อนแรงเกินคาด: ตลาดกังวลเงินเฟ้อไม่ลง แต่ช่วยคลายกังวลเรื่องเศรษฐกิจถดถอย (No Landing)',
        cool: 'หากตัวเลขชะลอลงอย่างมีระเบียบ: ตลาดมองเป็นสภาวะสมดุล (Soft Landing / Goldilocks) หนุนตลาดหุ้นฟื้นตัว',
      },
      portfolioPreparation: 'เกาะติดหุ้นกลุ่มเทคโนโลยีและการบริโภค เป็นโอกาสประเมินกำลังซื้อจริงของผู้บริโภคก่อนเข้าสู่งบไตรมาส',
    },
    {
      id: 'c4',
      eventNameTh: 'สัปดาห์เริ่มต้นประกาศงบ Big Tech & หุ้นกลุ่ม AI',
      eventNameEn: 'Mega-Cap Big Tech Q3/Q4 Earnings Season Kickoff',
      expectedTiming: 'เริ่มสัปดาห์หน้าเป็นต้นไป (หลังตลาดสหรัฐฯ ปิดทำการ)',
      importance: 'high',
      category: 'earnings',
      forecastText: 'ตลาดคาดหวังรายได้ Cloud, Search และ AI Infrastructure เติบโตระดับ Double-Digit',
      marketImpactScenario: {
        hot: 'หาก Google และ Big Tech รายงานกำไรทะลุเป้า พร้อมยอดขาย AI ชัดเจน: ตลาดจะตัดขาดจากความกังวลเรื่องดอกเบี้ยและดีดตัวขึ้นแรง',
        cool: 'หากงบชะลอตัว หรือ Capex บานปลายเกินรายได้: อาจเกิดแรงขายปรับ Multiple ลงมาที่ฐานราคาใหม่',
      },
      portfolioPreparation: 'เตรียมสภาพคล่องสำหรับ GOOGL และ QQQM หากราคาย่อตัวลงมาบริเวณแนวรับก่อนประกาศงบ',
    },
    {
      id: 'c5',
      eventNameTh: 'การประชุม กนง. ธนาคารแห่งประเทศไทย (BOT Rate Decision)',
      eventNameEn: 'Bank of Thailand Monetary Policy Committee Decision',
      expectedTiming: 'พุธนี้ 14:00 น. (ตามเวลาไทย)',
      importance: 'medium',
      category: 'policy',
      forecastText: 'ตลาดจับตาการส่งสัญญาณหรือการปรับลดอัตราดอกเบี้ยนโยบายเพื่อกระตุ้นเศรษฐกิจในประเทศและจัดการค่าเงินบาท',
      marketImpactScenario: {
        hot: 'หากคงดอกเบี้ย: หนุนส่วนต่างรายได้ดอกเบี้ยสุทธิ (NIM) ของกลุ่มธนาคารอย่าง SCB ทรงตัวในระดับสูงต่อเนื่อง',
        cool: 'หากลดดอกเบี้ย: อาจกดดัน NIM เล็กน้อย แต่ช่วยลดความเสี่ยงหนี้เสีย (NPL) และกระตุ้นการปล่อยสินเชื่อ',
      },
      portfolioPreparation: 'SCB มี Dividend Yield สูงระดับ 7-8% ทำหน้าที่เป็นเบาะกันกระแทกเงินเฟ้อ ถือรับเงินปันผลได้อย่างมั่นใจ',
    },
  ]

  // 🛡️ Portfolio Defensive Playbook: Dynamically tailored to user's actual holdings with live technical support levels
  const holdingPlaybook: HoldingDefensiveAction[] = (holdings.length > 0 ? holdings : [
    { ticker: 'GOOGL', assetName: 'Alphabet Inc.', allocationPercent: 20 },
    { ticker: 'VOO', assetName: 'Vanguard S&P 500', allocationPercent: 30 },
    { ticker: 'SCHD', assetName: 'Schwab US Dividend', allocationPercent: 20 },
    { ticker: 'QQQM', assetName: 'Invesco Nasdaq 100', allocationPercent: 15 },
    { ticker: 'WDC', assetName: 'Western Digital', allocationPercent: 10 },
    { ticker: 'SCB', assetName: 'SCB X', allocationPercent: 5 },
  ]).map((h) => {
    const isTHB = h.currency === 'THB' || h.ticker.toUpperCase() === 'SCB'
    const prefix = isTHB ? '' : '$'
    const suffix = isTHB ? ' บาท' : ''
    const sym = h.ticker.toUpperCase()

    let supportText = ''
    if (h.supportS1 != null) {
      supportText = `แนวรับแรก S1: ${prefix}${h.supportS1}${suffix}`
      if (h.supportS2 != null) {
        supportText += ` (แนวรับรอง S2: ${prefix}${h.supportS2}${suffix})`
      }
      if (h.sma50 != null) {
        supportText += ` / SMA50: ${prefix}${h.sma50}${suffix}`
      }
    } else if (h.currentPrice != null && h.currentPrice > 0) {
      const s1 = Number((h.currentPrice * 0.975).toFixed(2))
      const s2 = Number((h.currentPrice * 0.95).toFixed(2))
      supportText = `แนวรับ S1: ${prefix}${s1}${suffix} (แนวรับรอง S2: ${prefix}${s2}${suffix})`
    } else {
      supportText = 'ตั้งรับที่แนวรับเส้นค่าเฉลี่ย SMA 50 วัน'
    }

    let stance: HoldingDefensiveAction['stance'] = 'HOLD'
    let stanceLabel = 'ถือครองต่อเนื่อง (Hold)'
    let rationale = `สินทรัพย์หลักในพอร์ต ยึดวินัยตามแผนการลงทุนระยะยาว`

    if (sym === 'GOOGL') {
      stance = 'BUY_DIP'
      stanceLabel = 'รอจังหวะสะสมเมื่อย่อตัว (Buy on Dip)'
      rationale = 'หุ้นเทคโนโลยีขนาดใหญ่มีกระแสเงินสดแข็งแกร่ง แม้ Bond Yield พุ่งกดดัน Valuation ระยะสั้น แต่เป็นโอกาสทยอยสะสมของดีที่แนวรับ'
    } else if (sym === 'VOO') {
      stance = 'HOLD'
      stanceLabel = 'ถือครองต่อเนื่อง & DCA ตามแผน (Core Anchor)'
      rationale = 'ดัชนี S&P 500 กระจายความเสี่ยงทั่วตลาด แม้จะปรับฐานตามตัวเลขเงินเฟ้อ แต่การถือยาวและ DCA ให้ผลตอบแทนฟื้นตัวได้ดีที่สุดเสมอ'
    } else if (sym === 'SCHD') {
      stance = 'COLLECT_DIVIDEND'
      stanceLabel = 'กันชนความผันผวน & เก็บเกี่ยวปันผล'
      rationale = 'หุ้นปันผลและกลุ่ม Value ทนทานต่อสภาวะดอกเบี้ยสูงได้ดี ช่วยลด Maximum Drawdown ของพอร์ตรวมและสร้างกระแสเงินสดสม่ำเสมอ'
    } else if (sym === 'QQQM') {
      stance = 'WAIT'
      stanceLabel = 'ชะลอการไล่ราคา รอสร้างฐาน (Wait & See)'
      rationale = 'Nasdaq 100 มีความอ่อนไหวต่ออัตราดอกเบี้ยและ Yield จึงควรชะลอการไล่ราคา รอให้แรงขายชะลอและดัชนีสร้างฐานที่แนวรับก่อนสะสมไม้ใหม่'
    } else if (sym === 'WDC') {
      stance = 'HOLD'
      stanceLabel = 'ถือเกาะติดรอบขาขึ้นของหน่วยความจำ'
      rationale = 'แม้มหภาคจะผันผวน แต่วัฏจักรความต้องการ Enterprise HDD และ AI Storage ยังคงเติบโตอย่างมีนัยสำคัญตามการขยายตัวของ Data Center'
    } else if (sym === 'SCB') {
      stance = 'COLLECT_DIVIDEND'
      stanceLabel = 'ถือรับเงินปันผลสูง 7-8%'
      rationale = 'ดอกเบี้ยในระดับสูงช่วยรักษา NIM ของธนาคาร และ Dividend Yield ระดับสูงทำหน้าที่เป็นเบาะกันกระแทกเงินเฟ้อ'
    }

    return {
      symbol: sym,
      stance,
      stanceLabel,
      rationale,
      supportOrActionLevel: supportText,
    }
  })

  const defensivePlaybook: PortfolioDefensivePlaybook = {
    overallStance: '🛡️ ตั้งรับอย่างมีกลยุทธ์ (Defensive Accumulation): ไม่ Panic Sell ที่แนวรับ รักษาวินัย DCA และเตรียมสภาพคล่องดักซื้อจุดกลับตัว',
    cashBufferAdvice: 'แนะนำสำรองเงินสดหรือสภาพคล่องไว้ประมาณ 10 - 15% ของพอร์ต เพื่อเป็นกระสุนรอเข้าซื้อหุ้นคุณภาพในจังหวะตลาด Oversold จากความกังวลเรื่อง CPI/Fed',
    holdingPlaybook,
    scenarioAPlan: {
      condition: 'หากเงินเฟ้อ/ดอกเบี้ยยังกดดันต่อ และตลาดปรับฐานลงอีก 3 - 5%',
      action: 'ห้าม Panic Sell ที่แนวรับ ให้ใช้เงินสดสำรอง 10-15% ทยอยแบ่งไม้ซื้อ VOO และ GOOGL ในระดับราคาที่มี Margin of Safety สูง',
    },
    scenarioBPlan: {
      condition: 'หากตลาดดูดซับข่าว CPI จบ และเริ่มมี Technical Rebound กลับขึ้นมา',
      action: 'ถือครองหุ้นเดิมตามปกติ ไม่ไล่ราคาซื้อบนยอด ให้ปล่อยให้พอร์ตฟื้นตัวตามธรรมชาติ และพิจารณา Rebalance หากสัดส่วนเกินเป้าหมาย',
    },
  }

  // 1. Today Highlights
  const todayHighlights: TodayMarketHighlight[] = [
    {
      id: 'h1',
      title: 'ตัวเลขเงินเฟ้อ US CPI สูงกว่าคาด ส่งผลให้ Bond Yield พุ่งขึ้น',
      tag: 'เงินเฟ้อ & นโยบาย FED',
      detail: 'รายงานดัชนีราคาผู้บริโภคสหรัฐฯ ล่าสุดสูงกว่าคาด ส่งผลให้อัตราผลตอบแทนพันธบัตร 10 ปีพุ่งขึ้น และตลาดลดความหวังการลดดอกเบี้ยเร็วของ Fed',
      sentiment: 'negative',
      relatedSymbol: 'SPY',
    },
    {
      id: 'h2',
      title: 'หุ้นเทคโนโลยีเผชิญแรงขายทำกำไรระยะสั้นจาก Multiple Compression',
      tag: 'เทคโนโลยี & บิ๊กเทค',
      detail: 'หุ้นกลุ่ม AI และเติบโตสูงย่อตัวลงเนื่องจากแรงกดดันด้านอัตราคิดลด (Discount Rate) แต่นักวิเคราะห์มองเป็นโอกาสสะสมของดีราคาลดก่อนงบออก',
      sentiment: 'neutral',
      relatedSymbol: holdingsSymbols.has('GOOGL') ? 'GOOGL' : 'QQQM',
    },
    {
      id: 'h3',
      title: 'หุ้นปันผลและกลุ่ม Defensive ทำหน้าที่เป็นเกราะพยุงพอร์ต',
      tag: 'เงินปันผล & สภาพคล่อง',
      detail: 'กระแสเงินทุนบางส่วนโยกเข้าสู่หุ้นกลุ่ม Dividend และ Defensive ที่มีกระแสเงินสดมั่นคง ช่วยลดความผันผวนของพอร์ตโดยรวม',
      sentiment: 'positive',
      relatedSymbol: holdingsSymbols.has('SCHD') ? 'SCHD' : 'SCB',
    },
    {
      id: 'h4',
      title: 'ตลาดรอจับตาตัวเลข PPI และถ้อยแถลง Powell สัปดาห์นี้',
      tag: 'ตัวเลขเศรษฐกิจ & ปฏิทิน',
      detail: 'นักลงทุนทั่วโลกชะลอการซื้อเชิงรุกเพื่อรอดูตัวเลขราคาผู้ผลิต PPI และทิศทางการส่งสัญญาณจากประธานเฟดก่อนตัดสินใจรอบใหม่',
      sentiment: 'neutral',
      relatedSymbol: 'VOO',
    },
  ]

  // 2. Market Consensus
  const marketConsensus: MarketConsensus = {
    mood: 'Cautious',
    moodLabel: 'ระมัดระวังความเสี่ยง & ปรับฐานรับมือดอกเบี้ย (Defensive / Risk-Off)',
    summary: 'ตลาดส่วนใหญ่เข้าสู่โหมดระมัดระวังความเสี่ยง หลังตัวเลขเงินเฟ้อ CPI สหรัฐฯ สูงกว่าคาด ส่งผลให้ Bond Yield พุ่งขึ้น และนักลงทุนชะลอการลงทุนในหุ้น High-Multiple Tech',
    fedExpectation: 'ตลาดปรับลดความคาดหวังการปรับลดอัตราดอกเบี้ยเชิงรุกของ Fed โดยมองว่า Fed จะดำเนินนโยบาย Higher-for-Longer นานขึ้นเพื่อควบคุมเงินเฟ้อ',
    keyRisksToWatch: 'ทิศทางตัวเลขดัชนีราคาผู้ผลิต (PPI), ถ้อยแถลงของ Jerome Powell และผลประกอบการไตรมาสของบิ๊กเทค',
  }

  // 3. Holdings Direct Impact
  const holdingsImpact: PortfolioAssetImpact[] = holdings.map((h) => {
    const sym = h.ticker.toUpperCase()
    if (sym === 'GOOGL' || sym === 'GOOG') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Alphabet Inc.',
        allocationPercent: h.allocationPercent,
        impact: 'mixed',
        headline: 'โดนกดดันระยะสั้นจาก Bond Yield แต่มีพื้นฐานแกร่งและเงินสดล้นมือ',
        detail: 'ราคาอาจย่อตัวตามกลุ่มเทคโนโลยีจากความกังวลเรื่องดอกเบี้ย แต่ธุรกิจ Search, YouTube และ Google Cloud ยังมีอัตรากำไรแข็งแกร่ง และเตรียมได้แรงหนุนจากงบ AI ไตรมาสนี้',
        actionSuggestion: 'ไม่ตื่นตระหนกขายที่แนวรับ ทยอยตั้งรับสะสมหากราคาย่อตัวลงมาแตะแนวรับ $160 - $164',
      }
    }
    if (sym === 'VOO' || sym === 'SPY') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Vanguard S&P 500 ETF',
        allocationPercent: h.allocationPercent,
        impact: 'neutral',
        headline: 'ปรับฐานระยะสั้นตามดัชนีภาพรวม แต่มีเกราะกระจายความเสี่ยง 500 บริษัท',
        detail: 'การกระจายตัวในกลุ่ม Defensive และ Value ช่วยพยุงไม่ให้ดัชนีทรุดตัวแรงเท่าหุ้นกลุ่มเดี่ยว การแกว่งตัวเป็นวัฏจักรปกติของตลาด',
        actionSuggestion: 'ถือครองเป็นแกนหลักพอร์ต (Core Port) และทำตามวินัย DCA อย่างสม่ำเสมอ',
      }
    }
    if (sym === 'SCHD') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Schwab US Dividend Equity ETF',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'ทำหน้าที่เป็นเกราะป้องกันความผันผวนและผลิตกระแสเงินสดปันผลสม่ำเสมอ',
        detail: 'หุ้นกลุ่ม Dividend Growth ทนทานต่อสภาวะดอกเบี้ยสูงได้ดีกว่ากลุ่ม Growth Dividend Yield ระดับ 3.5% ช่วยเสริมสภาพคล่องให้พอร์ตในทุกสภาวะ',
        actionSuggestion: 'ถือครองเพื่อรับกระแสเงินสด และเตรียมนำเงินปันผลไป Reinvest ซื้อหุ้นเติบโตตอนย่อตัว',
      }
    }
    if (sym === 'QQQM' || sym === 'QQQ') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Invesco NASDAQ 100 ETF',
        allocationPercent: h.allocationPercent,
        impact: 'negative',
        headline: 'เผชิญความผันผวนสูงจาก Bond Yield ที่ปรับตัวสูงขึ้น',
        detail: 'Nasdaq 100 มีความอ่อนไหวสูงต่ออัตราผลตอบแทนพันธบัตร เมื่อเงินเฟ้อ CPI สูงกว่าคาด ดัชนีจึงเกิดแรงขายทำกำไรระยะสั้น',
        actionSuggestion: 'ชะลอการซื้อไล่ราคา รอให้ดัชนีสร้างฐานสะสมเสร็จสิ้นก่อนเริ่มสะสมไม้ใหม่',
      }
    }
    if (sym === 'WDC') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Western Digital Corp.',
        allocationPercent: h.allocationPercent,
        impact: 'neutral',
        headline: 'แม้มหภาคจะกดดัน แต่วงจรหน่วยความจำและ AI Storage ยังเป็นขาขึ้น',
        detail: 'ความต้องการ Enterprise HDD และ NAND Flash สำหรับศูนย์ข้อมูล AI ยังแข็งแกร่ง ช่วยหนุน Gross Margin ของบริษัทในระยะ 6-12 เดือน',
        actionSuggestion: 'ถือครองต่อโดยตั้ง Trailing Stop เพื่อปกป้องกำไรจากความผันผวนของตลาดรวม',
      }
    }
    if (sym === 'SCB') {
      return {
        symbol: sym,
        assetName: h.assetName || 'SCB X PCL',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'ได้รับผลบวกจากอัตราดอกเบี้ยที่ยังอยู่ในระดับสูง พร้อมปันผลระดับ 7-8%',
        detail: 'ทิศทางดอกเบี้ยที่ยังไม่ปรับลดลงเร็วช่วยรักษา NIM ของธนาคาร และ Dividend Yield ระดับสูงช่วยลดความผันผวนของพอร์ตรวมในสกุลเงินบาท',
        actionSuggestion: 'ถือรับเงินปันผลตามแผนงาน และใช้เป็นสินทรัพย์เสริมสภาพคล่อง',
      }
    }

    return {
      symbol: sym,
      assetName: h.assetName,
      allocationPercent: h.allocationPercent,
      impact: 'neutral',
      headline: `การเคลื่อนไหวของ ${sym} ยังคงสอดคล้องกับภาพรวมของอุตสาหกรรม`,
      detail: `ยังไม่มีปัจจัยลบที่มีนัยสำคัญต่อพื้นฐานธุรกิจ สามารถถือครองตามกลยุทธ์การจัดสรรพอร์ตเดิม`,
      actionSuggestion: 'ถือครองตามสัดส่วนเดิม และติดตามรายงานผลการดำเนินงาน',
    }
  })

  // If no holdings in database yet, provide sensible default
  if (holdingsImpact.length === 0) {
    holdingsImpact.push({
      symbol: 'PORTFOLIO',
      assetName: 'ภาพรวมพอร์ตของคุณ',
      allocationPercent: 100,
      impact: 'neutral',
      headline: 'พอร์ตลงทุนเผชิญแรงกดดันระยะสั้นจากเงินเฟ้อ แต่โครงสร้างยังมีความสมดุล',
      detail: 'การมีทั้งสินทรัพย์เติบโตและสินทรัพย์ปันผลช่วยลดแรงกระแทกจากความผันผวนของอัตราดอกเบี้ยได้เป็นอย่างดี',
      actionSuggestion: 'รักษาวินัยการถือครอง สำรองเงินสด 10-15% ไว้รอซื้อจังหวะย่อ',
    })
  }

  // 4. Timeframe Strategy
  const timeframeStrategy: TimeframeStrategy = {
    shortTerm: {
      period: 'ระยะสั้น (1 - 7 วัน)',
      action: 'ห้าม Panic Sell ที่แนวรับ สำรองเงินสด 10-15% และรอประเมินผลตัวเลข US PPI และถ้อยแถลง Powell',
      focus: 'การตอบสนองของ Bond Yield 10 ปี และปฏิกิริยาของดัชนี S&P 500 ที่แนวรับ',
    },
    mediumTerm: {
      period: 'ระยะกลาง (1 - 3 เดือน)',
      action: 'ทยอยสะสมหุ้นคุณภาพ (GOOGL, VOO) ในจังหวะ Oversold และปล่อยให้ SCHD, SCB จ่ายเงินปันผลเสริมกระแสเงินสด',
      focus: 'ผลประกอบการไตรมาสของ Big Tech และการชี้แจงรายได้จากโครงการ AI',
    },
    longTerm: {
      period: 'ระยะยาว (6 - 12 เดือน+)',
      action: 'ยึดมั่นในวินัยถือครองสินทรัพย์ที่มีคูเมืองแข็งแกร่ง ปล่อยให้ผลตอบแทนทบต้นทำงานเต็มที่',
      focus: 'เมกะเทรนด์ AI, Cloud Computing, และการเติบโตของกำไรต่อหุ้น (EPS) ระยะยาว',
    },
  }

  // 5. Action Plan
  const actionPlan: ActionPlanItem[] = [
    {
      id: 'a1',
      priority: 'high',
      type: 'HOLD',
      badgeText: 'ถือครองอย่างมีวินัย',
      title: 'รักษาสถานะ Core Port (VOO & QQQM) ไม่ขายหนีความผันผวน',
      detail: 'การปรับฐานจากข่าว CPI เป็นความผันผวนระยะสั้น การ Panic Sell มักทำให้ขายในจุดที่แย่ที่สุด',
    },
    {
      id: 'a2',
      priority: 'high',
      type: 'BUY_DIP',
      badgeText: 'รอจังหวะสะสม',
      title: 'เตรียมตั้งรับ Big Tech (GOOGL) ที่แนวรับ $160 - $164',
      detail: 'ใช้เงินสดสำรองทยอยตั้ง Limit Order ไม้เล็กเมื่อตลาด Overreact ต่อตัวเลขเศรษฐกิจ',
    },
    {
      id: 'a3',
      priority: 'medium',
      type: 'DIVIDEND',
      badgeText: 'เก็บเกี่ยวปันผล',
      title: 'ใช้ SCHD และ SCB เป็นเกราะกันกระแทกเงินเฟ้อ',
      detail: 'ปล่อยให้หุ้นปันผลสร้าง Cash Inflow อย่างต่อเนื่องเพื่อเป็นสภาพคล่องเสริมพอร์ต',
    },
    {
      id: 'a4',
      priority: 'medium',
      type: 'WATCH',
      badgeText: 'เกาะติดเรดาร์',
      title: 'จับตาตัวเลข PPI คืนวันพฤหัสบดี 19:30 น. อย่างใกล้ชิด',
      detail: 'ตัวเลข PPI จะเป็นตัวชี้ขาดว่าตลาดจะสร้างฐานฟื้นตัวหรือปรับฐานลงต่อในระยะสั้น',
    },
  ]

  // 6. Interesting Stocks
  const interestingStocks: InterestingStockOpportunity[] = [
    {
      symbol: 'CEG',
      name: 'Constellation Energy',
      theme: 'พลังงานนิวเคลียร์ & ศูนย์ข้อมูล AI',
      whyInteresting: 'ผู้ผลิตพลังงานนิวเคลียร์รายใหญ่ที่สุดในสหรัฐฯ ได้รับสัญญาขายไฟฟ้า 20 ปีให้แก่ Microsoft เพื่อจ่ายไฟให้ AI Data Center โดยตรง',
      catalyst: 'ความต้องการพลังงานสะอาดที่จ่ายไฟสม่ำเสมอ 24/7 ของบริษัทเทคโนโลยีชั้นนำ',
      riskNote: 'ราคาหุ้นปรับตัวขึ้นมาแรง ควรตั้งรับเมื่อราคาย่อตัวลงมาใกล้แนวรับ',
    },
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      theme: 'ผู้นำชิปประมวลผล AI & Data Center',
      whyInteresting: 'คำสั่งซื้อชิป Blackwell เต็มความสามารถการผลิตไปจนถึงปีหน้า ความต้องการ AI Compute ยังคงสูงกว่าอุปทาน',
      catalyst: 'การเพิ่มงบลงทุน CapEx ของ Google, Meta และ Microsoft ในไตรมาสถัดไป',
      riskNote: 'ระดับความคาดหวังของตลาดสูงมาก ความผันผวนรายวันอาจสูงหากมีข่าวชะลอตัวย่อย',
    },
    {
      symbol: 'TLT',
      name: 'iShares 20+ Year Treasury Bond ETF',
      theme: 'การป้องกันความเสี่ยง & พันธบัตรสหรัฐฯ',
      whyInteresting: 'หลังตัวเลข CPI สูงกว่าคาด Yield 10 ปีพุ่งขึ้น ทำให้ราคา TLT ย่อตัวลงมาอยู่ในจุดที่ให้ผลตอบแทนปันผลสูงและมีความคุ้มค่าในการเก็งกำไรรอบรีบาวด์',
      catalyst: 'เมื่อตัวเลขเงินเฟ้อเริ่มชะลอตัวในเดือนถัดไป หรือ Fed เริ่มกลับมาส่งสัญญาณผ่อนคลาย',
      riskNote: 'ยังมีความผันผวนสูงหากตัวเลขเงินเฟ้อยังดื้อรั้นต่อเนื่อง ควรแบ่งไม้ลงทุน',
    },
    {
      symbol: 'SMR',
      name: 'NuScale Power Corp.',
      theme: 'เตาปฏิกรณ์นิวเคลียร์ขนาดเล็ก (SMR)',
      whyInteresting: 'ได้รับความสนใจอย่างกว้างขวางหลัง Alphabet/Google ประกาศแผนสนับสนุนเตาปฏิกรณ์ SMR เพื่อจ่ายพลังงานให้ Cloud',
      catalyst: 'ความคืบหน้าในการขอใบอนุญาตและข้อตกลงเชิงพาณิชย์กับลูกค้าระดับโลก',
      riskNote: 'ยังอยู่ในช่วงเริ่มต้นพัฒนาเชิงพาณิชย์ มีความเสี่ยงสูง เหมาะสำหรับพอร์ตเก็งกำไรสัดส่วนเล็ก',
    },
  ]

  const summaryOneLiner = `ตลาดเผชิญแรงกดดันระยะสั้นจากเงินเฟ้อ US CPI ที่สูงกว่าคาด ส่งผล Fed ชะลอการลดดอกเบี้ย พอร์ตของคุณ (${topTickers.join(', ') || 'หุ้นรวม'}) ควรตั้งรับอย่างมีกลยุทธ์ ไม่ Panic Sell และสำรองเงินสด 10-15% ดักซื้อจังหวะย่อ`

  const tailwinds = `สินทรัพย์กลุ่มปันผล (SCHD, SCB) ช่วยเป็นเกราะลด Drawdown ขณะที่ธุรกิจ AI & Cloud ของ GOOGL ยังเติบโตแข็งแกร่ง`
  const headwinds = `ตัวเลขเงินเฟ้อ US CPI ที่สูงกว่าคาด ส่งผลให้ Bond Yield พุ่งขึ้น และ Fed มีแนวโน้มคงดอกเบี้ยสูงนานขึ้น (Higher-for-Longer)`
  const strategicTakeaway = `ยึดแผน Defensive Accumulation: ไม่ Panic Sell ที่แนวรับ สำรองเงินสด 10-15% ไว้เข้าซื้อของดีราคาลด และเกาะติดตัวเลข PPI พฤหัสบดีนี้`

  return {
    overallSentiment,
    sentimentScore,
    positiveCount: positive,
    negativeCount: negative,
    neutralCount: neutral,
    summaryOneLiner,
    readingTimeMinutes: 2,
    macroShockAlert,
    upcomingCatalysts,
    defensivePlaybook,
    todayHighlights,
    marketConsensus,
    holdingsImpact,
    timeframeStrategy,
    actionPlan,
    interestingStocks,
    decisionFramework: buildDefaultMarketDecisionFramework(overallSentiment, sentimentScore, topTickers),
    tailwinds,
    headwinds,
    strategicTakeaway,
    generatedAt: new Date().toISOString(),
  }
}

export function buildDefaultMarketDecisionFramework(
  overallSentiment: 'bullish' | 'bearish' | 'neutral',
  sentimentScore: number,
  userTickers: string[] = []
): MarketDecisionFramework {
  const isBull = overallSentiment === 'bullish'
  const isBear = overallSentiment === 'bearish'

  const overallStance: 'BUY' | 'HOLD' | 'WAIT' = isBull && sentimentScore >= 65
    ? 'BUY'
    : isBear || sentimentScore <= 35
    ? 'WAIT'
    : 'HOLD'

  const stanceLabel = overallStance === 'BUY'
    ? '🟢 โซนทยอยสะสมตามแผน (Selective Accumulation)'
    : overallStance === 'WAIT'
    ? '🔴 ชะลอการซื้อ & เน้นถือเงินสดรอจังหวะ (Wait & Preserve Cash)'
    : '🟡 ถือครองตามแผน & รอจังหวะย่อตัวแตะแนวรับ (Hold Steady & Buy on Dips)'

  const stanceBadgeColor = overallStance === 'BUY'
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : overallStance === 'WAIT'
    ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
    : 'text-amber-400 bg-amber-500/15 border-amber-500/30'

  const summaryHeadline = overallStance === 'BUY'
    ? 'ตลาดให้โอกาสในการทยอยสะสมหุ้นพื้นฐานแกร่งที่ย่อตัวลงมาแตะแนวรับสำคัญตามแผน DCA'
    : overallStance === 'WAIT'
    ? 'ตลาดอยู่ในภาวะความเสี่ยงสูงหรือเผชิญแรงกดดันมหภาค ควรชะลอการไล่ราคาและสำรองสภาพคล่องเงินสด'
    : 'ตลาดอยู่ในกรอบแกว่งตัวรอความชัดเจน ถือครองสินทรัพย์หลักตามสัดส่วนเดิม และตั้ง Limit Order รอซื้อเมื่อย่อตัว'

  return {
    overallStance,
    stanceLabel,
    stanceBadgeColor,
    summaryHeadline,
    threeCoreQuestions: {
      marketFacing: 'ตลาดกำลังซึมซับทิศทางดอกเบี้ย Fed และตัวเลขเงินเฟ้อที่ยังคงมีความไม่แน่นอน แต่มีแรงพยุงจากสภาพคล่องของกลุ่มเทคโนโลยีขนาดใหญ่และกระแส AI',
      earningsTrend: 'ผลกำไรของบริษัทผู้นำ (Big Tech / Market Leaders) ยังคงเติบโตระดับสูงและงบลงทุน AI ยังเพิ่มขึ้นอย่างมีนัยสำคัญ',
      valuationRiskReward: 'Valuation ดัชนีหลักค่อนข้างตึงตัว (Forward P/E ~20-22x) จึงไม่ควรไล่ราคาที่จุดสูงสุด แต่คุ้มค่าหากดักซื้อเมื่อย่อตัวแตะแนวรับ',
    },
    tier1Regular: [
      {
        id: 't1-1',
        title: 'S&P 500 และ Nasdaq',
        subTitle: 'ดัชนีชี้นำภาพรวมตลาดและโมเมนตัมหลัก',
        status: isBull ? 'bullish' : 'neutral',
        statusLabel: isBull ? 'โมเมนตัมบวก' : 'แกว่งตัวทดสอบแนวต้าน',
        keyMetric: 'SPX ~5,850+ | NDX ~20,400+',
        insight: 'ดัชนีหลักยังคงอยู่ในโครงสร้างแนวโน้มขาขึ้นระยะยาว แต่อาจเผชิญแรงขายทำกำไรระยะสั้นในรอบการประกาศตัวเลขเศรษฐกิจ',
        actionGuidance: 'เน้นถือหุ้นพื้นฐานดีตามรอบ ไม่ไล่ราคาช่วง New High รอจังหวะย่อตัว 2-3% ค่อยสะสม',
      },
      {
        id: 't1-2',
        title: 'US 10Y Yield และแนวโน้ม Fed',
        subTitle: 'อัตราผลตอบแทนพันธบัตร 10 ปี & ทิศทางดอกเบี้ย',
        status: 'watch',
        statusLabel: 'จับตาระดับ 4.0% - 4.3%',
        keyMetric: 'US 10Y Yield: 4.15%',
        insight: 'เมื่อ Bond Yield พุ่งขึ้น จะกดดัน Valuation ของหุ้นกลุ่มเทคโนโลยี High-PE แต่หาก Yield เริ่มชะลอตัวจะส่งผลบวกต่อสินทรัพย์เสี่ยง',
        actionGuidance: 'หาก Yield ขยับขึ้นเหนือ 4.25% ให้เตรียมกระสุนดักซื้อหุ้นเทคโนโลยีชั้นนำที่โดนเทขายเกินจริง',
      },
      {
        id: 't1-3',
        title: 'เงินเฟ้อและตลาดแรงงาน',
        subTitle: 'US CPI, Core PCE & Non-Farm Payrolls',
        status: 'neutral',
        statusLabel: 'เงินเฟ้อชะลอช้าแต่ตลาดแรงงานยังแกร่ง',
        keyMetric: 'CPI Target: 2.0% | Non-Farm ~150k-200k',
        insight: 'ตลาดให้ความสำคัญสูงสุดกับตัวเลขเงินเฟ้อและอัตราการว่างงานเพื่อคาดการณ์จังหวะการลดดอกเบี้ยของ Fed',
        actionGuidance: 'หลีกเลี่ยงการเปิดสถานะเก็งกำไรขนาดใหญ่ก่อนวันประกาศตัวเลข CPI หรือการประชุม FOMC',
      },
      {
        id: 't1-4',
        title: 'ผลประกอบการและประมาณการกำไร',
        subTitle: 'Corporate Earnings & Forward EPS Guidance',
        status: 'bullish',
        statusLabel: 'EPS เติบโตแข็งแกร่งกว่าคาด',
        keyMetric: 'S&P 500 Q3/Q4 EPS Growth ~9.5%',
        insight: 'ผลประกอบการจริงเป็นเสาหลักที่ค้ำยันดัชนี แม้ Valuation จะตึงตัว แต่กำไรที่เติบโตจริงจะช่วยลดระดับ P/E ลงได้',
        actionGuidance: 'เลือกลงทุนในบริษัทที่มี Pricing Power, Free Cash Flow สม่ำเสมอ และหนี้สินต่ำ',
      },
      {
        id: 't1-5',
        title: 'ข่าวสำคัญที่กระทบตลาดวงกว้าง',
        subTitle: 'Macro Breaking News & Broad Market Drivers',
        status: 'watch',
        statusLabel: 'เฝ้าระวังปัจจัยนโยบายรัฐ',
        keyMetric: 'Broad Market Shocks',
        insight: 'การประกาศนโยบายการค้า มาตรการภาษี และความตึงเครียดทางภูมิรัฐศาสตร์มักสร้างแรงกระแทกระยะสั้น',
        actionGuidance: 'แยกแยะระหว่างความตระหนกชั่วคราว (Sentiment Noise) กับการเปลี่ยนแปลงพื้นฐานธุรกิจ (Structural)',
      },
    ],
    tier2BuyTiming: [
      {
        id: 't2-1',
        title: 'Valuation ของ VOO และ QQQM',
        subTitle: 'Forward P/E & 5-Year Historical Percentile',
        status: 'neutral',
        statusLabel: 'Valuation ค่อนข้างตึงตัว',
        keyMetric: 'VOO Fwd P/E ~21.5x | QQQM ~26.2x',
        insight: 'ระดับ Valuation สูงกว่าค่าเฉลี่ย 5 ปีเล็กน้อย สะท้อนว่าตลาดอยู่ในโซน Fair-to-Rich Valuation',
        actionGuidance: 'เน้นวิธีทยอยซื้อตามรอบ DCA หรือรอซื้อไม้ใหญ่เมื่อมีรอบปรับฐาน (Correction) 5-7%',
      },
      {
        id: 't2-2',
        title: 'VIX และความกว้างของตลาด',
        subTitle: 'Fear Index & % Stocks Above 50/200 DMA',
        status: isBear ? 'bearish' : 'bullish',
        statusLabel: 'ความผันผวนอยู่ในกรอบปกติ',
        keyMetric: 'VIX: 15-18 | Market Breadth: 62%',
        insight: 'VIX ต่ำกว่า 20 บ่งชี้ความเสี่ยงต่ำ แต่หาก VIX พุ่งทะลุ 25-30 จะเป็นจุดเกิด Panic Buy Opportunity ที่ได้ราคาดีที่สุด',
        actionGuidance: 'สำรองเงินสด 10-15% ไว้เสมอ เพื่อพร้อมซื้อเมื่อ VIX ดีดตัวสูงผิดปกติ',
      },
      {
        id: 't2-3',
        title: 'DXY และ USD/THB',
        subTitle: 'ดัชนีดอลลาร์ & อัตราแลกเปลี่ยนเงินบาท',
        status: 'neutral',
        statusLabel: 'บาททรงตัวแข็งค่าปานกลาง',
        keyMetric: 'DXY ~102 | USD/THB ~33.5 - 34.5',
        insight: 'ช่วงที่ค่าเงินบาทแข็งค่าคือช่วงเวลาที่ได้เปรียบในการแลกเงินบาทไปเป็น USD เพื่อเตรียมซื้อหุ้นต่างประเทศ',
        actionGuidance: 'ทยอยแลกเงิน USD สะสมไว้ในบัญชีลงทุนเมื่อ USD/THB ย่อลงมาใกล้แนวรับ',
      },
      {
        id: 't2-4',
        title: 'แนวโน้มรายได้และการลงทุน AI',
        subTitle: 'AI Capex & Monetization Momentum',
        status: 'bullish',
        statusLabel: 'งบลงทุน Hyperscalers ยังเร่งตัว',
        keyMetric: 'Big Tech AI Capex > $200B/yr',
        insight: 'เม็ดเงินลงทุน AI ยังคงเป็นธีมเมกะเทรนด์หลักที่ขับเคลื่อนเศรษฐกิจ โดยเฉพาะกลุ่ม Semi, Cloud และ Data Centers',
        actionGuidance: 'คงสัดส่วนหุ้นแกนนำเทคโนโลยีและโครงสร้างพื้นฐาน AI ไว้เป็นเสาหลักของพอร์ต',
      },
      {
        id: 't2-5',
        title: 'ราคาปัจจุบันเทียบกับแผนทยอยซื้อ',
        subTitle: 'DCA Execution & Key Support Zones',
        status: 'watch',
        statusLabel: 'จับตาแนวรับสำคัญ S1 / SMA50',
        keyMetric: 'Support Levels Tracking',
        insight: 'การซื้อหุ้นที่แตะแนวรับเส้นค่าเฉลี่ย 50 วัน (SMA50) หรือ 200 วัน (SMA200) ให้ Risk/Reward Ratio ที่คุ้มค่าที่สุด',
        actionGuidance: 'ตั้ง Order รับซื้อตามกรอบแนวรับ S1 ในแผนประจำวัน แทนการไล่ซื้อตามราคาตลาด',
      },
    ],
    tier3EventDriven: [
      {
        id: 't3-1',
        title: 'สงคราม ภาษี และมาตรการคว่ำบาตร',
        subTitle: 'Geopolitics, Tariffs & Trade Restrictions',
        status: 'watch',
        statusLabel: 'ติดตามสถานการณ์ความขัดแย้ง',
        keyMetric: 'Geopolitical Risk Index',
        insight: 'ความเสี่ยงด้านภูมิรัฐศาสตร์มักทำให้ราคาสินค้าโภคภัณฑ์ผันผวนและนักลงทุนสลับเข้าสินทรัพย์ปลอดภัย',
        actionGuidance: 'หลีกเลี่ยงหุ้นที่มีความเสี่ยงสูงด้านข้อพิพาทการค้า และเน้นบริษัทที่มี Global Moat แข็งแกร่ง',
      },
      {
        id: 't3-2',
        title: 'น้ำมัน ทองคำ และสินค้าโภคภัณฑ์',
        subTitle: 'WTI Crude Oil & Gold Safe Haven',
        status: 'neutral',
        statusLabel: 'ทองคำแข็งแกร่ง น้ำมันทรงตัว',
        keyMetric: 'WTI Oil ~$72 | Gold ~$2,650+',
        insight: 'ราคาน้ำมันส่งผลต่อเงินเฟ้อทางตรง ขณะที่ทองคำเป็นสินทรัพย์ประกันความเสี่ยงจากความไม่แน่นอนของระบบเงินตรา',
        actionGuidance: 'ควรถือทองคำในพอร์ต 5-10% เพื่อเป็นกันชนลดความผันผวนรวมของพอร์ต',
      },
      {
        id: 't3-3',
        title: 'ปัญหาธนาคาร สินเชื่อ และสภาพคล่อง',
        subTitle: 'Credit Spreads & Systemic Liquidity',
        status: 'bullish',
        statusLabel: 'สภาพคล่องระบบยังมั่นคง',
        keyMetric: 'High Yield Credit Spreads: Low',
        insight: 'Credit Spreads ที่แคบสะท้อนว่าตลาดยังไม่มีความกังวลเรื่องการล้มละลายหรือการตึงตัวของระบบสินเชื่อ',
        actionGuidance: 'ติดตามสุขภาพของธนาคารพาณิชย์และระดับดอกเบี้ยเงินกู้ภาคเอกชน',
      },
      {
        id: 't3-4',
        title: 'ข่าวเฉพาะบริษัทที่คุณถือหรือสนใจ',
        subTitle: 'Single Stock Catalyst & Fundamental Shifts',
        status: 'watch',
        statusLabel: 'ตรวจสอบผลกระทบรายตัว',
        keyMetric: userTickers.slice(0, 4).join(', ') || 'หุ้นในพอร์ต',
        insight: 'การประกาศผลงาน วงเงินซื้อหุ้นคืน (Buyback) หรือการเพิ่มเงินปันผล ช่วยดันราคาเฉพาะตัวได้ดีกว่าตลาดรวม',
        actionGuidance: 'คลิกดูบทวิเคราะห์เจาะลึก 3 บรรทัดและแบบจำลองสถานการณ์ (Deep Dive) ในส่วนคลังข่าวด้านล่าง',
      },
    ],
    officialSources: [
      {
        name: 'Fed — ดอกเบี้ยและนโยบายการเงิน',
        url: 'https://www.federalreserve.gov/monetarypolicy.htm',
        description: 'มติการประชุม FOMC, Dot Plot, แถลงการณ์ประธาน Fed และอัตราดอกเบี้ยนโยบาย',
        category: 'นโยบายการเงิน',
      },
      {
        name: 'BLS — ปฏิทินตัวเลขเศรษฐกิจ',
        url: 'https://www.bls.gov/schedule/2026/',
        description: 'ปฏิทินวันและเวลาประกาศตัวเลข CPI, PPI, การจ้างงานนอกภาคเกษตร และอัตราว่างงาน',
        category: 'สถิติแรงงานและเงินเฟ้อ',
      },
      {
        name: 'FRED — ข้อมูลเศรษฐกิจและดอกเบี้ย',
        url: 'https://fred.stlouisfed.org/',
        description: 'กราฟและฐานข้อมูลเศรษฐกิจมหภาค Yield Curve, อัตราเงินเฟ้อ และสภาพคล่อง M2',
        category: 'ฐานข้อมูลเศรษฐกิจสหรัฐฯ',
      },
      {
        name: 'Reuters — ข่าวตลาดการเงิน',
        url: 'https://www.reuters.com/markets/',
        description: 'สำนักข่าวการเงินระดับโลก ข่าวความเคลื่อนไหวตลาดหุ้น สินค้าโภคภัณฑ์ และภูมิรัฐศาสตร์',
        category: 'ข่าวตลาดการเงินโลก',
      },
    ],
    disciplineRule:
      'ก่อนซื้อหุ้น ให้ตอบได้ 3 ข้อว่า: ตลาดกำลังเผชิญอะไร, กำไรของธุรกิจมีแนวโน้มอย่างไร และราคาปัจจุบันคุ้มกับความเสี่ยงหรือไม่ — หากข้อมูลเหล่านี้ไม่เปลี่ยน ก็ไม่จำเป็นต้องเปลี่ยนแผนลงทุนทุกวัน',
  }
}

// ============================================================
// 6. News Deep-Dive Scenario Analysis (Bull / Base / Bear)
// ============================================================
export async function generateNewsDeepDive(
  userId: string,
  headline: string,
  summary: string | null,
  symbol: string | null
): Promise<NewsDeepDiveResult> {
  const targetSymbol = symbol ? symbol.toUpperCase() : 'ตลาดการเงินรวม'

  const prompt = `คุณคือ Investment Intelligence AI ประจำระบบ Investment Pro
กรุณาวิเคราะห์ข่าวต่อไปนี้อย่างลึกซึ้งและเป็นกลาง:
สินทรัพย์: ${targetSymbol}
หัวข้อข่าว: ${headline}
เนื้อหาย่อ: ${summary || 'ไม่มีเนื้อหาย่อ'}

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
      userId,
      prompt,
      logType: 'advisor',
      responseMimeType: 'application/json',
    })

    const parsed = JSON.parse(res.text)
    return {
      whyItMatters: parsed.whyItMatters || 'ข่าวนี้ส่งผลต่อจิตวิทยาการลงทุนและแนวโน้มกำไรของสินทรัพย์',
      fundamentalImpact: parsed.fundamentalImpact || 'ยังไม่พบการเปลี่ยนแปลงเชิงโครงสร้างที่มีนัยสำคัญต่อพื้นฐานธุรกิจ',
      scenarios: {
        bull: parsed.scenarios?.bull || 'หากยอดคำสั่งซื้อและผลประกอบการเติบโตต่อเนื่อง ราคาอาจปรับตัวขึ้นทดสอบจุดสูงสุดเดิม',
        base: parsed.scenarios?.base || 'ราคาจะเคลื่อนไหวตามสภาวะตลาดรวมและสะท้อนข้อมูลในราคาปัจจุบันแล้ว',
        bear: parsed.scenarios?.bear || 'ความเสี่ยงจากแรงขายทำกำไรหากตัวเลขจริงต่ำกว่าที่นักวิเคราะห์คาดการณ์',
      },
      actionPlan: parsed.actionPlan || 'แนะนำคงสัดส่วนเดิมไว้ และติดตามรายงานงบการเงินงวดถัดไปอย่างใกล้ชิด',
      modelUsed: res.modelUsed,
    }
  } catch (err: any) {
    console.warn('[News Deep Dive] Gemini call error, using intelligent fallback:', err)
    // Intelligent heuristic fallback
    return {
      whyItMatters: `ข่าวนี้สะท้อนกระแสการคาดการณ์ของตลาดต่อ ${targetSymbol} ซึ่งส่งผลต่อสภาพคล่องและการปรับพอร์ตของนักลงทุนสถาบัน`,
      fundamentalImpact: `ส่งผลต่อมุมมองรายได้ในระยะ 1-2 ไตรมาสข้างหน้า แต่พื้นฐานและคูเมืองทางธุรกิจยังคงสอดคล้องกับปัจจัยหลัก`,
      scenarios: {
        bull: `หากปัจจัยนี้ขยายตัวได้ดี จะผลักดันให้กำไรต่อหุ้น (EPS) เพิ่มขึ้น และกระตุ้นให้โบรกเกอร์ปรับเพิ่มราคาเป้าหมาย`,
        base: `ผลประกอบการเติบโตตามเป้าหมายของฝ่ายบริหาร ราคาแกว่งตัวในกรอบสะสมตามสภาวะตลาด`,
        bear: `หากสภาวะเศรษฐกิจมหภาคชะลอตัวลง อาจทำให้การรับรู้รายได้ล่าช้ากว่าที่ตลาดคาดหวัง`,
      },
      actionPlan: `แนะนำให้นักลงทุน "ถือครองตามสัดส่วนเดิม (Hold)" โดยไม่จำเป็นต้องตื่นตระหนก และรอพิจารณาข้อมูลทางการเงินที่ยืนยันแล้ว`,
      modelUsed: 'Heuristic Analytical Engine',
    }
  }
}
