'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import useSWR from 'swr'
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
    groupName: 'ภาพรวม',
    items: [
      { label: 'แดชบอร์ด',        href: '/dashboard',    icon: LayoutDashboard },
    ]
  },
  {
    groupName: 'พอร์ตของฉัน',
    items: [
      { label: 'รายการธุรกรรม',   href: '/transactions', icon: ArrowLeftRight },
      { label: 'บัญชีการเงิน',    href: '/accounts',     icon: Wallet },
      { label: 'รายงานภาษี',      href: '/tax-report',   icon: ReceiptText },
    ]
  },
  {
    groupName: 'วางแผน',
    items: [
      { label: 'แผนการลงทุน',     href: '/plans',        icon: PieChart },
      { label: 'พยากรณ์พอร์ต',   href: '/forecast',     icon: Sparkles, badge: 'AI' },
    ]
  },
  {
    groupName: 'ตลาดและข้อมูล',
    items: [
      { label: 'จับตาตลาด',       href: '/market-watch', icon: TrendingUp },
      { label: 'สรุปข่าวเศรษฐกิจ', href: '/news',        icon: Newspaper },
    ]
  },
  {
    groupName: 'ระบบ',
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
  const { data: accountsData } = useSWR('/api/accounts')
  const { data: transactionsData } = useSWR('/api/transactions?limit=1')
  const hasAccounts = (accountsData?.accounts?.length ?? 0) > 0
  const hasTransactions = (transactionsData?.transactions?.length ?? 0) > 0
  const ctaLabel = !hasAccounts ? 'สร้างบัญชีลงทุน' : hasTransactions ? 'บันทึกธุรกรรม' : 'เพิ่มธุรกรรมแรก'
  const ctaHref = !hasAccounts ? '/accounts' : '/transactions'
  const openQuickAdd = () => {
    if (hasAccounts) setQuickAddOpen(true)
  }

  const sidebarW = collapsed ? 'app-sidebar-collapsed' : 'app-sidebar-expanded'

  return (
    <div
      className="app-shell min-h-screen text-slate-200 relative overflow-x-clip"
      style={{ '--sidebar-width': collapsed ? '72px' : '240px' } as React.CSSProperties}
    >
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside
        className={`app-sidebar flex-col border-r border-white/10 bg-[#12151C] shrink-0 sticky top-0 h-screen z-40 transition-[width] duration-200 ease-out ${sidebarW}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col shrink-0 p-4 pb-2 gap-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <Link href="/dashboard" className="flex items-center gap-3 no-underline min-w-0 group">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 p-1 flex items-center justify-center shrink-0 shadow-md">
                <img src="/logo.png" alt="Investment Pro" className="w-full h-full object-contain" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <span className="text-[15px] font-bold tracking-tight text-white">Investment Pro</span>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">ระบบจัดการพอร์ตลงทุน</p>
                </div>
              )}
            </Link>

            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0"
                title="ย่อแถบเมนู"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="ขยายแถบเมนู"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto overflow-x-visible px-3 py-2 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupName} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  {group.groupName}
                </p>
              )}
              {collapsed && <div className="h-px bg-slate-800/80 w-6 mx-auto my-2" />}

              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 no-underline group relative ${
                      active
                        ? 'bg-indigo-500/15 text-white font-semibold border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    } ${collapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {/* Collapsed tooltip */}
                    {collapsed && (
                      <span className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 border border-slate-700 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-50 flex items-center gap-2">
                        {item.label}
                        {item.badge && <span className="text-purple-300 text-[9px] bg-purple-500/20 px-1.5 py-0.5 rounded">{item.badge}</span>}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          {/* Admin section */}
          {isSuperAdminOrAdmin && (
            <div className="pt-2 space-y-1 border-t border-slate-800/80">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold tracking-wider text-amber-500/70 uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all no-underline group relative ${
                      active
                        ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                        : 'text-slate-400 hover:text-amber-200 hover:bg-amber-500/5'
                    } ${collapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-300'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <span className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-amber-200 bg-slate-900 border border-amber-500/30 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-50">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* User Profile Footer */}
        <div className="mt-auto p-3 border-t border-slate-800/80 bg-slate-950/90">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-200 font-bold flex items-center justify-center text-xs">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-200 font-bold flex items-center justify-center text-xs shrink-0">
                  {userName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{userEmail || role}</p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className="min-w-0 flex flex-col pb-20 lg:pb-6 relative z-10">
        <div className="sticky top-0 z-30 w-full flex flex-col">
          {/* Real-time Market Ticker Tape */}
          <TickerTape />

          {/* Desktop Topbar */}
          <header className="app-desktop-topbar min-w-0 items-center justify-between gap-4 px-6 xl:px-10 py-3 border-b border-white/10 bg-[#12151C]/95 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-2 text-xs"
                title={collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
              >
                <PanelLeft className="w-4 h-4" />
                <span className="hidden xl:inline text-slate-400">
                  {collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={ctaHref}
                onClick={hasAccounts ? (event) => { event.preventDefault(); openQuickAdd() } : undefined}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs min-h-9 py-2 px-3.5 flex items-center gap-1.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{ctaLabel}</span>
              </Link>
            </div>
          </header>

          {/* Mobile Header */}
          <header className="app-mobile-only items-center justify-between px-4 py-2.5 bg-[#12151C]/95 border-b border-white/10 backdrop-blur-xl">
            <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 p-0.5 flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-semibold text-white text-sm">Investment Pro</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href={ctaHref} onClick={hasAccounts ? (event) => { event.preventDefault(); openQuickAdd() } : undefined} className="w-9 h-9 rounded-lg bg-indigo-600 text-white text-xs flex items-center justify-center" title={ctaLabel}>
                <Plus className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </header>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false)
            }}
            className="app-mobile-only fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex-col justify-end"
          >
            <div className="bg-slate-950 border-t border-slate-800 rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 animate-slide-up shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 p-0.5 flex items-center justify-center">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-semibold text-sm text-white">Investment Pro</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:text-white">
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
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                          : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono truncate max-w-[180px]">{userEmail}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Canvas Area */}
        <main className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────── */}
      <nav className="app-mobile-only fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 border-t border-slate-800 backdrop-blur-xl px-2 py-2 justify-around items-center">
        {[
          { href: '/dashboard',    icon: LayoutDashboard, label: 'แดชบอร์ด' },
          { href: '/transactions', icon: ArrowLeftRight,   label: 'ธุรกรรม' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors no-underline ${
              pathname === href ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span>{label}</span>
          </Link>
        ))}

        <Link href={ctaHref} onClick={hasAccounts ? (event) => { event.preventDefault(); openQuickAdd() } : undefined} className="flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 px-3 rounded-xl text-[10px] font-bold text-white bg-indigo-600">
          <Plus className="w-5 h-5" />
          <span>{hasAccounts ? 'บันทึก' : 'สร้างบัญชี'}</span>
        </Link>

        {[
          { href: '/accounts', icon: Wallet, label: 'บัญชี' },
          { href: '/market-watch', icon: TrendingUp, label: 'ตลาด' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors no-underline ${
              pathname === href ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span>{label}</span>
          </Link>
        ))}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium text-slate-400"
        >
          <Menu className="w-5 h-5 mb-1" />
          <span>เมนู</span>
        </button>
      </nav>

      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
