/**
 * lib/news/news-analyzer.ts
 * Synthesizes financial news into actionable portfolio intelligence:
 * - Rule-based & AI-assisted Thai synthesis and 3-point takeaways
 * - Sentiment scoring & impact classification
 * - Daily portfolio brief generation
 * - Gemini deep-dive scenario analysis (Bull / Base / Bear)
 */

import { NewsSentiment } from '@prisma/client'
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
}

export interface PortfolioDailyBrief {
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
  sentimentScore: number // 0 - 100 (% bullish)
  positiveCount: number
  negativeCount: number
  neutralCount: number
  summaryOneLiner: string
  readingTimeMinutes?: number

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
export function isHeadlineRelevantToTicker(headline: string, symbol: string | null): boolean {
  if (!symbol) return true
  const upperHeadline = headline.toUpperCase()
  const cleanSym = symbol.toUpperCase().trim()

  // Common ticker company name map
  const nameMap: Record<string, string[]> = {
    NVDA: ['NVIDIA', 'NVDA'],
    META: ['META', 'FACEBOOK'],
    AAPL: ['APPLE', 'AAPL', 'IPHONE'],
    MSFT: ['MICROSOFT', 'MSFT', 'AZURE'],
    GOOGL: ['GOOGLE', 'ALPHABET', 'GOOGL', 'GOOG'],
    AMZN: ['AMAZON', 'AMZN', 'AWS'],
    TSLA: ['TESLA', 'TSLA', 'MUSK'],
    BTC: ['BITCOIN', 'BTC', 'CRYPTO'],
    ETH: ['ETHEREUM', 'ETH'],
    SPY: ['S&P 500', 'SPY', 'S&P'],
    QQQ: ['NASDAQ', 'QQQ', 'TECH STOCKS'],
  }

  const aliases = nameMap[cleanSym] || [cleanSym]
  return aliases.some((alias) => upperHeadline.includes(alias))
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

export function invalidateDailyBriefCache(userId?: string) {
  if (userId) {
    briefCache.delete(userId)
  } else {
    briefCache.clear()
  }
}

export async function generateDailyBrief(
  userId: string,
  userHoldingsInput: UserHoldingContext[] | string[],
  recentNews: Array<{ headline: string; symbol: string | null; sentiment: NewsSentiment | null }>,
  geminiApiKeyConfigured: boolean,
  forceRefresh: boolean = false
): Promise<PortfolioDailyBrief> {
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

  // Check in-memory cache
  if (!forceRefresh) {
    const cached = briefCache.get(userId)
    if (cached && Date.now() - cached.timestamp < BRIEF_CACHE_TTL_MS) {
      return cached.brief
    }
  }

  // 1. Calculate sentiment metrics
  let positive = 0
  let negative = 0
  let neutral = 0

  for (const n of recentNews) {
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
    recentNews,
    positive,
    negative,
    neutral,
    sentimentScore,
    overallSentiment
  )

  let finalBrief: PortfolioDailyBrief = heuristicBrief

  // If Gemini is available, attempt AI-powered executive synthesis
  if (geminiApiKeyConfigured && recentNews.length > 0) {
    try {
      const newsDigest = recentNews
        .slice(0, 10)
        .map((n) => `- [${n.symbol || 'MARKET'}] ${n.headline}`)
        .join('\n')

      const holdingsDigest = holdings.length > 0
        ? holdings.map((h) => `${h.ticker} (${h.assetName}, สัดส่วน ${h.allocationPercent}%)`).join(', ')
        : 'หุ้นเทคโนโลยีและดัชนีหลัก'

      const prompt = `คุณคือหัวหน้านักกลยุทธ์การลงทุนอาวุโส (Chief Investment Strategist) ของ Investment Pro
ทำหน้าที่สรุปบทวิเคราะห์ข่าวสารและกลยุทธ์พอร์ตประจำวัน (Executive Daily Portfolio Intelligence Brief) ให้อ่านง่าย สั้น กระชับ ได้ใจความ เหมาะสำหรับนักลงทุนอ่านจบใน 2 นาที

ข้อมูลพอร์ตของผู้ใช้:
ถือครอง: ${holdingsDigest}

ข่าวสารสำคัญล่าสุดในตลาด:
${newsDigest}

กรุณาวิเคราะห์และตอบกลับในรูปแบบ JSON ภาษาไทยที่มีโครงสร้างดังนี้เท่านั้น (ห้ามใส่ Markdown หรือข้อความนอก JSON):
{
  "summaryOneLiner": "สรุปภาพรวมตลาดและผลต่อพอร์ตของผู้ใช้ใน 1 ประโยคเด่น ชัดเจนและทรงพลัง (ไม่เกิน 150 ตัวอักษร)",
  "todayHighlights": [
    {
      "id": "h1",
      "title": "หัวข้อข่าวเด่นสั้นๆ",
      "tag": "หมวด เช่น อุตสาหกรรม AI, ดอกเบี้ย FED, ผลประกอบการ",
      "detail": "คำอธิบายกระชับ 1-2 บรรทัด ว่าเกิดอะไรขึ้นวันนี้/ช่วงนี้",
      "sentiment": "positive | negative | neutral"
    }
  ],
  "marketConsensus": {
    "mood": "Selective",
    "moodLabel": "เลือกลงทุนเฉพาะกลุ่ม (Selective Accumulation) หรือตามสภาวะจริง",
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
      "theme": "ธีมการลงทุน เช่น พลังงานนิวเคลียร์ AI, ชิปประมวลผล, ปันผลสูง",
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
  briefCache.set(userId, { brief: finalBrief, timestamp: Date.now() })

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

  // 1. Today Highlights
  const todayHighlights: TodayMarketHighlight[] = [
    {
      id: 'h1',
      title: 'กระแส AI & โครงสร้างพื้นฐานพลังงานขยายตัวต่อเนื่อง',
      tag: 'อุตสาหกรรมเทคโนโลยี & AI',
      detail: 'บิ๊กเทคเดินหน้าลงนามสัญญาพลังงานสะอาดและพลังงานนิวเคลียร์ (SMRs) เพื่อรองรับศูนย์ข้อมูล Data Centers มั่นใจความต้องการชิปและคลาวด์ยังอยู่ในขาขึ้น',
      sentiment: 'positive',
      relatedSymbol: holdingsSymbols.has('GOOGL') ? 'GOOGL' : 'NVDA',
    },
    {
      id: 'h2',
      title: 'ทิศทางดอกเบี้ย FED & ตัวเลขเศรษฐกิจสหรัฐฯ',
      tag: 'นโยบายการเงิน & มหภาค',
      detail: 'ตลาดซึมซับการผ่อนคลายนโยบายแบบค่อยเป็นค่อยไป ขณะที่ตัวเลขตลาดแรงงานและเงินเฟ้อยังสะท้อนภาพเศรษฐกิจแบบ Soft Landing',
      sentiment: 'neutral',
      relatedSymbol: 'SPY',
    },
    {
      id: 'h3',
      title: 'ดัชนีหลักแกว่งตัวในกรอบสะสม รอผลประกอบการไตรมาส',
      tag: 'ตลาดหุ้นโลก',
      detail: 'นักลงทุนสถาบันเริ่มปรับพอร์ตคัดเลือกหุ้นรายตัว (Stock Picking) โดยเน้นบริษัทที่มีกระแสเงินสดแข็งแกร่งและอำนาจกำหนดราคา',
      sentiment: 'positive',
      relatedSymbol: 'VOO',
    },
    {
      id: 'h4',
      title: 'หุ้นปันผลและสินทรัพย์ป้องกันความเสี่ยงให้ผลตอบแทนสม่ำเสมอ',
      tag: 'เงินปันผล & สภาพคล่อง',
      detail: 'หุ้นกลุ่ม Dividend Growth และพันธบัตรระยะกลางช่วยลดความผันผวนของพอร์ตรวมในช่วงที่ตลาดยังรอปัจจัยชี้นำใหม่',
      sentiment: 'positive',
      relatedSymbol: holdingsSymbols.has('SCHD') ? 'SCHD' : 'SCB',
    },
  ]

  // 2. Market Consensus
  const marketConsensus: MarketConsensus = {
    mood: 'Selective',
    moodLabel: 'เลือกลงทุนเฉพาะกลุ่ม (Selective Risk-On)',
    summary: 'ตลาดส่วนใหญ่มีมุมมองเชิงบวกอย่างระมัดระวัง เงินทุนไหลเข้าสู่กลุ่มเทคโนโลยีขนาดใหญ่และหุ้นที่มีเงินปันผลมั่นคง โดยเลี่ยงกลุ่มเก็งกำไรที่ Valuation สูงเกินจริง',
    fedExpectation: 'ตลาดคาดการณ์ว่า FED มีแนวโน้มปรับลดอัตราดอกเบี้ยอย่างต่อเนื่องตามสภาวะเศรษฐกิจ โดยไม่มีสัญญาณภาวะเศรษฐกิจถดถอยรุนแรง',
    keyRisksToWatch: 'อัตราผลตอบแทนพันธบัตรรัฐบาล (Bond Yields) และประเด็นภูมิรัฐศาสตร์ที่อาจกระทบราคาพลังงาน',
  }

  // 3. Holdings Direct Impact
  const holdingsImpact: PortfolioAssetImpact[] = holdings.map((h) => {
    const sym = h.ticker.toUpperCase()
    if (sym === 'GOOGL' || sym === 'GOOG') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Alphabet Inc.',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'ได้ประโยชน์โดยตรงจากการขยายตัวของ AI และข้อตกลงพลังงานสำหรับ Data Center',
        detail: 'การทำสัญญาพลังงานสะอาดระยะยาวช่วยคลายความกังวลเรื่องต้นทุนไฟฟ้าของระบบ Cloud และโมเดล AI เสริมความแข็งแกร่งของกำไรระยะยาว',
        actionSuggestion: 'ถือครองตามแผนการลงทุนระยะยาวเพื่อรับผลตอบแทนทบต้น',
      }
    }
    if (sym === 'VOO' || sym === 'SPY') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Vanguard S&P 500 ETF',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'ดัชนีสะท้อนสุขภาพเศรษฐกิจสหรัฐฯ และความแข็งแกร่งของบริษัท 500 อันดับแรก',
        detail: 'การกระจายความเสี่ยงในหลายกลุ่มธุรกิจช่วยซับแรงกระแทกจากความผันผวนของหุ้นเดี่ยว แนวโน้มระยะยาวยังคงเติบโตตามกำไรบริษัทจดทะเบียน',
        actionSuggestion: 'คงสัดส่วนเป็นแกนหลัก (Core Holding) และ DCA สม่ำเสมอ',
      }
    }
    if (sym === 'SCHD') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Schwab US Dividend Equity ETF',
        allocationPercent: h.allocationPercent,
        impact: 'neutral',
        headline: 'ทำหน้าที่เป็นเกราะป้องกันความผันผวนและผลิตกระแสเงินสดปันผลสม่ำเสมอ',
        detail: 'แม้ราคาอาจปรับขึ้นช้ากว่าหุ้นเทคโนโลยี แต่ Dividend Yield ประมาณ 3.4-3.6% ช่วยให้พอร์ตมี Cash Inflow ต่อเนื่องในทุกสภาวะตลาด',
        actionSuggestion: 'ถือครองเพื่อรับกระแสเงินสด และนำเงินปันผลไปต่อยอด Reinvest',
      }
    }
    if (sym === 'QQQM' || sym === 'QQQ') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Invesco NASDAQ 100 ETF',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'เกาะติดโมเมนตัมของบริษัทเทคโนโลยีและนวัตกรรมระดับโลก',
        detail: 'หุ้นในกลุ่ม Nasdaq 100 ยังคงเป็นตัวขับเคลื่อนผลตอบแทนหลักของตลาด หากมีแรงขายทำกำไรระยะสั้นถือเป็นจังหวะสะสม',
        actionSuggestion: 'ถือครองต่อไป หรือทยอยสะสมเพิ่มเมื่อดัชนีย่อตัว 3-5%',
      }
    }
    if (sym === 'WDC') {
      return {
        symbol: sym,
        assetName: h.assetName || 'Western Digital Corp.',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'รอบวัฏจักรหน่วยความจำและสตอเรจฟื้นตัวตามความต้องการ AI Storage',
        detail: 'ความต้องการฮาร์ดดิสก์ความจุสูง (Enterprise HDDs) สำหรับ AI Infrastructure มีแนวโน้มเติบโต ช่วยหนุน Gross Margin ของบริษัท',
        actionSuggestion: 'เกาะติดระดับแนวรับสำคัญ และติดตามตัวเลขรายได้ไตรมาสถัดไป',
      }
    }
    if (sym === 'SCB') {
      return {
        symbol: sym,
        assetName: h.assetName || 'SCB X PCL',
        allocationPercent: h.allocationPercent,
        impact: 'positive',
        headline: 'อัตราผลตอบแทนเงินปันผลระดับสูงช่วยลดความผันผวนของพอร์ตโดยรวม',
        detail: 'หุ้นธนาคารขนาดใหญ่ของไทยที่มีระดับ Dividend Yield สูงกว่า 7-8% ช่วยเพิ่มเสถียรภาพและสร้างผลตอบแทนสม่ำเสมอในสกุลเงินบาท',
        actionSuggestion: 'ถือรับเงินปันผลตามแผน และใช้เป็นสินทรัพย์เสริมกระแสเงินสด',
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
      impact: 'positive',
      headline: 'พอร์ตลงทุนได้รับการจัดสรรอย่างสมดุลระหว่างการเติบโตและกระแสเงินสด',
      detail: 'สินทรัพย์หลักยังคงได้รับแรงส่งจากกระแสการลงทุนระยะยาวและนโยบายการเงินที่ผ่อนคลายลง',
      actionSuggestion: 'คงสัดส่วนการลงทุนตามแผน ไม่จำเป็นต้อง Panic Sell',
    })
  }

  // 4. Timeframe Strategy
  const timeframeStrategy: TimeframeStrategy = {
    shortTerm: {
      period: 'ระยะสั้น (1 - 7 วัน)',
      action: 'หลีกเลี่ยงการเทรดตามอารมณ์หรือความตื่นตระหนกของข่าวรายวัน เน้นจับตาจุดรับเมื่อราคาหุ้นคุณภาพย่อตัว',
      focus: 'การตอบสนองของดัชนีต่อตัวเลขเงินเฟ้อและถ้อยแถลงของประธาน FED',
    },
    mediumTerm: {
      period: 'ระยะกลาง (1 - 3 เดือน)',
      action: 'ทยอยสะสมหุ้นกลุ่ม Core Holdings (VOO, QQQM, GOOGL) ตามรอบ DCA และปล่อยให้เงินปันผลทบต้น',
      focus: 'รายงานงบการเงินไตรมาสล่าสุด และทิศทางการลงทุน CapEx ด้าน AI ของบิ๊กเทค',
    },
    longTerm: {
      period: 'ระยะยาว (6 - 12 เดือน+)',
      action: 'ยึดมั่นในวินัยการถือครองสินทรัพย์คุณภาพสูง เพื่อให้พลังของดอกเบี้ยทบต้น (Compounding) ทำงานเต็มประสิทธิภาพ',
      focus: 'เมกะเทรนด์ AI, โครงสร้างพื้นฐานพลังงานแห่งอนาคต, และเสถียรภาพทางการเงินของบริษัทที่ถือครอง',
    },
  }

  // 5. Action Plan
  const actionPlan: ActionPlanItem[] = [
    {
      id: 'a1',
      priority: 'high',
      type: 'HOLD',
      badgeText: 'ถือครองต่อเนื่อง',
      title: 'รักษาสถานะ Core Port (VOO & QQQM)',
      detail: 'ไม่ตื่นตระหนกกับความผันผวนระยะสั้น สัดส่วนหลักของพอร์ตยังคงอยู่ในแนวโน้มขาขึ้นที่แข็งแกร่ง',
    },
    {
      id: 'a2',
      priority: 'medium',
      type: 'BUY_DIP',
      badgeText: 'รอจังหวะสะสม',
      title: 'ตั้งเป้ารับ Big Tech (GOOGL) เมื่อราคาย่อตัว',
      detail: 'หากราคาหุ้นเทคโนโลยีคุณภาพปรับฐานจากความกังวลเศรษฐกิจชั่วคราว ให้ถือเป็นจังหวะเพิ่มน้ำหนัก',
    },
    {
      id: 'a3',
      priority: 'medium',
      type: 'DIVIDEND',
      badgeText: 'เก็บเกี่ยวปันผล',
      title: 'ปล่อยให้ SCHD และ SCB ผลิตกระแสเงินสดต่อเนื่อง',
      detail: 'เก็บเงินปันผลที่ได้รับไว้เป็นสภาพคล่องสำรอง หรือนำไป Reinvest ทบต้นเพื่อขยายพอร์ต',
    },
    {
      id: 'a4',
      priority: 'low',
      type: 'WATCH',
      badgeText: 'เกาะติดข้อมูล',
      title: 'ตรวจสอบปฏิทินเศรษฐกิจสัปดาห์นี้',
      detail: 'ดูวันประกาศตัวเลขเงินเฟ้อ CPI และรายงานงบการเงินเพื่อเตรียมสภาพคล่องให้พร้อมล่วงหน้า',
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
      symbol: 'SMR',
      name: 'NuScale Power Corp.',
      theme: 'เตาปฏิกรณ์นิวเคลียร์ขนาดเล็ก (Small Modular Reactors)',
      whyInteresting: 'ได้รับความสนใจอย่างกว้างขวางหลัง Alphabet/Google ประกาศแผนสนับสนุนเตาปฏิกรณ์ SMR เพื่อจ่ายพลังงานให้ Cloud',
      catalyst: 'ความคืบหน้าในการขอใบอนุญาตและข้อตกลงเชิงพาณิชย์กับลูกค้าระดับโลก',
      riskNote: 'ยังอยู่ในช่วงเริ่มต้นพัฒนาเชิงพาณิชย์ มีความเสี่ยงสูง เหมาะสำหรับเป็นพอร์ตเก็งกำไรสัดส่วนเล็ก',
    },
    {
      symbol: 'TLT',
      name: 'iShares 20+ Year Treasury Bond ETF',
      theme: 'การป้องกันความเสี่ยง & วัฏจักรดอกเบี้ยขาลง',
      whyInteresting: 'อัตราผลตอบแทน Yield อยู่ในระดับที่น่าสนใจ และมีโอกาสได้รับ Capital Gain เมื่อ FED ทยอยปรับลดอัตราดอกเบี้ย',
      catalyst: 'การปรับลดดอกเบี้ยนโยบายของ FED ในการประชุมไตรมาสข้างหน้า',
      riskNote: 'มีความอ่อนไหวสูงต่อตัวเลขเงินเฟ้อสหรัฐฯ หากเงินเฟ้อกลับมาพุ่งอาจกดดันราคาพันธบัตร',
    },
  ]

  const summaryOneLiner = `ตลาดอยู่ในช่วงคัดเลือกหุ้นรายตัว (Selective) พอร์ตของคุณ (${topTickers.join(', ') || 'หุ้นรวม'}) ยังได้แรงหนุนสำคัญจากกระแส AI Infrastructure และมีเกราะป้องกันจากเงินปันผล`

  const tailwinds = `สินทรัพย์หลักในพอร์ต (${topTickers.join(', ') || 'หุ้นรวม'}) ได้รับแรงหนุนจากกระแสความต้องการเทคโนโลยี AI และเสถียรภาพของเงินปันผล`
  const headwinds = `ความผันผวนของอัตราผลตอบแทนพันธบัตรและการรอคอยตัวเลขเงินเฟ้อยังคงสร้างการแกว่งตัวระยะสั้น`
  const strategicTakeaway = `ถือครอง Core Portfolio ตามแผน ไม่จำเป็นต้อง Panic Sell รอจังหวะสะสมในวันที่ราคาย่อตัว`

  return {
    overallSentiment,
    sentimentScore,
    positiveCount: positive,
    negativeCount: negative,
    neutralCount: neutral,
    summaryOneLiner,
    readingTimeMinutes: 2,
    todayHighlights,
    marketConsensus,
    holdingsImpact,
    timeframeStrategy,
    actionPlan,
    interestingStocks,
    tailwinds,
    headwinds,
    strategicTakeaway,
    generatedAt: new Date().toISOString(),
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
