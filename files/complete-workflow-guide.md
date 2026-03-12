# 🚀 Complete Template Workflow Guide

## 🎯 วัตถุประสงค์

คู่มือนี้เป็น workflow ที่สมบูรณ์ที่สุดเพื่อป้องกันการ import template แล้วมานั่งแก้ปัญหากันอีก

## 📋 พร้อมต์ทั้งหมดที่มี

| พร้อมต์ | วัตถุประสงค์ | ไฟล์ |
|---------|-------------|------|
| 📖 How to Use | คู่มือเลือกพร้อมต์ | `bolt-prompts-collection.html` |
| 🏗️ Repo-Specific | สร้าง template สำหรับ repo นี้ | `bearloannow-repo-specific.md` |
| 🔍 Template Validation | ตรวจสอบ template ทั่วไป | `template-validation-prompt.md` |
| 📊 Tracking Validation | ตรวจสอบ tracking แบบละเอียด | `tracking-validation-prompt.md` |
| ✅ Pre-Import Checklist | ตรวจสอบทุกอย่างก่อน import | `pre-import-checklist-prompt.md` |

## 🔄 Workflow ที่สมบูรณ์ที่สุด

### 📋 ขั้นตอนที่ 1: เลือกและคัดลอกพร้อมต์สร้าง

1. **เปิด** `bolt-prompts-collection.html`
2. **อ่าน** แท็บ "📖 How to Use" ก่อน
3. **เลือก** พร้อมต์ "Repo-Specific"
4. **คัดลอก** พร้อมต์

### 🏗️ ขั้นตอนที่ 2: สร้าง Template

1. **ไปที่** `bolt.new`
2. **วาง** พร้อมต์ Repo-Specific
3. **วาง** เนื้อหาจาก `bearloannow-repo-specific.md`
4. **กด Send** รอให้ Bolt สร้างเสร็จ

### 🔍 ขั้นตอนที่ 3: ตรวจสอบ Template (3 ชั้น)

#### ชั้นที่ 1: Template Validation (ทั่วไป)
```
คัดลอก template-validation-prompt.md
วางใน Bolt + "Validate the BearLoanNow template"
```

#### ชั้นที่ 2: Tracking Validation (เฉพาะ tracking)
```
คัดลอก tracking-validation-prompt.md
วางใน Bolt + "Validate tracking implementation"
```

#### ชั้นที่ 3: Pre-Import Checklist (ทุกอย่าง)
```
คัดลอก pre-import-checklist-prompt.md
วางใน Bolt + "Run complete pre-import health check"
```

### 🛠️ ขั้นตอนที่ 4: แก้ไขปัญหา (ถ้ามี)

1. **อ่านรายงาน** จากทั้ง 3 การตรวจสอบ
2. **จัดลำดับความสำคัญ**:
   - 🔴 Critical Issues (ต้องแก้ก่อน import)
   - 🟡 Warning Issues (แก้หลัง import ได้)
3. **คัดลอก fixes** ที่ Bolt แนะนำ
4. **วางให้ Bolt แก้ไข**:
   ```
   Please fix these critical issues:
   [วาง fixes ทั้งหมด]
   ```

### 🔄 ขั้นตอนที่ 5: ตรวจสอบซ้ำ

1. **รัน validation ทั้ง 3 ชั้นอีกครั้ง**
2. **ตรวจสอบว่า**:
   - ✅ ไม่มี Critical Issues
   - ✅ Overall Status: PASS
   - ✅ Ready for Import: YES

### 📥 ขั้นตอนที่ 6: Download (เฉพาะตอนพร้อม)

1. **Download template** จาก Bolt
2. **แตกไฟล์** ไว้ใน `templates/bearloannow`
3. **รัน validation ในโปรเจกต์**:
   ```bash
   node scripts/validate-template-tracking.mjs templates/bearloannow
   ```
4. **ถ้าผล ✅ ทั้งหมด** ถึงจะ import

## 🎯 จุดตรวจสอบสำคัญที่ต้องไม่ลืม

### ✅ ไฟล์ที่ต้องมี (7 ไฟล์)
- `src/pages/index.astro`
- `src/layouts/Layout.astro`
- `src/pages/e.ts`
- `src/pages/robots.txt.ts`
- `public/_headers`
- `package.json`
- `astro.config.mjs`

