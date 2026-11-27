import { positionBasisLabel, positionWeight, type PositionLimit } from '../ai/portfolio-position-limit'
/**
 * lib/analytics/risk-sentinel.ts
 * Quantitative calculation engine for Risk Sentinel & Opportunity Radar.
 * Includes Sector Classification, Correlation Awareness & Cross-Sector Rotation.
 */

import { HoldingItem } from './holdings'

export interface StressTestScenario {
  dropPercent: number // e.g. -10, -20, -30
  lossAmountBase: number
  portfolioImpactPercent: number
}

export interface ConcentrationRiskItem {
  ticker: string
  assetName: string
  market: string
  allocationPercent: number
  currentValueBase: number
  riskLevel: 'MODERATE' | 'HIGH' | 'CRITICAL'
  stressTests: StressTestScenario[]
  recommendation: string
}

export interface DrawdownRiskItem {
  ticker: string
  assetName: string
  market: string
  unrealizedPnLPercent: number
  unrealizedPnLBase: number
  currentValueBase: number
  severity: 'WARNING' | 'DANGER'
  thesisCheckNote: string
}

export interface LiquidityHealth {
  cashTotalBase: number
  portfolioTotalBase: number
  cashRatioPercent: number
  status: 'LOW' | 'OPTIMAL' | 'HIGH'
  statusLabel: string
  recommendation: string
}

export interface SectorBreakdownItem {
  sector: string
  valueBase: number
  percent: number
  isOverweight: boolean
}

export interface RiskSentinelReport {
  overallRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL'
  overallRiskScore: number // 0 - 100 (higher = riskier)
  concentrationRisks: ConcentrationRiskItem[]
  drawdownRisks: DrawdownRiskItem[]
  liquidity: LiquidityHealth
  assetClassBreakdown: Array<{
    category: string
    valueBase: number
    percent: number
    isOverweight: boolean
  }>
  sectorBreakdown: SectorBreakdownItem[]
  keyWarnings: string[]
}

export type OpportunityType =
  | 'SECTOR_ROTATION'
  | 'DEFENSIVE_HEDGE'
  | 'DCA_DOWN'
  | 'PULLBACK'
  | 'REBALANCE_LAG'
  | 'WATCHLIST_DIP'

export interface OpportunityItem {
  id: string
  ticker: string
  assetName: string
  market: string
  assetType: string
  currentPrice: number
  currency: string
  opportunityType: OpportunityType
  opportunityScore: number // 1-100
  title: string
  description: string
  metricLabel: string
  metricValue: string
  suggestedAction: string
}

export interface OpportunityRadarReport {
  opportunities: OpportunityItem[]
  topPickSummary: string
  deployableCashBase: number
}

