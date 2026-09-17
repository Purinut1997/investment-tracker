# Investment Pro — Professional Design Guardrails

> เอกสารนี้เป็นเกณฑ์ตัดสินงานออกแบบและงาน Frontend ของ Investment Pro
> เป้าหมายคือให้ระบบดูเป็น **เครื่องมือจัดการความมั่งคั่งที่น่าเชื่อถือ** ไม่ใช่ dashboard template ที่ตกแต่งด้วยสี แสง และข้อมูลจำลอง

## จุดยืนของผลิตภัณฑ์

**Quiet confidence, clear financial decisions.**

หน้าจอต้องทำให้ผู้ใช้ตอบคำถามได้ทันทีว่า “พอร์ตของฉันเป็นอย่างไร”, “อะไรต้องทำตอนนี้”, และ “กดตรงไหนเพื่อทำต่อ”

จึงให้น้ำหนักกับข้อมูล การอ่านตัวเลข และลำดับการตัดสินใจ มากกว่าเอฟเฟกต์ visual

## สิ่งที่ภาพปัจจุบันบอกว่าไม่เป็นมืออาชีพ

ภาพอ้างอิงมีฐาน dark-fintech ที่ดี แต่ควรแก้ประเด็นต่อไปนี้ก่อนเพิ่มความสวยงาม:

1. **ข้อมูลว่าง แต่หน้าจอทำเหมือนมี portfolio ทำงานอยู่** — กราฟเส้นศูนย์, KPI ฿0, Allocation ว่าง และ AI digest อยู่พร้อมกัน ทำให้เป็น demo state มากกว่า onboarding ที่เชื่อถือได้
2. **ลำดับความสำคัญไม่ชัด** — ticker, theme selector, real-time badge, KPI badge, sparkline, AI card และ FAB แข่งกันเรียกร้องสายตา
3. **สี accent ถูกใช้มากเกินไป** — violet, cyan, emerald, rose, amber และ glow อยู่พร้อมกัน จึงไม่มีสีไหนมีความหมายพิเศษจริง
4. **แบรนด์ยังไม่เป็นหนึ่งเดียว** — ห้ามสลับชื่อ `Investment Tracker`, `Investment AI`, `Investment Pro`, `Wealth Manager` หรือ `MIX THE ARCHITECT` ภายในผลิตภัณฑ์เดียว
5. **ภาษาผสมโดยไม่มีหลัก** — เช่น `Live`, `Realized`, `PnL Momentum`, `Grade C` ปนภาษาไทย ทำให้ระบบดูประกอบจากหลาย template
6. **พื้นที่เริ่มต้นของเนื้อหาไม่ปลอดภัย** — ต้องตรวจทุก breakpoint ว่า heading และ KPI แถวแรกไม่อยู่ใต้ sticky header / ticker และไม่ถูก sidebar บัง
7. **ทางออกจาก empty state ไม่ต่อเนื่อง** — เมื่อไม่มีบัญชี Quick Add แสดงข้อความ `/accounts` แต่ผู้ใช้ต้องกดปุ่มไปสร้างบัญชีได้จริง พร้อมกลับมาที่ flow เดิม

## กฎที่ห้ามฝ่าฝืน

- ห้ามใช้ gradient, glow, glass, badge หรือ animation เพื่อ “เติม” ส่วนที่ยังไม่มีข้อมูลหรือความหมาย
- หนึ่ง viewport มี primary CTA ได้ **1 ปุ่ม**; secondary CTA ได้ตามจำเป็น
- สีเขียวและแดงใช้เฉพาะผลตอบแทน/สถานะทางการเงิน ไม่ใช้เพื่อความสวยงาม
- สี indigo ใช้กับ action และ selected state เท่านั้น ไม่ใช้เป็น decoration ทั่วหน้า
- ห้ามมีคำว่า `LIVE` หากข้อมูลนั้นไม่บอกเวลาอัปเดตและแหล่งข้อมูลได้
- ห้ามแสดงกราฟที่มีค่า 0 ทั้งหมดเป็นกราฟจริง; ใช้ empty state หรือ skeleton ตามสถานะ
- ห้ามใช้ card ซ้อน card โดยไม่มีบทบาทหรือ hierarchy ที่ต่างกัน
- ห้ามสร้าง theme บุคลิกใหม่ต่อหน้า; ปรับได้เพียง Light / Dark ใน design system เดียว
- ห้ามเพิ่ม widget, ticker, AI badge หรือ sparkline หากไม่ช่วยให้ตัดสินใจหรือทำงานต่อได้

