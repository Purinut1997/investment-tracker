# Investment Tracker - Progress Log

Last updated: 2026-09-17

## สถานะภาพรวม
- **Phase ที่เสร็จสมบูรณ์**: Phase 0 ถึง Phase 8 ครบถ้วน 100%
- **สถานะ Deployment**: ออนไลน์แล้วบน Vercel Production (`https://investment-tracker-three-sand.vercel.app`)
- **Database**: เชื่อมต่อสดกับ Neon PostgreSQL (ap-southeast-1) พร้อม 20 ตารางและโมเดล AI
- **Superadmin**: บัญชี `themikthemik4015@gmail.com` ได้รับสิทธิ์ Superadmin เรียบร้อย
- **แผนงานปัจจุบัน**: อยู่ระหว่างเตรียมทำ [UI_REDESIGN_PLAN.md](./UI_REDESIGN_PLAN.md) เพื่อยกเครื่องหน้าตาเว็บและแอนิเมชันสู่ Luxury Fintech
- **สถานะ Build**: `npm run build` ผ่าน 100% (45 Static/Dynamic routes)
- **Unit Test**: `npm run test:tax` ผ่านทุกเงื่อนไข (FIFO Cost Basis, Thai SET Tax Exemption, Withholding Tax)

---

## สรุป Phase ที่สร้างเสร็จสมบูรณ์

### 1. Phase 0: Setup พื้นฐาน ✅
- Next.js 16 (Turbopack) + TypeScript + Tailwind CSS v4
- `prisma/schema.prisma` ครบทั้ง 20 ตาราง
- `prisma/seed.ts` สร้าง Superadmin และ 7 AI Model Options
- PWA `manifest.json`, `vercel.json` สำหรับ Cron jobs, Dark Theme Design System

