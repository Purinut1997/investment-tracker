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
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react'
import { QuickAddModal } from './QuickAddModal'
import { TickerTape } from './TickerTape'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface NavGroup {
  groupName: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'Overview',
    items: [
      { label: 'แดชบอร์ด',        href: '/dashboard',    icon: LayoutDashboard },
    ]
  },
  {
    groupName: 'My Portfolio',
    items: [
      { label: 'รายการธุรกรรม',   href: '/transactions', icon: ArrowLeftRight },
      { label: 'บัญชีการเงิน',    href: '/accounts',     icon: Wallet },
      { label: 'รายงานภาษี',      href: '/tax-report',   icon: ReceiptText },
    ]
  },
  {
    groupName: 'Planning',
    items: [
      { label: 'แผนการลงทุน',     href: '/plans',        icon: PieChart },
      { label: 'พยากรณ์พอร์ต',   href: '/forecast',     icon: Sparkles, badge: 'AI' },
    ]
  },
  {
    groupName: 'Market & Data',
    items: [
      { label: 'จับตาตลาด',       href: '/market-watch', icon: TrendingUp },
      { label: 'สรุปข่าวเศรษฐกิจ', href: '/news',        icon: Newspaper },
    ]
  },
  {
    groupName: 'System',
    items: [
      { label: 'ตั้งค่าระบบ',     href: '/settings',     icon: Settings },
    ]
  }
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

  const role = (session?.user as { role?: string } | undefined)?.role || 'USER'
  const isSuperAdminOrAdmin = role === 'SUPERADMIN' || role === 'ADMIN'
  const userName  = session?.user?.name || session?.user?.email?.split('@')[0] || 'นักลงทุน'
  const userEmail = session?.user?.email || ''

  const sidebarW = collapsed ? 'w-[80px]' : 'w-[280px]'
  const shellColumns = collapsed ? '80px minmax(0, 1fr)' : '280px minmax(0, 1fr)'

  return (
    <div
      className="min-h-screen text-[var(--text-primary)] flex lg:grid relative overflow-x-clip"
      style={{ background: 'var(--bg-base)', gridTemplateColumns: shellColumns }}
    >

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col border-r border-white/[0.05] bg-[#090b10] shrink-0 sticky top-0 h-screen z-40 transition-all duration-300 ease-in-out ${sidebarW}`}
      >
        {/* Brand Header */}
        <div className={`flex flex-col shrink-0 border-b border-white/[0.05] transition-all duration-300 p-4 gap-5`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <Link href="/dashboard" className="flex items-center gap-3 no-underline min-w-0">
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-violet-600 to-indigo-600 p-2 shrink-0 flex items-center justify-center shadow-[0_0_24px_rgba(124,58,237,0.35)]">
                <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain brightness-0 invert drop-shadow-md" />
              </div>
              {!collapsed && (
                <div className="min-w-0 overflow-hidden">
                  <div className="font-bold text-white text-[15px] tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                    Investment
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white font-bold uppercase tracking-wider">
                      Pro
                    </span>
                  </div>
                </div>
              )}
            </Link>

            {/* Collapse toggle */}
            {!collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-all shrink-0 group"
              >
                <PanelLeftClose className="w-4 h-4 group-hover:scale-95 transition-transform" />
              </button>
            )}
          </div>

          {!collapsed && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white/90 truncate leading-tight">พอร์ตลงทุนหลัก</p>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  ซิงค์ล่าสุด: วันนี้
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center bg-white/[0.02] border border-white/[0.04] text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-all group"
                title="ขยายแถบเมนู (Sidebar)"
              >
                <PanelLeft className="w-5 h-5 text-violet-400 group-hover:scale-105 transition-transform" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-visible p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.groupName} className="space-y-1.5">
              {!collapsed && (
                <p className={`px-3 ${gIdx === 0 ? 'pt-2' : 'pt-4 border-t border-white/[0.04] mt-2'} pb-1 text-[10px] font-bold tracking-[0.15em] text-zinc-500 uppercase`}>
                  {group.groupName}
                </p>
              )}
              {collapsed && gIdx !== 0 && <div className="h-px bg-white/[0.04] w-10 mx-auto my-2" />}

              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-[14px] font-semibold transition-all duration-300 no-underline group relative ${
                      active
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_4px_20px_-4px_rgba(124,58,237,0.5)] border border-white/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                    } ${collapsed ? 'justify-center w-12 h-12 px-0 mx-auto' : ''}`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 transition-all duration-300 ${active ? 'text-white drop-shadow-md' : 'text-zinc-500 group-hover:text-violet-400'}`} />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-black/20 text-white border border-white/20 font-bold shrink-0 shadow-inner">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {/* Collapsed tooltip */}
                    {collapsed && (
                      <span className="absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold text-white bg-[#151821] border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-50 flex items-center gap-2">
                        {item.label}
                        {item.badge && <span className="text-violet-400 text-[10px] bg-violet-500/10 px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          {/* Admin section */}
          {isSuperAdminOrAdmin && (
            <div className={`pt-4 mt-2 space-y-1.5 relative`}>
              {/* Divider */}
              <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              
              {!collapsed && (
                <p className="px-3 pb-1 text-[10px] font-bold tracking-[0.15em] text-amber-500/70 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
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
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-[14px] font-semibold transition-all duration-300 no-underline group relative ${
                      active
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-[0_4px_20px_-4px_rgba(245,158,11,0.4)] border border-white/10'
                        : 'text-zinc-400 hover:text-white hover:bg-amber-500/5 border border-transparent'
                    } ${collapsed ? 'justify-center w-12 h-12 px-0 mx-auto' : ''}`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 transition-all duration-300 ${active ? 'text-white drop-shadow-md' : 'text-zinc-500 group-hover:text-amber-400'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <span className="absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold text-white bg-[#151821] border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-50">
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
        <div className="p-4 border-t border-white/[0.05] shrink-0 bg-[#090b10]">
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-[0_0_15px_rgba(124,58,237,0.3)] ring-2 ring-white/10">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-inner">
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-[0_0_15px_rgba(124,58,237,0.3)] ring-2 ring-white/10">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold truncate text-white/90">{userName}</p>
                <p className="text-[10px] text-zinc-500 truncate capitalize mt-0.5">{role}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className="min-w-0 flex flex-col pb-28 lg:pb-24 relative z-10">

        {/* Desktop Topbar */}
        <header className="hidden lg:flex items-center justify-between px-6 lg:px-8 py-3.5 border-b border-white/[0.08] bg-[#0a0c10]/95 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/[0.08] transition-all flex items-center gap-2 text-xs"
              title={collapsed ? 'ขยายแถบเมนู (Sidebar)' : 'ย่อแถบเมนู (Sidebar)'}
            >
              <PanelLeft className="w-4 h-4 text-violet-400" />
              <span className="text-[var(--text-muted)] font-medium">
                {collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">

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
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/[0.04] border-b border-white/[0.06] backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-1.5 flex items-center justify-center">
                <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
              </div>
              <span className="font-bold text-white text-[15px] tracking-tight">Investment Pro</span>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
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
            className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col justify-end"
          >
            <div className="bg-[#0d0a2e]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/95 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                    <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block leading-tight">Investment Pro</span>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-white/[0.06]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {NAV_GROUPS.flatMap(g => g.items).map((item) => {
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
        <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/[0.04] border-t border-white/[0.07] backdrop-blur-2xl px-2 py-1.5 flex justify-around items-center">
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
      <div className="hidden lg:flex fixed bottom-8 right-8 z-40 items-center justify-center group">
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
