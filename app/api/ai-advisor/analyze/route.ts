import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { calculatePortfolioRebalance } from '@/lib/analytics/rebalancing'
import { callGemini } from '@/lib/ai/gemini-client'
import { sumAccountCashInBaseCurrency } from '@/lib/market-data/frankfurter'
import {
  parseUserInvestmentMemory,
  formatInvestmentMemoryForPrompt,
} from '@/lib/ai/portfolio-intelligence'

export const maxDuration = 45

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId,
        logType: 'advisor',
        OR: [
          { prompt: { contains: '[AI Portfolio Health & Strategy Advisor]' } },
          { prompt: { contains: 'AI Wealth Advisor' } },
          { prompt: { contains: 'Chief Risk Officer' } },
          { prompt: { contains: 'Chief Investment Officer' } },
          { prompt: { contains: 'Portfolio Health Score' } },
          { prompt: { contains: 'Investment Advisor AI' } },
        ],
        NOT: [
          { prompt: { contains: 'AI Daily Investment Strategist' } },
          { prompt: { contains: 'Executive Daily Portfolio Intelligence' } },
          { prompt: { contains: '[AI Stock Deep Dive Analysis' } },
          { prompt: { contains: 'AI Risk Sentinel' } },
          { prompt: { contains: '(Risk Sentinel)' } },
          { prompt: { contains: '[AI_COPILOT_THREAD]' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    })

    return NextResponse.json({
      advice: latestLog?.response ?? null,
      modelUsed: latestLog?.modelUsed ?? null,
      updatedAt: latestLog?.createdAt ? latestLog.createdAt.toISOString() : null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch latest advice' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({}))
    const { presetName, targetAllocation, monthlyContribution, subAllocations } = body || {}

    // 1. Gather context
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const memory = parseUserInvestmentMemory(userSettings?.defaultRiskProfile)
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const cleanTargetAlloc =
      targetAllocation && typeof targetAllocation === 'object'
        ? (Object.fromEntries(
            Object.entries(targetAllocation).filter(
              ([k, v]) => !k.startsWith('_') && typeof v === 'number'
            )
          ) as Record<string, number>)
        : undefined
    const healthScore = calculatePortfolioHealthScore(
      holdingsResult.holdings,
      cleanTargetAlloc && Object.keys(cleanTargetAlloc).length > 0 ? cleanTargetAlloc : undefined
    )

    // Fetch cash balances across user accounts converted to baseCurrency
    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, accountName: true, currency: true },
    })
    const totalCash = await sumAccountCashInBaseCurrency(accounts, baseCurrency)

    if (holdingsResult.holdings.length === 0 && totalCash === 0) {
      return NextResponse.json({
        advice: 'ยังไม่มีสินทรัพย์ในพอร์ต กรุณาเพิ่มรายการธุรกรรมซื้อ-ขายก่อนขอคำแนะนำจาก AI',
        disclaimer: 'ข้อมูลนี้ไม่ใช่คำแนะนำทางการเงินที่มีใบอนุญาต เป็นเพียงการวิเคราะห์เชิงสถิติ',
      })
    }

    // 2. Format holdings list for AI
    const holdingsSummary = holdingsResult.holdings.map((h) => ({
      ticker: h.ticker,
      name: h.assetName,
      market: h.market,
      currentValue: `${h.currentValueBase.toLocaleString()} ${baseCurrency}`,
      allocationPercent: `${h.allocationPercent.toFixed(1)}%`,
      pnlPercent: `${h.unrealizedPnLPercent.toFixed(1)}%`,
    }))

    const defaultDca = baseCurrency === 'USD' ? 150 : 5000
    const dcaBudget = Number(monthlyContribution) > 0 ? Number(monthlyContribution) : defaultDca

    // 3. Deterministic rebalancing calculation (finance engine ground-truth)
    let mathRebalanceSummary = ''
    try {
      const effectiveTargets =
        subAllocations && Object.keys(subAllocations).length > 0
          ? subAllocations
          : targetAllocation && Object.keys(targetAllocation).length > 0
          ? targetAllocation
          : null

      if (effectiveTargets) {
        const rebalancePlan = calculatePortfolioRebalance({
          holdings: holdingsResult.holdings,
          totalCashBase: totalCash,
          targetAllocation: effectiveTargets,
          cashInflowBase: dcaBudget,
          mode: 'CASH_FLOW',
          baseCurrency,
        })

        const buys = rebalancePlan.items.filter((i) => i.action === 'BUY' && i.recommendedAmountBase > 0)
        const holds = rebalancePlan.items.filter((i) => i.action === 'HOLD')
        const trims = rebalancePlan.items.filter((i) => i.action === 'TRIM')

        mathRebalanceSummary = `
[ผลการคำนวณ Rebalancing เชิงคณิตศาสตร์ (Deterministic Financial Engine)]:
- ค่าความเบี่ยงเบนจากเป้าหมายรวม (Portfolio Drift Score): ${rebalancePlan.overallDriftScore.toFixed(1)}/100
- สินทรัพย์ที่คำนวณแล้วว่าต้องเติมเงิน DCA (BUY) ประจำเดือนนี้:
${
  buys.length > 0
    ? buys
        .map(
          (b) =>
            `  * ${b.label}: แนะนำเติมเงิน ${b.recommendedAmountBase.toLocaleString()} ${baseCurrency} (สัดส่วนปัจจุบัน ${b.currentWeight.toFixed(1)}% vs เป้าหมาย ${b.targetWeight.toFixed(1)}% | ขาด ${Math.abs(b.driftPercent).toFixed(1)}%)`
        )
        .join('\n')
    : '  * สัดส่วนสมดุลดีแล้ว สามารถแบ่งเฉลี่ยตามเป้าหมายหลักได้'
}
- สินทรัพย์ที่สัดส่วนเกินเป้าหมายหรือทรงตัว (TRIM/HOLD):
${
  trims.length > 0
    ? trims
        .map(
          (t) =>
            `  * ${t.label}: สัดส่วนเกินเป้า ${t.driftPercent > 0 ? '+' : ''}${t.driftPercent.toFixed(1)}% (ปัจจุบัน ${t.currentWeight.toFixed(1)}% vs เป้าหมาย ${t.targetWeight.toFixed(1)}%)`
        )
        .join('\n')
    : holds.length > 0
    ? holds.map((h) => `  * ${h.label}: สัดส่วนใกล้เคียงเป้าหมาย (${h.currentWeight.toFixed(1)}%)`).join('\n')
    : '  * ไม่มีสินทรัพย์ที่เกินเป้าหมายอย่างมีนัยสำคัญ'
}`
      }
    } catch (mathErr) {
      console.warn('[rebalance math calculation warning]', mathErr)
    }

    const prompt = `
[AI Portfolio Health & Strategy Advisor]
คุณเป็น Chief Investment Officer (CIO) และ AI Wealth Advisor ระดับสถาบันการเงิน
วิเคราะห์ข้อมูลพอร์ตการลงทุนของผู้ใช้ และให้คำแนะนำเชิงยุทธศาสตร์ที่มีโครงสร้างชัดเจน เน้นประโยคสำคัญและตัวหนา (Bold) อ่านแล้วเห็นแนวทางปฏิบัติได้ทันที:

[ข้อมูลสถานะพอร์ตปัจจุบัน]
- มูลค่าสินทรัพย์ลงทุน: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency}
- เงินสดคงเหลือรวม: ${totalCash.toLocaleString()} ${baseCurrency}
- มูลค่าพอร์ตสุทธิรวม: ${(holdingsResult.totalValueBase + totalCash).toLocaleString()} ${baseCurrency}
- กำไร/ขาดทุนรวม: ${holdingsResult.unrealizedPnLPercent.toFixed(2)}%
- Portfolio Health Score: ${healthScore.score}/100 (ระดับ ${healthScore.grade})
- แผนการลงทุนที่เลือก: ${presetName || 'แผนมาตรฐาน'}
- งบลงทุนใหม่รายเดือน (DCA Budget): ${dcaBudget.toLocaleString()} ${baseCurrency}
${targetAllocation ? `- สัดส่วนเป้าหมายหลัก: ${JSON.stringify(targetAllocation)}` : ''}
${subAllocations ? `- สัดส่วนเป้าหมายย่อยรายหุ้น: ${JSON.stringify(subAllocations)}` : ''}
- รายการสินทรัพย์ที่ถือครองจริง:
${JSON.stringify(holdingsSummary, null, 2)}
${mathRebalanceSummary}

[ความจำกลยุทธ์และกฎความเสี่ยงของผู้ลงทุน (AI Memory)]:
${formatInvestmentMemoryForPrompt(memory)}

[ข้อกำหนดสำคัญในการเขียนคำตอบ - ต้องปฏิบัติตามอย่างเคร่งครัด]:
1. ห้ามมีคำทักทายเกริ่นนำใดๆ ทั้งสิ้น (ห้ามเขียน "เรียน ท่านนักลงทุน", "สวัสดีครับ", "ในฐานะ Investment Advisor...") ให้เริ่มเข้าสู่หัวข้อที่ 1 ทันที!
2. จัดโครงสร้างเป็น 5 หมวดหมู่อย่างเคร่งครัด โดยใช้ Markdown Header '###' ดังนี้:
   ### 🎯 สรุปยุทธศาสตร์พอร์ตด่วน (Executive Takeaways)
   (สรุปภาพรวมสถานะพอร์ต จุดแข็ง และสิ่งที่ต้องจัดการทันทีใน 2-3 ประโยค เน้นตัวหนา)

   ### 🟢 สินทรัพย์ที่ต้องเร่งเติมเงิน / จุดน่าช้อน (Top Buying & Dip Priorities)
   (ระบุชื่อหุ้นที่สัดส่วนยังขาดจากเป้าหมายตามผลการคำนวณ Rebalancing หรือราคาลงมาทดสอบแนวรับ/จุดย่อตัวที่น่าช้อน พร้อมบอกเหตุผลว่าทำไมถึงได้เปรียบ)

   ### ⏸️ สินทรัพย์ที่ควรงดซื้อชั่วคราว (Pause & Hold)
   (ระบุชื่อหุ้นที่สัดส่วนโตเกินเป้าไปมาก หรือราคาตึงตัว ให้คำแนะนำชะลอการซื้อเพื่อไม่ให้พอร์ตกระจุกตัว)

   ### 💵 แผนจัดสรรเงินลงทุนเดือนหน้า (Monthly DCA Allocation Action Plan)
   (อ้างอิงและแจกแจงตัวเลขตามผลการคำนวณ Rebalancing ข้างต้น ว่างบ DCA จำนวน ${dcaBudget.toLocaleString()} ${baseCurrency} ควรนำไปซื้อหุ้นตัวไหน ตัวละกี่${baseCurrency}อย่างแม่นยำ พร้อมเหตุผลประกอบ)

   ### 🛡️ เรดาร์บริหารความเสี่ยง (Risk Sentinel Alert)
   (เตือนจุดเสี่ยง เช่น หุ้นตัวเดียวครองสัดส่วนสูงเกิน 25-30% หรือมีสินทรัพย์นอกแผนการลงทุน)

3. ให้เน้นชื่อหุ้น สัญลักษณ์ (เช่น **VOO**, **SCHD**, **QQQM**, **GOOGL**) ตัวเลขเปอร์เซ็นต์ และจำนวนเงิน (เช่น **฿3,500** หรือ **$150**) ด้วยเครื่องหมาย **ตัวหนา** เสมอ เพื่อให้ผู้อ่านกวาดตาอ่านได้รวดเร็ว
4. ต้องใช้ "สัญลักษณ์หุ้น (Ticker Symbol)" ตัวย่อภาษาอังกฤษตัวพิมพ์ใหญ่เสมอ ห้ามใช้ชื่อบริษัทภาษาไทยหรือชื่อยาวโดดเดี่ยวเด็ดขาด เพื่อความเป็นมืออาชีพระดับสถาบัน
`

    const systemInstruction =
      'คุณเป็น AI ที่ปรึกษาการลงทุนระดับมืออาชีพ ตอบเป็นภาษาไทยที่กระชับ ทรงพลัง ตรงประเด็น ไม่มีน้ำหรือคำทักทายเยิ่นเย้อ เน้นยุทธศาสตร์ที่ปฏิบัติได้จริง อ้างอิงตัวเลขคณิตศาสตร์ Rebalance ที่กำหนดให้อย่างแม่นยำ'

    const { text, modelUsed, groundingSources } = await callGemini({
      userId,
      prompt,
      logType: 'advisor',
      systemInstruction,
      enableGoogleSearch: true,
    })

    const disclaimer =
      '⚠️ ข้อมูลนี้เกิดจากการประมวลผลด้วย AI เพื่อการวิเคราะห์ส่วนบุคคลเท่านั้น ไม่ถือเป็นคำแนะนำทางการเงิน การลงทุน หรือการชักชวนให้ซื้อขายหลักทรัพย์ที่มีใบอนุญาต ผู้ลงทุนควรศึกษาข้อมูลและตัดสินใจด้วยตนเอง'

    return NextResponse.json({
      advice: text,
      disclaimer,
      modelUsed,
      groundingSources: groundingSources || [],
      updatedAt: new Date().toISOString(),
      healthScore,
    })
  } catch (error: any) {
    console.error('[ai-advisor analyze]', error)
    return NextResponse.json({ error: error.message || 'AI analysis failed' }, { status: 500 })
  }
}
