'use client'

import React from 'react'
import {
  X,
  CheckCircle2,
  Compass,
  Wallet,
  Target,
  TrendingUp,
  FileText,
  Sparkles,
  Info,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  AlertCircle,
  Coins,
  Globe2,
} from 'lucide-react'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
  category?: 'routine' | 'action' | 'review'
}

interface ChecklistDetailModalProps {
  isOpen: boolean
  item: ChecklistItem | null
  onClose: () => void
  onConfirmComplete: (id: string, newDoneState?: boolean) => void
  marketOverview?: {
    regime?: {
      title: string
      description: string
      color: string
      bg: string
    }
    benchmarks?: Array<{
      symbol: string
      name: string
      price: number
      changePercent: number
      currency: string
    }>
  }
  portfolioTriggers?: Array<{
    ticker: string
    assetName: string
    currentPrice: number
    rsi14: number | null
    supportS1: number | null
    actionTag: string
    distanceToS1Percent: number | null
    currency?: string
    market?: string
  }>
  totalCash?: number
  totalPortfolioValue?: number
  baseCurrency?: string
}

export function ChecklistDetailModal({
  isOpen,
  item,
  onClose,
  onConfirmComplete,
  marketOverview,
  portfolioTriggers = [],
  totalCash = 0,
  totalPortfolioValue = 0,
  baseCurrency = 'THB',
}: ChecklistDetailModalProps) {
  if (!isOpen || !item) return null

  // Determine which standard routine item this corresponds to
  const text = item.text.trim()
  const isItem1 = text.includes('ดัชนีตลาดโลก') || text.includes('แนวโน้มทิศทาง')
  const isItem2 = text.includes('สภาพคล่องเงินสด') || text.includes('Dry Powder')
  const isItem3 = text.includes('สแกนหุ้นในพอร์ต') || text.includes('Key Support') || text.includes('แนวรับสำคัญ')
  const isItem4 = text.includes('วางแผนจุดรับซื้อ') || text.includes('Limit Order') || text.includes('กรอบราคา')
  const isItem5 = text.includes('บันทึกสรุปผล') || text.includes('Trading Journal')

  // Calculate Cash Ratio
  const cashRatio = totalPortfolioValue > 0 ? ((totalCash / totalPortfolioValue) * 100).toFixed(1) : '0'

  const handleCompleteAndClose = () => {
    onConfirmComplete(item.id, true)
    onClose()
  }

  const handleToggleUndone = () => {
    onConfirmComplete(item.id, false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 md:p-7 flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                isItem1
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : isItem2
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isItem3
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : isItem4
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isItem5
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              }`}
            >
              {isItem1 && <Globe2 className="w-6 h-6" />}
              {isItem2 && <Wallet className="w-6 h-6" />}
              {isItem3 && <Target className="w-6 h-6" />}
              {isItem4 && <TrendingUp className="w-6 h-6" />}
              {isItem5 && <FileText className="w-6 h-6" />}
              {!isItem1 && !isItem2 && !isItem3 && !isItem4 && !isItem5 && <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {isItem1 && 'ขั้นตอนที่ 1 • วิเคราะห์ภาพรวมตลาด'}
                {isItem2 && 'ขั้นตอนที่ 2 • ตรวจสอบกระสุนเงินสด'}
                {isItem3 && 'ขั้นตอนที่ 3 • คัดกรองหุ้นแตะแนวรับ'}
                {isItem4 && 'ขั้นตอนที่ 4 • กลยุทธ์ส่งคำสั่งซื้อ'}
                {isItem5 && 'ขั้นตอนที่ 5 • บันทึกวินัยการลงทุน'}
                {!isItem1 && !isItem2 && !isItem3 && !isItem4 && !isItem5 && 'แผนปฏิบัติการลงทุนประจำวัน'}
              </span>
              <h3 className="text-lg md:text-xl font-bold text-white leading-snug mt-0.5">
                {item.text}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Detailed Guidance */}
        <div className="py-5 space-y-5 text-sm text-slate-200">
          {/* ITEM 1: ตรวจเช็กดัชนีตลาดโลก */}
          {isItem1 && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-white/[0.06] rounded-2xl p-4">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                  สภาวะตลาดปัจจุบัน (Market Regime)
                </span>
                <p className="text-base font-bold text-white">
                  {marketOverview?.regime?.title || 'ตลาดทรงตัวในกรอบ (Consolidation)'}
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {marketOverview?.regime?.description ||
                    'ตรวจสอบการปิดตัวของตลาดสหรัฐฯ เมื่อคืน ทิศทางดัชนี S&P 500, NASDAQ และอัตราผลตอบแทนพันธบัตร'}
                </p>
              </div>

              {marketOverview?.benchmarks && marketOverview.benchmarks.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-2">
                    ดัชนีชี้นำล่าสุด:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {marketOverview.benchmarks.slice(0, 5).map((b, i) => (
                      <div
                        key={i}
                        className="bg-slate-950/50 border border-white/[0.05] rounded-xl p-2.5 flex flex-col justify-between"
                      >
                        <span className="text-[11px] text-slate-400 font-medium truncate">{b.symbol}</span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xs font-bold text-white font-mono">
                            {b.price?.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] font-bold font-mono ${
                              b.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {b.changePercent >= 0 ? '+' : ''}
                            {b.changePercent?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                <span className="text-xs font-bold text-blue-300 block">สิ่งที่ต้องเช็กก่อนเริ่มวัน:</span>
                <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                  <li>ดูแนวโน้มว่าตลาดอยู่ในโหมด Risk-On (กล้าเสี่ยง) หรือ Risk-Off (ระมัดระวัง)</li>
                  <li>ตรวจสอบว่ามีรายงานตัวเลขเศรษฐกิจสำคัญคืนนี้หรือไม่ (เช่น CPI, ดอกเบี้ย Fed)</li>
                  <li>ประเมินว่าควรชะลอการซื้อหรือเตรียมช้อนซื้อที่แนวรับ</li>
                </ul>
              </div>
            </div>
          )}

          {/* ITEM 2: ตรวจสอบสภาพคล่องเงินสดสำรอง (Dry Powder) */}
          {isItem2 && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-emerald-500/20 rounded-2xl p-4.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                    เงินสดสำรองพร้อมลงทุน (Dry Powder)
                  </span>
                  <p className="text-2xl font-black text-white font-mono mt-1">
                    ฿{Number(totalCash).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    คิดเป็นสัดส่วน <strong className="text-emerald-300">{cashRatio}%</strong> ของมูลค่าพอร์ตรวม
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <Coins className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                <span className="text-xs font-bold text-emerald-300 block">
                  เกณฑ์การบริหารสภาพคล่องเงินสดสถาบัน:
                </span>
                <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                  <li>
                    รักษาสัดส่วนเงินสด <strong>10% - 20%</strong> เพื่อความคล่องตัวในการช้อนซื้อของถูก (Dip Buy)
                  </li>
                  <li>
                    หากสัดส่วนเงินสดต่ำกว่า 5% ควรงดไล่ซื้อ และเน้นทยอยเติมเงินสดตามรอบ DCA
                  </li>
                  <li>ตรวจสอบยอดเงินในบัญชีโบรกเกอร์ (เช่น Dime, InnovestX, พอร์ตหุ้นไทย) ให้พร้อมส่งคำสั่ง</li>
                </ul>
              </div>
            </div>
          )}

          {/* ITEM 3: สแกนหุ้นในพอร์ตที่ลงมาแตะแนวรับสำคัญ (Key Support S1/SMA) */}
          {isItem3 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                คัดกรองหุ้นในพอร์ตที่มีความได้เปรียบทางเทคนิคอล โดยพิจารณาจากราคาที่ย่อตัวลงมาใกล้แนวรับ Pivot S1 หรือ RSI อยู่ในเขต Oversold (≤ 35):
              </p>

              {portfolioTriggers.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-cyan-400 block">
                    สินทรัพย์ในพอร์ตที่ส่งสัญญาณ ({portfolioTriggers.length} รายการ):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {portfolioTriggers.map((t, idx) => {
                      const isThai =
                        t.currency === 'THB' ||
                        t.market === 'TH' ||
                        t.market === 'SET' ||
                        t.ticker.endsWith('.BK') ||
                        t.ticker === 'SCB'
                      const sym = isThai ? '฿' : '$'
                      return (
                        <div
                          key={idx}
                          className="bg-slate-950/70 border border-white/[0.06] rounded-xl p-3 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white font-mono text-sm">{t.ticker}</span>
                            <span className="text-xs font-mono font-bold text-cyan-300">
                              {sym}{t.currentPrice}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                            <span>RSI: {t.rsi14 ?? 'N/A'}</span>
                            <span>S1: {t.supportS1 ? `${sym}${t.supportS1}` : 'N/A'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 truncate">
                            {t.actionTag}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/50 border border-white/[0.05] rounded-xl p-3 text-xs text-slate-400 text-center">
                  ยังไม่มีหุ้นที่แตะแนวรับลึกในวันนี้ — หุ้นส่วนใหญ่แกว่งตัวในกรอบปกติ
                </div>
              )}

              <div className="space-y-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 text-xs text-slate-300">
                <span className="font-bold text-cyan-300 block">แนวทางปฏิบัติ:</span>
                <p>• ให้ความสำคัญกับหุ้นที่มีสัดส่วนขาดเป้าและกราฟลงมาแตะแนวรับพร้อมกัน (Double Confirmation)</p>
                <p>• หากตัวไหน RSI สูงเกิน 68 (Overbought) ให้หลีกเลี่ยงการซื้อเพิ่ม</p>
              </div>
            </div>
          )}

          {/* ITEM 4: วางแผนจุดรับซื้อและตั้ง Limit Order ตามกรอบราคา */}
          {isItem4 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                การตั้งคำสั่งซื้อล่วงหน้าแบบ Limit Order ที่แนวรับ ช่วยลดอิทธิพลของอารมณ์ และป้องกันการไล่ราคาในช่วงที่ตลาดเปิดผันผวน:
              </p>

              <div className="bg-slate-950/70 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  กฎเหล็ก 3 ข้อในการวางคำสั่งซื้อ:
                </span>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-400">1.</span>
                    <span><strong>ตั้ง Limit Order ที่แนวรับ S1:</strong> หลีกเลี่ยง Market Order ในช่วง 15 นาทีแรกที่ตลาดเปิด</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-400">2.</span>
                    <span><strong>แบ่งไม้เข้าซื้อ (Scaling-in):</strong> แบ่งเงินเป็น 2-3 ไม้ เช่น ไม้แรกที่ S1, ไม้สองที่ S2</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-400">3.</span>
                    <span><strong>กำหนดอายุคำสั่ง:</strong> ตรวจสอบว่าตั้งคำสั่งแบบ Day Order หรือ GTC (Good-Til-Cancelled)</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200">
                💡 <strong>เคล็ดลับ:</strong> เมื่อเปิดแอปพลิเคชัน Streaming หรือ Dime ให้ป้อนราคา Limit ที่ได้จากระบบวิเคราะห์ประจำวันนี้
              </div>
            </div>
          )}

          {/* ITEM 5: บันทึกสรุปผลการตัดสินใจท้ายวัน (Trading Journal) */}
          {isItem5 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                บันทึกเหตุผลการตัดสินใจเพื่อสร้างระเบียบวินัยและพัฒนาผลการลงทุนระยะยาว:
              </p>

              <div className="bg-slate-950/70 border border-purple-500/20 rounded-2xl p-4 space-y-2.5 text-xs text-slate-300">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                  หัวข้อที่ควรทบทวนและบันทึกท้ายวัน:
                </span>
                <ul className="space-y-2 list-disc list-inside">
                  <li><strong>การดำเนินการ:</strong> วันนี้ได้ส่งคำสั่งซื้อหรือปรับพอร์ตตามแผนที่วางไว้หรือไม่?</li>
                  <li><strong>วินัยและอารมณ์:</strong> มีการไล่ซื้อตามอารมณ์ FOMO หรือตื่นตระหนกขายหรือไม่?</li>
                  <li><strong>บทเรียนสำหรับวันพรุ่งนี้:</strong> สิ่งที่ทำได้ดี หรือสิ่งที่ควรปรับปรุง</li>
                </ul>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-200">
                ✏️ คุณสามารถพิมพ์บันทึกเหล่านี้ลงในกล่อง <strong>"บันทึกกลยุทธ์และการตัดสินใจประจำวัน (Daily Notes)"</strong> ด้านล่างได้ทันที
              </div>
            </div>
          )}

          {/* Custom or AI Action Step Items */}
          {!isItem1 && !isItem2 && !isItem3 && !isItem4 && !isItem5 && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-white/[0.08] rounded-2xl p-4">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  รายละเอียดแผนปฏิบัติการ
                </span>
                <p className="text-sm font-medium text-white leading-relaxed">
                  {item.text}
                </p>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
                <span className="font-bold text-indigo-300 block">คำแนะนำก่อนยืนยัน:</span>
                <p>• ตรวจสอบว่าได้ดำเนินการตามขั้นตอนข้างต้นในบัญชีหรือระบบลงทุนเรียบร้อยแล้ว</p>
                <p>• เมื่อกดปุ่มยืนยันด้านล่าง ระบบจะบันทึกสถานะ "เสร็จสิ้น" ของหัวข้อนี้ให้อัตโนมัติทันที</p>
              </div>
            </div>
          )}

          {/* Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
            <span className="text-slate-400">สถานะรายการนี้:</span>
            <span
              className={`font-bold flex items-center gap-1.5 ${
                item.done ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {item.done ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> ดำเนินการเสร็จสิ้นแล้ว
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" /> ยังไม่ได้ทำเครื่องหมาย
                </>
              )}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-sm font-medium transition-all text-center"
          >
            ปิด (ยังไม่ทำเครื่องหมาย)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {item.done && (
              <button
                type="button"
                onClick={handleToggleUndone}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm font-semibold transition-all text-center"
              >
                ยกเลิกการติ๊ก
              </button>
            )}

            <button
              type="button"
              onClick={handleCompleteAndClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>อ่านแล้ว • ติ๊กบันทึกอัตโนมัติ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