### 2. Phase 1: Authentication & Authorization ✅
- NextAuth.js v5 (Google OAuth + Credentials)
- AES-256-GCM encryption สำหรับ Gemini API Key (`lib/crypto.ts`)
- Database-backed rate limiting ป้องกัน brute force (`LoginAttempt`)
- Superadmin auto-promote และระบบป้องกันการลดสิทธิ์คนสุดท้าย (`hasOtherSuperadmin`)
- ระบบส่งอีเมลยืนยันตัวตนและรีเซ็ตรหัสผ่าน (`Resend` พร้อม fallback)
- หน้า UI: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/superadmin/users`, `/superadmin/logs`

### 3. Phase 2: Core Transaction System ✅
- CRUD Transactions พร้อมบันทึกประวัติการแก้ไขอัตโนมัติ (`TransactionEditHistory`)
- นำเข้า CSV พร้อมระบบตรวจจับรายการซ้ำ (Duplicate Detection) และ PapaParse preview
- บัญชีการเงินแยกตามประเภท (Brokerage, Crypto Exchange, Bank, Cash) พร้อมระบบป้องกันการลบบัญชีที่มีธุรกรรม
- Navigation Shell ครบวงจร (`AppShell.tsx` สำหรับ Desktop Sidebar, Mobile Bottom Bar, และ FAB)
- Quick Add Modal (Natural Language AI Parsing + Manual Form)
- หน้า UI: `/transactions`, `/accounts`, `/dashboard`

### 4. Phase 3: Market Data Integration ✅
- Abstraction Layer กลาง (`lib/market-data/types.ts`) รองรับการสลับ Provider
- Finnhub (หุ้นสหรัฐฯ), CoinGecko (คริปโต), Stooq (หุ้นไทย .BK และทองคำ GC.F), Frankfurter (อัตราแลกเปลี่ยน FX ไม่จำกัด)
- Cache Layer บันทึกและดึงราคาจาก `PriceHistory` ในฐานข้อมูล
- Cron job: `GET /api/cron/sync-prices`
- หน้า UI: `/market-watch` พร้อมเครื่องมือแปลงสกุลเงินด่วนแบบ Real-time

### 5. Phase 4: Portfolio Holdings & Analytics ✅
- คำนวณต้นทุนเฉลี่ย, มูลค่าตลาดตามเวลาจริง, กำไร/ขาดทุนที่ยังไม่ขาย (Unrealized P&L) และที่ขายแล้ว (Realized Gain)
- Portfolio Health Score คำนวณจาก Diversification (HHI 40%), Target Alignment (40%), Concentration Risk (20%)
- หน้า UI: `/dashboard` แสดงผลเกจสุขภาพพอร์ต, กราฟ Recharts Donut & Line, การ์ดตัวเลขอัตโนมัติ (CountUp), และตาราง Holdings

### 6. Phase 5: AI Engine & Gemini Integration ✅
- Multi-model Gemini client (`lib/ai/gemini-client.ts`) รองรับ Auto fallback chain และ Manual mode
- ฟังก์ชัน AI Advisor วิเคราะห์พอร์ต Rebalancing และความเสี่ยง (`/api/ai-advisor/analyze`)
- ฟังก์ชัน Natural Language Quick-add แกะข้อความเป็น JSON (`/api/ai-advisor/quick-add`)
- หน้า UI: `/settings` (จัดการ API Key เข้ารหัส, เลือกรุ่นโมเดล, สกุลเงินหลัก, ออกจากระบบทุกอุปกรณ์)
- หน้า UI: `/superadmin/settings` (จัดการ `AiModelOption` เพิ่ม/แก้โมเดล Gemini โดยไม่ต้อง redeploy)

### 7. Phase 6: Presets & Forecast ✅
- กำหนดสัดส่วนเป้าหมายและแผนการลงทุน (`InvestmentPreset`)
- คำนวณและเปรียบเทียบสัดส่วนจริงกับเป้าหมาย พร้อมแนะนำการ Rebalance
- แบบจำลอง Monte Carlo Simulation (500 paths ด้วย Geometric Brownian Motion) คำนวณเส้นพัด P10, P50, P90 และโอกาสบรรลุเป้าหมาย
- ฟังก์ชัน AI อธิบายผลลัพธ์การจำลองเป็นภาษาคน (`/api/ai-advisor/explain-forecast`)
- หน้า UI: `/plans`, `/forecast`

### 8. Phase 7: News System & Weekly Digest ✅
- ดึงข่าวจาก Finnhub แยกข่าวพอร์ตและข่าวตลาดทั่วไป พร้อมตัดข่าวซ้ำ (`NewsItem`)
- Cron job: `GET /api/cron/weekly-digest` รันทุกวันจันทร์ ส่งสรุปทางอีเมลและแอป
- หน้า UI: `/news` พร้อมแท็ก Sentiment (Positive / Neutral / Negative)

### 9. Phase 8: Tax Report & Unit Tests ✅
- อัลกอริทึมคำนวณต้นทุนแบบ FIFO (`lib/analytics/tax-fifo.ts`) แยก 3 หมวดตามเกณฑ์สรรพากรไทย:
  1. ปันผลและภาษีหัก ณ ที่จ่าย
  2. กำไรหุ้นไทย (SET - ได้รับการยกเว้นภาษี)
  3. กำไรหุ้นต่างประเทศและคริปโต
- ฟังก์ชัน AI ช่วยสรุปรายงานภาษีและสิทธิประโยชน์ (`/api/tax-report/explain`)
- ส่งออกรายงานเป็นไฟล์ Excel (.xlsx) ด้วย `xlsx`
- Unit Test ผ่าน 100%: `npm run test:tax`
- หน้า UI: `/tax-report` พร้อมข้อความแจ้งเตือนทางกฎหมาย (Legal Disclaimer)

### 10. Phase 9: Luxury Fintech UI/UX & Motion Overhaul ✅
- **Design System 2.0**: Luxury Palette (Emerald Neon, Crimson Rose, Cyan, Royal Violet), Mesh Gradient Ambient Aura (`.ambient-aura-bg`), และ Luxury Glassmorphism (`.card-luxury`, `.glass-card` พร้อม Top Inner Highlight)
- **Wall Street Marquee Ticker Tape (`components/TickerTape.tsx`)**: แถบราคาหุ้น/คริปโต/ทองคำ/FX วิ่งวนไร้รอยต่อ เชื่อมข้อมูลตลาดสด พร้อมไฟกะพริบสดและ Hover pause
- **Micro-Sparklines (`components/Sparkline.tsx`)**: กราฟคลื่น SVG ขนาดจิ๋ว 7 วันแบบเรืองแสง พร้อม Cubic Bezier curve และ Area fade
- **Theme Toggle (`components/ThemeToggle.tsx`)**: ปุ่มสลับโหมด Dark/Light พร้อมแอนิเมชันไอคอนพระอาทิตย์/พระจันทร์ และคงค่าใน localStorage
- **Navigation & Shell (`components/AppShell.tsx`)**: ไฟนีออนเรืองแสงสำหรับเมนูที่กำลังเลือก (Active Pill Glow) และวงแหวนแสงหมุนรอบปุ่ม Quick Add FAB (Aura Ring)
- **Dashboard Overhaul (`app/dashboard/page.tsx`)**:
  - Animated SVG Circular Health Gauge พร้อมแถบสี Gradient และ Drawer แสดงผลแยก 3 มิติ
  - Summary Metric Cards พร้อม Rolling Numbers (`react-countup`) และขอบเรืองแสงเขียว/แดง
  - Recharts Area Wave Gradient พร้อม Floating Glass Tooltip
  - ตาราง Holdings ผัง Micro-Sparklines แสดงทิศทางราคาของแต่ละสินทรัพย์
  - Inspiring Empty State พร้อมปุ่มแสงวิบวับ "✨ บันทึกธุรกรรมแรก"
- **Market Watch Overhaul (`app/market-watch/page.tsx`)**: Luxury quote cards พร้อมไฟกะพริบสด Live Pulse และปุ่มสลับสกุลเงินหมุน Flip 180°
- **Official Brand Logo Integration ("Investment Pro - MX")**: อัปเดตและติดตั้งโลโก้ทางการของระบบตามไฟล์ภาพใหม่ (`IMG_2283.JPG`) ด้วยสัญลักษณ์กราฟพุ่งขึ้นสไตล์ "MX" โทน Dark Luxury ผสานกราเดียนต์น้ำเงิน-ม่วง ติดตั้งครบทุกจุด: Desktop Sidebar, Mobile Top Header, Mobile Navigation Drawer, หน้ายืนยันตัวตนทั้งหมด (`/login`, `/register`, `/forgot-password`, `/reset-password`), Ticker Tape, PWA App Icons (`icon-192`, `icon-512`, `apple-icon`), Favicon และ OpenGraph/Twitter social cards ใน `app/layout.tsx`

### 11. Phase 10: Glassmorphism 2.0 & Multi-Theme Switcher Overhaul ✅
- **Multi-Theme Style Switcher (`components/ThemeStyleSelector.tsx`)**:
  - รองรับ 3 รูปแบบสไตล์ UI ที่เลือกสลับได้ทันที:
    1. 🌌 **Aurora Glass**: กระจกฝ้า Deep Indigo-Violet พร้อมลูกแก้วแสงลอยเบาๆ (Aurora Orbs)
    2. 🖤 **Minimal Slate**: สไตล์ Linear / Apple เรียบหรู สะอาดตา ไร้แสงฟุ้ง เส้นขอบคมชัด สบายตาที่สุด
    3. 💎 **Cyber Emerald**: โทนดำลึกตัดเขียวมรกต สไตล์ High-Tech FinTech & Wealth
  - ติดตั้งตัวสลับธีมที่ Desktop Topbar, Mobile Header และหน้า Settings พร้อม Live Preview
  - จดจำค่าใน `localStorage` และมี Inline Script ใน `<head>` เพื่อป้องกันการกะพริบ (Zero Flicker)
- **Collapsible Sidebar (`components/AppShell.tsx`)**: พับย่อ-ขยายแถบเมนูด้านซ้ายได้ด้วยปุ่มเดียว เพิ่มพื้นที่การใช้งาน (Breathing room) พร้อม Tooltip อัตโนมัติเมื่อย่อแถบ
- **Complete System-wide Redesign (ครบทั้ง 8 หน้าหลัก)**:
  - `/dashboard`: สไตล์ Modern Personal Finance ตัวเลขใหญ่คมชัด Holdings แบบ Card Rows ลอยตัว
  - `/transactions`: Summary metric cards ตัวเลขใหญ่, ตัวกรองกระจกฝ้า, ตารางธุรกรรมหรูหรา
  - `/accounts`: การ์ดบัญชีการเงินสไตล์ Neo-Bank / Apple Wallet พร้อม Glow accent ตามประเภทบัญชี
  - `/plans`: การ์ดแผนการลงทุนสัดส่วนสินทรัพย์ พร้อมแถบเปรียบเทียบ Dual-progress bars นุ่มนวล
  - `/market-watch`: เครื่องมือแปลงสกุลเงินด่วน และ Quote Cards ขนาดใหญ่พร้อมอัตราแลกเปลี่ยนสด
  - `/forecast`: กล่องควบคุมตัวแปรจำลอง Monte Carlo, เส้นพัด Fan Chart, และการ์ดวิเคราะห์ AI
  - `/news`: ฟีดข่าวสารแบบ Feed Cards พร้อมแท็ก Sentiment
  - `/tax-report`: 3 Tax Category KPI cards และตารางแยกหมวดภาษี FIFO สไตล์ Luxury
  - `/settings`: การ์ดเลือก Theme Style แสดง Color swatches และรายละเอียดชัดเจน
- **Build Status**: `npm run build` ผ่าน 100% ครบทุก 45 Static/Dynamic routes โดยไม่มี Error หรือ Type Warning ใดๆ

### 12. Phase 11: Usability Audit & Modal Window UX Overhaul ✅
- **Modal Windows & Popups ("หน้าต่างทั้งหมดในระบบ")**:
  - **Click Outside to Close (Backdrop Dismissal)**: เพิ่มการคลิกพื้นที่ว่างด้านนอกหน้าต่างเพื่อปิดทันทีในทุก Modal (`QuickAddModal`, `EditTransactionModal`, `CsvImportModal`, `AccountModal`, `PlanPresetModal`, `SuperadminModelModal`, และ `Mobile Drawer`)
  - **ESC Key Dismissal**: รองรับการกดปุ่ม `Escape` บนคีย์บอร์ดเพื่อปิดหน้าต่างทุกตัว
  - **Body Scroll Lock**: ล็อกการเลื่อนหน้าจอด้านหลังขณะที่หน้าต่าง Modal เปิดอยู่ ป้องกันปัญหาหน้าจอเลื่อนซ้อนบนมือถือ
  - **Mobile iOS Bottom Sheet Experience**: ปรับเปลี่ยนฟอร์มหน้าต่างบนมือถือให้ขึ้นมาเป็น Bottom Sheet สไตล์ iOS (`rounded-t-3xl sm:rounded-3xl`) จับถือง่ายขึ้น
  - **Glassmorphism 2.0 Card Standards**: ปรับเส้นขอบและพื้นหลังหน้าต่างเป็นกระจกฝ้าทรงโค้งมน (`border-white/10 backdrop-blur-2xl`) เข้ากับธีมทั้ง 3 แบบ (Aurora, Minimal, Emerald) ไร้สีฮาร์ดโค้ด
- **Clearance & Breathing Room**: ขยายระยะขอบด้านล่างของหน้าจอ (`pb-28 md:pb-24`) ทำให้ปุ่มบันทึกด่วน AI (Desktop FAB) ไม่บังตารางหรือปุ่ม Pagination ด้านขวาล่างอีกต่อไป

### 13. Phase 12: Codex & Linear Engineering Dark Architecture Overhaul ✅
- **Codex Design Tokens (`app/globals.css`)**:
  - สีพื้นหลัง Deep Charcoal Slate Canvas (`#090a0f`), Surface (`#111319`), Solid (`#151821`), Elevated (`#1a1d28`)
  - คมชัดระดับ Retina ด้วย 1px Crisp Borders (`rgba(255,255,255,0.08)`) และ Typography Contrast สีขาวบริสุทธิ์ `#ffffff` ตัดกับ Slate Text `#94a3b8`
  - ปิดกั้นแสงสีม่วงฟุ้ง (`aurora-orb`) ขนาด 800px ทั้งหมด และแทนที่ด้วย Linear-style subtle ambient glow
