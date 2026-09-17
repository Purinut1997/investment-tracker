'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Activity,
  Key,
  Globe,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  User
} from 'lucide-react'

export default function SuperadminLogsPage() {
  const [tab, setTab] = useState<'audit' | 'login'>('audit')
  const [page, setPage] = useState(1)
  const [limit] = useState(30)

  const { data, isLoading, error } = useSWR(`/api/superadmin/logs?type=${tab}&page=${page}&limit=${limit}`)
  const logs: any[] = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit) || 1

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Security & Audit
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <ShieldAlert className="w-7 h-7 text-amber-400" />
              <span>บันทึกความปลอดภัย (Audit Logs)</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              ตรวจสอบประวัติการทำรายการสำคัญของระบบ และการพยายามล็อกอินทั้งหมดเพื่อเฝ้าระวัง Brute-force
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => {
              setTab('audit')
              setPage(1)
            }}
            className={`py-3 px-5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              tab === 'audit'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Audit Logs (ประวัติเหตุการณ์)</span>
          </button>
          <button
            onClick={() => {
              setTab('login')
              setPage(1)
            }}
            className={`py-3 px-5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              tab === 'login'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Login Attempts (ประวัติล็อกอิน)</span>
          </button>
        </div>

        {/* Table View */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
              <span className="text-xs">กำลังโหลดบันทึกความปลอดภัย...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-red-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูลบันทึก
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              ยังไม่มีบันทึกข้อมูลในหมวดนี้
            </div>
          ) : tab === 'audit' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase tracking-wider text-[11px] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">วันเวลา (UTC/BKK)</th>
                    <th className="py-3 px-4">การกระทำ (Action)</th>
                    <th className="py-3 px-4">ผู้ใช้งาน</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">รายละเอียด (Details)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                      <td className="py-3 px-4 text-[var(--text-muted)] text-[11px] whitespace-nowrap font-sans">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans whitespace-nowrap">
                        {log.user ? (
                          <div>
                            <span className="font-semibold text-white">{log.user.name || log.user.email}</span>
                            <span className="text-[10px] text-[var(--text-muted)] block">{log.user.role}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">System Event</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] text-[11px] whitespace-nowrap">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--text-secondary)] max-w-xs truncate">
                        {log.detail ? JSON.stringify(log.detail) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase tracking-wider text-[11px] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">วันเวลาที่พยายาม</th>
                    <th className="py-3 px-4">อีเมลเป้าหมาย</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4 text-right">ผลลัพธ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {logs.map((att: any) => (
                    <tr key={att.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                      <td className="py-3 px-4 text-[var(--text-muted)] text-[11px] whitespace-nowrap font-sans">
                        {new Date(att.attemptedAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap font-sans">
                        {att.email}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] text-[11px] whitespace-nowrap">
                        {att.ipAddress || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {att.success ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            SUCCESS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                            FAILED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[var(--border)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">
                หน้า {page} จากทั้งหมด {totalPages} ({total} รายการ)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
