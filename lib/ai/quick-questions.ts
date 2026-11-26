/**
 * lib/ai/quick-questions.ts
 * Portfolio-aware dynamic quick questions & cross-page Copilot deep links.
 * Eliminates hardcoded stock assumptions so every user gets questions grounded in their real portfolio.
 */

export type QuickQuestionIconKey =
  | 'compass'
  | 'layers'
  | 'shield'
  | 'newspaper'
  | 'scale'
  | 'receipt'

export interface CopilotQuickQuestion {
  id: string
  category: string
  iconKey: QuickQuestionIconKey
  prompt: string
}

export interface QuickQuestionHoldingInput {
  ticker: string
  allocationPercent?: number
  unrealizedPnLPercent?: number
  assetType?: string
  market?: string
}

export interface QuickQuestionInput {
  holdings?: QuickQuestionHoldingInput[]
  tacticalActions?: Array<{ ticker: string; action: string }>
  cashPercent?: number | null
  recommendedCashPercent?: number | null
  riskLevel?: number | null
  maxSinglePositionPercent?: number | null
  hasThematicAlert?: boolean
}

export function buildCopilotDeepLink(question: string): string {
  const clean = question.trim()
  return clean ? `/ai-advisor?q=${encodeURIComponent(clean)}` : '/ai-advisor'
}

export function buildCopilotQuickQuestions(input: QuickQuestionInput = {}): CopilotQuickQuestion[] {
  const holdings = [...(input.holdings || [])]
    .filter((h) => Boolean(h?.ticker))
    .sort((a, b) => Number(b.allocationPercent || 0) - Number(a.allocationPercent || 0))

  const topTickers = holdings.slice(0, 4).map((h) => h.ticker.toUpperCase())
  const topHeavy = holdings.slice(0, 2).map((h) => `${h.ticker.toUpperCase()}${h.allocationPercent ? ` (${Number(h.allocationPercent).toFixed(0)}%)` : ''}`)
  const profitLeaders = holdings
    .filter((h) => Number(h.unrealizedPnLPercent || 0) >= 12)
    .slice(0, 3)
    .map((h) => h.ticker.toUpperCase())

  const accumulateTickers = (input.tacticalActions || [])
    .filter((a) => a.action === 'ACCUMULATE')
    .slice(0, 3)
    .map((a) => a.ticker.toUpperCase())
  const trimTickers = (input.tacticalActions || [])
    .filter((a) => a.action === 'TRIM_PROFIT')
    .slice(0, 3)
    .map((a) => a.ticker.toUpperCase())

  const hasGold = holdings.some((h) => h.assetType === 'gold' || /^(XAU|GOLD)/i.test(h.ticker))
  const hasThai = holdings.some((h) => h.market === 'TH' || h.ticker.toUpperCase().endsWith('.BK'))
  const maxCap = Number.isFinite(Number(input.maxSinglePositionPercent)) && Number(input.maxSinglePositionPercent) > 0
    ? Number(input.maxSinglePositionPercent)
    : 20

  const riskNote = input.riskLevel ? ` (สภาวะตลาดเสี่ยง ${input.riskLevel}/5)` : ''
  const cashNote =
    typeof input.cashPercent === 'number' && Number.isFinite(input.cashPercent)
      ? typeof input.recommendedCashPercent === 'number' && Number.isFinite(input.recommendedCashPercent)
        ? `เงินสดปัจจุบัน ${input.cashPercent.toFixed(1)}% เทียบเป้า ${input.recommendedCashPercent}%`
        : `เงินสดปัจจุบัน ${input.cashPercent.toFixed(1)}%`
      : 'เงินสดสำรองในพอร์ตตอนนี้'

  const tickersPhrase = topTickers.length > 0 ? topTickers.join(', ') : 'สินทรัพย์หลักในพอร์ตของผม'
  const deployTargets =
    accumulateTickers.length > 0
      ? `โดยเทียบตัวในแผนสะสม (${accumulateTickers.join(', ')}) กับ`
      : 'โดยเทียบกับ'

  const q1Prompt = `ช่วยสรุปแผนปฏิบัติการวันนี้เป็นลำดับ 1-2-3${riskNote} โดยเชื่อมข้อมูลจากแผนรายวัน, Tactical Advisor, คำเตือน Risk Sentinel และกฎส่วนตัวของผมให้ตรงกัน ว่าผมควรทำอะไรก่อน-หลังใน 24 ชั่วโมงนี้?`

  const q2Prompt = `ตอนนี้มี${cashNote} ควรแบ่งเงินเข้าซื้อกี่ไม้ (${deployTargets}แนวรับ S1 และเพดานไม่เกิน ${maxCap}%/ตัว) และควรกันเงินสดสำรองไว้เท่าไหร่?`

  const q3Prompt = topHeavy.length > 0
    ? `ตรวจความเสี่ยงกระจุกตัว${input.hasThematicAlert ? 'และคำเตือนธีมซ้ำ' : ''}ของตัวหลักในพอร์ต (${topHeavy.join(', ')}) เทียบเพดาน ${maxCap}% พร้อมระบุจุดหนีไฟ (Stop-Loss / Invalidation) และเงื่อนไขที่ต้องลดน้ำหนัก`
    : `ตรวจความเสี่ยงกระจุกตัวของพอร์ตเทียบเพดาน ${maxCap}%/ตัว พร้อมระบุจุดหนีไฟ (Stop-Loss / Invalidation) และเงื่อนไขป้องกัน Drawdown เกินกรอบ`

  const q4Prompt = `สรุปข่าวล่าสุด ปฏิทินงบ (Earnings) และวันขึ้น XD ที่ใกล้ถึงสำหรับ ${tickersPhrase} พร้อมบอกว่าเรื่องไหนเปลี่ยนแผนเดิมหรือควรเฝ้าระวังเป็นพิเศษ`

  const assetMixFocus = [
    hasGold ? 'ทองคำ' : null,
    hasThai ? 'หุ้นไทย' : null,
    'สินทรัพย์ปรับสมดุล/Defensive',
  ]
    .filter(Boolean)
    .join(', ')

  const q5Prompt = trimTickers.length > 0
    ? `ตัวที่แผนแนะนำจับตา/ล็อกกำไร (${trimTickers.join(', ')}) ควรแบ่งขายหรือชะลอซื้อแค่ไหน แล้วหมุนเงินเข้าตัวกันกระแทกหรือโอกาสทำกำไรจาก Regime Alpha (${assetMixFocus}) ตัวไหนเพื่อลด Drawdown เวลาหุ้นเทคร่วง?`
    : `เช็กผลสแกน Regime Alpha & โครงสร้างพอร์ตล่าสุดว่ากลุ่มไหนโตเกินเป้าจนควรชะลอซื้อ และควรเสริม ${assetMixFocus} ตัวไหนที่ Correlation ต่ำเพื่อกันกระแทกและสร้างโอกาสทำกำไรเมื่อตลาดผันผวน?`

  const taxTickers = trimTickers.length > 0 ? trimTickers : profitLeaders
  const q6Prompt = taxTickers.length > 0
    ? `ถ้าจะแบ่งขายทำกำไร ${taxTickers.join(', ')} เพื่อปรับสมดุลพอร์ต มีประเด็นภาษีไทย/ต่างประเทศ (ป.161/2566, หุ้นไทย SET ยกเว้น หรือต้นทุน FIFO) และสิ่งที่ควรเตรียมก่อนสิ้นปีอะไรบ้าง?`
    : `ตรวจสถานะกำไร-ขาดทุน FIFO และเงินปันผลในปีนี้ว่ามีรายการไหนควรวางแผนภาษีก่อนสิ้นปี (แยกหุ้นไทย/ต่างประเทศ/ทองคำ ตาม ป.161/2566) และควรเช็กเอกสารอะไรเพิ่ม?`

  return [
    { id: 'next-123', category: '🧭 ทำอะไรต่อวันนี้ (1-2-3)', iconKey: 'compass', prompt: q1Prompt },
    { id: 'cash-tranche', category: '🎯 แบ่งไม้ใช้เงินสด', iconKey: 'layers', prompt: q2Prompt },
    { id: 'risk-stop', category: '🛡️ จุดหนีไฟ & กระจุกตัว', iconKey: 'shield', prompt: q3Prompt },
    { id: 'news-catalysts', category: '📰 ข่าว & งบ/XD หุ้นที่ถือ', iconKey: 'newspaper', prompt: q4Prompt },
    { id: 'sector-rotation', category: '⚖️ หมุนกลุ่มปรับสมดุล', iconKey: 'scale', prompt: q5Prompt },
    { id: 'tax-trim', category: '🧾 เช็กภาษีก่อนขาย', iconKey: 'receipt', prompt: q6Prompt },
  ]
}

