# Template Safe Checklist (Worker Deploy)

> ใช้ checklist นี้ก่อน publish/redeploy template เพื่อกันปัญหา layout เพี้ยน, สีหาย, หรือโค้ด Astro หลุดเป็นข้อความบนหน้า

ดู playbook rollout แบบเต็มได้ที่ `docs/paid-fast-track-rollout-playbook.md`

---

## 1) Pre-flight (ก่อน Save/Publish)

- มี entry ไฟล์อย่างน้อยหนึ่งไฟล์
  - `src/pages/index.astro` หรือ `index.html`
- ถ้าใช้ `templateId` ใหม่ ต้องไม่ซ้ำกับของเดิม และเป็น slug ปลอดภัย
  - ตัวอย่าง: `bear-loan-modern`, `pet-loans-v2`
- ถ้า template ต้องการเป็น built-in:
  - เพิ่ม register ใน `packages/lp-template-generator/src/templates/index.js`
  - เพิ่ม fallback metadata ใน `src/utils/template-registry.js`
  - เพิ่มใน `BUILTIN_TEMPLATE_IDS` ที่ `apps/api-worker/src/worker.js`

---

## 2) Worker-safe Rules (สำคัญที่สุด)

- หลีกเลี่ยง Astro expression ซับซ้อนใน `<head>` เมื่อ deploy ผ่าน worker converter
  - เช่น `{cond && (...)}`, `{a ? b : c}`, `{...map(...)}`
- อย่าพึ่งพา `@tailwind`/`@apply` อย่างเดียวในโหมดที่ไม่ได้ compile เต็ม pipeline
  - ควรมี fallback inline CSS ในจุด critical (hero/button/form/section)
- อย่า hardcode สีหลักไว้เฉพาะค่าเดียว
  - ใช้ `var(--color-primary|secondary|accent)` เพื่อให้ theme เปลี่ยนได้
- tracking script ต้อง fail-safe
  - ไม่มีค่าก็ไม่ throw error (เช่น `conversionId`, `voluumDomain`)
- ถ้าใช้ external assets/script ให้มี fallback behavior

---

## 3) Visual QA (มือถือก่อน)

- Hero:
  - หัวข้อไม่ล้นจอ
  - subtitle อ่านง่าย
  - primary CTA เด่นและกดได้
- Form card:
  - input + button อยู่ใน viewport โดยไม่ต้อง zoom
  - error state แสดงชัด
- Trust/How-it-works:
  - icon และ text spacing ไม่ซ้อนกัน
- สี:
  - มี contrast เพียงพอ (หัวข้อ/ปุ่ม/พื้นหลัง)
  - ไม่มีจุดที่กลับเป็น grayscale โดยไม่ตั้งใจ

---

## 4) Runtime QA (หลัง Redeploy site)

- เปิด URL จริงของ worker/site แล้วตรวจ:
  - ไม่มีข้อความ Astro หลุด เช่น `{title}`, `{noindex}`, `{voluumDomain && (...)}` บนหน้า
  - ไม่มี error JS ร้ายแรงใน console
  - CTA, slider, form submit ทำงานได้
- ตรวจ pixel/tracking:
  - event ยิงไป `https://t.{domain}/e` ได้
  - gtag ไม่พังเมื่อไม่มี/มี conversionId

---

## 5) Release Checklist (ก่อนปิดงาน)

- `npm run build` ผ่าน
- ถ้าแก้ template rendering core:
  - deploy dashboard (`main.fusionops.pages.dev`)
  - redeploy site ที่ได้รับผลกระทบ
- บันทึก changelog ว่าแก้อะไรใน template:
  - visual changes
  - tracking changes
  - compatibility changes

---

## Quick Triage (เมื่อเจอหน้าเพี้ยน)

- เห็น `{...}` โผล่บนหน้า:
  - ปัญหาจาก Astro expression ไม่ถูกแปลง -> ตรวจ `src/utils/template-router.js` (converter pass)
- สีหาย/คลาสไม่ทำงาน:
  - ปัญหา Tailwind source ไม่ถูก compile -> เพิ่ม inline/fallback CSS จุดสำคัญ
- พรีวิวสวยแต่ URL จริงเพี้ยน:
  - deploy dashboard แล้ว แต่ยังไม่ได้ redeploy site ตัวนั้น

