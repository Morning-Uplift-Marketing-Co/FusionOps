# 📦 Astro Template Starter Pack Guide

คู่มือสร้างและ import Astro template เข้า Wizard พร้อมใช้

---

## 🚀 Quick Start (3 นาที)

```bash
# 1. คัดลอก template ใหม่
cp -r templates/pet-orange-white templates/my-template

# 2. Validate ก่อน
node scripts/validate-template-tracking.mjs templates/my-template

# 3. Pack เป็น ZIP
node scripts/pack-template.mjs templates/my-template my-template --name "My Template" --desc "Custom template"

# 4. Upload ZIP ผ่าน Wizard → Smart Import (ZIP)
```

---

## 📋 สิ่งที่ต้องตรวจสอบก่อน import

### ✅ Checklist ต้องผ่านทุกข้อ

| รายการ | ตำแหน่ง | ตรวจสอบ |
|---|---|---|
| Layout อ่าน env vars | `src/layouts/Layout.astro` | `PUBLIC_COLORID`, `PUBLIC_FONTID`, `PUBLIC_RADIUS`, `PUBLIC_LAYOUT` |
| fpPixel block | Layout `<head>` | `window.__fpPixel` ชี้ `t.{domain}/e` |
| Voluum dtpCallback | Layout `<head>` | `dtpCallback.js` (ไม่ใช่ vp.js) |
| CTA wired | `src/pages/index.astro` | `ctaHref` และ `href={ctaHref}` |
| Pixel endpoint | `src/pages/e.ts` | GET 200 + 1x1 GIF |
| Security headers | `public/_headers` | Cloudflare headers |
| Robots route | `src/pages/robots.txt.ts` | SEO robots.txt |

### ❌ ปัญหาที่พบบ่อย

```
✗ Layout.astro missing PUBLIC_VOLUUMDOMAIN env usage
→ เพิ่ม: const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
✗ Layout.astro pixel must use t.{domain}/e
→ แก้ endpoint จาก '/e' เป็น 'https://t.' + window.location.hostname + '/e'
✗ Layout.astro missing Voluum dtpCallback injection
→ เพิ่ม script block โหลด dtpCallback.js
```

---

## 🔧 แก้ไข Template ให้พร้อมใช้

### 1. แก้ชื่อ Layout ถ้าจำเป็น

ถ้า template ใช้ `BaseLayout.astro` แทน `Layout.astro`:

```bash
# แก้ validate script หรือ rename file
mv templates/my-template/src/layouts/BaseLayout.astro templates/my-template/src/layouts/Layout.astro
```

### 2. เพิ่ม env vars ใน Layout

```astro
// src/layouts/Layout.astro
const colorId  = import.meta.env.PUBLIC_COLORID  || 'ocean';
const fontId   = import.meta.env.PUBLIC_FONTID   || 'plus-jakarta';
const radiusId = import.meta.env.PUBLIC_RADIUS   || 'rounded';
const layout   = import.meta.env.PUBLIC_LAYOUT   || 'hero-center';
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';
```

### 3. เพิ่ม fpPixel block (คัดลอกจาก pet-orange-white)

```html
<!-- ใน <head> ของ Layout -->
<script data-cfasync="false" is:inline>
(function(){
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  if (cid) {
    window.__fpClickId = cid;
    try { sessionStorage.setItem('voluum_cpid', cid); } catch(_){}
  }
  window.__fpPixel = function(eventName, extra) {
    try {
      var endpoint = 'https://t.' + window.location.hostname + '/e';
      var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Math.floor(Date.now()/1000) }, extra || {});
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
    } catch(_) {}
  };
  window.__fpPixel('pv', cid ? { click_id: cid } : {});
})();
</script>
```

### 4. เพิ่ม Voluum dtpCallback

```html
{voluumDomain && (
  <script data-cfasync="false" is:inline define:vars={{ voluumDomain }}>
  (function(){
    var p = new URLSearchParams(window.location.search);
    var cpid = p.get('cpid') || p.get('cid') || p.get('click_id') || p.get('vlcid') || '';
    if (cpid) { try { sessionStorage.setItem('voluum_cpid', cpid); } catch(_){} }
    var s = document.createElement('script');
    s.async = true; s.setAttribute('data-cfasync','false');
    s.src = 'https://' + voluumDomain + '/dtpCallback.js';
    document.head.appendChild(s);
  })();
  </script>
)}
```