- **Collapsible Sidebar Fix & 100% Usability (`components/AppShell.tsx`)**:
  - ขยาย Sidebar Rail ตอนพับเป็น `w-[72px]` เพื่อให้มีพื้นที่เหลือเพียงพอ
  - ออกแบบ Header ของ Sidebar ใหม่: เมื่อพับแถบเมนู โลโก้และปุ่มขยาย (`PanelLeft`) จะจัดเรียงในแนวตั้งกึ่งกลาง แสดงผลชัดเจน 100% ไม่หลุดขอบหน้าจอ
  - เพิ่มปุ่มขยาย/ย่อเมนูใน Desktop Topbar (`PanelLeft`) เพื่อให้ผู้ใช้เปิด-ปิด Sidebar ได้ตลอดเวลา
  - Floating Hover Tooltips แสดงชื่อเมนูและ Badge อย่างชัดเจนเมื่อเอาเมาส์ไปชี้ไอคอนในโหมดพับ
- **Fluid Screen Fit ("แก้ปัญหาหน้าต่างไม่พอดี")**:
  - ขยาย Layout Container จากเดิมที่ล็อกไว้ที่ `max-w-7xl` (1280px) เป็น `max-w-[1720px]` พร้อม Responsive Padding (`px-4 sm:px-6 lg:px-8 xl:px-10`)
  - ใช้พื้นที่จอกว้าง/Ultrawide ได้อย่างสมดุลเต็มจอ กำจัดพื้นที่ว่างสีดำขนาดใหญ่ด้านขวาอย่างสิ้นเชิง
