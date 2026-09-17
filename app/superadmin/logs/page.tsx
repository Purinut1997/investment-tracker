'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
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
  User,
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
      <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
        <PageHeader
          eyebrow="SECURITY & AUDIT"
          title="บันทึกความปลอดภัย"
          description="ตรวจสอบเหตุการณ์สำคัญของระบบและการพยายามเข้าสู่ระบบเพื่อเฝ้าระวังความผิดปกติ"
        />

        {/* Tab Switcher */}
        <div className="flex border-b border-white/[0.08] gap-2">
          <button
            onClick={() => {
              setTab('audit')
              setPage(1)
            }}
            className={`py-3 px-5 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${
              tab === 'audit'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]'
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
            className={`py-3 px-5 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${
              tab === 'login'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Login Attempts (ประวัติการล็อกอิน)</span>
          </button>
        </div>

        {/* Table View */}
        <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <span className="text-xs">กำลังโหลดบันทึกความปลอดภัย...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-rose-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูลบันทึก
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              ยังไม่มีบันทึกข้อมูลในหมวดนี้
            </div>
          ) : tab === 'audit' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181C25]/80 text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-4">วันเวลา (UTC/BKK)</th>
                    <th className="py-3.5 px-4">การกระทำ (Action)</th>
                    <th className="py-3.5 px-4">ผู้ใช้งาน</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">รายละเอียด (Details)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 text-zinc-400 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md font-semibold text-[11px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.user ? (
                          <div>
                            <span className="font-medium text-white">{log.user.name || log.user.email}</span>
                            <span className="text-[11px] text-zinc-500 block">{log.user.role}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">System Event</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-xs whitespace-nowrap">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-300 max-w-xs truncate font-mono">
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
                <thead className="bg-[#181C25]/80 text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-4">วันเวลาที่พยายาม</th>
                    <th className="py-3.5 px-4">อีเมลเป้าหมาย</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4 text-right">ผลลัพธ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map((att: any) => (
                    <tr key={att.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 text-zinc-400 text-xs whitespace-nowrap">
                        {new Date(att.attemptedAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white whitespace-nowrap">
                        {att.email}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-xs whitespace-nowrap">
                        {att.ipAddress || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {att.success ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            สำเร็จ (SUCCESS)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                            ล้มเหลว (FAILED)
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
            <div className="p-4 border-t border-white/[0.06] flex items-center justify-between text-xs bg-[#181C25]/40">
              <span className="text-zinc-400">
                หน้า {page} จากทั้งหมด {totalPages} ({total} รายการ)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-white/10 bg-[#181C25] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-white/10 bg-[#181C25] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors"
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