### 5. ตรวจ CTA ใน index.astro

```astro
const ctaHref = voluumClickUrl || '#apply';

// ใน CTA button
<a href={ctaHref}>Apply Now</a>
```

---

## 📦 Pack เป็น ZIP

### Basic pack
```bash
node scripts/pack-template.mjs templates/my-template my-template
```

### Full options
```bash
node scripts/pack-template.mjs templates/my-template my-template \
  --name "My Awesome Template" \
  --desc "Custom loan template with modern design" \
  --category loan \
  --badge "Custom" \
  --convert
```

**Options:**
- `--convert`: แปลง Astro.props → template literals อัตโนมัติ
- `--category`: loan|pet|custom
- `--badge`: ข้อความ badge ใน Wizard

ผลลัพธ์: `template-my-template.zip` พร้อม upload

---

## 🎯 Import เข้า Wizard

1. เปิด Wizard → Step 3: Template Selection
2. คลิก **Smart Import (ZIP)**
3. Upload `template-{id}.zip`
4. กรอกข้อมูล template (ID, name, description)
5. Save → template จะปรากฏใน list

---

## 🧪 ทดสอบหลัง Import

### 1. สร้าง site ใหม่
- เลือก template ที่ import เข้ามา
- กรอกข้อมูล site ปกติ
- ไปถึง Step 4: Design

### 2. ตรวจสอบ features
- ✅ Color scheme เปลี่ยนได้
- ✅ Font เปลี่ยนได้  
- ✅ Layout เปลี่ยนได้
- ✅ เห็น `${brand}` → แสดง brand จริง

### 3. Deploy ทดสอบ
- Deploy ไป Cloudflare Pages
- ตรวจ tracking events ใน Realtime Dashboard
- ทดสอบ LeadsGate form (ถ้ามี)

---

## ⚡ Tips & Tricks

### เร็วขึ้นด้วย `--convert`
```bash
# แปลง {brand} → ${site.brand} อัตโนมัติ
node scripts/pack-template.mjs templates/my-template my-template --convert
```

### Debug ปัญหา
```bash
# ตรวจสอบก่อน pack
node scripts/validate-template-tracking.mjs templates/my-template

# ดูไฟล์ที่ถูก pack
unzip -l template-my-template.zip
```

### Re-import หลังแก้
แก้ไฟล์ใน template folder → pack ใหม่ → upload ZIP ใหม่

---

## 📁 โครงสร้าง Template ที่ถูกต้อง

```
templates/my-template/
├── src/
│   ├── layouts/Layout.astro     # ✅ ต้องมี
│   ├── pages/
│   │   ├── index.astro          # ✅ ต้องมี
│   │   ├── apply.astro          # ถ้ามี LeadsGate
│   │   ├── e.ts                 # ✅ pixel endpoint
│   │   └── robots.txt.ts        # ✅ SEO
│   └── components/              # ส่วนประกอบ
├── public/
│   ├── _headers                 # ✅ security headers
│   └── favicon.svg
├── package.json
└── astro.config.mjs
```

---

## 🆘 ถ้าเจอปัญหา

| ปัญหา | สาเหตุ | แก้ไข |
|---|---|---|
| `${brand}` แสดงดิบ | Template ไม่อ่าน `PUBLIC_BRAND` | เพิ่ม env var ใน Layout |
| Color ไม่เปลี่ยน | ไม่มี `COLOR_MAP` | คัดลอกจาก pet-orange-white |
| Tracking ไม่ fire | ไม่มี fpPixel block | เพิ่ม script block |
| Deploy ล้มเหลว | Validate ไม่ผ่าน | รัน validate script ก่อน |

---

## ✅ สำเร็จ!

เมื่อ template ผ่าน validate และ import สำเร็จ:

1. ✅ Template แสดงใน Wizard พร้อม badge
2. ✅ Step 4: Design ทำงานครบ (color/font/layout)
3. ✅ Deploy ได้ทันที
4. ✅ Tracking ทำงานถูกต้อง

**Template พร้อมใช้จริง! 🎉**
