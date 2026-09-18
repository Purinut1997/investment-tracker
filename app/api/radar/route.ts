import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import {
  analyzePortfolioRisks,
  scanPortfolioOpportunities,
  RiskSentinelReport,
  OpportunityRadarReport,
} from '@/lib/analytics/risk-sentinel'
import { callGemini } from '@/lib/ai/gemini-client'

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

  // Simple conversion or sum for cash balance (assuming base currency or 1:1 if THB)
  let totalCash = 0
  for (const acc of accounts) {
    const bal = Number(acc.cashBalance) || 0
    totalCash += bal
  }

  // 3. Fetch default preset target allocation
  const defaultPreset = await prisma.investmentPreset.findFirst({
    where: { userId, isDefault: true },
  })
  const targetAllocation = (defaultPreset?.targetAllocation as Record<string, number>) ?? undefined

  // 4. Fetch watchlist
  const watchlists = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { symbol: true, displayName: true, itemType: true },
  })

  // 5. Run analysis engines
  const riskReport: RiskSentinelReport = analyzePortfolioRisks(
    holdingsResult.holdings,
    totalCash,
    baseCurrency
  )

  const opportunityReport: OpportunityRadarReport = scanPortfolioOpportunities(
    holdingsResult.holdings,
    watchlists,
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

    // Fetch latest AI briefing
    const latestAiLog = await prisma.aiAdviceLog.findFirst({
      where: { userId, logType: 'advisor' },
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

    // Prepare prompt for Gemini AI
    const prompt = `
คุณเป็น "Chief Risk Officer & Head of Capital Allocation" ของระบบ Investment Pro
จงประเมินและสรุปบทวิเคราะห์ "AI Risk Sentinel & Opportunity Radar" เป็นภาษาไทยระดับผู้บริหารการลงทุน สำหรับพอร์ตนี้:

[ภาพรวมพอร์ต]
- มูลค่าสินทรัพย์ลงทุน: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency}
- สภาพคล่องเงินสดสำรอง (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (${riskReport.liquidity.cashRatioPercent.toFixed(1)}% ของพอร์ต)
- ระดับความเสี่ยงพอร์ตโดยรวม: ${riskReport.overallRiskLevel} (คะแนนความเสี่ยง ${riskReport.overallRiskScore}/100)

[ข้อกังวลและจุดเสี่ยงที่ตรวจพบ (Risk Sentinel)]
${riskReport.keyWarnings.length > 0 ? riskReport.keyWarnings.map((w) => `- ${w}`).join('\n') : '- ไม่พบจุดเสี่ยงระดับรุนแรงในขณะนี้'}
${riskReport.concentrationRisks.map((c) => `- สินทรัพย์ ${c.ticker} มีสัดส่วน ${c.allocationPercent.toFixed(1)}% (หากร่วง -20% จะกระทบพอร์ต -฿${c.stressTests[1]?.lossAmountBase.toLocaleString()})`).join('\n')}

[โอกาสการลงทุนที่เรดาร์สแกนพบ (Opportunity Radar)]
${opportunityReport.opportunities.slice(0, 3).map((o) => `- ${o.title}: ${o.metricLabel} ${o.metricValue} -> ${o.suggestedAction}`).join('\n')}

[คำสั่งในการตอบ]
จัดหมวดหมู่ให้สวยงาม อ่านเข้าใจทันที ใช้หัวข้อย่อยและ Bullet points:
1. 🛡️ **บทสรุปและจุดยืนความเสี่ยง (Executive Risk Summary)**: 2-3 บรรทัด สรุปสถานะพอร์ตและระดับการป้องกันเงินต้น
2. 🎯 **3 ยุทธศาสตร์สำคัญที่ควรลงมือทำทันที (Top 3 Actionable Decisions)**: เจาะจงชัดเจนว่าควรซื้อ/ขาย/เติมเงินส่วนไหน เพราะอะไร
3. 💡 **คำแนะนำการบริหารเงินสด (Dry Powder Deployment Strategy)**: ควรเก็บเงินสดไว้เท่าไหร่ หรือทยอยเข้าช้อนซื้อในจังหวะใด
`

    const systemInstruction =
      'คุณเป็น AI ผู้เชี่ยวชาญการบริหารความเสี่ยงและจัดสรรสินทรัพย์การลงทุนระดับโลก ให้คำแนะนำที่เฉียบคม ตรงไปตรงมา อิงหลักการปกป้องเงินต้นและการเติบโตอย่างยั่งยืน'

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
