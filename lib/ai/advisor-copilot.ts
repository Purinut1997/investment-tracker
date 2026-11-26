import type { AdvisorPlanResult } from './advisor-plan'

type Currency = 'THB' | 'USD'

export type CopilotPlanIntent =
  | { kind: 'explain' }
  | { kind: 'scenario'; amount: number; currency?: Currency; field: 'inflow' | 'reserve'; extra: boolean; reserve?: number }
  | { kind: 'clarify' }

const thaiDigits = '๐๑๒๓๔๕๖๗๘๙'
const amountPattern = '(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?'
const currencyPattern = '(บาท|thb|usd|ดอลลาร์(?:สหรัฐ)?)?'
const lead = /^(?:(?:เดือนนี้|เดือนหน้า|ผม|ฉัน|แล้ว|ถ้า|หาก|จะ|ช่วย|ลอง|จำลอง(?:กรณี)?|ขอ|อยาก)\s*)+/u
const end = /\s*(?:ล่ะ|จะ(?:เหลือเท่าไหร่|เป็น(?:อย่างไร|ยังไง)|เปลี่ยน(?:อย่างไร|ยังไง))|ได้ไหม|เป็น(?:อย่างไร|ยังไง)|ช่วยเทียบกับแผนเดิม(?:ให้หน่อย)?|แล้วจะเหลือเท่าไหร่)?\s*$/u
const reserveClause = '(?:กัน|เก็บ|ตั้ง)?\\s*เงินสด(?:สำรอง|ขั้นต่ำ)?\\s*(?:ไว้|เป็น|ที่)?'
const extraClause = '(?:เพิ่ม|เติม)(?:เงิน(?:ลงทุน|ใหม่)?)?\\s*อีก'
const inflowClause = '(?:มีเงิน(?:ลงทุน|ใหม่)?|เงิน(?:ลงทุน|ใหม่)|(?:ใส่|เติม|เพิ่ม)เงิน(?:ลงทุน|ใหม่)?|ลงทุน|ตั้งงบ(?:เติมเงิน|ลงทุน)?)(?:เป็น|ที่)?'
const clause = new RegExp('^(' + reserveClause + '|' + extraClause + '|' + inflowClause + ')\\s*' + amountPattern + '\\s*' + currencyPattern + '$', 'i')
const numberWords: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9 }
const units: Record<string, number> = { พัน: 1000, หมื่น: 10000, แสน: 100000, ล้าน: 1000000 }
function readClause(text: string) {
  const match = clause.exec(text.trim().replace(lead, '').trim())
  if (!match) return null
  const amount = Number(match[2].replace(/,/g, '') + (match[3] ? '.' + match[3] : ''))
  const unit = match[4]?.toLowerCase()
  const currency: Currency | undefined = unit === 'บาท' || unit === 'thb' ? 'THB' : unit ? 'USD' : undefined
  return { amount, currency, field: /เงินสด/.test(match[1]) ? 'reserve' as const : 'inflow' as const, extra: /อีก/.test(match[1]) }
}

export function identifyCopilotPlanIntent(question: string): CopilotPlanIntent | null {
  const normalized = question.normalize('NFC').replace(/[๐-๙]/g, digit => String(thaiDigits.indexOf(digit)))
    .replace(/(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)(พัน|หมื่น|แสน|ล้าน)/g, (_, n, unit) => ' ' + numberWords[n] * units[unit] + ' ')
    .trim().replace(/[?!？。ฯ]+$/, '').trim().replace(/\s*(?:ครับ|ค่ะ|คะ)$/u, '').trim()
  if (/^(?:(?:ช่วย)?สรุปแผน(?:เติมเงิน|ลงทุน)(?:ที่บันทึก(?:ไว้)?|ล่าสุด)?|(?:แล้ว)?ทำไม(?:ถึง)?(?:ให้|ต้อง|แนะนำให้)รอ|ทำไมแผน(?:เติมเงิน)?(?:ถึง)?ให้รอ)$/u.test(normalized)) return { kind: 'explain' }

  const parts = normalized.replace(end, '').split(/\s*(?:และ|พร้อม(?:กับ)?|กับ(?=\s*(?:ขอ|กัน|เงินสด|เติมเงิน))|แล้ว(?=(?:ขอ)?(?:กัน|เก็บ|ตั้ง)เงินสด))\s*/u)
  const parsed = parts.map(readClause)
  if (!parsed.some(Boolean)) return null
  if (parts.length > 2 || parsed.some(item => !item || item.amount > 100_000_000)) return { kind: 'clarify' }
  const [first, second] = parsed
  if (!first) return { kind: 'clarify' }
  if (!second) return { kind: 'scenario', ...first }
  if (first.field === second.field || (first.currency && second.currency && first.currency !== second.currency)) return { kind: 'clarify' }
  const [inflow, reserve] = first.field === 'inflow' ? [first, second] : [second, first]
  return { kind: 'scenario', ...inflow, currency: inflow.currency ?? reserve.currency, reserve: reserve.amount }
}

export function describeCopilotPlan(
  result: AdvisorPlanResult,
  version: number,
  comparison?: { spent: number; cashAfter: number },
) {
  const time = new Date(result.asOf).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
  const money = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ' + result.currency
  const lines = [
    comparison ? '**ผลจำลอง** · อ้างอิงพอร์ตชุดเดียวกับกรณีตามโปรไฟล์'
      : '**แผนเติมเงินที่บันทึกไว้**',
    `ข้อมูล ณ ${time} · กฎพอร์ตรุ่น ${version}`,
    result.reason,
  ]
  if (result.status === 'review') {
    lines.push('', ...result.limitations.map((item) => `- ${item}`))
  } else {
    lines.push('',
      `- เงินใหม่ ${money(result.inflow)} · วงเงินพร้อมใช้ ${money(result.budget)}`,
      `- เสนอใช้ ${money(result.spent)} รวมค่าธรรมเนียม ${money(result.fees)}`,
      `- เงินสดที่ใช้ได้หลังทำตามแผน ${money(result.availableCashAfter)} · ขั้นต่ำ ${money(result.reserve)}`,
    )
    for (const order of result.orders) {
      lines.push(`- **${order.ticker} (${order.market})** ${order.quantity} หน่วย · มูลค่า ${money(order.amount)} · สัดส่วน ${order.weightBefore.toFixed(2)}% → ${order.weightAfter.toFixed(2)}% (เป้า ${order.targetWeight}%)`)
    }
    if (comparison) {
      const difference = comparison.spent > 0 ? 'เพิ่ม ' + money(comparison.spent)
        : comparison.spent < 0 ? 'ลด ' + money(-comparison.spent) : 'เท่าเดิม'
      lines.push('', `เทียบกรณีตามโปรไฟล์บนพอร์ตชุดเดียวกัน ยอดใช้${difference}`)
    }
  }
  if (comparison) lines.push('', 'ผลจำลองใช้เฉพาะในคำตอบนี้ แผนที่บันทึกไว้ยังใช้ได้ตามเดิมหากข้อมูลพอร์ตยังไม่เปลี่ยน')
  return lines.join('\n')
}