## Visual system ที่ต้องใช้

### สี

| บทบาท | Token | ค่าแนะนำ |
|---|---|---|
| พื้นหลัง | `--bg-base` | `#090B10` |
| Surface | `--bg-surface` | `#12151C` |
| Elevated surface | `--bg-elevated` | `#181C25` |
| ข้อความหลัก | `--text-primary` | `#F4F6F8` |
| ข้อความรอง | `--text-secondary` | `#9AA4B2` |
| Action / selected | `--accent` | `#6D5EF7` |
| Profit | `--positive` | `#20C997` |
| Loss | `--negative` | `#F05D73` |
| Warning | `--warning` | `#F2B84B` |

ใช้ surface ทึบเป็น default. Glass / backdrop blur ใช้ได้เฉพาะ dialog, floating menu และ top bar เท่านั้น

### รูปทรงและตัวอักษร

- Control: radius 12px; panel: 16px; modal: 20px
- Border: 1px ที่ contrast ต่ำ (`white / 8–10%`), ไม่มีเส้นเรืองแสงเป็นค่าเริ่มต้น
- จำนวนเงินต้องใช้ tabular numerals, ชิดขวาในตาราง, format สกุลเงินเดียวกันทั้งหน้า
- H1: 28–32px; section title: 16–18px; label: 12px; metadata: 11–12px
- ใช้ภาษาไทยเป็นหลัก; คำเทคนิคที่จำเป็นต้องใช้ภาษาอังกฤษต้องใช้ซ้ำด้วยคำเดิมทุกหน้า

### Motion

- UI transition: 160–220ms, ease-out
- อนุญาตเฉพาะ hover, loading, successful save และ state transition ที่ทำให้ผู้ใช้เข้าใจผลลัพธ์
- ticker เคลื่อนไหวได้เมื่อเป็นข้อมูลตลาดจริง แต่ต้องหยุดเมื่อ `prefers-reduced-motion` และไม่ควรสูงเกิน 28px
- ไม่ใช้ pulse / shimmer / rotating aura พร้อมกันเกินหนึ่งจุดใน viewport

## โครงสร้างข้อมูลและหน้า Dashboard

### เมื่อผู้ใช้มีข้อมูลแล้ว

```text
[ ชื่อพอร์ต + เวลาอัปเดต ]                              [ + เพิ่มธุรกรรม ]

[ มูลค่าพอร์ต ] [ กำไร/ขาดทุน ] [ ผลตอบแทน ] [ เงินสดพร้อมลงทุน ]

[ กราฟผลตอบแทน + period + benchmark                ][ ต้องให้ความสนใจ ]
[                                                     ][ ปรับสมดุล / ภาษี ]

[ Allocation ]                                       [ Holdings table ]
```

- KPI แรกต้องเป็นมูลค่าพอร์ตรวม ไม่ใช่ badge หรือ score
- Health score อยู่ในส่วน “Portfolio health” ด้านล่างหรือ sidebar ของ insight ไม่ใช่ KPI หลัก
- AI insight แสดงเฉพาะเมื่อมี insight ที่มี action เช่น “Crypto เกินเป้าหมาย 8%” พร้อมปุ่ม `ดูแผนปรับสมดุล`
- Holdings table เป็น surface สำคัญ: Asset, Value, Average cost, P&L, Weight, Action

### เมื่อผู้ใช้ยังไม่มีข้อมูล

ห้าม render dashboard ปกติพร้อมเลขศูนย์ ให้ใช้ onboarding state ทั้งหน้า:

```text
เริ่มสร้างพอร์ตของคุณ

1. สร้างบัญชีลงทุน                  [ สร้างบัญชี ]
2. เพิ่มธุรกรรมแรก หรือ Import CSV  [ เพิ่มรายการ ] [ Import CSV ]
3. ตั้งเป้าหมายและสัดส่วน           [ ตั้งแผน ]
```

