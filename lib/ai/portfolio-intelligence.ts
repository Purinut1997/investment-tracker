/**
 * lib/ai/portfolio-intelligence.ts
 * Unified 360° Portfolio Context Assembler combining:
 * - Fundamentals & Valuation Guardrails (Yahoo QuoteSummary)
 * - Upcoming Earnings & Dividend / XD Catalysts
 * - User Investment Memory & Active InvestmentPreset Goals
 * - In-Memory FIFO Tax Lot & Realized Gain Summary
 */

import { prisma } from '@/lib/prisma'
import { HoldingItem } from '@/lib/analytics/holdings'
import {
  StockSplitEvent,
  getSplitMultiplier,
  getUserAssetSplitsMap,
  mergeTxnsAndSplits,
} from '@/lib/analytics/stock-splits'
import { getYahooQuoteSummary, YahooQuoteSummaryData } from '@/lib/market-data/yahoo-crumb'
import { getEarningsIntelligence, formatYahooTicker } from '@/lib/earnings/earnings-analyzer'
import { getDividendIntelligence } from '@/lib/dividends/dividend-analyzer'
import {
  UserInvestmentMemory,
  parseUserInvestmentMemory,
  formatInvestmentMemoryForPrompt,
} from './outcome-evaluator'

export * from './outcome-evaluator'

export interface HoldingFundamentalFlag {
  ticker: string
  data: YahooQuoteSummaryData
  flags: Array<'VALUE_TRAP_RISK' | 'STRETCHED_VALUATION' | 'HIGH_QUALITY'>
}

export interface PortfolioDeepIntelligence {
  memory: UserInvestmentMemory
  activePreset: {
    presetName: string
    targetAmount: number | null
    monthlyContribution: number | null
    riskProfile: string | null
    targetAllocation: Record<string, unknown> | null
  } | null
  fundamentalsByTicker: Record<string, HoldingFundamentalFlag>
  fundamentalsPrompt: string
  catalystsPrompt: string
  goalsAndMemoryPrompt: string
  taxContextPrompt: string
}

