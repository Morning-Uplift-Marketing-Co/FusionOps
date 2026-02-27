# Template Tools Guide

เครื่องมือสำหรับสร้างและแปลง Astro Templates ให้พร้อมใช้กับระบบ

---

## 📦 วิธีใช้งาน

### Step 1: แปลง Template ให้รองรับระบบ

```bash
# ดูผลแบบ Dry Run (ไม่แก้ไขจริง)
npm run convert-template templates/pro-lp-v1 -- --dry-run

# แปลงจริง (สร้าง backup อัตโนมัติ)
npm run convert-template templates/pro-lp-v1 -- --backup

# แปลงโดยระบุ brand ที่ต้องการแทนที่
npm run convert-template templates/pro-lp-v1 -- --brand "YourBrand"
```

สิ่งที่แปลง:
- `Astro.props` → `site`
- `{title}` → `${site.title || "Your Title"}`
- `{brand}` → `${site.brand || "YourBrand"}`
- `ElasticCredits` → `${site.brand || "ElasticCredits"}`
- ลบ Props section เก็บเฉพาะ imports

---

### Step 2: สร้าง ZIP พร้อม Upload

```bash
# Pack แบบปกติ (ใช้ไฟล์ต้นฉบับ)
npm run pack-template templates/pro-lp-v1

# Pack พร้อมแปลง props → literals ในตัว
npm run pack-template templates/pro-lp-v1 -- --convert

# Pack พร้อมระบุชื่อ template
npm run pack-template templates/pro-lp-v1 pro-lp-v1 --name "Pro LP V1" --desc "Professional landing page"
```

ผลลัพธ์: `template-pro-lp-v1.zip` พร้อม upload

---

### Step 3: Upload ไปยังระบบ

1. ไปที่ **Template Wizard**
2. เลือก **Smart Import (ZIP)**
3. Upload ZIP ที่ได้จาก Step 2
4. ตรวจสอบและบันทึก

---

## 🔧 รายละเอียด Script

### `convert-template.mjs`

แปลงไฟล์ `.astro` ให้รองรับ Template Literals

| Option | คำอธิบาย |
|--------|----------|
| `--dry-run` | แสดงผลแต่ไม่บันทึก |
| `--backup` | สร้าง `.backup` ก่อนแก้ไข |
| `--brand "X"` | ระบุ brand ที่ต้องการแทนที่ |

### `pack-template.mjs`

สร้าง ZIP พร้อมส่ง

| Option | คำอธิบาย |
|--------|----------|
| `--convert` | แปลง props → literals ขณะ pack |
| `--name "X"` | ชื่อ template |
| `--desc "X"` | คำอธิบาย |
| `--category X` | หมวดหมู่ (general/pdl/etc) |
| `--badge "X"` | ป้ายกำกับ |

---

## 📋 ตัวแปรที่รองรับ

Template จะใช้ตัวแปร `site` object:

```javascript
site = {
  brand: "YourBrand",
  title: "Your Title",
  description: "Your description",
  h1: "Your Headline",
  h1span: "Get Started",
  sub: "Your subheadline",
  cta: "Get Started",
  badge: "Featured",
  domain: "example.com",
  email: "support@example.com",
  conversionId: "",
  formStartLabel: "",
  formSubmitLabel: "",
  aid: "",
  voluumDomain: "",
  amountMin: 100,
  amountMax: 5000,
  aprMin: 5.99,
  aprMax: 35.99,
  loanLabel: "Personal Loans"
}
```

---

## ⚠️ ข้อจำกัด

| อย่าง | คำอธิบาย |
|--------|----------|
| ❌ React `.tsx` | ไม่รองรับใน Preview (ใช้ `.astro` static แทน) |
| ❌ Nested Slots | ใช้ได้แต่ depth 1 ชั้น |
| ❌ Complex Props | ต้องแปลงเป็น Template Literals |
| ✅ React `.tsx` | ใช้ได้ใน Deploy mode (ไม่ใช้ใน index.astro) |

---

## 🎯 Best Practices

### 1. ใช้ Static Components สำหรับ Preview

```astro
<!-- ❌ ไม่ดีสำหรับ Preview -->
import PaymentCalculator from './PaymentCalculator.tsx';
<PaymentCalculator />

<!-- ✅ ดีกว่าสำหรับ Preview -->
import CalcStatic from './CalcStatic.astro';
<CalcStatic />
```

### 2. Template Literals แทน Props

```astro
<!-- ❌ แบบเดิม -->
---
const { title } = Astro.props;
---
<title>{title}</title>

<!-- ✅ แบบใหม่ -->
---
---
<title>${site.title || "Your Title"}</title>
```

### 3. เก็บ React files ไว้สำหรับ Deploy

```
src/components/
├── CalcStatic.astro      ← สำหรับ Preview
├── Calc.tsx             ← สำหรับ Deploy/Google Ads
└── PaymentCalculator.tsx ← สำหรับ Deploy/Google Ads
```

`index.astro` ใช้ `CalcStatic.astro` แต่เวลา deploy ระบบจะเอาไฟล์ `.tsx` ไปด้วย
