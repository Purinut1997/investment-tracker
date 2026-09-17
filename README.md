# Investment Tracker

ระบบบันทึกและวิเคราะห์การลงทุนส่วนบุคคล แบบ full-stack พร้อม AI features

**Stack**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL (Neon) · Prisma · NextAuth v5 · Gemini AI

---

## ⚡ Quick Setup

### 1. Clone และ Install
```bash
git clone <repo-url>
cd investment-tracker
npm install
```

### 2. ตั้งค่า Environment Variables
```bash
cp .env.example .env.local
```
แก้ไข `.env.local` ตามค่าจริงของคุณ (ดูรายละเอียดด้านล่าง)

### 3. สร้าง Neon Database
1. ไปที่ [neon.tech](https://neon.tech) → สร้าง project ใหม่
2. Copy **connection string** (Pooled) → ใส่ใน `DATABASE_URL`
3. Copy **direct connection string** → ใส่ใน `DIRECT_URL`

### 4. ตั้งค่า Google OAuth
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง OAuth 2.0 Client ID
3. Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`
4. ใส่ค่าใน `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET`

### 5. สมัคร API Keys
| Service | ลิงก์สมัคร | หมายเหตุ |
|---------|-----------|---------|
| Gemini AI | [aistudio.google.com](https://aistudio.google.com) | ฟรี — Flash/Flash-Lite |
| Finnhub | [finnhub.io](https://finnhub.io) | ฟรี personal use, 60 req/min |
| CoinGecko | [coingecko.com/en/api](https://www.coingecko.com/en/api/pricing) | Demo API key ฟรี 10K req/mo |
| Resend | [resend.com](https://resend.com) | ฟรี 3,000 email/mo |

### 6. ตั้งค่า ENCRYPTION_KEY
```bash
# สร้าง 32-byte hex key (รัน command นี้ครั้งเดียว และบันทึกไว้ในที่ปลอดภัย)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
> ⚠️ **สำคัญมาก**: ถ้า `ENCRYPTION_KEY` หายหรือถูกเปลี่ยนหลัง deploy แล้ว Gemini API key ทั้งหมดใน DB จะ decrypt ไม่ได้อีก — ต้องสำรอง key นี้ไว้ในที่ปลอดภัยแยกจาก repo เสมอ (เช่น password manager)

### 7. รัน Database Migration
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 8. Deploy ขึ้น Vercel
```bash
# เชื่อม repo กับ Vercel แล้วตั้งค่า env vars ใน Vercel Dashboard
# จากนั้น push ขึ้น GitHub — Vercel จะ deploy อัตโนมัติ
```

---

## 🔑 Environment Variables

```env
# Database (Neon)
DATABASE_URL="postgresql://..."           # Pooled connection
DIRECT_URL="postgresql://..."            # Direct connection (for migrations)

# NextAuth
NEXTAUTH_SECRET="<random 32+ char string>"
NEXTAUTH_URL="https://yourdomain.com"    # หรือ http://localhost:3000 สำหรับ dev

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Encryption (สำหรับ Gemini API key ที่เก็บใน DB)
ENCRYPTION_KEY="<64-char hex string>"

# Market Data
FINNHUB_API_KEY="..."
COINGECKO_API_KEY="..."                  # CoinGecko Demo API key
TWELVE_DATA_API_KEY=""                   # Optional: historical data fallback

# Email Service (Resend)
RESEND_API_KEY="..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# Cron Security
CRON_SECRET="<random string>"

# Superadmin
SUPERADMIN_EMAIL="your-email@gmail.com"

# Optional: Error Monitoring
SENTRY_DSN=""
```

---

## ⚠️ สิ่งที่ต้องรู้เกี่ยวกับ Gemini AI

> **Google AI Pro/Ultra subscription ส่วนตัวของคุณ ≠ การเรียก Gemini API จากแอปนี้**

- Google AI Pro subscription ใช้ได้เฉพาะใน AI Studio Playground เท่านั้น
- การเรียก API จากแอปนี้ถูกคิดแยกผ่าน **Gemini Developer API free tier** เสมอ
- **Free tier** (Flash/Flash-Lite): ใช้ได้ฟรี ไม่มีค่าใช้จ่าย
- **Pro models**: ต้องเปิด **Cloud Billing** บน Google Cloud project แยกต่างหาก — มีค่าใช้จ่ายจริง

---

## ⚠️ Finnhub Free Tier

- **Personal/non-commercial use only** — เหมาะกับการใช้คนเดียว (Phase 0-9)
- ถ้าเปิดให้คนอื่นสมัครใช้งาน (Phase 10) ต้องตรวจสอบเงื่อนไข Finnhub ซ้ำ
- Historical candle endpoint ถูก restrict — ระบบใช้ cron สะสมรายวันแทน

---

## 🚀 Development

```bash
npm run dev          # localhost:3000
npx prisma studio    # Prisma GUI
npx prisma migrate dev --name <name>
```

---

*Created by MIKPURINUT*