function summarizeFifoTaxContext(
  holdings: HoldingItem[],
  txns: any[] | undefined,
  baseCurrency: string,
  splitsByAsset?: Map<string, StockSplitEvent[]>
): string {
  if (!txns || txns.length === 0) {
    return 'ยังไม่มีประวัติธุรกรรมเพียงพอสำหรับสรุปต้นทุน FIFO รายล็อต'
  }

  const currentYear = new Date().getUTCFullYear()
  const sorted = [...txns].sort(
    (a, b) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime()
  )
  const allSplits: StockSplitEvent[] = splitsByAsset ? Array.from(splitsByAsset.values()).flat() : []
  const timeline = mergeTxnsAndSplits(sorted, allSplits)

  const lotsByAsset = new Map<string, Array<{ qty: number; unitCost: number; date: Date }>>()
  let ytdForeignRealizedNative = 0
  let ytdThaiSetRealizedThb = 0

  for (const ev of timeline) {
    if (ev.kind === 'SPLIT') {
      const lots = lotsByAsset.get(ev.split.assetId)
      const mult = getSplitMultiplier(ev.split)
      if (lots && mult !== 1) {
        for (const lot of lots) {
          lot.qty *= mult
          lot.unitCost /= mult
        }
      }
      continue
    }

    const t = ev.txn
    const assetId = t.assetId
    if (!assetId) continue
    if (!lotsByAsset.has(assetId)) lotsByAsset.set(assetId, [])
    const lots = lotsByAsset.get(assetId)!
    const qty = Number(t.quantity || 0)
    const price = Number(t.pricePerUnit || 0)
    const fee = Number(t.fee || 0)
    const d = new Date(t.txnDate)

    if (t.txnType === 'BUY' && qty > 0) {
      lots.push({ qty, unitCost: (qty * price + fee) / qty, date: d })
    } else if (t.txnType === 'SELL' && qty > 0) {
      let rem = qty
      let costBasis = 0
      while (rem > 0.0000001 && lots.length > 0) {
        const lot = lots[0]
        if (lot.qty <= rem) {
          costBasis += lot.qty * lot.unitCost
          rem -= lot.qty
          lots.shift()
        } else {
          costBasis += rem * lot.unitCost
          lot.qty -= rem
          rem = 0
        }
      }
      if (d.getUTCFullYear() === currentYear) {
        const proceeds = Number(t.totalAmount || qty * price - fee)
        const gain = proceeds - costBasis
        if ((t.asset?.market === 'TH' && t.asset?.assetType !== 'crypto') || t.asset?.assetType === 'gold') {
          ytdThaiSetRealizedThb += gain
        } else {
          ytdForeignRealizedNative += gain
        }
      }
    }
  }

  const nowMs = Date.now()
  const perHoldingTaxLines = holdings.slice(0, 8).map((h) => {
    const lots = lotsByAsset.get(h.assetId) || []
    const oldestDate = lots[0]?.date
    const heldDays = oldestDate ? Math.max(0, Math.round((nowMs - oldestDate.getTime()) / 86400000)) : null
    const isThaiExempt = h.market === 'TH' && h.assetType !== 'crypto'
    const taxRuleNote =
      h.assetType === 'gold'
        ? 'ทองคำแท่งในไทย/Dime! (สังหาริมทรัพย์ มาตรา 42(9) — ไม่รวมในรายได้หุ้นต่างประเทศ ป.161/2566)'
        : isThaiExempt
        ? 'หุ้นไทย SET (กำไรส่วนต่างยกเว้นภาษีบุคคลธรรมดา)'
        : 'สินทรัพย์ต่างประเทศ/คริปโต (ภ.ง.ด. 90 เมื่อนำเงินกลับไทย ตามหลัก ป.161/2566)'
    return `  • ${h.ticker}: P&L ${h.unrealizedPnLPercent >= 0 ? '+' : ''}${h.unrealizedPnLPercent.toFixed(1)}% (${Math.round(h.unrealizedPnLBase).toLocaleString()} ${baseCurrency})${
      heldDays !== null ? ` | ถือล็อตเก่าสุด ${heldDays} วัน` : ''
    } — ${taxRuleNote}`
  })

  return [
    `- กำไร/ขาดทุนขายแล้วสะสมปี ${currentYear}: ต่างประเทศ/คริปโต ~ $${ytdForeignRealizedNative.toFixed(2)} | หุ้นไทย SET ~ ฿${Math.round(ytdThaiSetRealizedThb).toLocaleString()} (ยกเว้นภาษีขาย)`,
    ...perHoldingTaxLines,
  ].join('\n')
}