- **Dashboard Layout & Recharts Overlap Fix (`app/dashboard/page.tsx`)**:
  - เปลี่ยน Wrapper จาก `space-y-8` เป็น `flex flex-col gap-6 sm:gap-8 w-full` เพื่อแก้ปัญหาการทับซ้อนกันใน Tailwind CSS v4
  - กำหนดความสูงแน่นอนให้กับ Recharts Area Chart (`h-[340px] sm:h-[360px]`) ป้องกันไม่ให้กราฟทับซ้อนกับการ์ดสรุป KPI ด้านบน
  - ปรับการ์ดสรุปข้อมูลทั้งหมด (Row 1 KPI, Row 2 Area Chart & AI Digest, Row 3 Holdings Table) เป็น Codex Solid Surface Cards ป้องกันปัญหาการมองทะลุ (Scroll Bleed-through)
- **Non-Bleeding Topbar & Ticker Tape (`components/TickerTape.tsx`)**:
  - เสริมความทึบของแถบด้านบน (`bg-[#0a0c10]/95` และ `bg-[#090a0f]/95`) พร้อม Backdrop Blur เพื่อให้เวลาเลื่อนหน้าจอ ตัวหนังสือและกราฟด้านล่างจะไม่ทะลุผ่านแถบด้านบน

