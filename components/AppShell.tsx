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
  ExternalLink
} from 'lucide-react'
import { QuickAddModal } from './QuickAddModal'

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
  { label: 'แผน & สัดส่วน', href: '/plans', icon: PieChart },
  { label: 'ตลาดการเงิน', href: '/market-watch', icon: TrendingUp },
  { label: 'ข่าวสาร & Digest', href: '/news', icon: Newspaper },
  { label: 'รายงานภาษี', href: '/tax-report', icon: ReceiptText },
  { label: 'ตั้งค่าระบบ', href: '/settings', icon: Settings },
]

const SUPERADMIN_NAV: NavItem[] = [
  { label: 'จัดการผู้ใช้', href: '/superadmin/users', icon: Users },
  { label: 'Audit Logs', href: '/superadmin/logs', icon: ShieldAlert },
  { label: 'โมเดล AI', href: '/superadmin/settings', icon: Cpu },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const role = (session?.user as { role?: string })?.role ?? 'user'
  const isSuperAdminOrAdmin = role === 'superadmin' || role === 'admin'
  const userName = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'นักลงทุน'
  const userEmail = session?.user?.email ?? ''

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex">
      {/* ─── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--bg-surface)] shrink-0 sticky top-0 h-screen z-40">
        {/* Brand Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-transform group-hover:scale-105">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
                <span>INVESTMENT</span>
                <span className="text-[var(--cyan-400)] text-xs font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-medium">
                Tracker v5
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
                      ? 'bg-cyan-500/15 text-[var(--cyan-400)] border border-cyan-500/30 font-semibold shadow-[0_0_15px_rgba(34,211,238,0.08)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
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
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-amber-200 hover:bg-[var(--bg-elevated)]'
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
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
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
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="ออกจากระบบ"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-center text-[var(--text-muted)] mt-2">
            Created by MIKPURINUT
          </p>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border)] backdrop-blur-md bg-opacity-90">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-white text-sm">INVESTMENT AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-2 rounded-lg bg-cyan-500/20 text-[var(--cyan-400)] border border-cyan-500/30 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึก</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
            <div className="bg-[var(--bg-surface)] border-t border-[var(--border)] rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <span className="font-bold text-base">เมนูทั้งหมด</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
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
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium no-underline ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-500/30 text-[var(--cyan-400)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]'
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
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-1.5"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface)] border-t border-[var(--border)] backdrop-blur-lg bg-opacity-95 px-2 py-1.5 flex justify-around items-center">
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
        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-transform active:scale-95"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
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

      {/* ─── DESKTOP FLOATING ACTION BUTTON (FAB) ──────────────────── */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="hidden md:flex fixed bottom-8 right-8 z-40 items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 text-black font-semibold text-sm shadow-[0_4px_25px_rgba(34,211,238,0.35)] hover:shadow-[0_4px_30px_rgba(34,211,238,0.5)] transition-all hover:scale-105 active:scale-95"
        title="บันทึกธุรกรรมด่วนด้วย AI"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>บันทึกด่วน</span>
        <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-bold">
          AI
        </span>
      </button>

      {/* ─── QUICK ADD MODAL (Natural Language & Quick Add) ────────── */}
      {quickAddOpen && (
        <QuickAddModal onClose={() => setQuickAddOpen(false)} />
      )}
    </div>
  )
}
