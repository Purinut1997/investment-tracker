/**
 * lib/email/send.ts — Email service using Resend
 * Abstraction layer: swap provider by changing this file only.
 */

import { Resend } from 'resend'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }
  return new Resend(apiKey)
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@investmenttracker.app'
const BRAND_NAME = 'Investment Pro'
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export async function sendEmailVerification(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${BASE_URL}/verify-email?token=${token}`
  const resend = getResend()
  if (!resend) {
    console.warn(`[Email Mock] Verification link for ${email}: ${url}`)
    return
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `ยืนยันอีเมล — ${BRAND_NAME}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#22d3ee;margin-bottom:8px">ยืนยันอีเมลของคุณ</h2>
        <p>สวัสดีคุณ ${name},</p>
        <p>กดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>
        <a href="${url}" style="display:inline-block;background:#22d3ee;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          ยืนยันอีเมล
        </a>
        <p style="color:#64748b;font-size:14px">หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${url}</p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
        <p style="color:#64748b;font-size:12px">Created by MIKPURINUT</p>
      </div>
    `,
  })
}

export async function sendPasswordReset(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${BASE_URL}/reset-password?token=${token}`
  const resend = getResend()
  if (!resend) {
    console.warn(`[Email Mock] Password reset link for ${email}: ${url}`)
    return
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `รีเซ็ตรหัสผ่าน — ${BRAND_NAME}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#f59e0b;margin-bottom:8px">รีเซ็ตรหัสผ่าน</h2>
        <p>สวัสดีคุณ ${name},</p>
        <p>มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง</p>
        <a href="${url}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          รีเซ็ตรหัสผ่าน
        </a>
        <p style="color:#64748b;font-size:14px">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถเพิกเฉยอีเมลนี้ได้</p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
        <p style="color:#64748b;font-size:12px">Created by MIKPURINUT</p>
      </div>
    `,
  })
}

export async function sendWeeklyDigest(
  email: string,
  name: string,
  digestContent: string,
  weekOf: string
): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.warn(`[Email Mock] Weekly digest for ${email}: skipped (no API key)`)
    return
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `📊 สรุปพอร์ตประจำสัปดาห์ ${weekOf} — ${BRAND_NAME}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#22d3ee">📊 สรุปพอร์ตประจำสัปดาห์</h2>
        <p style="color:#64748b">สัปดาห์ ${weekOf}</p>
        <div style="background:#0f172a;border-radius:12px;padding:24px;color:#e2e8f0;line-height:1.7">
          ${digestContent.replace(/\n/g, '<br>')}
        </div>
        <p style="margin-top:24px"><a href="${BASE_URL}/dashboard" style="color:#22d3ee">เปิดแดชบอร์ด →</a></p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
        <p style="color:#64748b;font-size:12px">Created by MIKPURINUT · <a href="${BASE_URL}/settings" style="color:#64748b">ปิดการแจ้งเตือนทางอีเมล</a></p>
      </div>
    `,
  })
}
