# Phase 3 — Build-Output Fingerprint Findings

สำรวจ fingerprint ที่ **Google เห็นจริงใน HTML ที่ deploy** (ไม่ใช่ package.json — static site ไม่ deploy ไฟล์นั้น)

## วิธีสำรวจ
- ดู astro.config + Layout ของ template ที่ live brands ใช้จริง
- เช็ค generator meta, font loading, meta tags, template diversity ข้าม 37 configs

## ผลสรุป — footprint เล็กกว่าที่ research เดิมกลัว

| Signal | สถานะ | หมายเหตุ |
|--------|-------|----------|
| **Astro generator meta** | ✅ แก้แล้ว | มีแค่ 2 template (bolt-loan-04, tpl-insl-b02) ที่ไม่ได้ live — ลบออกแล้วเป็น hygiene |
| **Template diversity** | ✅ ดีอยู่แล้ว | 37 brands ใช้ ~20 template ต่างกัน (pet-loans-*, pastel-*, astro-oceanblue, bluerush ...) |
| **Meta title/description** | 🔴 footprint จริง | **0/37 configs ตั้ง metaTitle** → ทุก brand ใช้ default ของ template → brand ที่ใช้ template เดียวกัน มี `<title>`/meta **เหมือนกันเป๊ะ** |
| **Injected tracking snippet** | 🟡 footprint รอง | `inject-tracking.mjs` ฉีด inline JS (fpPixel/gtag) เหมือนกัน byte-by-byte ทุก site |

## 🔴 Action จริงที่เหลือ: Meta uniqueness (เป็น content ไม่ใช่ code)

ช่องมีอยู่แล้ว (`metaTitle`/`metaDescription` ใน config → `PUBLIC_META_TITLE`) แต่ไม่มีใครกรอก
- 2 brand ที่ใช้ astro-oceanblue (`node.sysassets-core-delivery.com`, `scratchdayplans.com`) ได้ title เดียวกันเป๊ะ
- **แก้:** กรอก `metaTitle` + `metaDescription` unique ต่อ brand ในแต่ละ `deploy-configs/*.json`
- **ทำไมต้องคน:** copy ต้องเขียนให้ต่างจริง ตาม brand voice — code generate ได้แค่ template-ied (ยังเป็น footprint)

## 🟡 Tracking snippet uniformity (deeper, optional)
inline script เหมือนกันทุก site เป็น footprint ระดับ HTML แต่แก้ยาก (เสี่ยงพัง tracking) — แนะนำทำทีหลังถ้าจำเป็น โดย vary variable names / formatting ต่อ brand ตอน inject

## สิ่งที่ทำในเฟสนี้
- ลบ `<meta name="generator">` จาก 2 template (ปลอดภัย, ไม่กระทบ function)
- ไม่แตะ package.json / dependency versions (ไม่อยู่ใน output, = footprint-theater สำหรับ static site)
