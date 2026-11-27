export function copilotQuotaSummary(input: {
  requestedEvidence: string[]
  unresolvedSymbols: string[]
  cash: number
  baseCurrency: string
  holdingsCount: number
}) {
  const lines = ['Gemini จำกัดจำนวนคำขอในรอบนี้ ระบบจึงแสดงข้อมูลที่ตรวจได้ประกอบคำถาม']
  if (input.requestedEvidence.length) lines.push('', ...input.requestedEvidence)
  if (input.unresolvedSymbols.length) lines.push('ยังยืนยันสัญลักษณ์หรือตลาดไม่ได้ · ' + input.unresolvedSymbols.join(', '))
  if (input.requestedEvidence.length || input.unresolvedSymbols.length) {
    lines.push('', 'เปิดกราฟในหน้าตลาดเพื่อตรวจเวลา ราคา และแนวรับแนวต้านอีกครั้งก่อนพิจารณาจังหวะเข้าออก')
  } else {
    lines.push('', 'พอร์ตมีสินทรัพย์ ' + input.holdingsCount + ' รายการ')
    if (Number.isFinite(input.cash)) lines.push('ยอดเงินสดรวมตามข้อมูลบัญชี ' + input.cash.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ' + input.baseCurrency)
    lines.push('', 'เปิดแผนประจำวันเพื่อทบทวนรายการที่เกี่ยวข้อง หรือระบุชื่อหุ้นเพื่อตรวจข้อมูลกราฟรายตัว')
  }
  return lines.join('\n')
}
