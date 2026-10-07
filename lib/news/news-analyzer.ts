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

export interface PortfolioDailyBrief {
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
  sentimentScore: number // 0 - 100 (% bullish)
  positiveCount: number
  negativeCount: number
  neutralCount: number
  tailwinds: string // ปัจจัยสนับสนุน
  headwinds: string // ปัจจัยเฝ้าระวัง/ความเสี่ยง
  strategicTakeaway: string // คำแนะนำกลยุทธ์วันนี้
  generatedAt: string
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
export async function generateDailyBrief(
  userId: string,
  userTickers: string[],
  recentNews: Array<{ headline: string; symbol: string | null; sentiment: NewsSentiment | null }>,
  geminiApiKeyConfigured: boolean
): Promise<PortfolioDailyBrief> {
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

  // Default synthesized brief
  let tailwinds = `สินทรัพย์หลักในพอร์ต (${userTickers.slice(0, 3).join(', ') || 'หุ้นรวม'}) ยังคงได้รับแรงหนุนจากกระแสความต้องการเทคโนโลยีและความมั่นคงของกำไร`
  let headwinds = `อัตราผลตอบแทนพันธบัตรและทิศทางนโยบายการเงินของ FED ยังคงเป็นตัวแปรสร้างความผันผวนระยะสั้นในสินทรัพย์เสี่ยง`
  let strategicTakeaway = `คงสัดส่วนการลงทุนตามแผน ไม่จำเป็นต้อง Panic Sell หากต้องการปรับสมดุล แนะนำรอจังหวะสะสมในวันที่ราคาย่อตัว`

  // If Gemini is available, attempt AI-powered synthesis
  if (geminiApiKeyConfigured && recentNews.length > 0) {
    try {
      const newsDigest = recentNews
        .slice(0, 8)
        .map((n) => `[${n.symbol || 'MARKET'}] ${n.headline}`)
        .join('\n')

      const prompt = `คุณคือหัวหน้านักกลยุทธ์การลงทุนอาวุโส (Chief Investment Strategist) ของ Investment Pro
ผู้ใช้ถือครองสินทรัพย์ต่อไปนี้ในพอร์ต: ${userTickers.join(', ') || 'หุ้นเติบโตและเทคโนโลยี'}
ข่าวสารสำคัญล่าสุดในตลาด:
${newsDigest}

กรุณาสรุปบทวิเคราะห์ภาพรวมประจำวันสำหรับพอร์ตลงทุนนี้ ในรูปแบบ JSON ภาษาไทยดังนี้:
{
  "tailwinds": "1 ประโยคสรุปปัจจัยบวกที่หนุนพอร์ตของผู้ใช้ (ไม่เกิน 120 ตัวอักษร)",
  "headwinds": "1 ประโยคสรุปปัจจัยเสี่ยง/ความผันผวนที่ต้องเฝ้าระวัง (ไม่เกิน 120 ตัวอักษร)",
  "strategicTakeaway": "1 ประโยคคำแนะนำกลยุทธ์การถือครอง/จัดการพอร์ตวันนี้ (ไม่เกิน 120 ตัวอักษร)"
}`

      const res = await callGemini({
        userId,
        prompt,
        logType: 'advisor',
        responseMimeType: 'application/json',
      })

      const parsed = JSON.parse(res.text)
      if (parsed.tailwinds) tailwinds = parsed.tailwinds
      if (parsed.headwinds) headwinds = parsed.headwinds
      if (parsed.strategicTakeaway) strategicTakeaway = parsed.strategicTakeaway
    } catch (err) {
      console.warn('[News Analyzer] Gemini daily brief fallback used:', err)
    }
  }

  return {
    overallSentiment,
    sentimentScore,
    positiveCount: positive,
    negativeCount: negative,
    neutralCount: neutral,
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
