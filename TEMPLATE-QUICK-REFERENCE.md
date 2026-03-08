# 📋 Template Quick Reference

## 🚀 3 นาทีสร้าง Template ใหม่

```bash
# 1. Copy starter
cp -r templates/pet-orange-white templates/my-template

# 2. Validate
node scripts/validate-template-tracking.mjs templates/my-template

# 3. Pack
node scripts/pack-template.mjs templates/my-template my-template \
  --name "My Template" --desc "Custom template" --category loan

# 4. Upload ZIP ผ่าน Wizard
```

## ✅ Validate ต้องผ่าน

```
✓ Layout.astro missing PUBLIC_VOLUUMDOMAIN env usage
✓ Layout.astro pixel must use t.{domain}/e
✓ Layout.astro missing Voluum dtpCallback injection
✓ index.astro missing ctaHref declaration
✓ index.astro CTA links are not wired to ctaHref
```

## 🔧 สิ่งที่ต้องมีใน Layout

```astro
// Env vars
const colorId  = import.meta.env.PUBLIC_COLORID  || 'ocean';
const fontId   = import.meta.env.PUBLIC_FONTID   || 'plus-jakarta';
const radiusId = import.meta.env.PUBLIC_RADIUS   || 'rounded';
const layout   = import.meta.env.PUBLIC_LAYOUT   || 'hero-center';
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
```

## 📦 Pack Options

```bash
--name "Display Name"
--desc "Description" 
--category loan|pet|custom
--badge "Custom"
--convert   # Astro.props → template literals
```

## 🎯 Import Steps

1. Wizard → Step 3 → Smart Import (ZIP)
2. Upload `template-{id}.zip`
3. Fill template info
4. Save → appears in list

## ⚡ Tips

- ใช้ `--convert` ถ้า template มี `{brand}` แสดงดิบ
- Validate ก่อน pack ทุกครั้ง
- Re-upload ZIP หลังแก้ template
- `pet-orange-white` เป็น reference template ที่สมบูรณ์

## 📁 Required Files

```
src/layouts/Layout.astro     ✅
src/pages/index.astro        ✅
src/pages/e.ts               ✅
src/pages/robots.txt.ts      ✅
public/_headers              ✅
```

---
**Ready to use! 🎉**