### ✅ Tracking ที่ต้องมี (2 ส่วน)
- fpPixel block ใน Layout.astro
- Voluum dtpCallback block ใน Layout.astro

### ✅ CTA ที่ต้องมี
- `ctaHref` declaration
- ทุก CTA ใช้ `{ctaHref}`

### ✅ Environment Variables ที่ต้องมี
- `PUBLIC_VOLUUMDOMAIN`
- `PUBLIC_VOLUUM_CLICK_URL`
- `PUBLIC_COLORID`
- `PUBLIC_FONTID`

## ⚠️ ข้อควรระวังที่ทำให้เสียเวลา

### ❌ อย่าทำ
- ดาวน์โหลด template โดยไม่ตรวจสอบ
- ข้าม Critical Issues
- Import template ที่มี warning
- สมมติว่า Bolt ทำถูกต้องเสมอไป
- ลืมตรวจสอบ tracking

### ✅ ควรทำ
- ตรวจสอบ template 3 ชั้นก่อนดาวน์โหลด
- แก้ไขปัญหาทั้งหมดก่อน import
- รัน validation script ในโปรเจกต์
- ตรวจสอบ tracking แบบละเอียด
- ตรวจสอบซ้ำหลังแก้ไข

## 🚨 ปัญหาที่เคยเจอและวิธีป้องกัน

### ปัญหาที่ 1: Missing fpPixel
- **สัญญาณ**: Tracking ไม่ทำงาน
- **ป้องกัน**: ใช้ Tracking Validation Prompt
- **ตรวจสอบ**: fpPixel block ใน Layout.astro

### ปัญหาที่ 2: CTA ไม่ wired
- **สัญญาณ**: คลิก CTA ไม่ไปที่ Voluum
- **ป้องกัน**: ตรวจสอบ ctaHref ทั้งหมด
- **ตรวจสอบ**: ไม่มี hardcoded href

### ปัญหาที่ 3: ไฟล์ขาดหาย
- **สัญญาณ**: Import ล้มเหลว
- **ป้องกัน**: ใช้ Pre-Import Checklist
- **ตรวจสอบ**: 7 ไฟล์ที่จำเป็น

### ปัญหาที่ 4: Dependencies พัง
- **สัญญาณ**: Build ไม่ผ่าน
- **ป้องกัน**: ตรวจสอบ package.json
- **ตรวจสอบ**: dependencies ครบถ้วน

### ปัญหาที่ 5: Environment Variables ผิด
- **สัญญาณ**: Template ทำงานผิดปกติ
- **ป้องกัน**: ตรวจสอบชื่อตัวแปร
- **ตรวจสอบ**: PUBLIC_ prefix สำหรับ client-side

## 📊 การจัดการเวลา

| กิจกรรม | เวลาที่ใช้ | ประหยัดเวลาที่เสียไป |
|---------|-------------|-------------------|
| ตรวจสอบ 3 ชั้น | 10-15 นาที | ป้องกัน 1-2 ชั่วโมงแก้ไข |
| แก้ไขปัญหา | 5-10 นาที | ป้องกัน 30 นาที debugging |
| ตรวจสอบซ้ำ | 5 นาที | ป้องกัน 15 นาที re-import |
| **รวม** | **20-30 นาที** | **ป้องกัน 2-3 ชั่วโมง** |

## 🎉 สำเร็จ!

เมื่อ template ผ่านการตรวจสอบทั้งหมด:

1. ✅ Template พร้อม import 100%
2. ✅ ไม่มี error ตอน import
3. ✅ Tracking ทำงานถูกต้อง
4. ✅ พร้อมใช้งานจริง
5. ✅ ไม่เสียเวลาแก้ไขภายหลัง

---

## 💡 เคล็ดลับสุดท้าย

**"ใช้เวลาตรวจสอบ 20 นาที ป้องกันการนั่งงม 2 ชั่วโมง"** ⏰

**Workflow นี้คือการลงทุนเล็ก ๆ ที่ป้องกันปัญหาใหญ่ ๆ** 🛡️

**พร้อมใช้งานได้เลย! ไม่ต้องมานั่งงมกันอีกแน่นอน!** 🚀
