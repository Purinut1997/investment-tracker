// The scheduled and interactive briefs use different names for the same sections.
export function dailyPriority(text: string) {
  const sections: string[][] = [[], [], []]
  const heading = /^\s*(?:#{1,6}\s*)?(?:\*\*)?([123])[.)]\s*(?:[🧭🎯📋]\s*)?(?:\*\*)?(?:ภาพรวมตลาด|ทิศทางตลาด|ภาพรวมพอร์ต|วิเคราะห์เจาะจง|สิ่งที่ต้องตรวจ|แผนปฏิบัติการ)/u
  let section: string[] | undefined
  for (const line of text.split(/\r?\n/)) {
    const match = heading.exec(line)
    if (match) {
      section = sections[Number(match[1]) - 1]
      const rest = line.slice(match[0].length)
      const inline = rest.match(/(?:\*\*\s*[:：—–]?|[:：—–])\s*(.+)$/u)?.[1]
      if (inline) section.push(inline)
    } else if (section && line.trim()) {
      section.push(line)
    }
  }
  const firstLine = (lines: string[]) => lines
    .map(line => line.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s*|\[[ x]\]\s*)+/i, '').replace(/\*\*/g, '').trim())
    .find(Boolean)
  return { action: firstLine(sections[2]), context: firstLine(sections[0]) }
}
