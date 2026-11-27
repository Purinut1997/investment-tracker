export function dailyPriority(text: string) {
  const sections = splitDailyBrief(text)
  return { action: dailyBriefTasks(sections.tasks)[0], context: dailyBriefTasks(sections.market)[0] }
}

// Older reports may omit numbers or place all three headings on one line.
export function splitDailyBrief(text: string) {
  const headings = [...text.matchAll(/(?:^|\n|[🧭🎯📋]\s*)(?:[ \t]*(?:#{1,6}\s*)?(?:[123][.)]\s*)?(?:[🧭🎯📋]\s*)?(?:\*\*)?)(ทิศทางตลาด|ภาพรวมตลาด|วิเคราะห์เจาะจงสินทรัพย์|ภาพรวมพอร์ต|แผนปฏิบัติการ|สิ่งที่ต้องตรวจ)[^\n*]*(?:\*\*\s*[:：—–]?|[:：—–]|(?=\n|$))/gu)]
  const get = (names: string[]) => {
    const index = headings.findIndex(match => names.includes(match[1]))
    if (index === -1) return ''
    const match = headings[index]
    return text.slice(match.index + match[0].length, headings[index + 1]?.index).trim()
  }
  return {
    market: get(['ทิศทางตลาด', 'ภาพรวมตลาด']),
    portfolio: get(['วิเคราะห์เจาะจงสินทรัพย์', 'ภาพรวมพอร์ต']),
    tasks: get(['แผนปฏิบัติการ', 'สิ่งที่ต้องตรวจ']),
  }
}

export function dailyBriefTasks(text: string) {
  return text.trim().split(/\n\s*(?=[-*•]|\d+[.)]\s)|\s+-\s+(?=\d+[.)]\s)/u)
    .map(line => line.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s*)+/u, '').replace(/\*\*/g, '').trim())
    .filter(line => /[\p{L}\p{N}]/u.test(line))
    .slice(0, 3)
}