- ปลดล็อกขั้นถัดไปเมื่อขั้นก่อนหน้าสำเร็จ
- Quick Add ที่ไม่มีบัญชีต้องมี CTA `สร้างบัญชีลงทุนก่อน` เป็น link/button จริง
- หลังสร้างบัญชีสำเร็จให้กลับ Quick Add พร้อมบัญชีใหม่ถูกเลือกไว้

## การนำทาง

จัด menu ตามงานของผู้ใช้ ไม่ใช่ตาม feature ที่ทีมพัฒนา:

```text
ภาพรวม
  Dashboard

พอร์ตของฉัน
  Holdings / Transactions / Accounts

วางแผน
  Goals & Allocation / Forecast / Tax report

ตลาดและข้อมูล
  Market watch / News

ระบบ
  Settings / Admin (ตามสิทธิ์)
```

- Desktop sidebar กว้าง 240–256px และ collapsed state 64–72px
- Mobile bottom nav ต้องมี Dashboard, Transactions, Accounts และปุ่ม Add; หน้าที่เหลือเข้าผ่าน More
- Admin ไม่ควรปนกับ menu งานลงทุนของผู้ใช้ทั่วไป

### Sidebar, logo และ responsive breakpoint

ภาพ collapsed sidebar ต้องไม่ทำให้เกิดความรู้สึกว่า rail ทับหรือบีบเนื้อหา แม้ CSS จะมี `margin-left` แล้วก็ตาม หาก KPI, title หรือกราฟซ้ายสุดเริ่มชิด sidebar จนเหมือนถูกตัด ถือว่าไม่ผ่าน visual QA

| ขนาดหน้าจอ | Navigation ที่ใช้ | กติกา layout |
|---|---|---|
| `>= 1280px` | Expanded sidebar | sidebar 240–256px, main content มี gutter อย่างน้อย 32px |
| `1024–1279px` | Collapsed sidebar | sidebar 72px, main content เว้นจาก rail อย่างน้อย 24px, KPI จัด 2 × 2 เมื่อพื้นที่ไม่พอ |
| `< 1024px` | Tablet/mobile nav | ซ่อน desktop sidebar, ใช้ top bar + bottom navigation หรือ More menu |

ข้อกำหนดเชิงเทคนิค:

- ความกว้างของ `aside` และ `main` offset ต้องมาจาก token เดียวกัน ห้ามแก้เลขคนละจุดจน width ไม่ตรงกัน
- ห้ามใช้ `fixed sidebar` ร่วมกับ content ที่ยังมี `min-width` ของ desktop card grid โดยไม่ทดสอบที่ 1024px และ 768px
- Main content ต้องมี horizontal padding อย่างน้อย 24px บน desktop/tablet และ 16px บน mobile
- หาก viewport แคบจน title, KPI แรก หรือแกนกราฟถูกตัด/ถูกซ่อนใต้ rail ให้เปลี่ยน layout ทันที ไม่ใช่ปล่อย horizontal crop
- ตรวจ screenshot ที่ 1280px, 1024px, 768px และ 390px ทุกครั้งที่แก้ AppShell หรือ dashboard grid

#### Logo ใน sidebar

Monogram ขนาดเล็กบนพื้นขาวทำให้ logo ดูคล้าย favicon และกล่องขาวเด่นกว่า brand mark จึงไม่ควรใช้เป็นค่าปกติของ sidebar ที่ collapse แล้ว

- Expanded state แสดง wordmark ชื่อแบรนด์เดียวเสมอ และ subtitle ใช้ได้ไม่เกินหนึ่งบรรทัด
- Collapsed state ใช้ monogram ขนาด 28–32px ภายใน frame 36–40px, radius 10–12px
- ให้ใช้ transparent หรือ monochrome logo ที่มี contrast กับ dark surface; หลีกเลี่ยงกล่องขาวขนาดใหญ่หากไม่ได้เป็นส่วนหนึ่งของ brand guideline
- ทุก logo ที่เป็น link ต้องมี tooltip/accessible label ชัดเจนว่าไป Dashboard
- ชื่อแบรนด์ต้องคงที่ทุก state และทุกหน้า

#### Menu density

Collapsed navigation ที่ไอคอนเรียงกันแน่นจะดูเหมือน toolbar มากกว่าเมนูผลิตภัณฑ์ จึงต้องคุม density ดังนี้:

