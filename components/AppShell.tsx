'use client'

import React, { useState, useEffect } from 'react'
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
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { QuickAddModal } from './QuickAddModal'
import { TickerTape } from './TickerTape'
import { ThemeStyleSelector } from './ThemeStyleSelector'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'แดชบอร์ด',        href: '/dashboard',    icon: LayoutDashboard },
  { label: 'รายการธุรกรรม',   href: '/transactions', icon: ArrowLeftRight },
  { label: 'บัญชีการเงิน',    href: '/accounts',     icon: Wallet },
  { label: 'แผนการลงทุน',     href: '/plans',        icon: PieChart },
  { label: 'จับตาตลาด',       href: '/market-watch', icon: TrendingUp },
  { label: 'พยากรณ์พอร์ต',   href: '/forecast',     icon: Sparkles, badge: 'AI' },
  { label: 'สรุปข่าวเศรษฐกิจ', href: '/news',        icon: Newspaper },
  { label: 'รายงานภาษี',      href: '/tax-report',   icon: ReceiptText },
  { label: 'ตั้งค่าระบบ',     href: '/settings',     icon: Settings },
]

const SUPERADMIN_NAV: NavItem[] = [
  { label: 'จัดการผู้ใช้',           href: '/superadmin/users',    icon: Users },
  { label: 'บันทึกระบบ',             href: '/superadmin/logs',     icon: ShieldAlert },
  { label: 'สถานะระบบ / AI',         href: '/superadmin/settings', icon: Cpu },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen]   = useState(false)
  const [quickAddOpen, setQuickAddOpen]       = useState(false)
  const [collapsed, setCollapsed]             = useState(false)

  // ESC key dismiss for mobile menu and quick add
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
        setQuickAddOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const role = (session?.user as any)?.role || 'USER'
  const isSuperAdminOrAdmin = role === 'SUPERADMIN' || role === 'ADMIN'
  const userName  = session?.user?.name || session?.user?.email?.split('@')[0] || 'นักลงทุน'
  const userEmail = session?.user?.email || ''

  const sidebarW = collapsed ? 'w-[68px]' : 'w-60'
  const mainML   = collapsed ? 'md:ml-[68px]' : 'md:ml-60'

  return (
    <div className="min-h-screen text-[var(--text-primary)] flex relative overflow-x-hidden"
         style={{ background: 'var(--bg-base)' }}>

      {/* ── Aurora Background ───────────────────────────────── */}
      <div className="aurora-bg">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col ${sidebarW} border-r border-white/[0.07] bg-white/[0.03] backdrop-blur-2xl shrink-0 fixed top-0 left-0 h-screen z-40 transition-all duration-300 ease-in-out overflow-hidden`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.07] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline min-w-0 overflow-hidden">
            <div className="w-9 h-9 rounded-2xl bg-white/95 p-1 shrink-0 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.35)]">
              <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0 overflow-hidden">
                <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                  INVESTMENT
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-[var(--violet)] border border-violet-500/30 font-semibold">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase font-medium whitespace-nowrap">
                  MIX THE ARCHITECT
                </p>
              </div>
            )}
          </Link>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--violet)] hover:bg-white/[0.06] transition-colors"
            title={collapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft  className="w-3.5 h-3.5" />
            }
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase mb-3">
              เมนูหลัก
            </p>
          )}

          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 no-underline group relative ${
                  active
                    ? 'nav-pill-active text-white'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.05]'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-[var(--violet)]' : 'text-[var(--text-muted)] group-hover:text-[var(--violet)]'}`} />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-[var(--violet)] border border-violet-500/25 font-bold shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {/* Collapsed tooltip */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 text-xs font-medium text-white bg-[#0d0a2e] border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50">
                    {item.label}
                    {item.badge && <span className="ml-1.5 text-[var(--violet)]">• {item.badge}</span>}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Admin section */}
          {isSuperAdminOrAdmin && (
            <div className={`pt-3 border-t border-white/[0.06] mt-3 space-y-1 ${collapsed ? '' : ''}`}>
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold tracking-widest text-amber-400/70 uppercase mb-2">
                  ผู้ดูแลระบบ
                </p>
              )}
              {SUPERADMIN_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 no-underline group relative ${
                      active
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : 'text-[var(--text-secondary)] hover:text-amber-200 hover:bg-amber-500/[0.06]'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-[var(--text-muted)]'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1.5 text-xs font-medium text-white bg-[#0d0a2e] border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-white/[0.07] shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-white">{userName}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSuperAdminOrAdmin ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-[10px] text-[var(--text-muted)] truncate capitalize">{role}</span>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 pb-28 md:pb-24 relative z-10 transition-all duration-300 ${mainML}`}>

        {/* Desktop Topbar */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06] transition-colors md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ThemeStyleSelector />

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live" />
              <span>Real-Time Market Sync</span>
            </div>

            <button
              onClick={() => setQuickAddOpen(true)}
              className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกธุรกรรม</span>
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/[0.04] border-b border-white/[0.06] backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-xl bg-white/95 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.3)]">
              <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-white text-sm tracking-tight">INVESTMENT AI</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeStyleSelector />
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-2 rounded-xl bg-violet-500/15 text-[var(--violet)] border border-violet-500/25 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึก</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-white/[0.06] transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Ticker Tape */}
        <TickerTape />

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false)
            }}
            className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col justify-end"
          >
            <div className="bg-[#0d0a2e]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/95 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                    <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block leading-tight">INVESTMENT AI</span>
                    <span className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase">MIX THE ARCHITECT</span>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-white/[0.06]">
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
                          ? 'bg-violet-500/15 border-violet-500/30 text-[var(--violet)]'
                          : 'bg-white/[0.04] border-white/[0.07] text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-[var(--violet)]' : 'text-[var(--text-muted)]'}`} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              {isSuperAdminOrAdmin && (
                <div className="pt-3 border-t border-white/[0.07]">
                  <p className="text-[10px] text-amber-400 uppercase font-semibold mb-2 tracking-widest">ผู้ดูแลระบบ ({role})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUPERADMIN_NAV.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] text-amber-300 text-xs font-medium no-underline"
                        >
                          <Icon className="w-4 h-4 text-amber-400" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{userEmail}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-5 sm:p-7 lg:p-9">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/[0.04] border-t border-white/[0.07] backdrop-blur-2xl px-2 py-1.5 flex justify-around items-center">
        {[
          { href: '/dashboard',    icon: LayoutDashboard, label: 'แดชบอร์ด' },
          { href: '/transactions', icon: ArrowLeftRight,   label: 'ธุรกรรม' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors no-underline ${
              pathname === href ? 'text-[var(--violet)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{label}</span>
          </Link>
        ))}

        {/* Center FAB */}
        <div className="relative -mt-6">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 opacity-60 blur-sm animate-pulse-glow" />
          <button
            onClick={() => setQuickAddOpen(true)}
            className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-400 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-transform active:scale-95"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {[
          { href: '/accounts', icon: Wallet, label: 'บัญชี' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors no-underline ${
              pathname === href ? 'text-[var(--violet)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{label}</span>
          </Link>
        ))}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium text-[var(--text-muted)] hover:text-white"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>เพิ่มเติม</span>
        </button>
      </nav>

      {/* ── DESKTOP FAB ─────────────────────────────────────── */}
      <div className="hidden md:flex fixed bottom-8 right-8 z-40 items-center justify-center group">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-600 opacity-50 blur-md animate-spin-slow group-hover:opacity-80 transition-opacity" />
        <button
          onClick={() => setQuickAddOpen(true)}
          className="relative flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold text-sm shadow-[0_6px_28px_rgba(139,92,246,0.5)] hover:shadow-[0_8px_36px_rgba(167,139,250,0.65)] transition-all hover:scale-105 active:scale-95 shimmer-btn"
          title="บันทึกธุรกรรมด่วนด้วย AI"
        >
          <Plus className="w-5 h-5 stroke-[2.8]" />
          <span className="tracking-wide">บันทึกด่วน</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-black">AI</span>
        </button>
      </div>

      {/* ── QUICK ADD MODAL ──────────────────────────────────── */}
      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
