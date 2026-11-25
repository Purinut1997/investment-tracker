import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { parseModelJson } from '@/lib/ai/model-contracts'
import { formatMarketObservation } from '@/lib/ai/advisor-evidence'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { getYahooQuoteSummary } from '@/lib/market-data/yahoo-crumb'
import { resolveMarketQuote } from '@/lib/market-data/resolver'

export const maxDuration = 45

const text = z.string().trim().min(1).max(2500)
const stockInsightSchema = z.object({
  summary: text.refine((value) => /[ก-๙]/.test(value)),
  businessOverview: text,
  financialPerformance: z.object({ revenue: text, eps: text, growth: text, fcf: text }),
  valuationAndDividend: z.object({ pe: text, pb: text, evEbitda: text, dividendYield: text, payoutRatio: text }),
  strengths: z.array(text).max(8),
  risks: z.array(text).max(8),
  scenarioAnalysis: z.object({ bull: text, base: text, bear: text }),
  latestNewsCatalyst: text,
})
const stockInput = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9^][A-Z0-9.^=/-]{0,24}$/),
  market: z.enum(['TH', 'US', 'CRYPTO', 'GLOBAL']),
  forceRefresh: z.boolean().optional(),
})

function contextTag(symbol: string, market: string) {
  return `[stock-insight:v2:${market}:${symbol}]`
}

async function loadInsight(userId: string, symbol: string, market: string, since?: Date) {
  const log = await prisma.aiAdviceLog.findFirst({
    where: {
      userId,
      logType: 'advisor',
      prompt: { contains: contextTag(symbol, market) },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { response: true, modelUsed: true, createdAt: true },
  })
  if (!log) return null
  try {
    const structuredInsight = stockInsightSchema.parse(parseModelJson(log.response))
    return { insight: log.response, structuredInsight, modelUsed: log.modelUsed, updatedAt: log.createdAt.toISOString(), cached: true }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const input = stockInput.safeParse({
    symbol: req.nextUrl.searchParams.get('symbol'),
    market: req.nextUrl.searchParams.get('market') || 'US',
  })
  if (!input.success) return NextResponse.json({ error: 'Invalid stock symbol or market' }, { status: 400 })
  const { symbol, market } = input.data
  const report = await loadInsight(session.user.id, symbol, market)
  return NextResponse.json(report ?? { insight: null, structuredInsight: null, modelUsed: null, updatedAt: null })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const input = stockInput.safeParse(await req.json())
    if (!input.success) return NextResponse.json({ error: 'Invalid stock symbol or market' }, { status: 400 })
    const { symbol, market, forceRefresh } = input.data
    const now = Date.now()
    if (!forceRefresh) {
      const cached = await loadInsight(session.user.id, symbol, market, new Date(now - 12 * 60 * 60_000))
      if (cached) return NextResponse.json(cached)
    }
    const ticker = market === 'TH' ? symbol.replace(/\.BK$/, '') + '.BK' : symbol
    const newsSymbols = [...new Set([symbol, ticker])]
    const [quote, fundamentals, news] = await Promise.all([
      (market === 'CRYPTO'
        ? resolveMarketQuote(symbol, 'crypto').then((item) => item.itemType === 'crypto' ? item.quote : null)
        : yahooFinanceProvider.getQuote(ticker, market)).catch(() => null),
      (market === 'TH' || market === 'US' ? getYahooQuoteSummary(ticker) : Promise.resolve(null)).catch(() => null),
      prisma.newsItem.findMany({
        where: { symbol: { in: newsSymbols }, publishedAt: { gte: new Date(now - 7 * 86400000) } },
        orderBy: { publishedAt: 'desc' }, take: 8,
        select: { headline: true, sourceName: true, sourceUrl: true, publishedAt: true },
      }).catch(() => []),
    ])
    if (!quote && !fundamentals && !news.length) {
      return NextResponse.json({ error: 'ยังไม่พบข้อมูลที่ยืนยันสัญลักษณ์ในตลาดนี้ กรุณาตรวจชื่อย่อและตลาด' }, { status: 422 })
    }
    const quotation = formatMarketObservation(symbol, quote
      ? { ...quote, timestamp: quote.observationTimestamp ?? 0 } : null, now, ` ${quote?.currency || ''}`)
    const prompt = `
${contextTag(symbol, market)}
วิเคราะห์ ${symbol} (${market}) เป็นภาษาไทย ณ เวลาที่เก็บบริบท ${new Date(now).toISOString()}
ราคา: ${quotation}
พื้นฐานจาก Yahoo Finance (ห้ามเดางวดบัญชีหรือค่าเฉลี่ยกลุ่ม): ${fundamentals ? JSON.stringify(fundamentals) : 'ไม่มีข้อมูล'}
ข่าวของสัญลักษณ์ที่บันทึกใน 7 วันล่าสุด (ให้ตรวจความเกี่ยวข้องกับตลาดก่อนใช้):
${news.map((item) => `- ${item.publishedAt.toISOString()} | ${item.sourceName}: ${item.headline} | ${item.sourceUrl}`).join('\n') || 'ไม่มีข้อมูลข่าวในช่วงนี้'}
แยกข้อมูลจริงจากกรณีสมมติ ห้ามตั้งราคาเป้าหมายหรือกล่าวอ้างข่าวล่าสุดเมื่อไม่มีหลักฐาน
ตอบเป็น JSON เท่านั้น โครงสร้าง:
{"summary":"ข้อความ","businessOverview":"ข้อความ","financialPerformance":{"revenue":"ข้อความ","eps":"ข้อความ","growth":"ข้อความ","fcf":"ข้อความ"},"valuationAndDividend":{"pe":"ข้อความ","pb":"ข้อความ","evEbitda":"ข้อความ","dividendYield":"ข้อความ","payoutRatio":"ข้อความ"},"strengths":["ข้อความ"],"risks":["ข้อความ"],"scenarioAnalysis":{"bull":"ข้อความ","base":"ข้อความ","bear":"ข้อความ"},"latestNewsCatalyst":"ข้อความ"}
`
    const result = await callGemini({
      userId: session.user.id, prompt, logType: 'stock_insight',
      validateJson: (value) => stockInsightSchema.safeParse(value).success,
    })
    return NextResponse.json({
      insight: result.text, structuredInsight: stockInsightSchema.parse(parseModelJson(result.text)),
      modelUsed: result.modelUsed, updatedAt: new Date().toISOString(), cached: false,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่สามารถวิเคราะห์หุ้นได้' }, { status: 500 })
  }
}