### 14. Phase 13: Multi-Image AI Slip Extraction & Multi-Currency Cash Wallet Architecture ✅
- **Multi-Image AI Trade Extraction (`app/api/ai/extract-slips/route.ts` & `components/QuickAddModal.tsx`)**:
  - รองรับการอัปโหลดหรือวางภาพ (Drag & Drop, Multi-file picker, Clipboard `Ctrl+V`) ได้พร้อมกันหลายภาพ
  - ประมวลผลด้วย Gemini Vision Multimodal แกะสลักข้อมูลธุรกรรมทุกประเภทรวมในครั้งเดียว:
    - คำสั่งซื้อ (BUY) เช่น GOOGL 1 หุ้น @ 328.94 USD รวมค่าคอมมิชชันและภาษี VAT 7%
    - คำสั่งขาย (SELL) เช่น MU 0.3191112 หุ้น @ 1,034.12 USD พร้อมค่าธรรมเนียม TAF & SEC
    - เงินปันผล (DIVIDEND) เช่น ปันผล GOOGL 0.44 USD พร้อมหักภาษี ณ ที่จ่าย 0.06 USD
    - ค่าธรรมเนียมรอจ่าย (FEE) และยอดเงินสดในบัญชี (CASH_BALANCE)
  - แปลงวันที่ปี พ.ศ. (เช่น 9 ก.ย. 69) เป็น ค.ศ. (2026-09-09) อย่างแม่นยำ
  - ตาราง **Batch Review Grid** ให้ตรวจสอบ แก้ไข เลือกรายการ และกด **"บันทึกทุกรายการในคลิกเดียว"**
- **Batch Transactions & Auto Balance Engine (`app/api/transactions/batch/route.ts`)**:
  - สร้างหรือจับคู่ Asset และ InvestmentAccount อัตโนมัติ
  - บันทึกทุกธุรกรรมใน 1 Database Transaction และปรับยอดเงินสดคงเหลือตามประเภทรายการโดยอัตโนมัติ (ซื้อตัดเงินสด, ขาย/ปันผลเพิ่มเงินสด)
- **Multi-Currency Cash Wallet & Accrued Interest (`components/CashWalletCard.tsx` & `app/api/cash-wallet/route.ts`)**:
  - ดีไซน์การ์ดเงินสดระดับ Luxury ถอดแบบจากหน้าจอ Dime! (ภาพที่ 4):
    - บัญชีของฉัน: 🇹🇭 THB (Dime! Save), 🇺🇸 USD (Dime! USD), 🇺🇸 USD (Dime! FCD) และรองรับ 10+ สกุลเงิน
    - แปลงมูลค่ารวมเป็นเงินบาท (THB) ตามอัตราแลกเปลี่ยนจริงแบบเรียลไทม์
    - การ์ด **"ดอกเบี้ยสะสม" (Accrued Interest)** พร้อมตัวเลขนับถอยหลังรอบจ่ายดอกเบี้ย ("จ่ายครั้งถัดไปในอีก 104 วัน") และแยกยอดรายสกุลเงิน
    - ปุ่มฝาก/ถอน/ปรับยอดเงินสดโดยตรง พร้อมปุ่มลัดสแกนหน้าเงินสดด้วย AI
- **Dashboard Net Worth Integration (`app/dashboard/page.tsx`)**:
  - คำนวณความมั่งคั่งสุทธิรวม (Total Net Worth = มูลค่าสินทรัพย์ลงทุน + เงินสดสำรองรวม) แสดงผลแบบสดใสบนการ์ด Hero
- **Build Status**: `npm run build` ผ่าน 100% ครบทุก 49 Static/Dynamic routes โดยไม่มี Error หรือ Type Warning ใดๆ

### 15. Phase 14: User Watchlist & Custom Asset Tracking (กระดานจับตาหุ้นส่วนตัว) ✅
- **Custom Watchlist Section (`app/market-watch/page.tsx`)**:
  - แสดงส่วน "⭐ หุ้นและสินทรัพย์ที่กำลังจับตา (Watchlist)" บนหน้าจอจับตาตลาด
  - การ์ดราคาแบบ Real-time แสดงสัญลักษณ์, ชื่อบริษัท/สินทรัพย์, ตลาด (`US`, `TH`, `CRYPTO`, `GOLD`), ราคาล่าสุด, % Change และปุ่มถอนการติดตาม
  - Empty state สวยงามพร้อมชิปเพิ่มด่วนยอดนิยม (`+ NVDA`, `+ AAPL`, `+ TSLA`, `+ PTT`, `+ DELTA`, `+ BTC`, `+ GOLD`)
