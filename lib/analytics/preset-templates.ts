/**
 * lib/analytics/preset-templates.ts
 * World-class institutional investment portfolio templates for quick adoption.
 */

export interface StrategyTemplate {
  id: string
  name: string
  subtitle: string
  description: string
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
  iconEmoji: string
  recommendedHorizon: string
  targetAllocation: Record<string, number>
  rationale: string
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'core-satellite',
    name: 'Core-Satellite Strategy (สมดุลเติบโตมั่นคง)',
    subtitle: 'กองทุนดัชนีหลัก 70% + หุ้นดาวรุ่ง 20% + กระสุนเงินสด 10%',
    description: 'เน้นความมั่นคงจาก Core Index ผสานกับผลตอบแทนส่วนเพิ่ม (Alpha) จากหุ้นเทคโนโลยีหรือหุ้นศักยภาพสูง',
    riskProfile: 'moderate',
    iconEmoji: '🛰️',
    recommendedHorizon: '5-10 ปีขึ้นไป',
    targetAllocation: {
      VOO: 45,
      SCHD: 25,
      GOOGL: 10,
      NVDA: 10,
      CASH: 10,
    },
    rationale: 'สร้างความมั่งคั่งระยะยาวด้วยค่าธรรมเนียมต่ำ ลดความผันผวนด้วยเงินปันผล และเปิดโอกาสเติบโตตามเมกะเทรนด์ AI',
  },
  {
    id: 'growth-dividend-barbell',
    name: 'Growth & Dividend Barbell (คานคู่เติบโตและปันผล)',
    subtitle: 'หุ้นเติบโตสูง 50% + กองทุนปันผลแกร่ง 35% + เงินสดสำรอง 15%',
    description: 'กลยุทธ์ Barbell ระดับสถาบัน: ใช้หุ้นปันผลและเงินสดเป็นเกราะป้องกัน แล้วใช้หุ้น Growth วิ่งทำกำไร',
    riskProfile: 'moderate',
    iconEmoji: '🏋️',
    recommendedHorizon: '5 ปีขึ้นไป',
    targetAllocation: {
      VOO: 30,
      SCHD: 25,
      VYM: 10,
      MSFT: 10,
      GOOGL: 10,
      CASH: 15,
    },
    rationale: 'กระแสเงินปันผลต่อเนื่องช่วยให้จิตใจมั่นคงในยามตลาดปรับฐาน และมีเงินสดพร้อมช้อนซื้อเมื่อราคาหุ้นเติบโตย่อตัว',
  },
  {
    id: 'warren-buffett-90-10',
    name: 'Warren Buffett 90/10 (เรียบง่ายทรงพลัง)',
    subtitle: 'ดัชนี S&P 500 (90%) + ตราสารหนี้ระยะสั้น/เงินสด (10%)',
    description: 'สูตรพอร์ตที่ Warren Buffett แนะนำให้ครอบครัว: ลงทุนในพลังของเศรษฐกิจสหรัฐ 90% และถือสภาพคล่อง 10%',
    riskProfile: 'aggressive',
    iconEmoji: '💼',
    recommendedHorizon: '10 ปีขึ้นไป',
    targetAllocation: {
      VOO: 90,
      CASH: 10,
    },
    rationale: 'เอาชนะกองทุนส่วนใหญ่ในระยะยาวด้วยการเกาะไปกับเศรษฐกิจสหรัฐแบบ Passive ต้นทุนต่ำสุด',
  },
  {
    id: 'ray-dalio-all-weather',
    name: 'Ray Dalio All-Weather (ทนทานทุกสภาวะเศรษฐกิจ)',
    subtitle: 'หุ้น 30% + พันธบัตรระยะยาว 40% + พันธบัตรกลาง 15% + ทองคำ 7.5% + โภคภัณฑ์ 7.5%',
    description: 'ออกแบบโดย Bridgewater Associates เพื่อสร้างผลตอบแทนสม่ำเสมอในทุกสภาพเศรษฐกิจ (เงินเฟ้อ/เงินฝืด/เศรษฐกิจโต/ถดถอย)',
    riskProfile: 'conservative',
    iconEmoji: '🛡️',
    recommendedHorizon: '3-7 ปีขึ้นไป',
    targetAllocation: {
      VOO: 30,
      TLT: 40,
      IEF: 15,
      GOLD: 7.5,
      DBC: 7.5,
    },
    rationale: 'กระจายความเสี่ยงข้ามสินทรัพย์ที่มีความสัมพันธ์ต่ำเพื่อลด Maximum Drawdown ให้น้อยที่สุดแม้เกิดวิกฤต',
  },
  {
    id: 'bogleheads-3-fund',
    name: 'Bogleheads 3-Fund Portfolio (คลาสสิกข้ามโลก)',
    subtitle: 'หุ้นสหรัฐ 60% + หุ้นทั่วโลก 20% + ตราสารหนี้รวม 20%',
    description: 'หลักการของ Jack Bogle ผู้ก่อตั้ง Vanguard: กระจายการลงทุนไปทั่วโลกเพื่อตัดความเสี่ยงเฉพาะประเทศ',
    riskProfile: 'moderate',
    iconEmoji: '🌐',
    recommendedHorizon: '5-15 ปีขึ้นไป',
    targetAllocation: {
      VTI: 60,
      VXUS: 20,
      BND: 20,
    },
    rationale: 'ครอบคลุมหุ้นและตราสารหนี้ทั่วโลกหลายพันตัว กระจายความเสี่ยงระดับสากล',
  },
  {
    id: 'crypto-growth-satellite',
    name: 'Tech & Digital Alpha (พอร์ตสายเติบโตยุคใหม่)',
    subtitle: 'หุ้นเทคโนโลยี 60% + คริปโตบลูชิป 20% + กระสุนเงินสด 20%',
    description: 'สำหรับนักลงทุนที่รับความผันผวนได้สูง มุ่งเน้นสร้างผลตอบแทนก้าวกระโดดจากเทคโนโลยีแห่งอนาคตและสินทรัพย์ดิจิทัล',
    riskProfile: 'aggressive',
    iconEmoji: '🚀',
    recommendedHorizon: '3-5 ปีขึ้นไป',
    targetAllocation: {
      QQQ: 40,
      NVDA: 20,
      BTC: 15,
      ETH: 5,
      CASH: 20,
    },
    rationale: 'สัดส่วนเงินสด 20% สำคัญอย่างยิ่งในการลดความผันผวนและรอจังหวะสะสมช่วง Crypto & Tech Dip',
  },
]
