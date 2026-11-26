const bangkok = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function advisorDate(now = new Date()) {
  return bangkok.format(now)
}

export function advisorDayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const start = new Date(`${date}T00:00:00+07:00`)
  if (!Number.isFinite(+start) || advisorDate(start) !== date) return null
  return { gte: start, lt: new Date(+start + 86_400_000) }
}

export function matchesLegacyReport(prompt: string, date: string) {
  return prompt.includes('[daily-brief:v2]') && prompt.includes(`วันที่ ${date}:`)
}
