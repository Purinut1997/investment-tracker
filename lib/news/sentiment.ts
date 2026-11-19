/**
 * lib/news/sentiment.ts
 * Bilingual (English + Thai) financial news keyword sentiment detector.
 */

export type SentimentLabel = 'positive' | 'negative' | 'neutral'

const POSITIVE_PATTERNS = [
  /\b(surge|surges|surged|surging|jump|jumps|jumped|rally|rallies|rallied|gain|gains|gained)\b/i,
  /\b(beat|beats|beaten|record high|all-time high|ath|boom|bullish|upgrade|upgrades|upgraded)\b/i,
  /\b(buyback|dividend hike|growth|outperform|strong demand|accelerat(e|es|ing))\b/i,
  /\b(profit rise|revenue jump|guidance raised|partnership|breakthrough|positive)\b/i,
  /\b(soar|soars|soared|skyrocket|top estimates)\b/i,
  /(กำไรพุ่ง|กำไรโต|นิวไฮ|ทุบสถิติ|ปันผลสูง|ดีกว่าคาด|ฟื้นตัว|ทะลุ|ขาขึ้น|แรงซื้อ|เติบโตแกร่ง|บวกแรง)/i,
]

const NEGATIVE_PATTERNS = [
  /\b(drop|drops|dropped|fall|falls|fallen|plunge|plunges|plunged|slump|slumps|slumped)\b/i,
  /\b(miss|misses|missed|warning|warns|downgrade|downgrades|downgraded|bearish)\b/i,
  /\b(sell-off|crash|investigation|lawsuit|probe|risk|risks|threat|loss|losses)\b/i,
  /\b(inflation fears|recession|rate hike|layoffs|cut forecast|weak demand|headwind)\b/i,
  /\b(plummet|plummeted|stumble|stumbles|retreat|tumble)\b/i,
  /(กำไรหด|ขาดทุน|ร่วงหนัก|ดิ่ง|ต่ำกว่าคาด|กังวล|วิกฤต|เทขาย|ชะลอตัว|หนี้เสีย|ฟองสบู่|ลบแรง|หั่นเป้า)/i,
]

export function detectSentiment(headline: string, summary?: string | null): SentimentLabel {
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
