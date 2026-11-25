import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { calculateStockDcaBreakdown } from '@/lib/analytics/rebalancing'
import { computeBucketsWithHoldings, extractStrategyBuckets } from '@/lib/analytics/strategy-buckets'
import { planAdviceContextKey, planAdviceInput } from '@/lib/ai/model-contracts'
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
    const context = req.nextUrl.searchParams.get('scenario')
    if (!context || !/^[a-f0-9]{1,8}-\d{1,8}$/.test(context)) {
      return NextResponse.json({ advice: null, modelUsed: null, updatedAt: null })
    }
    const latestLog = await prisma.aiAdviceLog.findFirst({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: `[plan-advice:v2:${context}]` },
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
    const input = planAdviceInput.safeParse(await req.json())
    if (!input.success) return NextResponse.json({ error: 'งบลงทุนหรือสัดส่วนแผนไม่ถูกต้อง' }, { status: 400 })
    const { presetId, presetName, targetAllocation, monthlyContribution, subAllocations, tolerancePercent } = input.data

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

    const dcaBudget = monthlyContribution
    const storedPreset = presetId ? await prisma.investmentPreset.findFirst({
      where: { id: presetId, userId }, select: { targetAllocation: true },
    }) : null
    const { computedBuckets } = computeBucketsWithHoldings(
      extractStrategyBuckets(storedPreset?.targetAllocation as Record<string, unknown> | undefined || targetAllocation, holdingsResult.holdings),
      holdingsResult.holdings,
      totalCash,
      holdingsResult.totalValueBase + totalCash,
    )
    const allocation = cleanTargetAlloc && Object.keys(cleanTargetAlloc).length > 0
      ? calculateStockDcaBreakdown({
          holdings: holdingsResult.holdings, totalCashBase: totalCash, cashInflow: dcaBudget,
          targetAllocation: cleanTargetAlloc, subTargets: subAllocations,
          strategyBuckets: computedBuckets, tolerancePercent,
        }) : null
    const money = (value: number) => `${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${baseCurrency}`
    const mathRebalanceSummary = allocation
      ? [
          ...allocation.items.filter((item) => item.allocatedAmountBase > 0).map(
            (item) => `- **${item.ticker}**: ${money(item.allocatedAmountBase)} | สัดส่วนปัจจุบัน ${item.currentWeight.toFixed(1)}% · เป้าหมาย ${item.targetWeight.toFixed(1)}%`
          ),
          `- รวมจัดสรร: ${money(allocation.totalAllocated)} จากงบ ${money(dcaBudget)}`,
          `- เงินที่ยังไม่ได้จัดสรร: ${money(allocation.unallocatedCash)}`,
        ].join('\n')
      : 'ยังไม่มีสัดส่วนเป้าหมายที่ใช้คำนวณแผนจัดสรรได้'

    const prompt = `
[AI Portfolio Health & Strategy Advisor]
[plan-advice:v2:${planAdviceContextKey(input.data)}]
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
   (อธิบายหุ้นที่มีสัดส่วนต่ำกว่าเป้าหมายจากผลคำนวณ อย่าอนุมานแนวรับหรือความถูกแพงจากสัดส่วน)

   ### ⏸️ สินทรัพย์ที่ควรงดซื้อชั่วคราว (Pause & Hold)
   (ระบุชื่อหุ้นที่สัดส่วนโตเกินเป้าไปมาก หรือราคาตึงตัว ให้คำแนะนำชะลอการซื้อเพื่อไม่ให้พอร์ตกระจุกตัว)

   ### 💵 แผนจัดสรรเงินลงทุนเดือนหน้า (Monthly DCA Allocation Action Plan)
   (อธิบายหลักคิดของผลคำนวณโดยสั้น ระบบจะแนบตารางตัวเลขเอง ห้ามสร้างตารางหรือตัวเลขวงเงินใหม่)

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
      skipLog: true,
    })
    const advice = `${text}\n\n### ยอดจัดสรรจากระบบคำนวณ\n${mathRebalanceSummary}`
    await prisma.aiAdviceLog.create({
      data: { userId, logType: 'advisor', prompt, response: advice, modelUsed },
    })

    const disclaimer =
      '⚠️ ข้อมูลนี้เกิดจากการประมวลผลด้วย AI เพื่อการวิเคราะห์ส่วนบุคคลเท่านั้น ไม่ถือเป็นคำแนะนำทางการเงิน การลงทุน หรือการชักชวนให้ซื้อขายหลักทรัพย์ที่มีใบอนุญาต ผู้ลงทุนควรศึกษาข้อมูลและตัดสินใจด้วยตนเอง'

    return NextResponse.json({
      advice,
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