- พื้นที่กดของทุก item อย่างน้อย `44 × 44px`
- ระยะระหว่าง items 6–8px; แบ่งกลุ่มด้วย gap 16–20px หรือ divider เบามาก
- Expanded state ใช้ label 14px / line-height 20px; icon 18–20px
- Active state ใช้สี action และพื้นหลังระดับเดียว; ไม่ต้องใช้ glow หนักหรือ gradient ทุก item
- Collapsed state ต้องแสดง tooltip ทันทีเมื่อ hover/focus และไอคอนต้องมีความหมายต่างกันชัดเจน
- ไม่ให้มีเมนูมากกว่า 7 รายการในกลุ่มหลักที่เห็นพร้อมกันโดยไม่แบ่งกลุ่ม

## หน้า Transactions

หน้า Transactions คือ accounting workbench ไม่ใช่หน้า card showcase:

1. Header: ชื่อหน้า, `Import CSV`, `+ เพิ่มธุรกรรม`
2. Toolbar เดียว: Search, Account, Type, Date range, Market
3. Summary ย่อ 3 ค่า: ลงทุนรวม, กระแสกลับ, ค่าธรรมเนียม
4. ตารางเป็นพระเอก พร้อม sticky header, pagination และ row action ที่แสดงเมื่อ hover
5. Quick Add ใช้ modal สำหรับรายการใหม่; การแก้ไขรายการบน desktop ใช้ side drawer

## AI และ Market data

- AI เป็น insight ที่พิสูจน์กลับไปยังข้อมูลต้นทางได้ ไม่ใช่กล่องสีพิเศษที่อยู่ทุกหน้า
- Market watch เริ่มจาก watchlist ของผู้ใช้ แล้วจึงค่อยมี tabs หุ้นไทย / หุ้นสหรัฐ / Crypto / FX
- ทุก quote แสดง provider และ `updated at`; แยกคำว่า delayed, cached และ live ให้ชัด
- Ticker เป็น optional utility ไม่ใช่แกนหลักของทุกหน้า

## Definition of Done สำหรับงาน UI ทุกชิ้น

ก่อน merge ต้องตรวจครบ:

- [ ] หน้าจอมี brand name เดียวและคำศัพท์สอดคล้องกัน
- [ ] Primary action เหลือหนึ่ง action ที่ชัดที่สุดต่อ viewport
- [ ] ไม่มีกราฟ/metric หลอกเมื่อข้อมูลว่าง
- [ ] Empty state บอกสาเหตุและมี CTA ที่กดทำต่อได้จริง
- [ ] ไม่มี content ถูก sticky header, ticker หรือ sidebar บังที่ desktop และ mobile
- [ ] สีเขียว/แดงใช้ semantic; glow ไม่ได้ใช้เป็น decoration ทั่วไป
- [ ] รองรับ `prefers-reduced-motion` และ pinch zoom บนมือถือ
- [ ] ตาราง ตัวเลข และ dialog อ่านได้ที่ 1280px desktop, 768px tablet, 390px mobile
- [ ] มี loading, error และ empty state สำหรับทุก fetch หลัก
- [ ] ทดสอบ flow: สร้างบัญชี -> เพิ่มธุรกรรม -> เห็น holding -> เปิด insight

## ลำดับการทำงานที่แนะนำ

1. ล็อกชื่อแบรนด์, palette และ typography ให้เหลือ design system เดียว
2. ทำ onboarding / empty portfolio state ก่อน dashboard ที่มีข้อมูล
3. ปรับ Quick Add ให้เชื่อม Accounts โดยไม่ทำให้ flow ขาด
4. ลด visual noise ของ top bar, ticker, badges และ glow
5. ปรับ dashboard ตาม hierarchy ที่ระบุ แล้วค่อยทำ market watch และ AI insight
6. ทำ responsive visual QA หลังทุก phase ไม่รอจนจบ

เอกสารนี้ใช้เป็นข้อกำหนดก่อนเพิ่ม component หรือ animation ใหม่: ถ้าสิ่งนั้นไม่ช่วยให้ผู้ใช้เข้าใจพอร์ตหรือตัดสินใจได้เร็วขึ้น ให้ไม่เพิ่ม