- **Add Watchlist Modal with Live Quote Preview (`components/market-watch/AddWatchlistModal.tsx`)**:
  - ค้นหาและกรอก Ticker ได้ทุกหมวด (หุ้นสหรัฐฯ, หุ้นไทย SET, คริปโต, ทองคำ/สินค้าโภคภัณฑ์)
  - ระบบ **Live Quote Preview & Validation**: ดึงราคาจริงและชื่อบริษัทมาแสดงพรีวิวแบบเรียลไทม์ พร้อมป้ายยืนยันความถูกต้องก่อนกดบันทึก
  - สามารถกำหนดชื่อเรียกสินทรัพย์ได้เอง (Custom Display Name)
- **1-Click Star Toggle (⭐)**:
  - เพิ่มปุ่มไอคอนดาวบนการ์ดตลาดทั่วไปทุกใบ ให้ผู้ใช้คลิกติดดาวเพิ่มเข้าหรือถอดออกจาก Watchlist ได้ทันทีในคลิกเดียว
- **REST APIs & Database**:
  - `GET /api/watchlist`: ดึงรายการ Watchlist ของผู้ใช้พร้อมดึงราคาตลาดสดแบบคู่ขนาน
  - `POST /api/watchlist`: ตรวจสอบและบันทึกรายการลงในตาราง `WatchlistItem` ของ Prisma
  - `DELETE /api/watchlist/[id]`: ลบรายการที่สนใจของผู้ใช้
  - `GET /api/watchlist/search`: API สำหรับค้นหาและพรีวิวราคาตลาดสด
- **Unified Market Resolver (`lib/market-data/resolver.ts`)**: ตัวจัดการดึงราคาแบบครบวงจร รองรับ US, Thai Stocks, Crypto, Gold พร้อม In-memory cache
- **Build Status**: `npm run build` ผ่าน 100% ครบทั้ง 51 Static/Dynamic routes

### 16. Phase 15: Sub-Allocation Drill-Down, Tactical Monthly DCA & Executive AI Advisor Overhaul ✅
- **Sub-Allocation Drill-Down Accordion (`components/plans/SubAllocationDrillDown.tsx` & `app/plans/page.tsx`)**:
  - รองรับการคลิกคลี่ดูสัดส่วนหุ้นย่อยภายในแต่ละกลุ่ม (เช่น US, TH, CASH)
  - กำหนดสัดส่วนย่อยรายตัวได้อิสระ (เช่น US มี VOO 30%, QQQM 30%, SCHD 30%, GOOGL 10%) และบันทึกลง Preset อัตโนมัติ
  - เปรียบเทียบสัดส่วนจริง vs เป้าหมายย่อย พร้อมส่วนต่างขาด/เกิน
  - ตรวจจับสัญญาณจังหวะราคาและแนวรับ: `🔥 ชนแนวรับ / น่าช้อนพิเศษ (Top Buy)`, `🟢 ขาดเป้าหมาย / ทยอยสะสม (Accumulate)`, `⏸️ โตเกินเป้า / งดซื้อชั่วคราว (Pause & Hold)`
- **Smart Tactical Monthly DCA Budget Planner**:
  - คำนวณแบ่งเงินงวดใหม่ (เช่น งบ ฿5,000 หรือปรับแต่งได้) ว่าควรลงตัวไหนกี่บาทอย่างเจาะจง
  - คำนวณจำนวนหุ้นโดยประมาณตามราคาตลาด พร้อมเหตุผลประกอบและปุ่มคัดลอกแผนซื้อในคลิกเดียว
- **Gemini AI Rebalance & Portfolio Advisor Overhaul (`components/plans/AiAdvisorDisplay.tsx` & `app/api/ai-advisor/analyze/route.ts`)**:
  - ตัดคำทักทายเกริ่นนำเยิ่นเย้อออกทั้งหมด มุ่งเน้นยุทธศาสตร์ที่ปฏิบัติได้จริงทันที
  - จัดหมวดหมู่ 5 กลุ่มสไตล์ Executive Cards: 🎯 สรุปยุทธศาสตร์ด่วน, 🟢 จุดน่าช้อนสะสม, ⏸️ สินทรัพย์ควรงดซื้อ, 💵 แผนจัดสรรเงินเดือนหน้า, 🛡️ เรดาร์บริหารความเสี่ยง
  - ไฮไลต์ Ticker Pills และตัวเลขเงินบาทคมชัด
- **Build Status**: `npm run build` ผ่าน 100% ครบทั้ง 60 Static/Dynamic routes โดยไม่มีข้อผิดพลาด

