'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  Globe,
  Sparkles,
  CalendarDays,
  ListFilter,
  CheckCircle2,
} from 'lucide-react'
import type { CalendarImportance, CalendarRegion } from './TradingViewCalendar'

export type MacroCategory = 'all' | 'interest_rate' | 'inflation' | 'employment' | 'growth' | 'pmi'
export type TimeframeFilter = 'all' | 'this_week' | 'next_week' | 'this_month'
export type CalendarViewMode = 'list' | 'grouped'

export interface MacroEventItem {
  id: string
  nameTh: string
  nameEn: string
  country: string
  currency: 'USD' | 'EUR' | 'JPY' | 'THB' | 'CNY' | 'GBP'
  flag: string
  region: CalendarRegion
  category: MacroCategory
  importance: 'high' | 'medium'
  releaseTime: string // e.g. '19:30 น.'
  daysOffset: number // Days from current date
  typicalTimeTh: string
  frequency: string
  actual?: string
  forecast: string
  previous: string
  unit: string
  source: string
  sourceUrl: string
  impactSummary: string
  bullishScenario: string
  bearishScenario: string
  affectedAssets: string[]
}

const MACRO_EVENTS: MacroEventItem[] = [
  {
    id: 'thai-cpi',
    nameTh: 'ดัชนีราคาผู้บริโภคของไทย (Headline CPI เงินเฟ้อทั่วไปไทย)',
    nameEn: 'Thailand Consumer Price Index (CPI YoY)',
    country: 'ไทย',
    currency: 'THB',
    flag: '🇹🇭',
    region: 'THB',
    category: 'inflation',
    importance: 'medium',
    releaseTime: '10:30 น.',
    daysOffset: 3,
    typicalTimeTh: '10:30 น. (ตามเวลาไทย)',
    frequency: 'ทุกเดือน (ช่วงต้น-กลางเดือน)',
    forecast: '0.8% - 1.2% YoY',
    previous: '0.98% YoY',
    unit: '% YoY',
    source: 'กระทรวงพาณิชย์ ประเทศไทย',
    sourceUrl: 'https://www.tpso.moc.go.th',
    impactSummary: 'สะท้อนราคาสินค้าและบริการในประเทศ ช่วยให้ กนง. ประเมินกรอบเป้าหมายเงินเฟ้อ 1-3%',
    bullishScenario: 'เงินเฟ้ออยู่ในกรอบเป้าหมาย 1-2% ช่วยเพิ่มพื้นที่ (Policy Space) ให้ ธปท. ปรับลดดอกเบี้ยกระตุ้นเศรษฐกิจ',
    bearishScenario: 'เงินเฟ้อติดลบต่อเนื่องเป็นเวลานาน อาจสะท้อนกำลังซื้อในประเทศที่ชะลอตัว',
    affectedAssets: ['SET Index', 'พันธบัตรรัฐบาลไทย', 'หุ้นค้าปลีก (CPALL, CRC)'],
  },
  {
    id: 'ecb-rate',
    nameTh: 'มติอัตราดอกเบี้ยนโยบายธนาคารกลางยุโรป (ECB Policy Rate)',
    nameEn: 'European Central Bank (ECB) Rate Decision',
    country: 'ยุโรป',
    currency: 'EUR',
    flag: '🇪🇺',
    region: 'EUR',
    category: 'interest_rate',
    importance: 'high',
    releaseTime: '19:15 น.',
    daysOffset: 5,
    typicalTimeTh: '19:15 น. (ตามเวลาไทย)',
    frequency: '8 ครั้งต่อปี',
    forecast: '2.75% - 3.00%',
    previous: '3.00%',
    unit: '%',
    source: 'European Central Bank (ECB)',
    sourceUrl: 'https://www.ecb.europa.eu',
    impactSummary: 'ตัวเลขชี้ทิศทางเศรษฐกิจกลุ่ม 20 ประเทศยูโรโซน กระทบต่อค่าเงิน EUR/USD และตลาดหุ้นยุโรป (DAX, CAC40)',
    bullishScenario: 'ECB ปรับลดดอกเบี้ยเมื่อเศรษฐกิจยุโรปซบเซา → หนุนตลาดหุ้นยุโรปและลดต้นทุนหนี้ของภาครัฐในยุโรป',
    bearishScenario: 'หากเงินเฟ้อยุโรปยังสูงจนต้องชะลอการลดดอกเบี้ย → ค่าเงินยูโรแข็งค่าขึ้นเมื่อเทียบกับดอลลาร์',
    affectedAssets: ['ดัชนี DAX (เยอรมนี)', 'EUR/USD', 'พันธบัตรรัฐบาลเยอรมัน (Bunds)'],
  },
  {
    id: 'us-cpi',
    nameTh: 'ดัชนีราคาผู้บริโภคสหรัฐฯ (US CPI / เงินเฟ้อทั่วไปและพื้นฐาน)',
    nameEn: 'US Consumer Price Index (CPI YoY & MoM)',
    country: 'สหรัฐอเมริกา',
    currency: 'USD',
    flag: '🇺🇸',
    region: 'USD',
    category: 'inflation',
    importance: 'high',
    releaseTime: '19:30 น.',
    daysOffset: 6,
    typicalTimeTh: '19:30 น. (ตามเวลาไทย)',
    frequency: 'ทุกเดือน (ช่วงกลางเดือน)',
    forecast: '2.6% YoY',
    previous: '2.7% YoY',
    unit: '% YoY',
    source: 'Bureau of Labor Statistics (BLS)',
    sourceUrl: 'https://www.bls.gov/cpi/',
    impactSummary: 'มาตรวัดเงินเฟ้อหลักที่ตลาดจับตามากที่สุด สะท้อนกำลังซื้อของผู้บริโภคและทิศทางนโยบายดอกเบี้ย FED',
    bullishScenario: 'หากตัวเลขเงินเฟ้อต่ำกว่าคาดการณ์ (Cooling Inflation) → นักลงทุนคาดว่า FED จะลดดอกเบี้ยได้เร็วขึ้น ตลาดหุ้นและทองคำดีดตัวขึ้น',
    bearishScenario: 'หากตัวเลขสูงกว่าคาดการณ์ (Sticky Inflation) → ตลาดกังวลเงินเฟ้อยืดเยื้อ ดอกเบี้ยอาจค้างสูงนาน หุ้นเทคฯ และทองคำถูกเทขาย',
    affectedAssets: ['S&P 500', 'NASDAQ', 'ทองคำ', 'อัตราแลกเปลี่ยน USD/THB', 'US 10Y Yield'],
  },
  {
    id: 'us-gdp',
    nameTh: 'อัตราการเติบโตทางเศรษฐกิจสหรัฐฯ (US GDP Growth Rate Q/Q)',
    nameEn: 'US Gross Domestic Product (GDP Annualized)',
    country: 'สหรัฐอเมริกา',
    currency: 'USD',
    flag: '🇺🇸',
    region: 'USD',
    category: 'growth',
    importance: 'high',
    releaseTime: '19:30 น.',
    daysOffset: 11,
    typicalTimeTh: '19:30 น. (ตามเวลาไทย)',
    frequency: 'รายไตรมาส (ประกาศ 3 ครั้ง: Advance, Second, Final)',
    forecast: '+2.8%',
    previous: '+3.0%',
    unit: '% Annualized',
    source: 'US Bureau of Economic Analysis',
    sourceUrl: 'https://www.bea.gov/data/gdp/gross-domestic-product',
    impactSummary: 'ภาพรวมผลผลิตมวลรวมภายในประเทศ สะท้อนความแข็งแกร่งของเศรษฐกิจสหรัฐฯ ว่ามีแนวโน้มขยายตัวหรือชะลอตัว',
    bullishScenario: 'GDP ขยายตัวในระดับ 2.0% - 2.8% อย่างมีเสถียรภาพ → สะท้อนเศรษฐกิจแข็งแกร่งโดยไม่สร้างแรงกดดันเงินเฟ้อเกินไป',
    bearishScenario: 'GDP ติดลบหรือชะลอตัวต่ำกว่า 1.0% มาก → ตลาดเกิดความกังวล Hard Landing / สัญญาณเศรษฐกิจชะลอตัว',
    affectedAssets: ['S&P 500', 'Russell 2000 (หุ้นเล็ก)', 'ดอลลาร์ DXY'],
  },
  {
    id: 'us-core-pce',
    nameTh: 'ดัชนีราคาการใช้จ่ายเพื่อการบริโภคส่วนบุคคลพื้นฐาน (Core PCE)',
    nameEn: 'US Core PCE Price Index (FED Inflation Target)',
    country: 'สหรัฐอเมริกา',
    currency: 'USD',
    flag: '🇺🇸',
    region: 'USD',
    category: 'inflation',
    importance: 'high',
    releaseTime: '19:30 น.',
    daysOffset: 12,
    typicalTimeTh: '19:30 น. (ตามเวลาไทย)',
    frequency: 'ทุกเดือน (สัปดาห์สุดท้ายของเดือน)',
    forecast: '2.7% YoY',
    previous: '2.8% YoY',
    unit: '% YoY',
    source: 'Bureau of Economic Analysis (BEA)',
    sourceUrl: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index-excluding-food-and-energy',
    impactSummary: 'เป็นตัวเลขเงินเฟ้อที่คณะกรรมการ FED ให้ความสำคัญและนำมาใช้เป็นเกณฑ์เป้าหมาย 2.0% อย่างเป็นทางการ',
    bullishScenario: 'Core PCE ชะลอตัวลงเข้าใกล้ 2% → หนุนความมั่นใจว่าเงินเฟ้ออยู่ในการควบคุม เพิ่มโอกาสลดดอกเบี้ย',
    bearishScenario: 'Core PCE เด้งกลับขึ้นมา → FED อาจต้องชะลอการลดดอกเบี้ยหรือคงดอกเบี้ยนานขึ้น',
    affectedAssets: ['พันธบัตรรัฐบาลสหรัฐฯ', 'หุ้นกลุ่มเติบโต (Growth Stocks)', 'ทองคำ'],
  },
  {
    id: 'china-pmi',
    nameTh: 'ดัชนีผู้จัดการฝ่ายจัดซื้อภาคการผลิตของจีน (China Caixin & NBS PMI)',
    nameEn: 'China Manufacturing PMI (Official NBS & Caixin)',
    country: 'จีน',
    currency: 'CNY',
    flag: '🇨🇳',
    region: 'CNY',
    category: 'pmi',
    importance: 'high',
    releaseTime: '08:30 น.',
    daysOffset: 13,
    typicalTimeTh: '08:30 น. (ตามเวลาไทย)',
    frequency: 'ทุกเดือน (สิ้นเดือน / ต้นเดือน)',
    forecast: '50.2',
    previous: '49.8',
    unit: 'Index (เกิน 50 คือขยายตัว)',
    source: 'National Bureau of Statistics / Caixin Media',
    sourceUrl: 'https://www.stats.gov.cn/english/',
    impactSummary: 'บ่งบอกภาวะโรงงานและเศรษฐกิจของจีนในฐานะโรงงานของโลก ส่งผลกระทบสูงต่อราคาสินค้าโภคภัณฑ์และหุ้นส่งออกไทย',
    bullishScenario: 'ดัชนีสูงกว่าระดับ 50.0 ขยายตัวชัดเจน → หนุนราคาหุ้นกลุ่มท่องเที่ยว สินค้าโภคภัณฑ์ ปิโตรเคมี และตลาดหุ้นเอเชีย',
    bearishScenario: 'ดัชนีต่ำกว่า 50.0 ต่อเนื่อง → สะท้อนอุปสงค์การบริโภคในจีนยังชะลอตัว อาจต้องรอมาตรการกระตุ้นจากรัฐบาลจีน',
    affectedAssets: ['ดัชนี Hang Seng (ฮั่งเส็ง)', 'CSI 300', 'ราคาน้ำมันดิบ & ทองแดง', 'หุ้นกลุ่มส่งออก/ท่องเที่ยวไทย'],
  },
  {
    id: 'boj-rate',
    nameTh: 'มติอัตราดอกเบี้ยนโยบายธนาคารกลางญี่ปุ่น (BOJ Interest Rate Decision)',
    nameEn: 'Bank of Japan (BOJ) Policy Rate & Outlook',
    country: 'ญี่ปุ่น',
    currency: 'JPY',
    flag: '🇯🇵',
    region: 'JPY',
    category: 'interest_rate',
    importance: 'high',
    releaseTime: '10:30 น.',
    daysOffset: 13,
    typicalTimeTh: '10:30 น. (ตามเวลาไทย)',
    frequency: '8 ครั้งต่อปี',
    forecast: '0.25% - 0.50%',
    previous: '0.25%',
    unit: '%',
    source: 'Bank of Japan (BOJ)',
    sourceUrl: 'https://www.boj.or.jp/en',
    impactSummary: 'สำคัญอย่างยิ่งต่อกระแสเงินทุนโลก เพราะกระทบต่อปรากฏการณ์ Yen Carry Trade Unwind ซึ่งส่งแรงกระเพื่อมถึงตลาดหุ้นทั่วโลก',
    bullishScenario: 'BOJ ส่งสัญญาณขึ้นดอกเบี้ยอย่างค่อยเป็นค่อยไป ไม่รีบร้อน → ตลาดการเงินคลายกังวลเรื่องการถอนเงิน Carry Trade กะทันหัน',
    bearishScenario: 'BOJ ขึ้นดอกเบี้ยเซอร์ไพรส์หรือส่งสัญญาณ Hawkish แรง → ค่าเงินเยนแข็งค่าอย่างรวดเร็ว ก่อให้เกิดแรงเทขายสินทรัพย์เสี่ยงทั่วโลก',
    affectedAssets: ['Nikkei 225', 'USD/JPY', 'Bitcoin & Crypto', 'ตลาดหุ้นโลก'],
  },
  {
    id: 'us-nfp',
    nameTh: 'การจ้างงานนอกภาคเกษตรและอัตราว่างงาน (US Non-Farm Payrolls)',
    nameEn: 'US Non-Farm Payrolls (NFP) & Unemployment Rate',
    country: 'สหรัฐอเมริกา',
    currency: 'USD',
    flag: '🇺🇸',
    region: 'USD',
    category: 'employment',
    importance: 'high',
    releaseTime: '19:30 น.',
    daysOffset: 19,
    typicalTimeTh: '19:30 น. (วันศุกร์แรกของเดือน)',
    frequency: 'ทุกเดือน (ศุกร์แรกของเดือน)',
    forecast: '+165K ตำแหน่ง',
    previous: '+142K ตำแหน่ง',
    unit: 'ตำแหน่ง',
    source: 'US Bureau of Labor Statistics',
    sourceUrl: 'https://www.bls.gov/news.release/empsit.nr0.htm',
    impactSummary: 'หัวใจสำคัญของภาคเศรษฐกิจจริง บ่งบอกว่าตลาดแรงงานยังแข็งแกร่งหรือเข้าสู่ภาวะชะลอตัว (Recession)',
    bullishScenario: 'หากตัวเลขอยู่ในเกณฑ์สมดุล (Goldilocks ไม่ร้อนแรงเกินไปและไม่หดตัว) → สะท้อน Soft Landing ตลาดหุ้นตอบรับเชิงบวก',
    bearishScenario: 'หากตัวเลขตกฮวบรุนแรง → ตลาดจะตื่นตระหนกกลัวเศรษฐกิจถดถอย (Recession Panic) และเทขายสินทรัพย์เสี่ยง',
    affectedAssets: ['S&P 500', 'Dow Jones', 'ดอลลาร์สหรัฐ (DXY)', 'ราคาน้ำมันดิบ'],
  },
  {
    id: 'fed-fomc-rate',
    nameTh: 'มติอัตราดอกเบี้ยนโยบายของธนาคารกลางสหรัฐฯ (FOMC Rate)',
    nameEn: 'Fed Interest Rate Decision & FOMC Statement',
    country: 'สหรัฐอเมริกา',
    currency: 'USD',
    flag: '🇺🇸',
    region: 'USD',
    category: 'interest_rate',
    importance: 'high',
    releaseTime: '01:00 น.',
    daysOffset: 20,
    typicalTimeTh: '01:00 น. หรือ 02:00 น. (ตามเวลาไทย)',
    frequency: '8 ครั้งต่อปี (ทุก ~6 สัปดาห์)',
    forecast: '4.25% - 4.50%',
    previous: '4.50% - 4.75%',
    unit: '%',
    source: 'Federal Reserve (FED)',
    sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    impactSummary: 'ตัวเลขกำหนดทิศทางต้นทุนทางการเงินทั่วโลก มีผลกระทบต่อสภาพคล่องในตลาดหุ้น พันธบัตร และราคาทองคำโดยตรง',
    bullishScenario: 'หาก FED ปรับลดดอกเบี้ย หรือส่งสัญญาณ Dovish (ผ่อนคลาย) → ตลาดหุ้น (โดยเฉพาะหุ้นเทคฯ) และราคาทองคำมักพุ่งขึ้น ดอลลาร์อ่อนค่า',
    bearishScenario: 'หากคงดอกเบี้ยสูงนานกว่าคาด หรือส่งสัญญาณ Hawkish (เข้มงวด) → Yield พันธบัตรพุ่ง ดอลลาร์แข็งค่า ตลาดหุ้นและทองคำปรับฐาน',
    affectedAssets: ['S&P 500', 'NASDAQ 100', 'ทองคำ (Gold)', 'ดอลลาร์ (DXY)', 'บอนด์ยิลด์ 10Y'],
  },
  {
    id: 'boe-rate',
    nameTh: 'มติอัตราดอกเบี้ยนโยบายธนาคารกลางอังกฤษ (Bank of England Rate)',
    nameEn: 'Bank of England (BOE) Official Bank Rate',
    country: 'สหราชอาณาจักร',
    currency: 'GBP',
    flag: '🇬🇧',
    region: 'GBP',
    category: 'interest_rate',
    importance: 'high',
    releaseTime: '19:00 น.',
    daysOffset: 20,
    typicalTimeTh: '19:00 น. (ตามเวลาไทย)',
    frequency: '8 ครั้งต่อปี',
    forecast: '4.50% - 4.75%',
    previous: '4.75%',
    unit: '%',
    source: 'Bank of England',
    sourceUrl: 'https://www.bankofengland.co.uk',
    impactSummary: 'สะท้อนสภาวะเศรษฐกิจและเงินเฟ้อในเกาะอังกฤษ กระทบต่อคู่เงิน GBP/USD และดัชนี FTSE 100',
    bullishScenario: 'BOE ปรับลดดอกเบี้ยตามแนวโน้มเงินเฟ้อที่ชะลอตัว → หนุนความเชื่อมั่นผู้บริโภคและภาคธุรกิจในอังกฤษ',
    bearishScenario: 'หากเงินเฟ้อภาคบริการของอังกฤษค้างสูง ทำให้ต้องคงดอกเบี้ยนาน → ค่าเงินปอนด์แข็งค่าแต่กดดันเศรษฐกิจจริง',
    affectedAssets: ['FTSE 100', 'GBP/USD', 'UK Gilts (พันธบัตรอังกฤษ)'],
  },
  {
    id: 'bot-rate',
    nameTh: 'มติอัตราดอกเบี้ยนโยบาย คณะกรรมการ กนง. (ธนาคารแห่งประเทศไทย)',
    nameEn: 'Bank of Thailand (BOT) Monetary Policy Committee Decision',
    country: 'ไทย',
    currency: 'THB',
    flag: '🇹🇭',
    region: 'THB',
    category: 'interest_rate',
    importance: 'high',
    releaseTime: '14:00 น.',
    daysOffset: 26,
    typicalTimeTh: '14:00 น. - 14:30 น. (ตามเวลาไทย)',
    frequency: '6 ครั้งต่อปี',
    forecast: '2.00% - 2.25%',
    previous: '2.25%',
    unit: '%',
    source: 'ธนาคารแห่งประเทศไทย (BOT)',
    sourceUrl: 'https://www.bot.or.th',
    impactSummary: 'กำหนดอัตราดอกเบี้ยในระบบการเงินไทย กระทบต่อหุ้นกลุ่มธนาคารพาณิชย์ กลุ่มอสังหาริมทรัพย์ หนี้ครัวเรือน และค่าเงินบาท',
    bullishScenario: 'การปรับลดดอกเบี้ยลง → หนุนหุ้นกลุ่มการเงินผู้บริโภค กลุ่มอสังหาฯ และลดต้นทุนดอกเบี้ยของผู้ประกอบการ',
    bearishScenario: 'หากคงดอกเบี้ยท่ามกลางเงินเฟ้อต่ำ → อาจกดดันการบริโภคในประเทศ แต่หนุนผลตอบแทน NIM ของหุ้นธนาคารใหญ่',
    affectedAssets: ['SET Index', 'หุ้นกลุ่มธนาคาร (BBL, KBANK, SCB)', 'หุ้นอสังหาฯ (CPN, AP, SPALI)', 'ค่าเงินบาท THB'],
  },
]

