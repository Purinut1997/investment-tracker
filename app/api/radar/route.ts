import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings, invalidateUserPortfolioCache } from '@/lib/analytics/holdings'
import {
  analyzePortfolioRisks,
  scanPortfolioOpportunities,
  RiskSentinelReport,
  OpportunityRadarReport,
} from '@/lib/analytics/risk-sentinel'
import { callGemini } from '@/lib/ai/gemini-client'
import { sumAccountCashInBaseCurrency } from '@/lib/market-data/frankfurter'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'

export const maxDuration = 45

async function getPortfolioRadarData(userId: string) {
  const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
  const baseCurrency = userSettings?.baseCurrency ?? 'THB'

  // 1. Calculate holdings
  const holdingsResult = await calculateUserHoldings(userId, baseCurrency)

  // 2. Fetch cash balances across accounts
  const accounts = await prisma.investmentAccount.findMany({
    where: { userId },
    select: { cashBalance: true, currency: true },
  })

  const totalCash = await sumAccountCashInBaseCurrency(accounts, baseCurrency)

  // 3. Fetch default preset target allocation
  const defaultPreset = await prisma.investmentPreset.findFirst({
    where: { userId, isDefault: true },
  })
  const targetAllocation = (defaultPreset?.targetAllocation as Record<string, number>) ?? undefined

  // 4. Fetch watchlist and enrich first 6 unheld items with live price & pullback signals
  const watchlists = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { symbol: true, displayName: true, itemType: true },
  })

  const heldSet = new Set(holdingsResult.holdings.map((h) => h.ticker.toUpperCase()))
  const unheldWatchlist = watchlists.filter((w) => !heldSet.has(w.symbol.toUpperCase())).slice(0, 6)
  const enrichedMap = new Map<
    string,
    { currentPrice: number; currency: string; changePercent: number; pullbackFromHigh: number; rsi14: number | null; market: string }
  >()

  await Promise.all(
    unheldWatchlist.map(async (w) => {
      const mkt =
        w.itemType === 'crypto' ? 'CRYPTO' : w.symbol.toUpperCase().endsWith('.BK') ? 'TH' : 'US'
      try {
        const sig = await fetchSingleTickerTechnicalSignal(w.symbol, mkt)
        if (sig && sig.currentPrice > 0) {
          enrichedMap.set(w.symbol.toUpperCase(), {
            currentPrice: sig.currentPrice,
            currency: sig.currencySymbol === '฿' ? 'THB' : 'USD',
            changePercent: sig.changePercent,
            pullbackFromHigh: sig.pullbackFromHigh,
            rsi14: sig.rsi14,
            market: mkt,
          })
        }
      } catch {
        // ignore quote failure for individual watchlist ticker
      }
    })
  )

  const enrichedWatchlists = watchlists.map((w) => {
    const extra = enrichedMap.get(w.symbol.toUpperCase())
    return extra ? { ...w, ...extra } : w
  })

  // 5. Run analysis engines
  const riskReport: RiskSentinelReport = analyzePortfolioRisks(
    holdingsResult.holdings,
    totalCash,
    baseCurrency
  )

  const opportunityReport: OpportunityRadarReport = scanPortfolioOpportunities(
    holdingsResult.holdings,
    enrichedWatchlists,
    totalCash,
    targetAllocation,
    baseCurrency
  )

  return {
    baseCurrency,
    holdingsResult,
    totalCash,
    riskReport,
    opportunityReport,
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const { baseCurrency, holdingsResult, totalCash, riskReport, opportunityReport } =
      await getPortfolioRadarData(userId)

    // Fetch latest AI briefing (specifically for Risk Sentinel)
    const latestAiLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: 'AI Risk Sentinel' },
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    return NextResponse.json({
      baseCurrency,
      totalPortfolioValue: holdingsResult.totalValueBase + totalCash,
      investedValue: holdingsResult.totalValueBase,
      totalCash,
      riskReport,
      opportunityReport,
      aiBriefing: latestAiLog
        ? {
            text: latestAiLog.response,
            modelUsed: latestAiLog.modelUsed,
            updatedAt: latestAiLog.createdAt,
          }
        : null,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[GET /api/radar error]', error)
    return NextResponse.json({ error: error.message || 'Failed to load radar data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const { baseCurrency, holdingsResult, totalCash, riskReport, opportunityReport } =
      await getPortfolioRadarData(userId)

    if (holdingsResult.holdings.length === 0) {
      return NextResponse.json({
        advice: 'ยังไม่มีสินทรัพย์ในพอร์ต กรุณาบันทึกรายการซื้อเพื่อเริ่มการสแกนด้วย AI',
        riskReport,
        opportunityReport,
      })
    }

    // Prepare institutional-grade prompt for Gemini AI
    const prompt = `
[AI Risk Sentinel]
คุณเป็น "Chief Risk Officer (CRO) & Global Chief Investment Officer (CIO)" สถาบันบริหารความมั่งคั่งระดับโลก (Institutional Wealth Management)
จงประเมินและสรุปยุทธศาสตร์ "AI Strategic Executive Briefing & Capital Allocation Blueprint" เป็นภาษาไทยระดับมืออาชีพ สำหรับพอร์ตนี้:

[ภาพรวมพอร์ตโฟลิโอ]
- มูลค่าสินทรัพย์ลงทุน: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency}
- สภาพคล่องเงินสดสำรอง (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (${riskReport.liquidity.cashRatioPercent.toFixed(1)}% ของพอร์ต)
- ระดับความเสี่ยงพอร์ตโดยรวม: ${riskReport.overallRiskLevel} (คะแนนความเสี่ยง ${riskReport.overallRiskScore}/100)

[สัดส่วนกลุ่มอุตสาหกรรม (Sector Allocation Breakdown)]
${riskReport.sectorBreakdown.map((s) => `- ${s.sector}: ${s.percent.toFixed(1)}% (${s.isOverweight ? '⚠️ Overweight สูงเกินเกณฑ์ปลอดภัย' : 'สมดุล'})`).join('\n')}

[ข้อกังวลและจุดเสี่ยงที่ตรวจพบ (Risk Sentinel)]
${riskReport.keyWarnings.length > 0 ? riskReport.keyWarnings.map((w) => `- ${w}`).join('\n') : '- ไม่พบจุดเสี่ยงระดับรุนแรงในขณะนี้'}
${riskReport.concentrationRisks.map((c) => {
  const scenario = c.stressTests.find(({ dropPercent }) => dropPercent === -20)
  return `- ${c.ticker} (${c.assetName}): สัดส่วน ${c.allocationPercent.toFixed(1)}%${
    scenario ? ` | สมมติราคาลด 20% ผลกระทบ ${scenario.lossAmountBase.toLocaleString()} ${baseCurrency}` : ''
  }`
}).join('\n')}

[โอกาสการลงทุนและการหมุนเงินทุน (Opportunity & Sector Rotation Radar)]
${opportunityReport.opportunities.slice(0, 4).map((o) => `- [${o.opportunityType}] ${o.title}: ${o.metricLabel} ${o.metricValue} -> ${o.suggestedAction}`).join('\n')}

[กฎเหล็กระดับสถาบันการเงิน (Institutional Rules - ห้ามละเมิดเด็ดขาด)]:
1. กฎห้ามสร้างความเสี่ยงกระจุกตัวซ้ำซ้อน: หากแนะนำให้ขายทำกำไรหรือลดความเสี่ยง (De-risk) จากหุ้น Growth/Tech ตัวใดตัวหนึ่ง (เช่น GOOGL) ห้ามแนะนำให้เอาเงินที่ได้ไปทุ่มซื้อหุ้น Growth/Tech/Semiconductor ตัวอื่น (เช่น ห้ามโยกไปซื้อ MU) เพราะไม่ได้ช่วยลดความเสี่ยงเชิงโครงสร้าง (Sector Risk) เลย!
2. กฎการหมุนเงินทุนข้ามกลุ่ม (Cross-Sector Rotation): ต้องแนะนำให้นำเงินที่ได้จากการ De-risk ไปจัดสรรสู่สินทรัพย์ที่มี Correlation ต่ำ หรือกลุ่มป้องกันความเสี่ยง (Defensive) เช่น:
   - กองทุนปันผลกระแสเงินสดมั่นคง (เช่น SCHD, VYM)
   - กลุ่มการแพทย์และสินค้าจำเป็น (เช่น Healthcare XLV/JNJ, Consumer Staples XLP/PG)
   - สินทรัพย์หลบภัย (เช่น ทองคำ GOLD, พันธบัตร TLT) หรือกองทุนดัชนีหลัก (VOO)
3. ใช้เฉพาะสัดส่วนที่ระบบคำนวณหรือผู้ใช้กำหนด ถ้าไม่มีเป้าหมายให้เสนอสิ่งที่จะประเมินก่อนเลือกวงเงินหรือสัดส่วนใหม่

[โครงสร้างบทวิเคราะห์ที่ต้องตอบ (ใช้ Markdown สวยงาม อ่านง่าย)]:
1. 🛡️ **การประเมินโครงสร้างและจุดอ่อนของพอร์ต (Structural & Sector Audit)**: 
   - สรุปสถานะพอร์ตและสัดส่วนกลุ่มอุตสาหกรรม ห้ามอ้าง Beta หรือ Correlation ที่ระบบไม่ได้คำนวณ
2. 🎯 **แผนจัดสรรเงินทุนและการหมุนกลุ่มอุตสาหกรรม (Capital Allocation & Sector Rotation Blueprint)**:
   - **ขั้นตอนที่ 1 — Take Profit & De-risk**: ระบุหุ้นที่ควรลดน้ำหนัก, ขายสัดส่วนกี่ %, ดึงลงมาเหลือเท่าไหร่
   - **ขั้นตอนที่ 2 — Sector Rotation (หมุนเข้ากลุ่มใหม่)**: ระบุสินทรัพย์/กลุ่มปลายทางข้ามอุตสาหกรรม (เช่น SCHD, XLV, ทองคำ) ที่ควรแบ่งเงินไปสะสม เพื่อสร้างสมดุลพอร์ต
   - **ขั้นตอนที่ 3 — Tactical Stock Stance**: กำหนดจุดยืนต่อหุ้นตัวอื่นๆ ในพอร์ต (เช่น สั่งชะลอการซื้อเพิ่มในกลุ่มที่ล้นพอร์ตอยู่แล้ว)
3. 💡 **แผนบริหารกระสุนเงินสด (Dry Powder Roadmap)**: 
   - แยกเงินสดปัจจุบันออกจากเงินสมมติหลังปรับพอร์ต และระบุข้อจำกัดเรื่องเป้าหมายหรือข้อมูลค่าใช้จ่ายที่ยังขาด
`

    const systemInstruction =
      'คุณเป็น Chief Investment Officer (CIO) และ Chief Risk Officer (CRO) สถาบันบริหารสินทรัพย์ชั้นนำระดับโลก ให้คำแนะนำเชิงยุทธศาสตร์ที่เฉียบคม บนหลักการ Cross-Sector Diversification ไม่แนะนำสินทรัพย์วนลูปในกลุ่มความเสี่ยงเดียวกัน'

    const { text, modelUsed } = await callGemini({
      userId,
      prompt,
      logType: 'advisor',
      systemInstruction,
    })

    // If critical risk, record in AllocationAlert
    if (riskReport.overallRiskLevel === 'CRITICAL' || riskReport.overallRiskLevel === 'ELEVATED') {
      try {
        await prisma.allocationAlert.create({
          data: {
            userId,
            deviationDetail: {
              overallRiskLevel: riskReport.overallRiskLevel,
              riskScore: riskReport.overallRiskScore,
              topConcentration: riskReport.concentrationRisks[0]?.ticker ?? null,
            },
            aiSummaryText: text.slice(0, 500),
          },
        })
      } catch (err) {
        console.error('[allocationAlert create error]', err)
      }
    }

    return NextResponse.json({
      success: true,
      aiBriefing: {
        text,
        modelUsed,
        updatedAt: new Date().toISOString(),
      },
      riskReport,
      opportunityReport,
      totalPortfolioValue: holdingsResult.totalValueBase + totalCash,
      investedValue: holdingsResult.totalValueBase,
      totalCash,
      baseCurrency,
    })
  } catch (error: any) {
    console.error('[POST /api/radar error]', error)
    return NextResponse.json({ error: error.message || 'Failed to execute radar scan' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const alertId = typeof body?.alertId === 'string' ? body.alertId.trim() : ''
    if (!alertId) {
      return NextResponse.json({ error: 'Missing alertId' }, { status: 400 })
    }

    await prisma.allocationAlert.updateMany({
      where: {
        id: alertId,
        userId: session.user.id,
      },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    })

    invalidateUserPortfolioCache(session.user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[PATCH /api/radar error]', error)
    return NextResponse.json({ error: error.message || 'Failed to acknowledge alert' }, { status: 500 })
  }
}