// ── Sector Mapping Database for Accurate Correlation & Skew Analysis ────────
const KNOWN_SECTORS: Record<string, { detail: string; broad: string }> = {
  // Technology & Semiconductors (High Beta / Cyclical / Growth)
  AAPL: { detail: 'Technology / Hardware', broad: 'Technology' },
  MSFT: { detail: 'Technology / Enterprise Software', broad: 'Technology' },
  GOOGL: { detail: 'Technology / Digital Media & Search', broad: 'Technology' },
  GOOG: { detail: 'Technology / Digital Media & Search', broad: 'Technology' },
  NVDA: { detail: 'Technology / AI Accelerator Semiconductor', broad: 'Technology' },
  MU: { detail: 'Technology / Memory Semiconductor', broad: 'Technology' },
  AMD: { detail: 'Technology / Semiconductor', broad: 'Technology' },
  TSM: { detail: 'Technology / Semiconductor Foundry', broad: 'Technology' },
  AVGO: { detail: 'Technology / Semiconductor & Infrastructure', broad: 'Technology' },
  META: { detail: 'Technology / Communication & Social Media', broad: 'Technology' },
  AMZN: { detail: 'Consumer Discretionary / Cloud Services', broad: 'Technology' },
  INTC: { detail: 'Technology / Semiconductor', broad: 'Technology' },
  QCOM: { detail: 'Technology / Mobile Semiconductor', broad: 'Technology' },
  ASML: { detail: 'Technology / Lithography Equipment', broad: 'Technology' },
  DELTA: { detail: 'Technology / Power & Electronics', broad: 'Technology' },
  HANA: { detail: 'Technology / Electronics Manufacturing', broad: 'Technology' },
  KCE: { detail: 'Technology / PCB Electronics', broad: 'Technology' },
  QQQM: { detail: 'Technology / Invesco Nasdaq 100 ETF', broad: 'Technology' },
  WDC: { detail: 'Technology / Data Storage & Memory', broad: 'Technology' },
  SNDK: { detail: 'Technology / Flash Storage & Memory', broad: 'Technology' },
  NFLX: { detail: 'Technology / Streaming & Entertainment', broad: 'Technology' },
  ORCL: { detail: 'Technology / Enterprise Cloud & Database', broad: 'Technology' },
  CRM: { detail: 'Technology / Enterprise Cloud Software', broad: 'Technology' },
  PLTR: { detail: 'Technology / AI Data & Analytics', broad: 'Technology' },
  SMCI: { detail: 'Technology / AI Server Infrastructure', broad: 'Technology' },
  ARM: { detail: 'Technology / Semiconductor Architecture', broad: 'Technology' },
  XLK: { detail: 'Technology / Technology Select Sector ETF', broad: 'Technology' },
  SOXX: { detail: 'Technology / iShares Semiconductor ETF', broad: 'Technology' },
  SMH: { detail: 'Technology / VanEck Semiconductor ETF', broad: 'Technology' },
  CHPY: { detail: 'Technology / Semiconductor Option Income ETF', broad: 'Technology' },
  ADVANC: { detail: 'Technology / Telecom & Digital Infra (TH)', broad: 'Technology' },
  TRUE: { detail: 'Technology / Telecom & Digital (TH)', broad: 'Technology' },

  // Consumer Discretionary / Growth / Thai Commerce & Tourism
  TSLA: { detail: 'Consumer Discretionary / EV & Energy AI', broad: 'Consumer & Growth' },
  CRC: { detail: 'Consumer Discretionary / Retail (TH)', broad: 'Consumer & Growth' },
  CPN: { detail: 'Real Estate & Retail / Shopping Centers (TH)', broad: 'Consumer & Growth' },
  MINT: { detail: 'Consumer Discretionary / Hospitality & Food (TH)', broad: 'Consumer & Growth' },
  AOT: { detail: 'Industrials / Airports & Aviation (TH)', broad: 'Consumer & Growth' },
  OR: { detail: 'Consumer & Energy / Mobility & Retail (TH)', broad: 'Consumer & Growth' },

  // Financials
  JPM: { detail: 'Financials / Diversified Banking', broad: 'Financials' },
  BAC: { detail: 'Financials / Banking', broad: 'Financials' },
  V: { detail: 'Financials / Payment Processing', broad: 'Financials' },
  MA: { detail: 'Financials / Payment Processing', broad: 'Financials' },
  GS: { detail: 'Financials / Investment Banking', broad: 'Financials' },
  SCB: { detail: 'Financials / Banking (TH)', broad: 'Financials' },
  KBANK: { detail: 'Financials / Banking (TH)', broad: 'Financials' },
  BBL: { detail: 'Financials / Banking (TH)', broad: 'Financials' },
  KTB: { detail: 'Financials / Banking (TH)', broad: 'Financials' },
  TISCO: { detail: 'Financials / Auto Loans & Dividend (TH)', broad: 'Financials' },

  // Healthcare & Pharmaceuticals (Defensive Low-Beta)
  UNH: { detail: 'Healthcare / Managed Care', broad: 'Healthcare' },
  JNJ: { detail: 'Healthcare / Medical Devices & Pharma', broad: 'Healthcare' },
  LLY: { detail: 'Healthcare / Pharmaceuticals', broad: 'Healthcare' },
  PFE: { detail: 'Healthcare / Pharmaceuticals', broad: 'Healthcare' },
  ABBV: { detail: 'Healthcare / Biotechnology', broad: 'Healthcare' },
  MRK: { detail: 'Healthcare / Pharmaceuticals', broad: 'Healthcare' },
  XLV: { detail: 'Healthcare / Health Care Select ETF', broad: 'Healthcare' },
  BDMS: { detail: 'Healthcare / Hospital Network (TH)', broad: 'Healthcare' },
  BH: { detail: 'Healthcare / Hospital (TH)', broad: 'Healthcare' },

  // Consumer Staples & Dividend (Defensive Cash Flow)
  PG: { detail: 'Consumer Staples / Household Products', broad: 'Defensive & Dividend' },
  KO: { detail: 'Consumer Staples / Beverages', broad: 'Defensive & Dividend' },
  PEP: { detail: 'Consumer Staples / Snacks & Beverages', broad: 'Defensive & Dividend' },
  COST: { detail: 'Consumer Staples / Warehouse Club', broad: 'Defensive & Dividend' },
  WMT: { detail: 'Consumer Staples / Retail', broad: 'Defensive & Dividend' },
  SCHD: { detail: 'Dividend & Value / Schwab US Dividend ETF', broad: 'Defensive & Dividend' },
  VYM: { detail: 'Dividend & Value / Vanguard High Dividend Yield ETF', broad: 'Defensive & Dividend' },
  XLP: { detail: 'Consumer Staples / Consumer Staples Select ETF', broad: 'Defensive & Dividend' },
  CPALL: { detail: 'Consumer Staples / Convenience Store (TH)', broad: 'Defensive & Dividend' },
  CPAXT: { detail: 'Consumer Staples / Wholesale (TH)', broad: 'Defensive & Dividend' },

  // Energy & Utilities
  XOM: { detail: 'Energy / Integrated Oil & Gas', broad: 'Energy & Utilities' },
  CVX: { detail: 'Energy / Integrated Oil & Gas', broad: 'Energy & Utilities' },
  PTT: { detail: 'Energy / National Oil & Gas (TH)', broad: 'Energy & Utilities' },
  PTTEP: { detail: 'Energy / E&P Oil & Gas (TH)', broad: 'Energy & Utilities' },
  GULF: { detail: 'Utilities / Power Generation (TH)', broad: 'Energy & Utilities' },
  GPSC: { detail: 'Utilities / Power Generation (TH)', broad: 'Energy & Utilities' },

  // Broad Market & Global Index ETFs
  VOO: { detail: 'Broad Index / Vanguard S&P 500 ETF', broad: 'Core Index' },
  SPY: { detail: 'Broad Index / SPDR S&P 500 ETF', broad: 'Core Index' },
  QQQ: { detail: 'Technology / Invesco QQQ Trust ETF', broad: 'Technology' },
  VT: { detail: 'Global Equities / Vanguard Total World ETF', broad: 'Core Index' },
  VTI: { detail: 'Broad Index / Vanguard Total Stock Market ETF', broad: 'Core Index' },
  VXUS: { detail: 'Global Equities / Vanguard Total International ETF', broad: 'Core Index' },
  VEA: { detail: 'Developed Markets / Vanguard FTSE Developed ETF', broad: 'Core Index' },
  VWO: { detail: 'Emerging Markets / Vanguard FTSE Emerging ETF', broad: 'Core Index' },

  // Real Assets, Fixed Income & Industrials
  GOLD: { detail: 'Commodities / Physical Gold', broad: 'Gold & Commodities' },
  XAU: { detail: 'Commodities / Gold Spot', broad: 'Gold & Commodities' },
  GLD: { detail: 'Commodities / SPDR Gold Shares ETF', broad: 'Gold & Commodities' },
  IAU: { detail: 'Commodities / iShares Gold Trust ETF', broad: 'Gold & Commodities' },
  DBC: { detail: 'Commodities / Invesco Commodity Index ETF', broad: 'Gold & Commodities' },
  TLT: { detail: 'Fixed Income / 20+ Year Treasury Bond ETF', broad: 'Bonds & Fixed Income' },
  IEF: { detail: 'Fixed Income / 7-10 Year Treasury Bond ETF', broad: 'Bonds & Fixed Income' },
  SHY: { detail: 'Fixed Income / 1-3 Year Treasury Bond ETF', broad: 'Bonds & Fixed Income' },
  BND: { detail: 'Fixed Income / Total Bond Market ETF', broad: 'Bonds & Fixed Income' },
  AGG: { detail: 'Fixed Income / iShares Core US Aggregate Bond ETF', broad: 'Bonds & Fixed Income' },
  SCC: { detail: 'Industrials & Materials / Siam Cement (TH)', broad: 'Energy & Utilities' },
  IVL: { detail: 'Materials / Petrochemicals (TH)', broad: 'Energy & Utilities' },
  CEG: { detail: 'Utilities / Nuclear & Clean Energy', broad: 'Energy & Utilities' },
  SMR: { detail: 'Utilities / Next-Gen Nuclear Energy', broad: 'Energy & Utilities' },

  // Cryptocurrencies
  BTC: { detail: 'Cryptocurrency / Store of Value', broad: 'Crypto' },
  ETH: { detail: 'Cryptocurrency / Smart Contract Platform', broad: 'Crypto' },
  SOL: { detail: 'Cryptocurrency / High Throughput L1', broad: 'Crypto' },
}

