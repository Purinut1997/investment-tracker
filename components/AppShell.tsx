'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
  const showMarketUtility = pathname === '/dashboard' || pathname.startsWith('/market-watch')

  const sidebarW = collapsed ? 'w-[72px]' : 'w-[240px]'
  const shellColumns = collapsed ? '72px minmax(0, 1fr)' : '240px minmax(0, 1fr)'

  return (
    <div
      className="min-h-screen bg-black text-slate-300 flex lg:grid relative overflow-x-clip"
      style={{ gridTemplateColumns: shellColumns }}
    >
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col border-r border-white/5 bg-[#050505] shrink-0 sticky top-0 h-screen z-40 transition-all duration-300 ease-in-out ${sidebarW}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col shrink-0 p-4 gap-5">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <Link href="/dashboard" className="flex items-center gap-3 no-underline min-w-0">
              <div className="flex items-center justify-center">
                <img src="https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png" alt="Investment PRO Logo" className="h-7 w-auto object-contain brightness-200" />
              </div>
              {!collapsed && (
                <div className="min-w-0 overflow-hidden">
                  <div className="text-[17px] font-bold tracking-tight text-white whitespace-nowrap">
                    Investment PRO
                  </div>
                </div>
              )}
            </Link>

            {!collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all shrink-0 group"
              >
                <PanelLeftClose className="w-4 h-4 group-hover:scale-95 transition-transform" />
              </button>
            )}
          </div>

          {!collapsed && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                <Wallet className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white/90 truncate leading-tight">พอร์ตลงทุนหลัก</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5 flex items-center gap-1.5 uppercase tracking-widest font-medium">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  ซิงค์ล่าสุด
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-11 h-11 mx-auto rounded-2xl flex items-center justify-center bg-white/[0.02] border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all group"
                title="ขยายแถบเมนู (Sidebar)"
              >
                <PanelLeft className="w-5 h-5 group-hover:scale-105 transition-transform" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-visible p-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.groupName} className="space-y-1">
              {!collapsed && (
                <p className={`px-3 ${gIdx === 0 ? 'pt-2' : 'pt-4 border-t border-white/5 mt-3'} mb-2 text-[10px] font-bold tracking-[0.15em] text-zinc-600 uppercase`}>
                  {group.groupName}
                </p>
              )}
              {collapsed && gIdx !== 0 && <div className="h-px bg-white/5 w-6 mx-auto my-3" />}

              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 no-underline group relative active:scale-95 ${
                      active
                        ? 'bg-white/10 text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    } ${collapsed ? 'justify-center w-11 h-11 px-0 mx-auto' : ''}`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${active ? 'text-white' : 'text-zinc-500 group-hover:text-white'}`} />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold shrink-0 uppercase tracking-wider">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {/* Collapsed tooltip */}
                    {collapsed && (
                      <span className="absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-50 flex items-center gap-2">
                        {item.label}
                        {item.badge && <span className="text-purple-300 text-[9px] bg-purple-500/20 px-1.5 py-0.5 rounded-md">{item.badge}</span>}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          {/* Admin section */}
          {isSuperAdminOrAdmin && (
            <div className={`pt-4 mt-2 space-y-1 relative border-t border-white/5`}>
              {!collapsed && (
                <p className="px-3 pb-1 text-[10px] font-bold tracking-[0.15em] text-amber-500/50 uppercase flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-amber-500/50" />
                  Admin
                </p>
              )}
              {SUPERADMIN_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 no-underline group relative active:scale-95 ${
                      active
                        ? 'bg-amber-500/10 text-amber-100 font-medium'
                        : 'text-zinc-500 hover:text-amber-100 hover:bg-amber-500/5'
                    } ${collapsed ? 'justify-center w-11 h-11 px-0 mx-auto' : ''}`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${active ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-400'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <span className="absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-50">
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
        <div className="mt-auto p-4 border-t border-white/5 shrink-0 bg-[#050505]">
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 text-white font-bold flex items-center justify-center text-xs">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-white/[0.02] rounded-2xl p-3 border border-white/5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-slate-200">{userName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white/10 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">PRO</span>
                  <span className="text-[10px] text-zinc-500 truncate capitalize font-mono">{role}</span>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors shrink-0 active:scale-95"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className="min-w-0 flex flex-col pb-24 lg:pb-8 relative z-10 bg-black">
        {/* Desktop Topbar */}
        <header className="hidden lg:flex min-w-0 items-center justify-between gap-4 px-6 xl:px-10 py-4 border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="shrink-0 p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-medium"
              title={collapsed ? 'ขยายแถบเมนู (Sidebar)' : 'ย่อแถบเมนู (Sidebar)'}
            >
              <PanelLeft className="w-4 h-4" />
              <span className="hidden xl:inline">
                {collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
              </span>
            </button>
          </div>

          <div className="min-w-0 flex items-center justify-end gap-3">
            {showMarketUtility && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-zinc-400 text-[11px] font-mono uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </div>
            )}
            <button
              onClick={() => setQuickAddOpen(true)}
              className="bg-white text-black hover:bg-slate-200 font-semibold shrink-0 text-xs py-2 px-4 flex items-center gap-1.5 rounded-xl transition-all active:scale-95 hover:-translate-y-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">บันทึกธุรกรรม</span>
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/5 backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png" alt="Investment Pro" className="w-full h-full object-contain brightness-200" />
              </div>
              <span className="font-bold text-white text-[15px] tracking-tight">Investment PRO</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-1.5 rounded-lg bg-white/10 text-white text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Ticker Tape */}
        {showMarketUtility && <TickerTape />}

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false)
            }}
            className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end"
          >
            <div className="bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <img src="https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png" alt="Investment Pro" className="w-full h-full object-contain brightness-200" />
                  </div>
                  <span className="font-bold text-sm text-white">Investment PRO</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-full text-zinc-500 hover:text-white">
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
                          ? 'bg-white/10 border-white/10 text-white'
                          : 'bg-transparent border-transparent text-zinc-500'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-zinc-500'}`} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">{userEmail}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-3 py-2 rounded-xl bg-white/5 text-white text-xs font-medium flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full max-w-7xl mx-auto overflow-x-clip px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#050505]/95 border-t border-white/5 backdrop-blur-xl px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex justify-around items-center">
        {[
          { href: '/dashboard',    icon: LayoutDashboard, label: 'แดชบอร์ด' },
          { href: '/transactions', icon: ArrowLeftRight,   label: 'ธุรกรรม' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors no-underline ${
              pathname === href ? 'text-white' : 'text-zinc-500'
            }`}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span>{label}</span>
          </Link>
        ))}

        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl text-[10px] font-bold text-black bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
        >
          <Plus className="w-5 h-5" />
          <span>บันทึก</span>
        </button>

        {[
          { href: '/accounts', icon: Wallet, label: 'บัญชี' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors no-underline ${
              pathname === href ? 'text-white' : 'text-zinc-500'
            }`}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span>{label}</span>
          </Link>
        ))}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium text-zinc-500"
        >
          <Menu className="w-5 h-5 mb-1" />
          <span>เมนู</span>
        </button>
      </nav>

      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