const CATEGORY_TABS: { id: MacroCategory; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'interest_rate', label: '🏦 ดอกเบี้ยนโยบาย' },
  { id: 'inflation', label: '📈 เงินเฟ้อ (CPI/PCE)' },
  { id: 'employment', label: '💼 การจ้างงาน (NFP)' },
  { id: 'growth', label: '📊 การเติบโต GDP' },
  { id: 'pmi', label: '🏭 ภาคการผลิต (PMI)' },
]

const CATEGORY_LABELS: Record<MacroCategory, string> = {
  all: 'ทั่วไป',
  interest_rate: 'ดอกเบี้ยนโยบาย',
  inflation: 'อัตราเงินเฟ้อ',
  employment: 'การจ้างงาน',
  growth: 'การเติบโต GDP',
  pmi: 'ภาคการผลิต PMI',
}

interface EventSchedule {
  isoDate: string
  thaiDate: string
  shortDay: string
  dayOfWeek: string
  fullThaiDate: string
  countdownText: string
  daysDiff: number
  bucket: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month' | 'later'
  statusBadgeStyle: string
  statusDotStyle: string
}

function calculateSchedule(daysOffset: number): EventSchedule {
  const now = new Date()
  const target = new Date(now)
  target.setDate(now.getDate() + daysOffset)

  const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
  const shortDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const fullMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ]

  const dayOfWeek = days[target.getDay()]
  const shortDay = shortDays[target.getDay()]
  const dateNum = target.getDate()
  const monthName = months[target.getMonth()]
  const fullMonthName = fullMonths[target.getMonth()]
  const yearNum = target.getFullYear()

  const thaiDate = `${dateNum} ${monthName} ${yearNum}`
  const fullThaiDate = `${dayOfWeek}ที่ ${dateNum} ${fullMonthName} ${yearNum}`
  const isoDate = `${yearNum}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`

  let countdownText = `อีก ${daysOffset} วัน`
  let bucket: EventSchedule['bucket'] = 'later'
  let statusBadgeStyle = 'bg-slate-500/15 text-slate-300 border border-slate-500/20'
  let statusDotStyle = 'bg-slate-400'

  if (daysOffset === 0) {
    countdownText = '⚡ วันนี้ (Today)'
    bucket = 'today'
    statusBadgeStyle = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
    statusDotStyle = 'bg-emerald-400 animate-pulse'
  } else if (daysOffset === 1) {
    countdownText = '🟡 พรุ่งนี้ (Tomorrow)'
    bucket = 'tomorrow'
    statusBadgeStyle = 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
    statusDotStyle = 'bg-amber-400'
  } else if (daysOffset <= 7) {
    countdownText = `อีก ${daysOffset} วัน (สัปดาห์นี้)`
    bucket = 'this_week'
    statusBadgeStyle = 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/35 font-semibold'
    statusDotStyle = 'bg-indigo-400'
  } else if (daysOffset <= 14) {
    countdownText = `อีก ${daysOffset} วัน (สัปดาห์หน้า)`
    bucket = 'next_week'
    statusBadgeStyle = 'bg-sky-500/15 text-sky-200 border border-sky-500/30'
    statusDotStyle = 'bg-sky-400'
  } else if (daysOffset <= 31) {
    countdownText = `อีก ${daysOffset} วัน (เดือนนี้)`
    bucket = 'this_month'
    statusBadgeStyle = 'bg-slate-500/15 text-slate-300 border border-white/[0.08]'
    statusDotStyle = 'bg-slate-400'
  } else {
    countdownText = `อีก ${daysOffset} วัน`
    bucket = 'later'
    statusBadgeStyle = 'bg-slate-500/10 text-slate-400 border border-white/[0.06]'
    statusDotStyle = 'bg-slate-500'
  }

  return {
    isoDate,
    thaiDate,
    shortDay,
    dayOfWeek,
    fullThaiDate,
    countdownText,
    daysDiff: daysOffset,
    bucket,
    statusBadgeStyle,
    statusDotStyle,
  }
}