export function classifySector(ticker: string, assetType?: string, market?: string) {
  const clean = ticker.toUpperCase()
  if (KNOWN_SECTORS[clean]) {
    return KNOWN_SECTORS[clean]
  }

  const cleanNoDot = clean.replace('.BK', '')
  if (KNOWN_SECTORS[cleanNoDot]) {
    return KNOWN_SECTORS[cleanNoDot]
  }

  if (assetType === 'crypto' || clean.includes('BTC') || clean.includes('ETH')) {
    return { detail: 'Cryptocurrency / Digital Asset', broad: 'Crypto' }
  }
  if (assetType === 'gold' || clean.includes('GOLD') || clean.includes('XAU')) {
    return { detail: 'Commodities / Gold', broad: 'Gold & Commodities' }
  }
  if (assetType === 'bond') {
    return { detail: 'Fixed Income / Debt Securities', broad: 'Bonds & Fixed Income' }
  }
  if (assetType === 'fund') {
    return { detail: 'Fund / Collective Investment', broad: 'Core Index' }
  }
  if (market === 'TH') {
    return { detail: 'Thai Equities (General)', broad: 'General Equities' }
  }
  return { detail: 'US Equities (General)', broad: 'General Equities' }
}

/**
 * 1. Analyze Portfolio Risks (Risk Sentinel)
 */
