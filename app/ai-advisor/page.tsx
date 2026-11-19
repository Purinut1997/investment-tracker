'use client'

import React, { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  TrendingUp,
  ShieldAlert,
  Wallet,
  Zap,
  RotateCcw,
  Copy,
  Check,
  Flame,
  BarChart3,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  Newspaper,
  Globe,
  LineChart,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { StockLogo } from '@/components/StockLogo'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import { FormattedCopilotMessage } from '@/components/FormattedCopilotMessage'
import type { TacticalAdvisorApiResponse } from '@/app/tactical-advisor/page'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  modelUsed?: string
}

interface ExternalNewsItem {
  id: string
  symbol?: string | null
  headline: string
  summary?: string | null
  sourceName: string
  sourceUrl?: string
  publishedAt: string
  sentiment?: 'positive' | 'negative' | 'neutral' | 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
}

function formatNumber(val: number | null | undefined, decimals = 2, fallback = '0.00'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback
  return Number(val).toFixed(decimals)
}

function formatInt(val: number | null | undefined, fallback = '0'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback
  return Math.round(Number(val)).toLocaleString()
}

function formatLocale(val: number | null | undefined, decimals = 2, fallback = '0.00'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

const QUICK_STRATEGY_QUESTIONS = [
  {
    category: '📰 ข่าวภายนอกกระทบพอร์ต',
    icon: Newspaper,
    prompt:
      'สรุปข่าวสารภายนอกล่าสุด (เช่น ข่าว AI Chips ของ Google/Nvidia, การเคลื่อนไหวของ Bond Yield, นโยบาย Fed, หรือคดีความ) ที่ส่งผลกระทบต่อหุ้นในพอร์ตของผมให้หน่อย',
  },
  {
    category: '📊 กราฟ & เทคนิครายตัว',
    icon: BarChart3,
    prompt:
      'อ่านกราฟแท่งเทียนและแนวโน้มราคาของหุ้นทุกตัวที่ผมถืออยู่ให้หน่อย พร้อมระบุ RSI(14) แนวรับ S1/S2 เส้น SMA 50/200 และจุดย่อตัวจากจุดสูงสุด',
  },
  {
    category: '🎯 แบ่งไม้ช้อนซื้อ',
    icon: Layers,
    prompt:
      'เงินสดที่มีอยู่ตอนนี้ ควรแบ่งเข้าตัวไหนเป็นไม้แรก (Tranche Entry) ตามแนวรับและสภาวะตลาดห้วงนี้?',
  },
  {
    category: '🛡️ จุดหนีไฟ Stop Loss',
    icon: ShieldAlert,
    prompt:
      'ตรวจสอบจุดหนีไฟ (Stop Loss) และแนวรับสำคัญของหุ้นแต่ละตัวในพอร์ต มีตัวไหนเสี่ยงหลุดแนวรับบ้าง?',
  },
  {
    category: '🌐 ดอกเบี้ย Fed & มหภาค',
    icon: Globe,
    prompt:
      'วิเคราะห์ข่าว Bond Yield สหรัฐฯ 10 ปีที่ทรงตัวสูง และความกังวลเรื่องดอกเบี้ย Fed ว่ากำลังกดดันหุ้นกลุ่ม Tech & AI ในพอร์ตของผมอย่างไร?',
  },
]

export default function AiAdvisorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuestion, setInputQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; market: string } | null>(null)
  const [activeLeftTab, setActiveLeftTab] = useState<'charts' | 'news'>('charts')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Fetch 360° Tactical & Market Context
  const { data: responseData, isLoading: isContextLoading } = useSWR<TacticalAdvisorApiResponse>(
    '/api/tactical-advisor',
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  // 2. Fetch Live External News Feed
  const { data: newsApiResponse } = useSWR<{
    items?: ExternalNewsItem[]
    news?: ExternalNewsItem[]
  }>(
    '/api/news?category=portfolio',
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  const payload = responseData?.data
  const pillars = payload?.marketRegime?.pillars
  const externalNewsList = newsApiResponse?.items || newsApiResponse?.news || []

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Initialize Welcome Message once context is loaded
  useEffect(() => {
    if (messages.length === 0 && payload) {
      const regimeName = payload.marketRegime?.statusLabelTh || 'ผันผวนและควรระมัดระวัง'
      const riskScore = pillars?.formula?.calculatedRiskScore || payload.marketRegime?.riskLevel || 4
      const posture = pillars?.formula?.postureLabelTh || '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)'

      const welcomeText = `สวัสดีครับ ผมคือ **AI ที่ปรึกษาการลงทุน 360° (Senior Wealth Copilot)** ประจำตัวคุณ

ผมได้ประมวลผลข้อมูลรอบด้านครบทุกมิติ พร้อมให้คำปรึกษาแล้วครับ:
- **ข้อมูลภายในพอร์ต:** มูลค่าสินทรัพย์รวม, เงินสดสำรอง (Dry Powder), สัดส่วนการถือครองรายตัว, ต้นทุน และกำไร/ขาดทุนจริง
- **ข้อมูลกราฟเทคนิคภายนอก:** วิเคราะห์แท่งเทียน, Wilder's RSI(14), เส้นค่าเฉลี่ย SMA 50/200, และแนวรับ/แนวต้าน Pivot S1/S2/R1
- **ข่าวสารภายนอกสด (Live News):** เชื่อมต่อข่าวเศรษฐกิจโลกและข่าวรายบริษัทจาก Finnhub, Yahoo Finance, Google News
- **สภาวะมหภาค 4 เสาหลัก:** สภาวะตลาดขณะนี้คือ **${regimeName}** (ความเสี่ยง **${riskScore}/5**) กลยุทธ์หลัก: **${posture}**

💡 คุณสามารถเลือกหัวข้อด่วนจากปุ่มแนะนำด้านบน คลิกดูกราฟสด/ข่าวสารจากแถบซ้าย หรือพิมพ์คำถามเจาะลึกได้ทันทีครับ`

      setMessages([
        {
          id: 'welcome-msg',
          role: 'assistant',
          content: welcomeText,
          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'Gemini 2.5 Pro (CMT & Macro Engine)',
        },
      ])
    }
  }, [payload, pillars, messages.length])

  // Handle Send Question
  const handleSendMessage = async (textToSend?: string) => {
    const question = textToSend || inputQuestion
    if (!question.trim() || isLoading) return

    const userMsgId = `user-${Date.now()}`
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: question.trim(),
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setInputQuestion('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/tactical-advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          tacticalContext: payload,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: json.answer || 'ไม่มีคำตอบจากระบบ',
          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: json.modelUsed,
        }
        setMessages((prev) => [...prev, botMsg])
      } else {
        const errorMsg: ChatMessage = {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: 'ขออภัยครับ ระบบไม่สามารถเชื่อมต่อและประมวลผลคำตอบได้ในขณะนี้ กรุณาลองส่งใหม่อีกครั้ง',
          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: 'assistant',
        content: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณาตรวจสอบการเชื่อมต่อของคุณ',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  // Copy to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Reset Chat
  const handleResetChat = () => {
    if (confirm('คุณต้องการล้างประวัติการสนทนานี้และเริ่มรอบใหม่หรือไม่?')) {
      setMessages([])
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10">
                <Bot className="w-6 h-6" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <span>AI ที่ปรึกษาการลงทุน 360° (Institutional Wealth Copilot)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-300 border border-indigo-500/40 font-bold uppercase tracking-wider hidden sm:inline">
                  PRO SUITE
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              วิเคราะห์ครบทุกมิติ: ผสานข้อมูลพอร์ตจริง + ข่าวสารภายนอกสด (Finnhub/Yahoo) + กราฟเทคนิคแท่งเทียน + มหภาค 4 เสาหลัก
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            <Link
              href="/tactical-advisor"
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs sm:text-sm font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <span>ดูกระดานกลยุทธ์ 5 ส่วน</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <button
              type="button"
              onClick={handleResetChat}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>เริ่มคุยใหม่</span>
            </button>
          </div>
        </div>

        {/* ── TWO-COLUMN WORKSPACE: COCKPIT & INTERACTIVE TERMINAL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN (LG: 4 COLUMNS): 360° INVESTOR DOSSIER ── */}
          <div className="lg:col-span-4 space-y-4">
            {/* 1. Internal Portfolio DNA Card */}
            <div className="p-5 rounded-2xl bg-[#0D1019] border border-white/[0.08] shadow-lg space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    ข้อมูลพอร์ตโฟลิโอภายใน (Portfolio DNA)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {payload?.cashStrategy.baseCurrency || 'THB'}
                </span>
              </div>

              {/* Cash & Dry Powder */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>เงินสดสำรอง (Dry Powder):</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {payload?.cashStrategy.currentCashTotalBase?.toLocaleString() || '-'}{' '}
                    {payload?.cashStrategy.baseCurrency || 'THB'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>สัดส่วนเงินสดในพอร์ต:</span>
                  <span className="font-mono font-semibold text-white">
                    {payload?.cashStrategy.currentCashPercent?.toFixed(1) || '-'}%{' '}
                    <span className="text-slate-500 font-normal">
                      (เป้าสภาวะนี้: {payload?.cashStrategy.recommendedCashPercent || 25}%)
                    </span>
                  </span>
                </div>
              </div>

              {/* Thematic Concentration Warning */}
              {payload?.portfolioResilience?.thematicRiskAlert && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>คำเตือนความเสี่ยงการกระจุกตัว</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {payload.portfolioResilience.thematicRiskAlert}
                  </p>
                </div>
              )}
            </div>

            {/* 2. DUAL-TAB COCKPIT: TECHNICAL CHARTS vs LIVE EXTERNAL NEWS */}
            <div className="p-5 rounded-2xl bg-[#0D1019] border border-white/[0.08] shadow-lg space-y-3.5">
              {/* Tab Selector Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setActiveLeftTab('charts')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeLeftTab === 'charts'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>กราฟเทคนิค & กรอบ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLeftTab('news')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeLeftTab === 'news'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>ข่าวภายนอกสด</span>
                    {externalNewsList.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {activeLeftTab === 'charts'
                    ? `${payload?.tacticalActions?.length || 0} หุ้น`
                    : `${externalNewsList.length} ข่าว`}
                </span>
              </div>

              {/* TAB 1: TECHNICAL CHARTS & WATCHLIST */}
              {activeLeftTab === 'charts' && (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {(payload?.tacticalActions || []).map((stock) => {
                    const isAccumulate = stock.action === 'ACCUMULATE'
                    const isTrim = stock.action === 'TRIM_PROFIT'

                    return (
                      <div
                        key={stock.id}
                        className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] transition-colors space-y-2.5 group"
                      >
                        {/* Header Row: Logo, Ticker, Action Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <StockLogo ticker={stock.ticker} name={stock.assetName} size={32} />
                            <div className="min-w-0">
                              <span className="font-bold text-white text-xs sm:text-sm tracking-wide block">
                                {stock.ticker}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate max-w-[130px] block">
                                {stock.assetName}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-white font-mono font-bold text-xs sm:text-sm block">
                              {stock.currency}{formatNumber(stock.currentPrice)}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold inline-block ${
                                isAccumulate
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : isTrim
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {stock.actionLabel}
                            </span>
                          </div>
                        </div>

                        {/* Pivot & Support Zone Info */}
                        <div className="p-2 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[10px]">กรอบเป้าหมาย</span>
                            <span className="text-indigo-300 font-semibold">{stock.targetZone}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block text-[10px]">จุดหนีไฟ (Stop)</span>
                            <span className="text-rose-300 font-semibold">{stock.stopLossPoint || '-'}</span>
                          </div>
                        </div>

                        {/* Interactive Buttons: Open Live Chart Modal & Ask AI */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStock({ symbol: stock.ticker, market: stock.market })}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/[0.06]"
                          >
                            <LineChart className="w-3.5 h-3.5 text-indigo-400" />
                            <span>ดูกราฟแท่งเทียนสด ↗</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const q = `วิเคราะห์กราฟเทคนิค ทรงราคา และแนวรับแนวต้านของหุ้น ${stock.ticker} ให้ละเอียด พร้อมบอกจังหวะเข้า/ออก`
                              setInputQuestion(q)
                              handleSendMessage(q)
                            }}
                            className="py-1.5 px-2.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-indigo-500/30"
                            title="ถาม AI เจาะลึกตัวนี้"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>ถาม AI</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TAB 2: LIVE EXTERNAL NEWS FEED */}
              {activeLeftTab === 'news' && (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {externalNewsList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-black/30 rounded-xl border border-white/[0.04]">
                      กำลังดึงข้อมูลข่าวสารภายนอกสดจากสำนักข่าวการเงิน...
                    </div>
                  ) : (
                    externalNewsList.slice(0, 15).map((news) => {
                      const isPositive = news.sentiment === 'positive' || news.sentiment === 'BULLISH'
                      const isNegative = news.sentiment === 'negative' || news.sentiment === 'BEARISH'

                      return (
                        <div
                          key={news.id}
                          className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] transition-colors space-y-2 group"
                        >
                          {/* News Header: Ticker, Sentiment, Source */}
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              {news.symbol ? (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold font-mono">
                                  {news.symbol}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300 font-bold">
                                  ตลาดโลก
                                </span>
                              )}

                              <span
                                className={`px-1.5 py-0.5 rounded font-semibold ${
                                  isPositive
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : isNegative
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : 'bg-white/[0.05] text-slate-400'
                                }`}
                              >
                                {isPositive ? 'เชิงบวก' : isNegative ? 'เชิงลบ/เตือน' : 'เป็นกลาง'}
                              </span>
                            </div>

                            <span className="text-slate-400 font-mono truncate max-w-[120px]">
                              {news.sourceName}
                            </span>
                          </div>

                          {/* Headline */}
                          <h4 className="text-xs font-semibold text-white leading-snug group-hover:text-indigo-300 transition-colors">
                            {news.headline}
                          </h4>

                          {/* 1-Click Ask AI About This News */}
                          <button
                            type="button"
                            onClick={() => {
                              const prompt = `ช่วยวิเคราะห์ผลกระทบของข่าวนี้: "${news.headline}" (แหล่งข่าว: ${news.sourceName}) ว่าส่งผลต่อราคาและทิศทางของหุ้น ${news.symbol || 'ในตลาด'} อย่างไร?`
                              setInputQuestion(prompt)
                              handleSendMessage(prompt)
                            }}
                            className="w-full py-1.5 px-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>ให้ AI วิเคราะห์ผลกระทบจากข่าวนี้</span>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* 3. Market Climate 4 Pillars Quick Glance */}
            {pillars && (
              <div className="p-5 rounded-2xl bg-[#0D1019] border border-white/[0.08] shadow-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      สภาวะมหภาค 4 เสาหลัก (Live)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 font-bold">
                    เสี่ยง {pillars.formula?.calculatedRiskScore || 4}/5
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                    <span className="text-slate-400 block text-[11px]">Fear & Greed</span>
                    <strong className="text-white font-mono text-sm block">
                      {pillars.sentiment.fearGreedScore}/100
                    </strong>
                    <span className="text-[10px] text-rose-400">
                      {pillars.sentiment.fearGreed1WDiff < 0
                        ? `⭣ ${Math.abs(pillars.sentiment.fearGreed1WDiff)} pts 1W`
                        : `${pillars.sentiment.fearGreed1WDiff} pts`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                    <span className="text-slate-400 block text-[11px]">VIX Volatility</span>
                    <strong className="text-white font-mono text-sm block">
                      {formatNumber(pillars.sentiment?.vixValue)} pts
                    </strong>
                    <span className="text-[10px] text-emerald-400">{pillars.sentiment?.vixStatus || 'NORMAL'}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                    <span className="text-slate-400 block text-[11px]">US 10Y Yield</span>
                    <strong className="text-amber-300 font-mono text-sm block">
                      {formatNumber(pillars.macroLiquidity?.us10yYield)}%
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      {pillars.macroLiquidity?.yieldPressureLevel || 'MODERATE'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                    <span className="text-slate-400 block text-[11px]">Gold Safe-Haven</span>
                    <strong className="text-white font-mono text-sm block">
                      ${formatLocale(pillars.catalystsAndFlows?.goldPrice, 1, '0.0')}
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">
                      DXY {formatNumber(pillars.catalystsAndFlows?.dxyPrice)}
                    </span>
                  </div>
                </div>

                {/* Data Transparency Badge */}
                <div className="pt-2 border-t border-white/[0.06] space-y-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ข้อมูลจริงที่ระบบส่งให้ AI วิเคราะห์:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pl-4 font-mono">
                    <span>✓ พอร์ต & เงินสดจริง</span>
                    <span>✓ ข่าว Finnhub/Yahoo</span>
                    <span>✓ Wilder's RSI(14)</span>
                    <span>✓ แท่งเทียน & Pivot S1/R1</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (LG: 8 COLUMNS): FULL INTERACTIVE AI CHAT SUITE ── */}
          <div className="lg:col-span-8 flex flex-col h-[780px] rounded-3xl bg-gradient-to-b from-[#111522] via-[#0E121D] to-[#0A0D15] border border-indigo-500/20 shadow-2xl overflow-hidden relative">
            {/* Terminal Header */}
            <div className="p-4 sm:p-5 bg-black/40 border-b border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#111522] absolute -bottom-0.5 -right-0.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                      Tactical Wealth Advisor Terminal
                    </h2>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                      พร้อมตอบคำถาม
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    ผสานข้อมูลรอบด้าน: ข่าวภายนอก + กราฟเทคนิค + มหภาค + ข้อมูลพอร์ตจริง
                  </span>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[11px] text-slate-400 font-mono block">กลยุทธ์พอร์ต</span>
                <span className="text-xs font-bold text-indigo-300">
                  {pillars?.formula?.postureLabelTh || '🛡️ ตั้งรับรอจังหวะ'}
                </span>
              </div>
            </div>

            {/* Quick Action Chips Carousel */}
            <div className="p-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-xs text-slate-400 font-semibold shrink-0 pl-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                คำถามแนะนำ:
              </span>
              {QUICK_STRATEGY_QUESTIONS.map((q, idx) => {
                const IconComponent = q.icon
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputQuestion(q.prompt)
                      handleSendMessage(q.prompt)
                    }}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-200 text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <IconComponent className="w-3 h-3 text-indigo-300" />
                    <span>{q.category}</span>
                  </button>
                )
              })}
            </div>

            {/* Messages Thread Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {messages.map((msg) => {
                const isUser = msg.role === 'user'

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                        isUser
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                      }`}
                    >
                      {isUser ? 'YOU' : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Bubble Content */}
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 shadow-lg space-y-2 ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                          : 'bg-black/60 border border-white/[0.08] text-slate-100 rounded-tl-none'
                      }`}
                    >
                      {/* Top Header of Message */}
                      <div className="flex items-center justify-between gap-3 text-xs pb-1 border-b border-white/[0.06]">
                        <span className={`font-semibold ${isUser ? 'text-indigo-200' : 'text-indigo-400'}`}>
                          {isUser ? 'คุณ' : 'Senior Wealth Copilot (360°)'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                          {!isUser && (
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="คัดลอกคำตอบ"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Text Body */}
                      {isUser ? (
                        <p className="text-xs sm:text-sm text-white leading-relaxed font-normal whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      ) : (
                        <div className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
                          <FormattedCopilotMessage content={msg.content} />
                        </div>
                      )}

                      {/* Model Used Tag */}
                      {msg.modelUsed && !isUser && (
                        <div className="pt-2 text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{msg.modelUsed}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Loading Bubble */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shrink-0 text-white shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-black/60 border border-indigo-500/30 text-xs sm:text-sm text-indigo-300 flex items-center gap-2.5 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>กำลังเชื่อมต่อข่าวสารภายนอกสด คำนวณกราฟเทคนิคแท่งเทียน และวิเคราะห์ร่วมกับพอร์ตของคุณ...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Sticky Input Form */}
            <div className="p-4 sm:p-5 bg-black/70 border-t border-white/[0.08] backdrop-blur-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  placeholder="พิมพ์คำถามวิเคราะห์ข่าว กราฟ หรือกลยุทธ์การลงทุน เช่น 'วิเคราะห์ข่าวดอกเบี้ยกระทบพอร์ต'..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-2xl bg-[#090C14] border border-white/[0.1] text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputQuestion.trim()}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/25 shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">ส่งคำถาม</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Detail Modal for full candlestick charts & fundamentals */}
      {selectedStock && (
        <StockDetailModal
          isOpen={true}
          onClose={() => setSelectedStock(null)}
          symbol={selectedStock.symbol}
          market={selectedStock.market}
        />
      )}
    </AppShell>
  )
}