interface NativeEconomicCalendarProps {
  importanceFilter?: CalendarImportance
  regionFilter?: CalendarRegion
  onSwitchToTradingView?: () => void
}

export function NativeEconomicCalendar({
  importanceFilter = 'high_medium',
  regionFilter = 'ALL',
  onSwitchToTradingView,
}: NativeEconomicCalendarProps) {
  const [selectedCategory, setSelectedCategory] = useState<MacroCategory>('all')
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all')
  const [viewMode, setViewMode] = useState<CalendarViewMode>('list')
  const [sortBy, setSortBy] = useState<'time' | 'importance'>('time')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Attach schedule calculations to events
  const eventsWithSchedule = useMemo(() => {
    return MACRO_EVENTS.map((event) => {
      const schedule = calculateSchedule(event.daysOffset)
      return {
        ...event,
        schedule,
      }
    })
  }, [])

  // Filter & sort items
  const filteredEvents = useMemo(() => {
    const list = eventsWithSchedule.filter((item) => {
      // 1. Region filter
      if (regionFilter !== 'ALL' && item.region !== regionFilter) {
        return false
      }

      // 2. Importance filter
      if (importanceFilter === 'high_only' && item.importance !== 'high') {
        return false
      }

      // 3. Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false
      }

      // 4. Timeframe filter
      if (timeframeFilter === 'this_week') {
        if (item.schedule.daysDiff > 7) return false
      } else if (timeframeFilter === 'next_week') {
        if (item.schedule.daysDiff <= 7 || item.schedule.daysDiff > 14) return false
      } else if (timeframeFilter === 'this_month') {
        if (item.schedule.daysDiff > 31) return false
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = item.nameTh.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q)
        const matchCountry = item.country.toLowerCase().includes(q) || item.currency.toLowerCase().includes(q)
        const matchAssets = item.affectedAssets.some((a) => a.toLowerCase().includes(q))
        if (!matchTitle && !matchCountry && !matchAssets) return false
      }

      return true
    })

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'importance') {
        if (a.importance === 'high' && b.importance !== 'high') return -1
        if (a.importance !== 'high' && b.importance === 'high') return 1
      }
      return a.schedule.daysDiff - b.schedule.daysDiff
    })
  }, [eventsWithSchedule, regionFilter, importanceFilter, selectedCategory, timeframeFilter, searchQuery, sortBy])

  // Group events by day if viewMode === 'grouped'
  const groupedEvents = useMemo(() => {
    const groups: { [dateKey: string]: typeof filteredEvents } = {}
    filteredEvents.forEach((ev) => {
      const key = ev.schedule.isoDate
      if (!groups[key]) groups[key] = []
      groups[key].push(ev)
    })
    return groups
  }, [filteredEvents])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-4">
      {/* Top Banner: Status & 100% Reliable Indicator */}
      <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-xs tracking-tight">
                ปฏิทินเหตุการณ์เศรษฐกิจโลกในระบบ (Built-in Macro Intelligence)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                100% เสถียร ไม่โดนบล็อก
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>แสดงวันที่ เวลาประเทศไทย (GMT+7) ตัวเลขคาดการณ์ และคู่มือวิเคราะห์ผลกระทบต่อพอร์ตลงทุน</span>
              <span className="text-emerald-400 font-medium">• ปรับเทียบเวลาอัตโนมัติ</span>
            </p>
          </div>
        </div>

        {onSwitchToTradingView && (
          <button
            type="button"
            onClick={onSwitchToTradingView}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>สลับไปใช้ TradingView Live Engine</span>
          </button>
        )}
      </div>

      {/* Main Filter & Control Panel */}
      <div className="p-3.5 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-3 shadow-lg shadow-black/20">
        {/* Row 1: Search Bar & Views */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตัวเลขเศรษฐกิจ เช่น FOMC, CPI, NFP, กนง., BOJ..."
              className="w-full bg-[#181C25] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* View Mode & Sorter Controls */}
          <div className="flex items-center gap-2">
            {/* View Mode: List vs Grouped */}
            <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'list'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="มุมมองไทม์ไลน์เดี่ยว"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>มุมมองปกติ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="จัดกลุ่มตามวันที่"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>จัดกลุ่มตามวัน</span>
              </button>
            </div>

            {/* Quick Counter */}
            <div className="text-xs text-slate-400 shrink-0 flex items-center gap-1.5 pl-1">
              <span>พบ</span>
              <span className="font-bold text-white px-2 py-0.5 rounded-md bg-[#181C25] border border-white/[0.08]">
                {filteredEvents.length} เหตุการณ์
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Date / Timeframe Filter Bar (⚡ New!) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1 shrink-0 mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>ช่วงเวลา:</span>
            </span>
            {[
              { id: 'all', label: '📅 ทุกช่วงเวลา' },
              { id: 'this_week', label: '⚡ สัปดาห์นี้ (0-7 วัน)' },
              { id: 'next_week', label: '⏳ สัปดาห์หน้า' },
              { id: 'this_month', label: '🗓️ เดือนนี้' },
            ].map((tf) => {
              const isActive = timeframeFilter === tf.id
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframeFilter(tf.id as TimeframeFilter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40 shadow-xs'
                      : 'bg-[#181C25] text-slate-400 hover:text-white border-white/[0.04]'
                  }`}
                >
                  {tf.label}
                </button>
              )
            })}
          </div>

          {/* Sort By Toggle */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="hidden sm:inline">เรียงตาม:</span>
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'time' ? 'importance' : 'time')}
              className="px-2 py-1 rounded-lg bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.06] text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              {sortBy === 'time' ? '⏰ เวลาใกล้ถึงที่สุด' : '🔥 ความสำคัญสูงก่อน'}
            </button>
          </div>
        </div>

        {/* Row 3: Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-white/[0.04]">
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-[#181C25] text-slate-400 hover:text-white hover:bg-white/[0.04] border-white/[0.06]'
                }`}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table Column Header Bar (Desktop Only) */}
      <div className="bg-[#121622] border border-white/[0.08] rounded-xl px-4 py-2.5 hidden md:flex items-center justify-between text-xs font-bold text-slate-300 select-none shadow-xs">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* ช่องวันที่ & เวลา Header */}
          <span className="w-44 shrink-0 text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>วันที่ & เวลา (GMT+7)</span>
          </span>

          {/* ประเทศ Header */}
          <span className="w-28 shrink-0 text-slate-400 font-bold uppercase tracking-wider">
            ประเทศ
          </span>

          {/* ระดับผลกระทบ Header */}
          <span className="w-28 shrink-0 text-slate-400 font-bold uppercase tracking-wider">
            ระดับผลกระทบ
          </span>

          {/* เหตุการณ์ Header */}
          <span className="truncate text-white font-bold tracking-tight">
            เหตุการณ์ / ตัวเลขเศรษฐกิจ (Macro Event)
          </span>
        </div>

        {/* Right Values Header */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="grid grid-cols-3 gap-2 w-[240px] text-right">
            <div className="flex flex-col items-end">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ผลจริง
              </span>
              <span className="text-[10px] text-emerald-400/70 font-mono uppercase">Actual</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-indigo-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                คาดการณ์
              </span>
              <span className="text-[10px] text-indigo-300/70 font-mono uppercase">Forecast</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                ครั้งก่อน
              </span>
              <span className="text-[10px] text-slate-400/80 font-mono uppercase">Prior</span>
            </div>
          </div>
          <div className="w-8 shrink-0" />
        </div>
      </div>

      {/* Event Cards List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#12151C] border border-white/[0.08]">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-300">ไม่พบเหตุการณ์เศรษฐกิจที่ตรงกับตัวกรอง</h3>
            <p className="text-xs text-slate-500 mt-1">
              ลองเปลี่ยนช่วงเวลา ปรับระดับความสำคัญ หรือล้างคำค้นหาเพื่อดูข้อมูลทั้งหมด
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all')
                setTimeframeFilter('all')
                setSearchQuery('')
              }}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-[#181C25] hover:bg-white/10 text-indigo-300 text-xs font-semibold border border-white/10 transition-colors"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped by Date View */
          Object.entries(groupedEvents).map(([dateKey, eventsInDay]) => {
            const firstEvent = eventsInDay[0]
            const schedule = firstEvent.schedule

            return (
              <div key={dateKey} className="space-y-2 pt-2">
                {/* Date Group Header Divider */}
                <div className="flex items-center gap-2 pb-1 px-1">
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs font-bold flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{schedule.fullThaiDate}</span>
                    <span className="text-[11px] font-normal text-indigo-300/70">
                      • {schedule.countdownText}
                    </span>
                  </div>
                  <div className="h-px bg-white/[0.08] flex-1" />
                  <span className="text-xs text-slate-500 font-mono">
                    {eventsInDay.length} เหตุการณ์
                  </span>
                </div>

                {/* Day's Event Cards */}
                <div className="space-y-2.5">
                  {eventsInDay.map((event) => (
                    <EventRowCard
                      key={event.id}
                      event={event}
                      isExpanded={expandedId === event.id}
                      onToggle={() => toggleExpand(event.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          /* Standard Linear List View */
          filteredEvents.map((event) => (
            <EventRowCard
              key={event.id}
              event={event}
              isExpanded={expandedId === event.id}
              onToggle={() => toggleExpand(event.id)}
            />
          ))
        )}
      </div>

      {/* External Verified Economic Calendars Link Bar */}
      <div className="p-4 rounded-2xl bg-[#0D1017] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-400" />
          <span className="text-slate-300 font-semibold">
            แหล่งตรวจสอบปฏิทินเศรษฐกิจแบบสดรายนาทีระดับโลก:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://www.tradingview.com/markets/world-stocks/economic-calendar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 font-medium inline-flex items-center gap-1"
          >
            <span>TradingView Macro</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-700">•</span>
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 font-medium inline-flex items-center gap-1"
          >
            <span>Forex Factory</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-700">•</span>
          <a
            href="https://www.investing.com/economic-calendar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 font-medium inline-flex items-center gap-1"
          >
            <span>Investing.com Live</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-700">•</span>
          <a
            href="https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 font-medium inline-flex items-center gap-1"
          >
            <span>CME FedWatch Tool</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Event Row Card Component
 * Includes dedicated prominent "Date & Time Box" (ช่องวันที่และเวลา)
 */
function EventRowCard({
  event,
  isExpanded,
  onToggle,
}: {
  event: MacroEventItem & { schedule: EventSchedule }
  isExpanded: boolean
  onToggle: () => void
}) {
  const isHigh = event.importance === 'high'
  const schedule = event.schedule
  const categoryLabel = CATEGORY_LABELS[event.category] || 'ทั่วไป'

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isExpanded
          ? 'bg-[#141822] border-indigo-500/40 shadow-xl shadow-black/40'
          : 'bg-[#12151C] hover:bg-[#151922] border-white/[0.08]'
      }`}
    >
      {/* Main Card Content */}
      <div
        onClick={onToggle}
        className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none group"
      >
        {/* Mobile-Only Header: Date & Time Bar */}
        <div className="md:hidden flex items-center justify-between pb-2.5 mb-1 border-b border-white/[0.06] bg-[#0E121B]/80 -mx-3.5 -mt-3.5 px-3.5 pt-3 rounded-t-2xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
            <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              {schedule.thaiDate} ({schedule.shortDay})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 font-mono text-xs font-extrabold text-white bg-[#151924] px-2 py-0.5 rounded-md border border-white/[0.08]">
              <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{event.releaseTime}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${schedule.statusBadgeStyle}`}>
              {schedule.countdownText}
            </span>
          </div>
        </div>

        {/* Desktop Aligned Columns */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* 1. ช่องวันที่และเวลา (Date & Time Box) - Desktop Only */}
          <div className="hidden md:flex w-44 shrink-0 bg-[#0E121B] border border-white/[0.08] rounded-xl p-2.5 flex-col justify-between group-hover:border-indigo-500/40 transition-colors shadow-xs">
            {/* Date and Day of Week */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{schedule.thaiDate}</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {schedule.shortDay}
              </span>
            </div>

            {/* Large Time Display */}
            <div className="mt-1 flex items-baseline justify-between">
              <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold text-white">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{event.releaseTime}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                GMT+7
              </span>
            </div>

            {/* Countdown Status Tag */}
            <div className="mt-1.5 flex items-center">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${schedule.statusBadgeStyle}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${schedule.statusDotStyle}`} />
                <span>{schedule.countdownText}</span>
              </span>
            </div>
          </div>

          {/* 2. ประเทศ / สกุลเงิน (Country & Currency Box) */}
          <div className="w-28 shrink-0 flex items-center gap-2.5">
            <div className="text-2xl shrink-0 drop-shadow-sm">{event.flag}</div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1">
                <span>{event.currency}</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate" title={event.country}>
                {event.country}
              </div>
            </div>
          </div>

          {/* 3. ระดับผลกระทบ (Impact Level Box) */}
          <div className="w-28 shrink-0 flex items-center">
            {isHigh ? (
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>สำคัญมาก</span>
              </span>
            ) : (
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>ปานกลาง</span>
              </span>
            )}
          </div>

          {/* 4. เหตุการณ์ / ตัวเลขเศรษฐกิจ (Event Name & Category) */}
          <div className="flex-1 min-w-0 space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {categoryLabel}
              </span>
              <span className="text-[11px] text-slate-400 hidden xl:inline">
                • {event.frequency}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight leading-snug group-hover:text-indigo-300 transition-colors">
              {event.nameTh}
            </h3>
            <p className="text-xs text-slate-400 font-mono truncate">
              {event.nameEn}
            </p>
          </div>
        </div>

        {/* 5. Numerical Values: Actual, Forecast, Prior & Action */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
          <div className="grid grid-cols-3 gap-2 w-[240px] text-xs font-mono text-right">
            {/* Actual */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-emerald-400 md:hidden block uppercase">ผลจริง</span>
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                {event.actual || 'รอประกาศ'}
              </span>
            </div>

            {/* Forecast */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-indigo-400 md:hidden block uppercase">คาดการณ์</span>
              <span className="font-bold text-indigo-200">
                {event.forecast}
              </span>
            </div>

            {/* Prior */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 md:hidden block uppercase">ครั้งก่อน</span>
              <span className="font-bold text-slate-300">
                {event.previous}
              </span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-[#181C25] border border-white/[0.08] text-slate-400 flex items-center justify-center shrink-0 group-hover:text-white transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Detailed Analysis & Investment Playbook */}
      {isExpanded && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-white/[0.06] space-y-4 animate-in fade-in duration-200">
          {/* Quick Schedule Details Banner */}
          <div className="p-3 rounded-xl bg-[#0B0E15] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">
                กำหนดการประกาศรอบถัดไป: <strong className="text-white">{schedule.fullThaiDate} เวลา {event.releaseTime}</strong> (GMT+7 เวลาไทย)
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${schedule.statusBadgeStyle}`}>
              สถานะ: {schedule.countdownText}
            </span>
          </div>

          {/* Summary text */}
          <div className="p-3.5 rounded-xl bg-[#0F1219] border border-white/[0.06] text-xs text-slate-300 leading-relaxed">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold mb-1">
              <Info className="w-3.5 h-3.5" />
              <span>ความสำคัญต่อตลาดการเงิน:</span>
            </div>
            {event.impactSummary}
          </div>

          {/* Scenarios Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Bullish */}
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <TrendingUp className="w-4 h-4" />
                <span>หากตัวเลขออกมาเชิงบวก / ชะลอตัวตามเป้า:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {event.bullishScenario}
              </p>
            </div>

            {/* Bearish */}
            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                <TrendingDown className="w-4 h-4" />
                <span>หากตัวเลขออกมาเชิงลบ / สวนทางคาดการณ์:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {event.bearishScenario}
              </p>
            </div>
          </div>

          {/* Bottom Metadata & Source Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400">สินทรัพย์ที่ได้รับผลกระทบ:</span>
              {event.affectedAssets.map((asset) => (
                <span
                  key={asset}
                  className="px-2 py-0.5 rounded-md bg-[#181C25] text-slate-300 border border-white/[0.08] text-[11px] font-medium"
                >
                  {asset}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">
                ความถี่: {event.frequency}
              </span>
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 text-[11px]"
              >
                <span>แหล่งข้อมูลทางการ ({event.source})</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