### 17. Phase 16: Live Technical Signals Engine (RSI 14, SMA 50/200, Pivot Support S1/S2 & 52W Pullback) & Strict Signal Classification ✅
- **Institutional Technical Signals Engine (`lib/market-data/technical-signals.ts`)**:
  - คำนวณ Wilder's RSI(14) จากแท่งเทียนราคาปิดจริงย้อนหลัง 6 เดือน
  - คำนวณเส้นค่าเฉลี่ยเคลื่อนที่ SMA 50 วัน และ SMA 200 วัน
  - คำนวณระดับแนวรับ/แนวต้าน Pivot Points: Support 1 (S1), Support 2 (S2), Resistance 1 (R1)
  - คำนวณ % Drawdown ย่อตัวจากจุดสูงสุดรอบ 52 สัปดาห์ (52-Week High Pullback)
  - ปรับเกณฑ์ความแม่นยำทางสถิติ (Strict Rule Calibration):
    - **ชนแนวรับจริง (At Support)**: ต้องมี Pullback ย่อตัวลงมาจริงอย่างน้อย $\le -3.5\%$ และราคาปัจจุบันอยู่ชิดกรอบ $\pm 1\%$ ของ S1/SMA50/SMA200
    - **Oversold จริง**: ต้องเป็น RSI $\le 35$ เท่านั้น (หาก RSI 54.7 จะแสดงสถานะ "ปกติ" ชัดเจน ไม่ปะปนกับ Oversold)
    - **เกาะใกล้จุดสูงสุด (Near Peak)**: หากย่อตัวเพียง $\ge -2.5\%$ เช่น VOO (-1.2%) จะระบุว่าเป็นโซนเกาะจุดสูงสุด แนะนำทยอย DCA สม่ำเสมอ ไม่เร่งไล่ราคา
  - ระบบ In-memory Cache 5 นาทีเพื่อความเร็วระดับ Milliseconds และป้องกัน Rate-limit
- **REST API Endpoint (`GET /api/market-data/technical-signals`)**:
  - ดึงข้อมูลสัญญาณเทคนิคัลแบบคู่ขนานสำหรับหุ้นในพอร์ต
- **Sub-Allocation Drill-Down Integration (`components/plans/SubAllocationDrillDown.tsx`)**:
  - ปรับ Badge และคำแนะนำ Smart Tactical DCA ให้ตรงกับข้อเท็จจริงทางเทคนิคอล 100%:
    - `🔥 RSI Oversold (X) + ชนแนวรับ S1`: เมื่อ RSI $\le 35$ และราคาชนแนวรับจริง
    - `🔥 RSI Oversold (X) / น่าช้อนพิเศษ`: เมื่อ RSI $\le 35$ แท้จริง
    - `🟢 ทดสอบแนวรับสำคัญ (S1/SMA50)`: เมื่อราคาย่อตัวลงมาถึงแนวรับ
    - `🟢 ขาดเป้า / ทยอย DCA (เกาะจุดสูงสุด)`: เมื่อสัดส่วนขาดแต่ราคาเกาะใกล้จุดสูงสุด (ย่อ < 2.5%) แนะนำทยอยเติมตามงวดปกติ
    - `🟢 สัดส่วนขาดเป้า / ทยอยสะสม (Accumulate)`: สัดส่วนขาดเป้าตามรอบปกติ
    - `⚠️ RSI Overbought (X) / งดซื้อชั่วคราว`: เมื่อ RSI $\ge 68$ เสี่ยงพักฐาน
    - `⏸️ สัดส่วนโตเกินเป้า (+X.X%) / งดซื้อชั่วคราว`: เมื่อสัดส่วนโตเกินเป้าหมาย
  - แสดงป้ายกำกับ Metric กราฟจริงในตาราง: `📈 RSI 54.7 (ปกติ) | แนวรับ S1: $692.30 | ย่อตัว -1.2%`
  - นำค่าทางเทคนิคอลจริงไปใส่ในเหตุผลของกล่องคำแนะนำแบ่งเงิน DCA ฿5,000 ชัดเจน 100% ไม่มีการสุ่มข้อความ
- **Build Status**: `npm run build` ผ่าน 100% (60 routes) ไร้ Type Warning หรือ Error

