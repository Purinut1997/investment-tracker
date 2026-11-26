import type { AdvisorPlanResult } from './advisor-plan'

type Currency = 'THB' | 'USD'

export type CopilotPlanIntent =
  | { kind: 'explain' }
  | { kind: 'scenario'; amount: number; currency?: Currency; field: 'inflow' | 'reserve'; extra: boolean }
  | { kind: 'clarify' }

const thaiDigits = '๐๑๒๓๔๕๖๗๘๙'
const amountPattern = '(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?'
const currencyPattern = '(บาท|thb|usd|ดอลลาร์(?:สหรัฐ)?)?'
const prefix = '(?:(?:แล้ว)?ถ้า\\s*|(?:ช่วย)?(?:ลอง)?จำลอง(?:กรณี)?\\s*)'
const tail = '\\s*(?:ล่ะ|จะเป็น(?:อย่างไร|ยังไง)|จะเปลี่ยน(?:อย่างไร|ยังไง)|ได้ไหม|เป็น(?:อย่างไร|ยังไง))?\\s*$'
const reserveQuestion = new RegExp('^' + prefix + '(?:กัน|เก็บ|ตั้ง)?\\s*เงินสด(?:สำรอง|ขั้นต่ำ)?\\s*(?:ไว้|เป็น|ที่)?\\s*' + amountPattern + '\\s*' + currencyPattern + tail, 'i')
const extraQuestion = new RegExp('^' + prefix + '(?:เพิ่ม|เติม)\\s*เงิน(?:ลงทุน|ใหม่)?\\s*อีก\\s*' + amountPattern + '\\s*' + currencyPattern + tail, 'i')
const budgetQuestion = new RegExp('^' + prefix + '(?:มีเงิน(?:ลงทุน|ใหม่)?|เงิน(?:ลงทุน|ใหม่)|(?:ใส่|เติม)เงิน|ลงทุน|ตั้งงบ(?:เติมเงิน|ลงทุน)?)\\s*(?:เป็น|ที่)?\\s*' + amountPattern + '\\s*' + currencyPattern + tail, 'i')

export function identifyCopilotPlanIntent(question: string): CopilotPlanIntent | null {
  const normalized = question.normalize('NFC')
    .replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)))
    .trim().replace(/[?!？。ฯ]+$/, '').trim().replace(/\s*(?:ครับ|ค่ะ|คะ)$/u, '').trim()
  if (/^(?:(?:ช่วย)?สรุปแผน(?:เติมเงิน|ลงทุน)(?:ที่บันทึก(?:ไว้)?|ล่าสุด)?|(?:แล้ว)?ทำไม(?:ถึง)?(?:ให้|ต้อง|แนะนำให้)รอ|ทำไมแผน(?:เติมเงิน)?(?:ถึง)?ให้รอ)$/u.test(normalized)) {
    return { kind: 'explain' }
  }

  const reserve = reserveQuestion.exec(normalized)
  const extra = extraQuestion.exec(normalized)
  const match = reserve ?? extra ?? budgetQuestion.exec(normalized)
  if (!match) return null

  const amount = Number(match[1].replace(/,/g, '') + (match[2] ? '.' + match[2] : ''))
  if (!Number.isFinite(amount) || amount > 100_000_000) return { kind: 'clarify' }
  const unit = match[3]?.toLowerCase()
  const currency = unit === 'บาท' || unit === 'thb' ? 'THB' : unit ? 'USD' : undefined
  return { kind: 'scenario', amount, currency, field: reserve ? 'reserve' : 'inflow', extra: Boolean(extra) }
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
