'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PieChart,
  TrendingUp,
  Newspaper,
  ReceiptText,
  Settings,
  Users,
  ShieldAlert,
  Cpu,
  LogOut,
  Menu,
  X,
  Plus,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Search,
  Bell
} from 'lucide-react'
import { QuickAddModal } from './QuickAddModal'
import { TickerTape } from './TickerTape'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  badge?: string
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'แดชบอร์ด', href: '/dashboard', icon: LayoutDashboard },
  { label: 'รายการธุรกรรม', href: '/transactions', icon: ArrowLeftRight },
  { label: 'บัญชีการเงิน', href: '/accounts', icon: Wallet },
  { label: 'แผนการลงทุน', href: '/plans', icon: PieChart },
  { label: 'จับตาตลาด', href: '/market-watch', icon: TrendingUp },
  { label: 'พยากรณ์พอร์ต', href: '/forecast', icon: Sparkles, badge: 'AI' },
  { label: 'สรุปข่าวเศรษฐกิจ', href: '/news', icon: Newspaper },
  { label: 'รายงานภาษี', href: '/tax-report', icon: ReceiptText },
  { label: 'ตั้งค่าระบบ', href: '/settings', icon: Settings },
]

const SUPERADMIN_NAV: NavItem[] = [
  { label: 'จัดการผู้ใช้', href: '/superadmin/users', icon: Users },
  { label: 'บันทึกระบบ (Logs)', href: '/superadmin/logs', icon: ShieldAlert },
  { label: 'สถานะระบบ / AI', href: '/superadmin/settings', icon: Cpu },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const role = (session?.user as any)?.role || 'USER'
  const isSuperAdminOrAdmin = role === 'SUPERADMIN' || role === 'ADMIN'
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'นักลงทุน'
  const userEmail = session?.user?.email || ''

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex relative overflow-x-hidden">
      {/* Ambient Lighting & Atmospheric Depth */}
      <div className="ambient-aura-bg">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
        <div className="ambient-blob-3" />
      </div>

      {/* ─── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[#0A0F1D]/80 backdrop-blur-2xl shrink-0 sticky top-0 h-screen z-40 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        {/* Brand Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-white/95 p-1 border border-white/20 shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-transform group-hover:scale-105 shrink-0 flex items-center justify-center">
              <img
                src="/logo.png?v=2"
                alt="Mix The Architect System Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
                <span>INVESTMENT</span>
                <span className="text-[var(--cyan-400)] text-xs font-semibold px-1.5 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-semibold">
                MIX THE ARCHITECT
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase mb-2">
              เมนูหลัก
            </p>
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all no-underline ${
                    active
                      ? 'nav-pill-active font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-[var(--cyan-400)]' : 'text-[var(--text-muted)]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-[var(--cyan-400)] font-semibold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Admin / Superadmin Section */}
          {isSuperAdminOrAdmin && (
            <div className="space-y-1 pt-3 border-t border-[var(--border)]">
              <div className="px-3 flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold tracking-wider text-amber-400/80 uppercase">
                  ผู้ดูแลระบบ ({role})
                </p>
              </div>
              {SUPERADMIN_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all no-underline ${
                      active
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-[0_0_15px_rgba(251,191,36,0.1)]'
                        : 'text-[var(--text-secondary)] hover:text-amber-200 hover:bg-[var(--bg-elevated)]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-[var(--text-muted)]'}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* User Footer Profile */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-md">
          <div className="p-2.5 rounded-xl bg-[var(--bg-elevated)]/80 border border-[var(--border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate text-[var(--text-primary)]">
                  {userName}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSuperAdminOrAdmin ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-[10px] text-[var(--text-muted)] capitalize truncate">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="ออกจากระบบ"
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--red-400)] hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center text-[var(--text-muted)] mt-2 font-medium">
            Investment AI • Luxury Edition
          </p>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6 relative z-10">
        {/* Desktop Topbar */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-[var(--border)] bg-[#0A0F1D]/80 backdrop-blur-xl sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3 w-96">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาสินทรัพย์, หุ้น, คริปโต... (⌘K)"
                className="w-full pl-10 pr-12 py-2 bg-[var(--bg-surface)]/80 border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--cyan-400)]/60 focus:ring-1 focus:ring-[var(--cyan-400)]/40 transition-all shadow-inner"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[var(--text-muted)]">
                ⌘K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Market Sync</span>
            </div>

            <button
              onClick={() => setQuickAddOpen(true)}
              className="btn btn-primary text-xs py-2 px-4 shadow-[0_0_18px_rgba(6,182,212,0.3)] flex items-center gap-1.5 rounded-xl font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกธุรกรรม</span>
            </button>

            <Link
              href="/settings"
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors border border-transparent hover:border-[var(--border)]"
              title="การตั้งค่า"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)]/90 border-b border-[var(--border)] backdrop-blur-md">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-white/95 p-0.5 border border-white/20 shadow-[0_0_12px_rgba(34,211,238,0.25)] flex items-center justify-center">
              <img
                src="/logo.png?v=2"
                alt="Mix The Architect System Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-white text-sm tracking-tight">INVESTMENT AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-2 rounded-xl bg-cyan-500/20 text-[var(--cyan-400)] border border-cyan-500/30 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึก</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Global Wall Street Marquee Ticker Tape */}
        <TickerTape />

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end">
            <div className="bg-[var(--bg-surface)] border-t border-[var(--border)] rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/95 p-0.5 border border-white/20 shadow-[0_0_12px_rgba(34,211,238,0.25)] flex items-center justify-center">
                    <img
                      src="/logo.png?v=2"
                      alt="Mix The Architect System Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block leading-tight">INVESTMENT AI</span>
                    <span className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-medium">MIX THE ARCHITECT</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium no-underline transition-all ${
                        active
                          ? 'nav-pill-active font-semibold'
                          : 'bg-[var(--bg-elevated)]/60 border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[var(--cyan-400)]" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              {isSuperAdminOrAdmin && (
                <div className="pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] text-amber-400 uppercase font-semibold mb-2">
                    ผู้ดูแลระบบ ({role})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUPERADMIN_NAV.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs font-medium no-underline"
                        >
                          <Icon className="w-4 h-4 text-amber-400" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Logout inside drawer */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                  {userEmail}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[var(--red-400)] text-xs font-medium flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content View */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* ─── MOBILE BOTTOM NAV ─────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface)]/90 border-t border-[var(--border)] backdrop-blur-lg px-2 py-1.5 flex justify-around items-center">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors no-underline ${
            pathname === '/dashboard' ? 'text-[var(--cyan-400)]' : 'text-[var(--text-muted)]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>แดชบอร์ด</span>
        </Link>
        <Link
          href="/transactions"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors no-underline ${
            pathname === '/transactions' ? 'text-[var(--cyan-400)]' : 'text-[var(--text-muted)]'
          }`}
        >
          <ArrowLeftRight className="w-5 h-5 mb-0.5" />
          <span>ธุรกรรม</span>
        </Link>

        {/* Center Mobile FAB with Aura Glow */}
        <div className="relative -mt-6">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-70 blur-sm animate-pulse-glow" />
          <button
            onClick={() => setQuickAddOpen(true)}
            className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-400 to-emerald-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-transform active:scale-95"
            aria-label="Quick Add"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        <Link
          href="/accounts"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors no-underline ${
            pathname === '/accounts' ? 'text-[var(--cyan-400)]' : 'text-[var(--text-muted)]'
          }`}
        >
          <Wallet className="w-5 h-5 mb-0.5" />
          <span>บัญชี</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium text-[var(--text-muted)] hover:text-white"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>เพิ่มเติม</span>
        </button>
      </nav>

      {/* ─── DESKTOP FLOATING ACTION BUTTON (FAB) WITH AURA RING ───── */}
      <div className="hidden md:flex fixed bottom-8 right-8 z-40 items-center justify-center group">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-violet-500 opacity-60 blur-md animate-spin-slow group-hover:opacity-100 transition-opacity" />
        <button
          onClick={() => setQuickAddOpen(true)}
          className="relative flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 text-black font-extrabold text-sm shadow-[0_6px_28px_rgba(34,211,238,0.45)] hover:shadow-[0_8px_35px_rgba(34,211,238,0.65)] transition-all hover:scale-105 active:scale-95 shimmer-btn"
          title="บันทึกธุรกรรมด่วนด้วย AI"
        >
          <Plus className="w-5 h-5 stroke-[2.8]" />
          <span className="tracking-wide">บันทึกด่วน</span>
          <span className="text-[10px] bg-black/25 text-black font-black px-1.5 py-0.5 rounded-full">
            AI
          </span>
        </button>
      </div>

      {/* ─── QUICK ADD MODAL (Natural Language & Quick Add) ────────── */}
      {quickAddOpen && (
        <QuickAddModal onClose={() => setQuickAddOpen(false)} />
      )}
    </div>
  )
}