### 18. Phase 17: Gemini AI Strategic Wealth Roadmap Executive Redesign ✅
- **Executive Card Engine (`components/forecast/StrategicRoadmapDisplay.tsx`)**:
  - พลิกโฉมจากกล่องข้อความยาวพรืด (Text Wall Prose) สู่ **Executive Cards ระดับสถาบันการเงิน**:
    - **KPI Ribbon บาร์สรุปตัวเลขหลัก**: โอกาสสำเร็จ (%), คาดการณ์มัธยฐาน P50, อำนาจซื้อแท้จริงหลังหักเงินเฟ้อ, เงินเดือนเกษียณ 4% Rule
    - **Card 1: 💡 บทสรุปภาพรวมผู้บริหาร (Executive Overview)**: ไฮไลต์สถานะพอร์ต โอกาสสำเร็จ และความท้าทายหลัก
    - **Card 2: 📈 การตีความผลลัพธ์และอำนาจซื้อแท้จริง (Executive Interpretation & Inflation Reality)**: วิเคราะห์ P50, P10 Bear market, อำนาจซื้อที่ลดลงจากเงินเฟ้อ
    - **Card 3: 🎯 ไทม์ไลน์และจุดเร่งทบต้น (Milestone Velocity & Compounding Effect)**: วิเคราะห์ปีที่จะแตะ 1M, 3M, 5M, 10M และจุดที่เกิดพลังดอกเบี้ยทบต้น
    - **Card 4: 🚀 พิมพ์เขียวกลยุทธ์เร่งการเติบโต (Actionable Growth Blueprint)**: แนวทางปฏิบัติแบบ 3 ขั้นตอน (Numbered Step Cards) พร้อมไฮไลต์
    - **Card 5: 🧭 คำแนะนำสรุปฟันธง (Strategic Conclusion)**: ฟันธง Action สำคัญที่สุดที่ต้องทำในเดือนนี้
  - ระบบ Format ตัวเลขทางการเงินแบบ Glow Badge: `฿1,219,801`, `72%` คมชัด อ่านง่าย สบายตา
  - ปุ่ม "คัดลอกบทวิเคราะห์ (Copy Roadmap)" สำหรับแชร์หรือส่งต่อ
- **Prompt Refinement (`app/api/ai-advisor/explain-forecast/route.ts`)**:
  - ปรับ Prompt บังคับโครงสร้าง Executive 5 หัวข้อหลัก ปราศจากคำทักทายเยิ่นเย้อ ชูประเด็นตัวเลขและกลยุทธ์ชัดเจน
- **Forecast Page Integration (`app/forecast/page.tsx`)**:
  - เชื่อมโยงผลลัพธ์เดิมในฐานข้อมูลและผลลัพธ์ใหม่เข้ากับ `StrategicRoadmapDisplay` สวยงามทันทีโดยไม่ต้อง Generate ใหม่
- **Build Status**: `npm run build` ผ่าน 100% (60 routes)

### 19. Phase 18: Executive Allocation Drift Matrix (Institutional Table Redesign) ✅
- **Executive Rebalance Matrix (`app/plans/page.tsx`)**:
  - พลิกโฉมการแสดงผลจากกล่องเดี่ยวหนาเทอะทะ (Bulky Double Bars) สู่ **ตารางเมทริกซ์สไตล์สถาบันการเงิน (Institutional Table)**:
    - **Asset Class & Status**: ไอคอนกลุ่มสินทรัพย์ + ชื่อกลุ่ม + ป้ายสถานะ (`หลุดกรอบเป้าหมาย` / `เริ่มเบี่ยงเบน` / `สมดุลดี`)
    - **Actual vs Target (%) with Glowing Target Pin**:
      - แถบหลอดเดี่ยวทรงโมเดิร์นฉีดสีตามสัดส่วนปัจจุบันจริง
      - ปักหมุดเป้าหมายสีขาวเรืองแสง (Target Pin Marker) ที่ระดับเปอร์เซ็นต์เป้าหมาย ทำให้เห็นทันทีว่าหลอดสีอยู่ก่อนหรือเกินเป้าหมาย โดยไม่ต้องเทียบสองแถบบนล่าง
    - **Current Portfolio Value**: มูลค่าเงินบาทจริงในพอร์ต (`฿X,XXX`) พร้อมจำนวนสินทรัพย์ย่อย
    - **Variance (Drift %)**: ป้ายส่วนต่างตัวเลขคมชัดตามโทนสีความเสี่ยง
    - **Action Recommendation Pill**: กล่องแนะนำสั้นกระชับเข้าใจทันที:
      - `⏸️ เกินเป้า ~฿11,597 (ชะลอเติม)` (Amber)
      - `🟢 ขาดเป้า ~฿3,500 (เน้นเติม)` (Emerald)
      - `✨ สัดส่วนสมดุลดี (DCA ตามปกติ)` (Cyan)
    - **Sub-Allocation Drill-Down Row**:
      - ปุ่มกดเจาะลึก `ดูย่อย (X รายการ) ▾` ที่เมื่อกดแล้วจะกางแถว Sub-Row ออกมาแสดงผลกล่อง `SubAllocationDrillDown` ด้านล่างของแถวนั้นอย่างแนบเนียนและสวยงาม
- **Build Status**: `npm run build` ผ่าน 100% (60 routes) ไร้ข้อผิดพลาด

---

## วิธีการรันและทดสอบระบบ
1. **รัน Development Server**:
   ```powershell
   npm run dev
   ```
2. **ทดสอบคำนวณภาษี FIFO**:
   ```powershell
   npm run test:tax
   ```
3. **ทดสอบ Production Build**:
   ```powershell
   npm run build
   ```