export async function gatherPortfolioDeepIntelligence(params: {
  userId: string
  baseCurrency: string
  holdings: HoldingItem[]
  txns?: any[]
}): Promise<PortfolioDeepIntelligence> {
  const { userId, baseCurrency, holdings, txns } = params

  const equityHoldings = holdings.filter(
    (h) =>
      h.assetType !== 'crypto' &&
      h.assetType !== 'gold' &&
      h.market !== 'CRYPTO'
  )
  const fundamentalTargets = equityHoldings.slice(0, 6)
  const catalystTargets = equityHoldings.slice(0, 5)

  const distinctAssetIds = Array.from(
    new Set([
      ...holdings.map((h) => h.assetId),
      ...((txns || []).map((t: any) => t.assetId).filter(Boolean) as string[]),
    ])
  )

  const [userSettingsRes, presetRes, fundamentalsRes, earningsRes, dividendsRes, splitsByAsset] =
    await Promise.all([
      prisma.userSettings
        .findUnique({
          where: { userId },
          select: { defaultRiskProfile: true },
        })
        .catch(() => null),
      prisma.investmentPreset
        .findFirst({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            presetName: true,
            targetAmount: true,
            monthlyContribution: true,
            riskProfile: true,
            targetAllocation: true,
          },
        })
        .catch(() => null),
      Promise.allSettled(
        fundamentalTargets.map(async (h) => {
          const mkt = h.market === 'TH' || h.ticker.toUpperCase().endsWith('.BK') ? 'TH' : 'US'
          const yahooSym = formatYahooTicker(h.ticker, mkt)
          const data = await getYahooQuoteSummary(yahooSym)
          return { ticker: h.ticker.toUpperCase(), data }
        })
      ),
      Promise.allSettled(
        catalystTargets.map(async (h) => {
          const mkt = h.market === 'TH' || h.ticker.toUpperCase().endsWith('.BK') ? 'TH' : 'US'
          const data = await getEarningsIntelligence(h.ticker, mkt)
          return { ticker: h.ticker.toUpperCase(), data }
        })
      ),
      Promise.allSettled(
        catalystTargets.map(async (h) => {
          const mkt = h.market === 'TH' || h.ticker.toUpperCase().endsWith('.BK') ? 'TH' : 'US'
          const data = await getDividendIntelligence(h.ticker, mkt)
          return { ticker: h.ticker.toUpperCase(), data }
        })
      ),
      getUserAssetSplitsMap(userId, distinctAssetIds),
    ])

  const memory = parseUserInvestmentMemory(userSettingsRes?.defaultRiskProfile)
  const activePreset = presetRes
    ? {
        presetName: presetRes.presetName,
        targetAmount: presetRes.targetAmount ? Number(presetRes.targetAmount) : null,
        monthlyContribution: presetRes.monthlyContribution
          ? Number(presetRes.monthlyContribution)
          : null,
        riskProfile: presetRes.riskProfile,
        targetAllocation:
          presetRes.targetAllocation && typeof presetRes.targetAllocation === 'object'
            ? (presetRes.targetAllocation as Record<string, unknown>)
            : null,
      }
    : null

  // 1. Fundamentals & Valuation Guardrails
  const fundamentalsByTicker: Record<string, HoldingFundamentalFlag> = {}
  const fundamentalLines: string[] = []

  for (const res of fundamentalsRes) {
    if (res.status !== 'fulfilled' || !res.value.data) continue
    const { ticker, data } = res.value
    const flags: HoldingFundamentalFlag['flags'] = []
    if (
      (data.freeCashflow !== null && data.freeCashflow < 0) ||
      (data.debtToEquity !== null && data.debtToEquity > 2.5)
    ) {
      flags.push('VALUE_TRAP_RISK')
    }
    const effectivePe = data.forwardPe ?? data.pe
    if (effectivePe !== null && effectivePe > 45) {
      flags.push('STRETCHED_VALUATION')
    }
    if (
      data.roe !== null &&
      data.roe >= 15 &&
      (data.debtToEquity === null || data.debtToEquity <= 1.5)
    ) {
      flags.push('HIGH_QUALITY')
    }

    fundamentalsByTicker[ticker] = { ticker, data, flags }

    const metrics: string[] = []
    if (data.pe !== null) metrics.push(`P/E ${data.pe.toFixed(1)}`)
    if (data.forwardPe !== null) metrics.push(`Fwd P/E ${data.forwardPe.toFixed(1)}`)
    if (data.pb !== null) metrics.push(`P/B ${data.pb.toFixed(2)}`)
    if (data.roe !== null) metrics.push(`ROE ${data.roe.toFixed(1)}%`)
    if (data.debtToEquity !== null) metrics.push(`D/E ${data.debtToEquity.toFixed(2)}x`)
    if (data.revenueGrowth !== null) {
      metrics.push(`RevGrowth ${data.revenueGrowth >= 0 ? '+' : ''}${data.revenueGrowth.toFixed(1)}%`)
    }
    if (data.dividendYield !== null) metrics.push(`DivYield ${data.dividendYield.toFixed(2)}%`)
    if (data.freeCashflow !== null) {
      metrics.push(data.freeCashflow >= 0 ? 'FCF เป็นบวก' : '⚠️ FCF ติดลบ')
    }

    const flagNote = flags.length > 0 ? ` [${flags.join(', ')}]` : ''
    if (metrics.length > 0) {
      fundamentalLines.push(`  • ${ticker}: ${metrics.join(' | ')}${flagNote}`)
    }
  }

  const fundamentalsPrompt =
    fundamentalLines.length > 0
      ? fundamentalLines.join('\n')
      : 'ยังไม่มีข้อมูล Valuation พื้นฐานจาก Yahoo Finance ในรอบนี้ (เช่น พอร์ตเป็น ETF/คริปโตเป็นหลัก)'

  // 2. Upcoming Catalysts (Earnings & Dividends XD)
  const catalystLines: string[] = []
  for (const res of earningsRes) {
    if (res.status !== 'fulfilled' || !res.value.data) continue
    const { ticker, data } = res.value
    const up = data.upcoming
    if (up?.hasUpcomingDate && up.daysRemaining >= 0 && up.daysRemaining <= 60) {
      const epsNote = up.consensusEps !== null ? ` | ตลาดคาด EPS ${up.consensusEps}` : ''
      const beatNote =
        data.stats?.beatRatePercent !== undefined
          ? ` | สถิติชนะคาด ${data.stats.beatRatePercent}%`
          : ''
      const urgentPrefix = up.daysRemaining <= 5 ? '🚨 ใกล้งบออกมาก! ' : ''
      catalystLines.push(
        `  • [Earnings] ${ticker}: ${urgentPrefix}ประกาศงบ ${up.earningsDateThai || up.earningsDate} (${up.countdownLabel}, ${up.releaseTimingLabel})${epsNote}${beatNote}`
      )
    }
  }

  for (const res of dividendsRes) {
    if (res.status !== 'fulfilled' || !res.value.data) continue
    const { ticker, data } = res.value
    const upDiv = data.upcomingDividend
    if (upDiv && upDiv.daysRemaining >= 0 && upDiv.daysRemaining <= 45) {
      const xdStats = data.xdDropAnalysis
        ? ` | เฉลี่ยวัน XD ราคาปรับ ${data.xdDropAnalysis.avgDropPercent}% และฟื้นตัวใน ${data.xdDropAnalysis.avgRecoveryDays} วันทำการ`
        : ''
      catalystLines.push(
        `  • [Dividend/XD] ${ticker}: ขึ้น XD ${upDiv.fullThaiDate} (${upDiv.countdownLabel}) | คาดปันผล ${data.currency}${upDiv.estimatedAmount}${xdStats}`
      )
    }
  }

  const catalystsPrompt =
    catalystLines.length > 0
      ? catalystLines.join('\n')
      : 'ไม่มีกำหนดประกาศงบ (Earnings) หรือขึ้น XD ภายใน 45-60 วันข้างหน้า'

  // 3. Goals & User Memory
  const cleanTargetAlloc = activePreset?.targetAllocation
    ? Object.fromEntries(
        Object.entries(activePreset.targetAllocation).filter(
          ([k, v]) => !k.startsWith('_') && typeof v === 'number'
        )
      )
    : null

  const presetLines = activePreset
    ? [
        `- แผนการลงทุนที่ใช้งานอยู่ (Active Preset): "${activePreset.presetName}"`,
        activePreset.targetAmount
          ? `- เป้าหมายความมั่งคั่ง: ${activePreset.targetAmount.toLocaleString()} ${baseCurrency}`
          : null,
        activePreset.monthlyContribution
          ? `- งบ DCA รายเดือนตามแผน: ${activePreset.monthlyContribution.toLocaleString()} ${baseCurrency}/เดือน`
          : null,
        cleanTargetAlloc && Object.keys(cleanTargetAlloc).length > 0
          ? `- สัดส่วนเป้าหมาย: ${JSON.stringify(cleanTargetAlloc)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '- ยังไม่ได้ตั้งค่าแผนเป้าหมาย (Investment Preset)'

  const goalsAndMemoryPrompt = `${presetLines}\n${formatInvestmentMemoryForPrompt(memory)}`

  // 4. Tax & Holding Context
  const taxContextPrompt = summarizeFifoTaxContext(holdings, txns, baseCurrency, splitsByAsset)

  return {
    memory,
    activePreset,
    fundamentalsByTicker,
    fundamentalsPrompt,
    catalystsPrompt,
    goalsAndMemoryPrompt,
    taxContextPrompt,
  }
}
