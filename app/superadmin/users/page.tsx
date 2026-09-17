'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Users,
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  UserX,
  Mail,
  Filter,
} from 'lucide-react'

export default function SuperadminUsersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { q: search }),
  })

  const { data, isLoading, error } = useSWR(`/api/superadmin/users?${queryParams.toString()}`)
  const users: any[] = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit) || 1

  async function handleRoleChange(userId: string, newRole: string) {
    setActionError('')
    setActionSuccess('')
    setUpdatingId(userId)

    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'เปลี่ยนสิทธิ์ไม่สำเร็จ')

      setActionSuccess('เปลี่ยนสิทธิ์ผู้ใช้งานเรียบร้อยแล้ว')
      mutate(`/api/superadmin/users?${queryParams.toString()}`)
    } catch (err: any) {
      setActionError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleStatusToggle(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    if (!confirm(`คุณต้องการเปลี่ยนสถานะบัญชีนี้เป็น "${newStatus === 'active' ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}" ใช่หรือไม่?`)) {
      return
    }

    setActionError('')
    setActionSuccess('')
    setUpdatingId(userId)

    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      })

      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'เปลี่ยนสถานะไม่สำเร็จ')

      setActionSuccess('อัปเดตสถานะบัญชีผู้ใช้งานเรียบร้อยแล้ว')
      mutate(`/api/superadmin/users?${queryParams.toString()}`)
    } catch (err: any) {
      setActionError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
        <PageHeader
          eyebrow="SUPERADMIN"
          title="จัดการผู้ใช้งานในระบบ"
          description="ตรวจสอบรายชื่อ กำหนดระดับสิทธิ์การเข้าถึง และควบคุมการระงับการใช้งานบัญชี"
        />

        {/* Feedback Alerts */}
        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-xs text-rose-400 font-medium animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-400 font-medium animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Search Toolbar */}
        <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl p-4 shadow-xl shadow-black/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="w-full bg-[#181C25] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="ค้นหาด้วยชื่อ หรืออีเมล..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span>ทั้งหมด <strong className="text-white font-mono">{total}</strong> บัญชี</span>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <span className="text-xs">กำลังโหลดรายชื่อผู้ใช้...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-rose-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูล (Forbidden หรือ Server Error)
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              ไม่พบผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181C25]/80 text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                    <tr>
                      <th className="py-3.5 px-4">ผู้ใช้งาน / อีเมล</th>
                      <th className="py-3.5 px-4">วิธีสมัคร</th>
                      <th className="py-3.5 px-4">ยืนยันอีเมล</th>
                      <th className="py-3.5 px-4">ธุรกรรม</th>
                      <th className="py-3.5 px-4">ระดับสิทธิ์ (Role)</th>
                      <th className="py-3.5 px-4">สถานะบัญชี</th>
                      <th className="py-3.5 px-4 text-right">วันที่สมัคร</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {users.map((u) => {
                      const isUpdating = updatingId === u.id
                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{u.name ?? 'ไม่ระบุชื่อ'}</div>
                            <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#181C25] border border-white/10 text-zinc-300 uppercase font-mono">
                              {u.authProvider}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {u.emailVerified ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>ยืนยันแล้ว</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                                <Mail className="w-3.5 h-3.5" />
                                <span>ยังไม่ยืนยัน</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-zinc-200 tabular-nums">
                            {u._count?.transactions ?? 0} รายการ
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              className="text-xs py-1.5 px-2.5 bg-[#181C25] border border-white/10 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                              value={u.role}
                              disabled={isUpdating}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            >
                              <option value="user">User (ผู้ใช้ปกติ)</option>
                              <option value="admin">Admin (ผู้ดูแล)</option>
                              <option value="superadmin">Superadmin (สูงสุด)</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleStatusToggle(u.id, u.status)}
                              disabled={isUpdating}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                u.status === 'active'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                              }`}
                            >
                              {u.status === 'active' ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>เปิดใช้งาน</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>ถูกระงับ</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right text-zinc-400 text-xs whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString('th-TH')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-white/[0.06] flex items-center justify-between text-xs bg-[#181C25]/40">
                  <span className="text-zinc-400">
                    หน้า {page} จากทั้งหมด {totalPages} ({total} ผู้ใช้)
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
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
