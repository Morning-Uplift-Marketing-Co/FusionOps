# Template Import Best Practices

## 🎯 Overview

ระบบ validation อัตโนมัติเพื่อป้องกันการ import template ที่มีปัญหาเข้า database

## ✅ Validation Process

### 1. **Pre-Import Validation** (อัตโนมัติ)

เมื่อใช้ `--upload` flag, ระบบจะ validate template ก่อนอัตโนมัติ:

```bash
node scripts/folder-to-template-json.js path/to/template --upload --id my-template
```

**ตรวจสอบ:**
- ✅ Required files (package.json, astro.config.mjs, tsconfig.json, index.astro)
- ✅ Required dependencies (astro)
- ✅ Syntax issues ใน index.astro
- ✅ Build test (npm install && npm run build)

### 2. **Manual Validation**

ทดสอบ template ก่อน import:

```bash
node scripts/validate-template-build.mjs path/to/template
```

### 3. **Skip Validation** (ไม่แนะนำ)

ถ้าต้องการ upload โดยไม่ validate:

```bash
node scripts/folder-to-template-json.js path/to/template --upload --skip-validation
```

⚠️ **คำเตือน:** Template ที่ไม่ผ่าน validation อาจทำให้ deployment ล้มเหลว

---

## 🔧 Common Issues & Auto-Fixes

### Issue 1: Missing `src/env.ts`

**ปัญหา:** Template ขาดไฟล์ env.ts ทำให้ import ล้มเหลว

**วิธีแก้:**
```bash
# สร้างไฟล์ src/env.ts ใน template folder
cat > src/env.ts << 'EOF'
export const env = {
  PUBLIC_BRAND: import.meta.env.PUBLIC_BRAND || '',
  PUBLIC_DOMAIN: import.meta.env.PUBLIC_DOMAIN || '',
  // ... (ดูตัวอย่างใน scripts/validate-template-build.mjs)
};
EOF
```

### Issue 2: Syntax Errors

**ปัญหา:** Code มี syntax error ทำให้ build ล้มเหลว

**วิธีแก้:**
1. รัน validation script เพื่อดู error details
2. แก้ไข syntax error ตามที่ระบุ
3. ทดสอบ build อีกครั้ง

### Issue 3: Missing Dependencies

**ปัญหา:** package.json ขาด dependencies

**วิธีแก้:**
```bash
cd template-folder
npm install astro @astrojs/react react react-dom
```

---

## 📋 Workflow Integration

### GitHub Actions Auto-Validation

Workflow จะ validate template อัตโนมัติก่อน deploy:

```yaml
- name: Auto-detect template source and prepare directory
  # ถ้า template ไม่มี physical folder
  # จะ generate จาก database ผ่าน generate-template-from-db.mjs
  
- name: Validate template tracking stack
  # ตรวจสอบ tracking elements
  
- name: Build Astro site
  # ถ้า build ล้มเหลว workflow จะหยุด
```

---

## 🚀 Recommended Import Flow

### สำหรับ Bolt.new Templates

```bash
# 1. Export template จาก Bolt.new
# 2. Validate ก่อน import
node scripts/validate-template-build.mjs path/to/bolt-template

# 3. ถ้าผ่าน validation -> import
node scripts/folder-to-template-json.js path/to/bolt-template \
  --upload \
  --id my-bolt-template \
  --name "My Bolt Template" \
  --badge Bolt \
  --category loan \
  --api-url https://lp-factory-api.misty-feather-556e.workers.dev

# 4. ตรวจสอบใน database
node scripts/check-bolt-templates.mjs
```

### สำหรับ Legacy Templates

```bash
# Legacy templates อยู่ใน templates/ folder
# ไม่ต้อง import เข้า database
# Workflow จะใช้ physical folder โดยตรง
```

---

## 🔍 Troubleshooting

### Template ไม่แสดงใน UI

**สาเหตุ:**
- Status = 'draft' (ยังไม่ publish)
- Badge ไม่ถูกต้อง
- Template ถูก filter ออก

**วิธีแก้:**
```bash
# ตรวจสอบ template ใน database
node scripts/check-bolt-templates.mjs

# แก้ไข badge
node scripts/fix-bolt-badge.mjs
```

### Deployment ล้มเหลว

**สาเหตุ:**
- Template มี syntax error
- Missing dependencies
- Build configuration ไม่ถูกต้อง

**วิธีแก้:**
1. ดู workflow logs: `gh run view <run-id> --log-failed`
2. แก้ไข template source
3. Re-import template
4. Trigger deployment ใหม่

---

## 📊 Validation Checklist

ก่อน import template ใหม่:

- [ ] ✅ ทดสอบ build locally (`npm run build`)
- [ ] ✅ รัน validation script
- [ ] ✅ ตรวจสอบ required files
- [ ] ✅ ตรวจสอบ tracking elements
- [ ] ✅ ทดสอบใน dev environment
- [ ] ✅ Import เข้า database
- [ ] ✅ ตรวจสอบใน Template Manager UI
- [ ] ✅ ทดสอบ deployment ผ่าน GitHub Actions

---

## 🎓 Best Practices

1. **Always validate before import** - ใช้ validation script ทุกครั้ง
2. **Test build locally first** - อย่า rely on CI/CD เพียงอย่างเดียว
3. **Use meaningful template IDs** - ใช้ naming convention ที่ชัดเจน
4. **Document template requirements** - บันทึก dependencies และ configuration
5. **Version control template source** - เก็บ template source ใน git
6. **Monitor deployment logs** - ตรวจสอบ logs เมื่อ deploy ล้มเหลว

---

## 🔗 Related Scripts

- `scripts/validate-template-build.mjs` - Validate template can build
- `scripts/folder-to-template-json.js` - Convert folder to template JSON
- `scripts/generate-template-from-db.mjs` - Generate template from database
- `scripts/check-bolt-templates.mjs` - Check templates in database
- `scripts/fix-bolt-badge.mjs` - Fix template badges

---

## 📞 Support

ถ้าพบปัญหา:
1. ตรวจสอบ validation logs
2. ดู GitHub Actions workflow logs
3. ตรวจสอบ database ด้วย check-bolt-templates.mjs
4. อ่าน troubleshooting guide ด้านบน
