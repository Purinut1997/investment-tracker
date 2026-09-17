'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
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
  Mail
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
      setActionError(err.message || 'เกิดข้อผิดพลาด')
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
      setActionError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Superadmin Control Panel
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Users className="w-7 h-7 text-amber-400" />
              <span>จัดการผู้ใช้งานในระบบ</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              ตรวจสอบรายชื่อ กำหนดสิทธิ์ (Roles), และควบคุมการระงับบัญชี (พร้อมระบบป้องกัน Last Superadmin)
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {actionError && (
          <div className="alert alert-danger flex items-center gap-2.5 text-xs animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="alert alert-success flex items-center gap-2.5 text-xs animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-[var(--green-400)] shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
        )}

        {/* Search Toolbar */}
        <div className="card p-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9 text-xs sm:text-sm"
              placeholder="ค้นหาด้วยชื่อ หรืออีเมล..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
              <span className="text-xs">กำลังโหลดรายชื่อผู้ใช้...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-red-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูล (Forbidden หรือ Server Error)
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              ไม่พบผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase tracking-wider text-[11px] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3 px-4">ผู้ใช้งาน / อีเมล</th>
                      <th className="py-3 px-4">วิธีสมัคร</th>
                      <th className="py-3 px-4">ยืนยันอีเมล</th>
                      <th className="py-3 px-4">ธุรกรรม</th>
                      <th className="py-3 px-4">ระดับสิทธิ์ (Role)</th>
                      <th className="py-3 px-4">สถานะบัญชี</th>
                      <th className="py-3 px-4 text-right">วันที่สมัคร</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {users.map((u) => {
                      const isUpdating = updatingId === u.id
                      return (
                        <tr key={u.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{u.name ?? 'ไม่ระบุชื่อ'}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] font-mono">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] uppercase">
                              {u.authProvider}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {u.emailVerified ? (
                              <span className="inline-flex items-center gap-1 text-[var(--green-400)] text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>ยืนยันแล้ว</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-400 text-[11px]">
                                <Mail className="w-3.5 h-3.5" />
                                <span>ยังไม่ยืนยัน</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-white tabular-nums">
                            {u._count?.transactions ?? 0} รายการ
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              className="select text-xs py-1 px-2.5 bg-[var(--bg-surface)] border-[var(--border)] rounded-lg font-semibold"
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
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                                u.status === 'active'
                                  ? 'bg-emerald-500/10 border-green-500/20 text-[var(--green-400)] hover:bg-green-500/10'
                                  : 'bg-rose-500/10 border-red-500/20 text-[var(--red-400)] hover:bg-red-500/10'
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
                          <td className="py-3.5 px-4 text-right text-[var(--text-muted)] text-[11px] whitespace-nowrap">
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
                <div className="p-4 border-t border-[var(--border)] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">
                    หน้า {page} จากทั้งหมด {totalPages} ({total} ผู้ใช้)
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
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
