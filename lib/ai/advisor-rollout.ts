export function advisorFlags(userId: string) {
  const audience = (process.env.ADVISOR_PILOT_USERS ?? '').split(',').map((value) => value.trim())
  const enrolled = audience.includes(userId)
  return {
    daily: enrolled && process.env.ADVISOR_DAILY_V1 === '1',
    planning: enrolled && process.env.ADVISOR_PLANNING_V1 === '1',
    shadow: enrolled && process.env.ADVISOR_SHADOW_V1 === '1',
  }
}