export function analyzePortfolioRisks(
  holdings: HoldingItem[],
  cashTotalBase: number,
  baseCurrency: string,
  positionLimit?: PositionLimit,
  valuationReady = true,
): RiskSentinelReport {
  const investedTotal = holdings.reduce((sum, h) => sum + h.currentValueBase, 0)
  const grandTotal = investedTotal + cashTotalBase
  const keyWarnings: string[] = []

  // ── A. Concentration Risk & Stress Testing ─────────────────
  const concentrationRisks: ConcentrationRiskItem[] = []
  for (const h of holdings) {
    const weight = positionLimit ? positionWeight(h.currentValueBase, investedTotal, cashTotalBase, positionLimit) ?? 0 : h.allocationPercent
    if (valuationReady && (positionLimit ? weight > positionLimit.percent : weight >= 20)) {
      let riskLevel: 'MODERATE' | 'HIGH' | 'CRITICAL' = 'MODERATE'
      let recommendation = `สัดส่วน ${weight.toFixed(1)}% สูงปานกลาง ควรจำกัดไม่ให้เกิน 25%`

      if (weight >= 40) {
        riskLevel = 'CRITICAL'
        recommendation = `สัดส่วนสูงถึง ${weight.toFixed(1)}% (เข้าข่ายเสี่ยงวิกฤต) แนะนำล็อกกำไรและกระจายความเสี่ยงด่วน`
        keyWarnings.push(`⚠️ ${h.ticker} ครองสัดส่วนสูงเกิน ${weight.toFixed(1)}% ของพอร์ต เสี่ยงได้รับผลกระทบหนักหากปรับฐาน`)
      } else if (weight >= 28) {
        riskLevel = 'HIGH'
        recommendation = `สัดส่วน ${weight.toFixed(1)}% ค่อนข้างสูง ควรชะลอการซื้อเพิ่มและเติมสินทรัพย์กลุ่มอื่น`
        keyWarnings.push(`ระวัง ${h.ticker} ครองสัดส่วน ${weight.toFixed(1)}% ของพอร์ตโฟลิโอ`)
      }

      if (positionLimit) {
        recommendation = `สัดส่วน ${weight.toFixed(1)}% ของ${positionBasisLabel(positionLimit)} เกินเพดาน ${positionLimit.percent}% · ทบทวนก่อนเพิ่ม`
      }

      // Stress tests: Drop -10%, -20%, -30%
      const stressTests: StressTestScenario[] = [-10, -20, -30].map((drop) => {
        const lossAmount = Math.abs((h.currentValueBase * drop) / 100)
        const impact = grandTotal > 0 ? (lossAmount / grandTotal) * 100 : 0
        return {
          dropPercent: drop,
          lossAmountBase: Math.round(lossAmount),
          portfolioImpactPercent: Number(impact.toFixed(2)),
        }
      })

      concentrationRisks.push({
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        allocationPercent: Number(weight.toFixed(1)),
        currentValueBase: Math.round(h.currentValueBase),
        riskLevel,
        stressTests,
        recommendation,
      })
    }
  }

  // ── B. Drawdown Risk (Unrealized Loss Inspection) ───────────
  const drawdownRisks: DrawdownRiskItem[] = []
  for (const h of holdings) {
    if (h.unrealizedPnLPercent <= -15) {
      const severity: 'WARNING' | 'DANGER' = h.unrealizedPnLPercent <= -25 ? 'DANGER' : 'WARNING'
      const note =
        severity === 'DANGER'
          ? `ติดลบลึก ${h.unrealizedPnLPercent.toFixed(1)}% ควรทบทวนพื้นฐานบริษัททันทีว่าเหตุผลในการซื้อเปลี่ยนไปหรือไม่`
          : `ย่อตัว ${h.unrealizedPnLPercent.toFixed(1)}% อยู่ในจุดที่ต้องติดตามระดับแนวรับอย่างใกล้ชิด`

      drawdownRisks.push({
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        unrealizedPnLPercent: Number(h.unrealizedPnLPercent.toFixed(2)),
        unrealizedPnLBase: Math.round(h.unrealizedPnLBase),
        currentValueBase: Math.round(h.currentValueBase),
        severity,
        thesisCheckNote: note,
      })

      if (severity === 'DANGER') {
        keyWarnings.push(`${h.ticker} ติดลบถึง ${h.unrealizedPnLPercent.toFixed(1)}% แนะนำทบทวนสมมติฐานการลงทุน`)
      }
    }
  }

  // ── C. Liquidity / Dry Powder Assessment ────────────────────
  const cashRatioPercent = grandTotal > 0 ? (cashTotalBase / grandTotal) * 100 : 0
  let liquidityStatus: 'LOW' | 'OPTIMAL' | 'HIGH' = 'OPTIMAL'
  let statusLabel = 'กระสุนเงินสดเหมาะสม'
  let liquidityRecommendation = 'สัดส่วนเงินสดอยู่ในเกณฑ์สมดุล พร้อมเข้าช้อนซื้อเมื่อเกิดโอกาส'

  if (cashRatioPercent < 10) {
    liquidityStatus = 'LOW'
    statusLabel = 'กระสุนเงินสดเหลือน้อย'
    liquidityRecommendation = 'เงินสดต่ำกว่า 10% ของพอร์ต แนะนำชะลอการซื้อหุ้นใหม่และเติมเงินสดสำรอง'
    keyWarnings.push('⚠️ เงินสดสำรองต่ำกว่า 10% อาจขาดสภาพคล่องเมื่อตลาดปรับฐานแรง')
  } else if (cashRatioPercent > 35) {
    liquidityStatus = 'HIGH'
    statusLabel = 'เงินสดสำรองล้นพอร์ต'
    liquidityRecommendation = 'เงินสดสูงเกิน 35% ส่งผลให้เสียโอกาสการเติบโต ควรวางแผนทยอยสะสมสินทรัพย์เป้าหมาย'
  }

  const liquidity: LiquidityHealth = {
    cashTotalBase,
    portfolioTotalBase: grandTotal,
    cashRatioPercent,
    status: liquidityStatus,
    statusLabel,
    recommendation: liquidityRecommendation,
  }

  // ── D. Asset Class Breakdown ───────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const h of holdings) {
    const cat = h.assetType ? h.assetType.toUpperCase() : 'STOCK'
    categoryMap[cat] = (categoryMap[cat] || 0) + h.currentValueBase
  }
  if (cashTotalBase > 0) {
    categoryMap['CASH'] = (categoryMap['CASH'] || 0) + cashTotalBase
  }

  const assetClassBreakdown = Object.entries(categoryMap).map(([category, valueBase]) => {
    const percent = grandTotal > 0 ? (valueBase / grandTotal) * 100 : 0
    const isOverweight = category === 'CRYPTO' ? percent > 35 : percent > 65
    return {
      category,
      valueBase,
      percent,
      isOverweight,
    }
  })

  // ── E. Sector Breakdown & Sector Overweight Detection ───────
  const sectorMap: Record<string, number> = {}
  for (const h of holdings) {
    const sectorInfo = classifySector(h.ticker, h.assetType, h.market)
    const sector = sectorInfo.broad
    sectorMap[sector] = (sectorMap[sector] || 0) + h.currentValueBase
  }
  if (cashTotalBase > 0) {
    sectorMap['Cash & Dry Powder'] = (sectorMap['Cash & Dry Powder'] || 0) + cashTotalBase
  }

  const sectorBreakdown: SectorBreakdownItem[] = Object.entries(sectorMap).map(
    ([sector, valueBase]) => {
      const percent = grandTotal > 0 ? (valueBase / grandTotal) * 100 : 0
      const isOverweight = sector === 'Technology' ? percent > 40 : sector !== 'Cash & Dry Powder' && percent > 35
      return {
        sector,
        valueBase,
        percent: Number(percent.toFixed(1)),
        isOverweight,
      }
    }
  )

  // Sort sectors by percentage descending
  sectorBreakdown.sort((a, b) => b.percent - a.percent)

  // Warn if any single sector is overweight
  for (const sec of sectorBreakdown) {
    if (sec.isOverweight && sec.sector !== 'Cash & Dry Powder') {
      keyWarnings.push(
        `⚠️ สัดส่วนกลุ่ม ${sec.sector} สูงถึง ${sec.percent}% ของพอร์ต (Overweight) เสี่ยงต่อความผันผวนเฉพาะกลุ่ม ควรพิจารณาทำ Sector Rotation ไปยังกลุ่มอื่น`
      )
    }
  }

  // ── F. Overall Risk Score Calculation (0-100) ───────────────
  let riskScore = 20 // baseline
  const maxAlloc = valuationReady && holdings.length > 0
    ? Math.max(...holdings.map(h => positionLimit ? positionWeight(h.currentValueBase, investedTotal, cashTotalBase, positionLimit) ?? 0 : h.allocationPercent))
    : 0
  if (maxAlloc > 50) riskScore += 35
  else if (maxAlloc > 35) riskScore += 25
  else if (maxAlloc > 25) riskScore += 15

  if (concentrationRisks.some((c) => c.riskLevel === 'CRITICAL')) riskScore += 20
  if (drawdownRisks.some((d) => d.severity === 'DANGER')) riskScore += 15
  if (liquidityStatus === 'LOW') riskScore += 15

  // Add risk penalty if single sector dominates > 50%
  const dominantSector = sectorBreakdown.find((s) => s.sector !== 'Cash & Dry Powder' && s.percent > 50)
  if (dominantSector) {
    riskScore += 15
  }

  riskScore = Math.min(100, Math.max(10, riskScore))

  let overallRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'LOW'
  if (riskScore >= 75) overallRiskLevel = 'CRITICAL'
  else if (riskScore >= 55) overallRiskLevel = 'ELEVATED'
  else if (riskScore >= 35) overallRiskLevel = 'MODERATE'
  else overallRiskLevel = 'LOW'

  return {
    overallRiskLevel,
    overallRiskScore: riskScore,
    concentrationRisks,
    drawdownRisks,
    liquidity,
    assetClassBreakdown,
    sectorBreakdown,
    keyWarnings,
  }
}

