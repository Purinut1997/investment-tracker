export interface AdvisorTarget {
  ticker: string
  market: string
  assetType?: string
}

const nonSymbols = new Set(
  'AI A AN AND API ARR CAGR CPI DCA DCF EBITDA EMA EPS ETF ETFs FC FCF FIFO FX GDP GPIO HOLD IPO MA MACD MDD MWR NAV NPV OECD PCE PE PEG PMI PNL PE P/E ROA ROE ROI RSI SEC SET SMA SMA20 SMA50 SMA200 TH THB TWR US USA USD VAT VIX VS WACC XD YTD'.toUpperCase().split(' ')
)

function targetKey({ ticker, market }: AdvisorTarget) {
  return `${market}:${ticker.toUpperCase().replace(/\.BK$/, '')}`
}

export function getQuestionSymbols(question: string, holdings: AdvisorTarget[], previousQuestion = '') {
  const known = new Set(holdings.map(({ ticker }) => ticker.toUpperCase().replace(/\.BK$/, '')))
  const extract = (input: string) => {
    const tokens = input.matchAll(/(?<![\w/])(?:(SET|NASDAQ|NYSE|AMEX):|([$])|(หุ้น|ticker\s*:)\s*)?([a-z][a-z0-9]{0,9}(?:[.-][a-z0-9]{1,4})?)(?![\w/])/gi)
    const symbols: string[] = []
    for (const [, exchange, dollar, tickerLabel, raw] of tokens) {
      const symbol = raw.toUpperCase()
      const bare = symbol.replace(/\.BK$/, '')
      const explicit = Boolean(exchange || dollar || tickerLabel || symbol.endsWith('.BK'))
      if (!explicit && !known.has(bare) && (raw !== symbol || symbol.length < 2 || nonSymbols.has(symbol))) continue
      symbols.push(exchange?.toUpperCase() === 'SET' ? `${bare}.BK` : exchange ? `US:${bare}` : symbol)
    }
    return symbols
  }
  const current = extract(question)
  const followUp = /\b(it|them|that stock|those stocks|compare)\b|ตัวนี้|ตัวนั้น|ตัวเดิม|สองตัว|เทียบกับ|แล้วล่ะ|แล้วถ้า/i.test(question)
  return [...new Set([...current, ...(followUp ? extract(previousQuestion) : [])])].slice(0, 5)
}

export function prioritizeAdvisorTargets(requested: AdvisorTarget[], holdings: AdvisorTarget[], limit: number) {
  const unique = new Map<string, AdvisorTarget>()
  for (const target of [...requested, ...holdings]) {
    const key = targetKey(target)
    if (!unique.has(key)) unique.set(key, target)
  }
  return [...unique.values()].slice(0, limit)
}

const maxObservationAge = 4 * 24 * 60 * 60 * 1000

export function getObservationTime(timestamp: number | undefined, now: number) {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp > now + 5 * 60_000) return null
  if (now - timestamp > maxObservationAge) return null
  return new Date(timestamp).toISOString()
}

export function formatMarketObservation(
  label: string,
  quote: { price: number; timestamp: number; provider: string } | null,
  now: number,
  unit = '',
) {
  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return `- ${label}: ไม่มีข้อมูลที่ยืนยันได้`
  const observedAt = getObservationTime(quote.timestamp, now)
  if (!observedAt) return `- ${label}: ไม่มีข้อมูลที่ใหม่พอหรือยืนยันเวลาได้`
  return `- ${label}: ${quote.price}${unit} (แหล่งข้อมูล: ${quote.provider} | เวลาสังเกต: ${observedAt})`
}