export function buildTacticalQuickQuestions(payload?: {
  marketRegime?: { riskLevel?: number }
  tacticalActions?: Array<{ ticker: string; action: string }>
  cashStrategy?: { currentCashPercent?: number; recommendedCashPercent?: number }
} | null): string[] {
  const actions = payload?.tacticalActions || []
  const acc = actions.filter((a) => a.action === 'ACCUMULATE').slice(0, 2).map((a) => a.ticker)
  const trim = actions.filter((a) => a.action === 'TRIM_PROFIT').slice(0, 2).map((a) => a.ticker)
  const top = actions.slice(0, 3).map((a) => a.ticker)

  const cashNow = payload?.cashStrategy?.currentCashPercent
  const cashRec = payload?.cashStrategy?.recommendedCashPercent
  const risk = payload?.marketRegime?.riskLevel

  return [
    `สรุปลำดับ 1-2-3 ที่ต้องทำวันนี้จากแผน Tactical${risk ? ` (เสี่ยง ${risk}/5)` : ''} และ Risk Sentinel`,
    acc.length > 0
      ? `วางแผนแบ่งไม้เข้าซื้อ ${acc.join(', ')} ตามแนวรับ S1/S2 ไม่ให้ขัดกฎสัดส่วนสูงสุด`
      : 'ถ้าตลาดย่อเพิ่ม 5% เงินสดที่มีควรแบ่งเข้าตัวไหนเป็นไม้แรกตามแนวรับ S1?',
    typeof cashNow === 'number' && typeof cashRec === 'number'
      ? `เงินสดตอนนี้ ${cashNow.toFixed(1)}% เทียบเป้า ${cashRec}% ควรกันสำรองเท่าไหร่และใช้ได้เท่าไหร่?`
      : 'วิเคราะห์จุดหนีไฟ (Stop Loss) และแนวรับสำคัญของหุ้นที่ถืออยู่ทั้งหมด',
    trim.length > 0
      ? `ตัวที่แนะนำล็อกกำไร (${trim.join(', ')}) ควรแบ่งขายกี่ % และมีผลภาษี ป.161/2566 ไหม?`
      : top.length > 0
      ? `เทียบปัจจัยพื้นฐาน งบ/XD และความเสี่ยงระยะสั้นของ ${top.join(', ')}`
      : 'ตัวไหนในพอร์ตควรขายทำกำไรหรือลดความเสี่ยงก่อนสิ้นปีเพื่อบริหารภาษี?',
  ]
}