/**
 * 2. Scan Portfolio Opportunities (Opportunity Radar)
 * Now includes Cross-Sector Rotation and Defensive Hedging Candidates!
 */
export function scanPortfolioOpportunities(
  holdings: HoldingItem[],
  watchlists: Array<{
    symbol: string
    displayName: string
    itemType: string
    market?: string
    currentPrice?: number
    currency?: string
    changePercent?: number
    pullbackFromHigh?: number
    rsi14?: number | null
  }>,
  cashTotalBase: number,
  targetAllocation?: Record<string, number>,
  baseCurrency = 'THB'
): OpportunityRadarReport {
  const opportunities: OpportunityItem[] = []
  const investedTotal = holdings.reduce((sum, h) => sum + h.currentValueBase, 0)
  const grandTotal = investedTotal + cashTotalBase

  // ── 0. Cross-Sector Rotation Candidates (If portfolio is Tech-Heavy) ──
  const techValue = holdings
    .filter((h) => classifySector(h.ticker, h.assetType, h.market).broad === 'Technology')
    .reduce((sum, h) => sum + h.currentValueBase, 0)
  const techPercent = grandTotal > 0 ? (techValue / grandTotal) * 100 : 0

  if (techPercent >= 35) {
    // Sector Rotation Target 1: High Quality Dividend Cash Flow
    const hasSCHD = holdings.some((h) => h.ticker.toUpperCase() === 'SCHD' || h.ticker.toUpperCase() === 'VYM')
    opportunities.push({
      id: 'rot_dividend_cashflow',
      ticker: 'SCHD / VYM',
      assetName: 'กองทุนปันผลกระแสเงินสดมั่นคง (Dividend & Value Rotation)',
      market: 'US',
      assetType: 'fund',
      currentPrice: 0,
      currency: 'USD',
      opportunityType: 'SECTOR_ROTATION',
      opportunityScore: 97,
      title: 'ยุทธศาสตร์หมุนเงินทุน (Sector Rotation) สู่ Dividend & Value',
      description: `พอร์ตของคุณมีสัดส่วนกลุ่ม Technology สูงถึง ${techPercent.toFixed(1)}% การขายลดความเสี่ยงจากหุ้น Tech แล้วหมุนเงินเข้ากองทุนปันผลคุณภาพสูง (เช่น SCHD หรือ VYM) จะช่วยลดค่าความผันผวน (Beta) และสร้างกระแสเงินสดรองรับตลาดปรับฐาน`,
      metricLabel: 'Tech Exposure ปัจจุบัน',
      metricValue: `${techPercent.toFixed(1)}% (Overweight)`,
      suggestedAction: hasSCHD ? 'เพิ่มน้ำหนัก SCHD ในพอร์ตเป็น 10-15%' : 'เปิดสถานะสะสมกองทุน SCHD หรือ VYM สัดส่วน 8-12% เพื่อกระจายความเสี่ยงข้ามกลุ่ม',
    })

    // Sector Rotation Target 2: Healthcare (Low-Beta Defensive)
    const hasHealthcare = holdings.some(
      (h) => classifySector(h.ticker, h.assetType, h.market).broad === 'Healthcare'
    )
    if (!hasHealthcare) {
      opportunities.push({
        id: 'rot_defensive_healthcare',
        ticker: 'XLV / JNJ',
        assetName: 'กลุ่มการแพทย์และสุขภาพ (Defensive Low-Beta Rotation)',
        market: 'US',
        assetType: 'stock',
        currentPrice: 0,
        currency: 'USD',
        opportunityType: 'DEFENSIVE_HEDGE',
        opportunityScore: 93,
        title: 'เสริมเกราะป้องกันพอร์ตด้วยกลุ่ม Healthcare (XLV / JNJ)',
        description: 'กลุ่มการแพทย์มีค่า Correlation กับหุ้นเทคโนโลยีต่ำมาก (~0.28) และมีความต้องการสม่ำเสมอในทุกช่วงเศรษฐกิจ ช่วยพยุงพอร์ตในยามที่หุ้นเติบโตเกิดฟองสบู่หรือถูกเทขาย',
        metricLabel: 'Correlation กับ Tech',
        metricValue: '~0.28 (ต่ำมาก)',
        suggestedAction: 'แบ่งเงิน 5-8% ทยอยสะสมเพื่อทำหน้าที่เป็นถุงลมนิรภัยให้พอร์ต',
      })
    }
  }

  // ── 1. DCA-Down Candidates (Assets trading below average cost) ──
  for (const h of holdings) {
    if (h.unrealizedPnLPercent < -3 && h.unrealizedPnLPercent > -35) {
      const discount = Math.abs(h.unrealizedPnLPercent)
      const score = Math.min(95, Math.round(50 + discount * 1.5))
      opportunities.push({
        id: `dca_${h.assetId}`,
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        assetType: h.assetType,
        currentPrice: h.currentPrice,
        currency: h.currency,
        opportunityType: 'DCA_DOWN',
        opportunityScore: score,
        title: `โอกาสลดต้นทุนเฉลี่ย (DCA-Down) ใน ${h.ticker}`,
        description: `ราคาปัจจุบัน ${h.currentPrice.toLocaleString()} ${h.currency} ต่ำกว่าต้นทุนเฉลี่ยของคุณ (${h.avgCost.toLocaleString()} ${h.currency}) อยู่ ${discount.toFixed(1)}% หากพื้นฐานยังไม่เปลี่ยน เป็นจังหวะดีในการสะสมเพื่อดึงต้นทุนลง`,
        metricLabel: 'ส่วนลดจากทุนเฉลี่ย',
        metricValue: `-${discount.toFixed(1)}%`,
        suggestedAction: `ทยอยสะสม ${h.ticker} เพิ่มเมื่อพอร์ตมีสัดส่วนกลุ่มรองรับเพียงพอ`,
      })
    }
  }

  // ── 2. Rebalance Lag Opportunity (Target allocation gap) ────
  if (targetAllocation && Object.keys(targetAllocation).length > 0) {
    const actualGrouped: Record<string, number> = {}
    for (const h of holdings) {
      const key = h.market || h.assetType || 'OTHER'
      actualGrouped[key] = (actualGrouped[key] || 0) + h.allocationPercent
    }

    for (const [key, targetPct] of Object.entries(targetAllocation)) {
      if (key.startsWith('_') || typeof targetPct !== 'number' || isNaN(targetPct)) continue
      const currentPct = actualGrouped[key] || 0
      const gap = targetPct - currentPct
      if (gap >= 5) {
        const candidate = holdings.find((h) => h.market === key || h.assetType === key)
        const candidateTicker = candidate?.ticker ?? key
        const candidateName = candidate?.assetName ?? `กลุ่มสินทรัพย์ ${key}`

        opportunities.push({
          id: `rebal_${key}`,
          ticker: candidateTicker,
          assetName: candidateName,
          market: candidate?.market ?? key,
          assetType: candidate?.assetType ?? 'stock',
          currentPrice: candidate?.currentPrice ?? 0,
          currency: candidate?.currency ?? baseCurrency,
          opportunityType: 'REBALANCE_LAG',
          opportunityScore: Math.min(98, Math.round(60 + gap * 2)),
          title: `สัดส่วนกลุ่ม ${key} ต่ำกว่าเป้าหมาย ${gap.toFixed(1)}%`,
          description: `พอร์ตของคุณมีสัดส่วนกลุ่ม ${key} เพียง ${currentPct.toFixed(1)}% จากเป้าหมาย ${targetPct}% ควรจัดสรรเงินใหม่เติมส่วนนี้เพื่อรักษาวินัยการกระจายความเสี่ยง`,
          metricLabel: 'สัดส่วนที่ยังขาด',
          metricValue: `+${gap.toFixed(1)}%`,
          suggestedAction: `จัดสรรเงินลงทุนรอบถัดไปเน้นกลุ่ม ${key}`,
        })
      }
    }
  }

  // ── 3. Watchlist High-Conviction Dip ────────────────────────
  const unheldWatchlist = watchlists.filter(
    (w) => !holdings.some((h) => h.ticker.toUpperCase() === w.symbol.toUpperCase())
  )
  const prioritizedWatchlist = [...unheldWatchlist].sort((a, b) => {
    const aDip = Math.abs(Math.min(0, a.pullbackFromHigh ?? 0)) + ((a.rsi14 ?? 50) <= 35 ? 10 : 0)
    const bDip = Math.abs(Math.min(0, b.pullbackFromHigh ?? 0)) + ((b.rsi14 ?? 50) <= 35 ? 10 : 0)
    return bDip - aDip
  })

  for (const w of prioritizedWatchlist.slice(0, 4)) {
    const inferredMarket =
      w.market ||
      (w.itemType === 'crypto' ? 'CRYPTO' : w.symbol.toUpperCase().endsWith('.BK') ? 'TH' : 'US')
    const inferredCurrency =
      w.currency || (inferredMarket === 'TH' ? 'THB' : 'USD')
    const hasLiveSignal =
      w.pullbackFromHigh !== undefined || w.changePercent !== undefined || w.rsi14 !== undefined
    const pullback = w.pullbackFromHigh ?? 0
    const chg = w.changePercent ?? 0
    const isDipOrOversold = pullback <= -3 || chg <= -1.5 || (w.rsi14 != null && w.rsi14 <= 40)

    if (hasLiveSignal && !isDipOrOversold && w.currentPrice && w.currentPrice > 0) {
      // Only surface non-dipping watchlist items if no dipped candidates exist, with lower priority
    }

    const dynamicScore = hasLiveSignal
      ? isDipOrOversold
        ? Math.min(
            95,
            Math.round(
              74 +
                Math.abs(Math.min(0, pullback) || Math.min(0, chg)) * 1.2 +
                (w.rsi14 != null && w.rsi14 <= 35 ? 8 : 0)
            )
          )
        : 65
      : 78

    const currSymbol = inferredCurrency === 'THB' ? '฿' : '$'
    const metricVal =
      w.currentPrice && w.currentPrice > 0
        ? `${currSymbol}${w.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}${
            pullback < 0 ? ` (${pullback.toFixed(1)}% จาก High)` : chg !== 0 ? ` (${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%)` : ''
          }`
        : 'ใน Watchlist'

    opportunities.push({
      id: `watch_${w.symbol}`,
      ticker: w.symbol,
      assetName: w.displayName,
      market: inferredMarket,
      assetType: w.itemType,
      currentPrice: w.currentPrice ?? 0,
      currency: inferredCurrency,
      opportunityType: 'WATCHLIST_DIP',
      opportunityScore: dynamicScore,
      title: isDipOrOversold
        ? `Watchlist ย่อตัวน่าสะสม: ${w.symbol}`
        : `สินทรัพย์ใน Watchlist น่าจับตา: ${w.symbol}`,
      description: isDipOrOversold
        ? `${w.symbol} กำลังย่อตัว ${pullback < 0 ? `${pullback.toFixed(1)}% จาก 52W High` : `${chg.toFixed(1)}%`}${
            w.rsi14 != null ? ` (RSI ${w.rsi14.toFixed(1)})` : ''
          } เหมาะสำหรับวางแผนทยอยเปิดไม้แรกตามแนวรับ`
        : `คุณกำลังติดตาม ${w.symbol} อยู่ หากมีกระสุนเงินสดสำรองเพียงพอ เป็นจังหวะดีในการศึกษาแนวรับเพื่อเริ่มไม้แรก (Initial Position)`,
      metricLabel: w.currentPrice && w.currentPrice > 0 ? 'ราคาล่าสุด / ย่อตัว' : 'สถานะ',
      metricValue: metricVal,
      suggestedAction: `วางแผนจุดเข้าซื้อไม้แรกใน ${w.symbol}`,
    })
  }

  // Sort opportunities by score descending
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore)

  const topPick = opportunities[0]
  const topPickSummary = topPick
    ? `${topPick.title} (${topPick.suggestedAction})`
    : 'โครงสร้างพอร์ตอยู่ในเกณฑ์สมดุล ยังไม่มีจุดเข้าซื้อที่มีนัยสำคัญ'

  return {
    opportunities,
    topPickSummary,
    deployableCashBase: cashTotalBase,
  }
}
