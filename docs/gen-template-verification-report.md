# รายงานการตรวจสอบ Gen Template เข้าระบบ

> ตรวจสอบโดย Codex — วันที่ 2025-02-24

---

## 1. ภาพรวม Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TemplateGeneratorModal (3 โหมด)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  • Blank Canvas   → StepInfo → Design → Features → Code → Review → Save  │
│  • Rapid Blueprint→ StepFromDir (Clone) → Review → Save                 │
│  • Smart Import  → StepFromZip (Upload) → Review → Save                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    onSave(state) → App.jsx
                                    │
                                    ▼
                    POST /api/templates
                    { templateId, name, description, category, badge, sourceCode, files }
                                    │
                                    ▼
                    D1 Database (templates table)
                                    │
                                    ▼
                    refreshCustomTemplates() + TEMPLATE_REFRESH_EVENT
                                    │
                                    ▼
                    LP Wizard → StepDesign → เลือก Template ได้
```

---

## 2. การทำงานตามโหมด

### 2.1 โหมด Clone (Rapid Blueprint) ✅ ทำงานถูกต้อง

| ขั้นตอน | ไฟล์ | สถานะ |
|---------|------|-------|
| เลือก Template + ตั้ง newFolderId | `StepTemplateFromDir.jsx` | ✅ |
| handleGenerateFrom → tmpl.generate(SAMPLE_SITE) | `getTemplate()` จาก lp-template-generator | ✅ |
| onGenerate({ sourceCode, files }) | เก็บทั้ง sourceCode และ files | ✅ |
| templateId = newFolderId | มีฟิลด์ใน Step | ✅ |
| files ส่งไป API | generatedFiles มีข้อมูลครบ | ✅ |

### 2.2 โหมด ZIP (Smart Import) ✅ ทำงานถูกต้อง

| ขั้นตอน | ไฟล์ | สถานะ |
|---------|------|-------|
| Upload .zip → JSZip.loadAsync | `StepTemplateFromZip.jsx` | ✅ |
| แตกไฟล์ ข้าม node_modules, dist | ALLOWED_EXTS, SKIP_DIRS | ✅ |
| ตรวจสอบ index.astro | hasIndexAstro check | ✅ |
| onGenerate({ sourceCode, files }) | files จาก parsed ZIP | ✅ |
| templateId = newFolderId | มีฟิลด์ใน Step | ✅ |

### 2.3 โหมด Blank (Start from Scratch) ⚠️ มีปัญหาสำคัญ

| ขั้นตอน | ไฟล์ | สถานะ |
|---------|------|-------|
| กรอก templateName, templateDescription, category, badge | `StepTemplateInfo.jsx` | ✅ |
| เลือก colorId, fontId | `StepTemplateDesign.jsx` | ✅ |
| เลือก features | `StepTemplateFeatures.jsx` | ✅ |
| กด Generate | `TemplateGeneratorModal.handleGenerate` | ⚠️ |
| generateTemplateCode(state) | คืนค่า **string** (source code) | ⚠️ |
| เก็บ generatedCode เท่านั้น | generatedFiles ไม่ได้ตั้งค่า | ❌ |
| **templateId (newFolderId)** | StepTemplateInfo ไม่มีฟิลด์นี้ | ❌ |

---

## 3. ปัญหาที่พบ (Bugs)

### BUG-1: Blank mode — `files` เป็น `{}` เสมอ

**สาเหตุ:** `generateTemplateCode(state)` คืนค่าเป็น **string** (source code ของ generator)  
แต่ระบบส่ง `files: templateData.generatedFiles || {}` ไป API  
ใน Blank mode `generatedFiles` ไม่เคยถูกตั้งค่า จึงได้ `files = {}`

**ผลกระทบ:**
- Template ที่สร้างจาก Blank mode จะถูกบันทึกโดย `files` เป็น `{}`
- เมื่อเลือก Template นั้นใน LP Wizard → `generateHtmlByTemplate` จะหา `customTemplate.files` ไม่เจอ
- `astroToHtmlPreview(files, site)` จะ fail เพราะไม่มี `src/pages/index.astro`
- **Template ไม่สามารถ Preview หรือ Deploy ได้**

**ที่มาของปัญหา:**
```
generateTemplateCode.js — คืนค่า source code string ที่มี logic สร้าง files ข้างใน
แต่เราไม่เคย "รัน" code นั้นเพื่อได้ files object จริง
```

---

### BUG-2: Blank mode — `templateId` (newFolderId) ว่างเปล่า

**สาเหตุ:** `App.jsx` ใช้ `templateId: templateData.newFolderId`  
แต่ `StepTemplateInfo` (โหมด Blank) ไม่มีฟิลด์ `newFolderId`  
ผู้ใช้กรอกเฉพาะ templateName, templateDescription, category, badge

**ผลกระทบ:**
- `templateId` ที่ส่งไป API = `""`
- API บันทึกด้วย `template_id = ''`
- อาจชนกับ constraint หรือสร้าง record ที่ไม่สมบูรณ์
- LP Wizard จะหา template โดย id ไม่ได้

---

## 4. โครงสร้าง Payload ที่ API คาดหวัง

```json
{
  "templateId": "my-lp",           // ← ต้องไม่ว่าง
  "name": "My LP Template",
  "description": "คำอธิบาย",
  "category": "general",
  "badge": "New",
  "sourceCode": "// generator code...",
  "files": {                        // ← ต้องมีอย่างน้อย src/pages/index.astro
    "src/pages/index.astro": "...",
    "astro.config.mjs": "...",
    "package.json": "..."
  }
}
```

---

## 5. คำแนะนำการแก้ไข

### แก้ BUG-1 (Blank: files ว่าง)

**ตัวเลือก A (แนะนำ):** ปรับ `generateTemplateCode` ให้คืนค่า `{ sourceCode, files }`

- แยก logic สร้างไฟล์ (package.json, astro.config.mjs, index.astro) ออกเป็นฟังก์ชันที่สร้าง object `files` จริง
- คืนค่า `{ sourceCode: string, files: object }`
- ใน `TemplateGeneratorModal.handleGenerate` ตั้งทั้ง `generatedCode` และ `generatedFiles`

**ตัวเลือก B:** ใช้ SAMPLE_SITE แล้ว eval/Function เรียก generator ที่ generateTemplateCode สร้าง  
→ มีความเสี่ยงด้านความปลอดภัย ไม่แนะนำ

### แก้ BUG-2 (Blank: templateId ว่าง)

- เพิ่มฟิลด์ **"Template ID"** (newFolderId) ใน `StepTemplateInfo.jsx`
- Auto-slug จาก templateName: `templateName.toLowerCase().replace(/[^a-z0-9]/g, '-')`
- Fallback: ถ้า newFolderId ว่างตอน Save ให้ใช้ slug จาก templateName

---

## 6. สรุป

| โหมด | templateId | files | สถานะ |
|------|------------|-------|-------|
| Clone | ✅ จาก newFolderId | ✅ จาก tmpl.generate() | ✅ ใช้งานได้ |
| ZIP | ✅ จาก newFolderId | ✅ จาก parsed ZIP | ✅ ใช้งานได้ |
| Blank | ❌ ว่าง | ❌ ว่าง | ❌ ไม่สามารถใช้ได้หลัง Save |

**ข้อเสนอ:** แก้ไข BUG-1 และ BUG-2 ในโหมด Blank เพื่อให้ Template ที่สร้างจาก Wizard ทุกโหมดสามารถบันทึกและใช้งานใน LP Wizard ได้ครบถ้วน
