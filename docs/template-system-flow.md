# คู่มือระบบ Template — FusionOps V2

> อธิบาย Flow ทั้งหมดของระบบ Template ตั้งแต่การสร้าง → บันทึก → โหลด → Preview → ใช้งาน

---

## ภาพรวม

ระบบ Template ใน FusionOps V2 ช่วยให้สร้าง Landing Page template ได้ 4 วิธี แล้วบันทึกลง Database เพื่อให้ LP Wizard ดึงมาใช้ได้ทันที

```
สร้าง Template (4 วิธี)
        │
        ▼
POST /api/templates → D1 Database
        │
        ▼
GET /api/templates → Cache ใน Browser
        │
        ▼
LP Wizard → เลือก Template → Preview → Deploy LP
```

---

## 1. วิธีสร้าง Template (4 เส้นทาง)

### วิธีที่ 1 — Start from Scratch (สร้างใหม่ด้วย Wizard)

```
ผู้ใช้กรอกข้อมูลใน Template Wizard
    │
    ├─ Step 1: ชื่อ Template, คำอธิบาย, หมวดหมู่
    ├─ Step 2: เลือก Color Scheme + Font
    ├─ Step 3: เลือก Features (Hero Form, FAQ, Calculator…)
    └─ Step 4: กด "Generate Code"
                    │
                    ▼
        generateTemplateCode(state)
        ← src/components/TemplateGenerator/generateTemplateCode.js
                    │
                    │  สร้างไฟล์ Astro project:
                    │  • package.json
                    │  • astro.config.mjs
                    │  • src/pages/index.astro  ← HTML + CSS + JS
                    ▼
        [Review Step] → กด "Save Template"
                    │
                    ▼
        POST /api/templates → บันทึกลง D1 ✅
```

### วิธีที่ 2 — Clone Existing (คัดลอกจาก Template ที่มีอยู่)

```
ผู้ใช้เลือก Template ต้นแบบ + ตั้งชื่อ Folder ใหม่
    │
    ▼
tmpl.generate(SAMPLE_SITE)
← packages/lp-template-generator/src/templates/<id>/index.js
    │
    │  ได้ไฟล์จริงของ Template นั้น:
    │  • src/pages/index.astro (HTML จริง)
    │  • astro.config.mjs
    │  • src/styles/, src/components/ ฯลฯ
    ▼
[Review Step] → กด "Save Template"
    │
    ▼
POST /api/templates → บันทึกลง D1 ✅
```

### วิธีที่ 3 — Upload ZIP (อัปโหลดไฟล์ .zip จาก Astro project)

```
ผู้ใช้ลาก .zip file วางในช่อง Upload
    │
    ▼
JSZip.loadAsync(file)
← src/components/TemplateGenerator/steps/StepTemplateFromZip.jsx
    │
    │  แตกไฟล์ออกมา (ข้าม node_modules/, dist/, .git/)
    │  ตรวจสอบว่ามี src/pages/index.astro ✓
    │
    ▼
[Review Step] → กด "Save Template"
    │
    ▼
POST /api/templates → บันทึกลง D1 ✅
```

### วิธีที่ 4 — CLI Script (แปลง Folder → JSON แล้ว Upload)

```bash
# แปลงเป็น JSON ไฟล์ก่อน
node scripts/folder-to-template-json.js ./my-astro-project \
  --id my-lp \
  --name "My LP Template" \
  --desc "คำอธิบาย"

# หรือ Upload ตรงเข้า API เลย
node scripts/folder-to-template-json.js ./my-astro-project \
  --id my-lp \
  --name "My LP Template" \
  --upload \
  --api-url http://localhost:8787
```

```
./my-astro-project/
    │
    ▼
scripts/folder-to-template-json.js
    │
    │  รวบรวมไฟล์ทุกไฟล์ (.astro, .js, .ts, .css, .json…)
    │  ข้าม: node_modules/, dist/, .git/, package-lock.json
    │  ตรวจสอบ: src/pages/index.astro ต้องมี
    │
    ├─ บันทึกเป็น my-lp.template.json  (ถ้าไม่ใช้ --upload)
    │
    └─ POST /api/templates  (ถ้าใช้ --upload)
              │
              ▼
        D1 Database ✅
```

---

## 2. โครงสร้าง Payload ที่ส่งไป API

```json
{
  "templateId": "my-lp",
  "name": "My LP Template",
  "description": "คำอธิบาย Template",
  "category": "general",
  "badge": "New",
  "sourceCode": "// โค้ด generator (สำหรับ Clone mode)",
  "files": {
    "src/pages/index.astro": "<!doctype html>...",
    "astro.config.mjs": "import { defineConfig }...",
    "src/styles/global.css": "* { margin: 0; }",
    "package.json": "{ \"name\": \"my-lp\" ... }"
  }
}
```

---

## 3. การบันทึกลง Database

```
POST /api/templates
← apps/api-worker/src/worker.js
    │
    ▼
Cloudflare D1 (ตาราง templates)
┌────────────────────────────────────────────────────┐
│  id          │ UUID อัตโนมัติ                       │
│  template_id │ "my-lp"                             │
│  name        │ "My LP Template"                    │
│  description │ "คำอธิบาย"                          │
│  category    │ "general"                           │
│  badge       │ "New"                               │
│  source_code │ "// generator code..."              │
│  files       │ JSON string ของ files object        │
│  created_at  │ timestamp                           │
└────────────────────────────────────────────────────┘
```

---

## 4. การโหลด Template เข้า LP Wizard

```
ผู้ใช้เปิด LP Wizard → Step Design
    │
    ▼
StepDesign.jsx เรียก refreshCustomTemplates()
← src/components/Wizard/StepDesign.jsx
    │
    ▼
GET /api/templates
← apps/api-worker/src/worker.js
    │
    ▼
template-registry.js แคชผลลัพธ์ไว้ใน Memory
← src/utils/template-registry.js
    │
    │  customTemplatesCache = [
    │    { id, template_id, name, files: {...} },
    │    ...
    │  ]
    │
    ▼
รวมกับ Built-in Templates (classic, pdl-loans-v1, ฯลฯ)
    │
    ▼
แสดงใน Template Selector Grid ✅
```

---

## 5. การ Preview Template (iframe แบบ Real-time)

```
ผู้ใช้เลือก Template + Color + Font ใน LP Wizard
    │
    ▼
useMemo → generateHtmlByTemplate(config)
← src/utils/template-router.js
    │
    ├─ Template ใน Built-in?
    │    └─ generateFromModule(templateId, site)
    │         └─ packages/lp-template-generator/src/templates/<id>/index.js
    │
    ├─ Template จาก API (Custom)?
    │    └─ customTemplatesCache.find(t => t.id === templateId)
    │         └─ ดึง files จาก Cache ที่โหลดไว้แล้ว
    │
    └─ ทั้งสองเส้นทาง → astroToHtmlPreview(files, site)
                │
                │  ขั้นตอนการแปลง:
                │  1. ตรวจว่ามี Astro frontmatter (---) ไหม
                │  2. ถ้าไม่มี → return HTML ตรงๆ (ป้องกัน JS เสียหาย)
                │  3. ถ้ามี → ลบ frontmatter ออก
                │  4. Strip: define:vars={{}}, is:inline, is:global
                │  5. Inject fallback vars: conversionId, formStartLabel ฯลฯ
                │  6. Replace: ${brand}, ${h1}, ${c.primary} ด้วยข้อมูลจริง
                ▼
           HTML string สมบูรณ์
                │
                ▼
        <iframe srcDoc={html} />  ← แสดงใน LP Wizard ✅
```

---

## 6. การใช้ Template สร้าง LP จริง

```
ผู้ใช้กรอกข้อมูล LP ครบทุก Step
    │  • Brand name, Domain
    │  • Headline, Subheadline, CTA
    │  • Color, Font
    │  • Template ที่เลือก
    ▼
generateHtmlByTemplate(site)  ← เหมือน Preview แต่ใช้ข้อมูลจริง
    │
    ▼
POST /api/sites → บันทึก LP ลง Database
    │
    ▼
Deploy → Cloudflare Pages / Netlify
    │
    ▼
LP ออนไลน์ ✅  https://mybrand.com
```

---

## 7. ตารางไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| `src/components/TemplateGenerator/TemplateGeneratorModal.jsx` | Wizard หลัก — จัดการ 3 modes และ step navigation |
| `src/components/TemplateGenerator/generateTemplateCode.js` | สร้างโค้ด Astro สำหรับ "Start from Scratch" mode |
| `src/components/TemplateGenerator/steps/StepTemplateFromDir.jsx` | UI สำหรับ Clone Existing mode |
| `src/components/TemplateGenerator/steps/StepTemplateFromZip.jsx` | UI สำหรับ Upload ZIP mode (ใช้ JSZip) |
| `src/components/TemplateGenerator/steps/StepTemplateReview.jsx` | หน้าสรุปก่อน Save — แสดงข้อมูล Template |
| `src/utils/template-router.js` | แปลง Astro files → HTML สำหรับ iframe preview |
| `src/utils/template-registry.js` | โหลดและแคช Custom Templates จาก API |
| `apps/api-worker/src/worker.js` | API endpoint: `POST/GET /api/templates` |
| `packages/lp-template-generator/src/templates/` | Built-in template generators (classic, pdl-loans-v1 ฯลฯ) |
| `scripts/folder-to-template-json.js` | CLI script: แปลง Astro folder → JSON → upload |

---

## 8. วิธีใช้ CLI Script

```bash
# ดู help
node scripts/folder-to-template-json.js

# แปลงเป็นไฟล์ JSON (ไม่ upload)
node scripts/folder-to-template-json.js ./templates/elastic-credits-v4 \
  --id elastic-v4 \
  --name "Elastic Credits V4" \
  --desc "Credit template with calculator" \
  --category general \
  --badge Stable

# ผลลัพธ์: elastic-v4.template.json

# Upload ตรงเข้า API (dev)
node scripts/folder-to-template-json.js ./templates/elastic-credits-v4 \
  --id elastic-v4 \
  --name "Elastic Credits V4" \
  --upload \
  --api-url http://localhost:8787

# Upload ตรงเข้า API (production)
node scripts/folder-to-template-json.js ./templates/elastic-credits-v4 \
  --id elastic-v4 \
  --name "Elastic Credits V4" \
  --upload \
  --api-url https://api.yourdomain.com
```

### ไฟล์ที่ script รับ / ข้ามอัตโนมัติ

| รับ | ข้าม |
|-----|------|
| `.astro` `.js` `.ts` `.jsx` `.tsx` `.mjs` `.css` `.json` `.html` `.md` `.env` `.toml` | `node_modules/` `dist/` `.git/` `.astro/` `.cache/` `package-lock.json` `bun.lock` |

---

## 9. อธิบาย `scripts/folder-to-template-json.js` แบบละเอียด

### ภาพรวม Flow ของ Script

```
รับ argument จาก command line
    │
    ▼
ตรวจสอบว่า folder มีอยู่จริง
    │
    ▼
collectFiles() — วนอ่านทุกไฟล์ใน folder แบบ recursive
    │  ข้าม: node_modules/, dist/, .git/ ฯลฯ
    │  รับเฉพาะ: .astro, .js, .ts, .css, .json ฯลฯ
    ▼
ตรวจสอบว่ามี src/pages/index.astro (เตือนถ้าไม่มี)
    │
    ▼
สร้าง payload object { templateId, name, files, ... }
    │
    ├─ บันทึกเป็น <id>.template.json เสมอ
    │
    └─ ถ้าใช้ --upload → POST /api/templates
```

---

### อธิบายทีละส่วน

#### ส่วนที่ 1 — ค่า Config (บรรทัด 34–46)

```js
// นามสกุลไฟล์ที่ยอมรับ — เฉพาะไฟล์ source code เท่านั้น
const ALLOWED_EXTENSIONS = new Set([
  '.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.json', '.css', '.html', '.md', '.env', '.toml', '.txt',
]);

// โฟลเดอร์ที่ข้ามทั้งหมด — ไม่อ่านเข้าไปเลย
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.astro', '.cache',
  '.netlify', '.vercel', '.wrangler', 'coverage',
]);

// ไฟล์ที่ข้าม — lock files ที่ใหญ่และไม่จำเป็น
const SKIP_FILES = new Set([
  'package-lock.json', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml',
]);
```

> **เหตุผล:** ไม่รับ `node_modules/` เพราะมีไฟล์หลายหมื่นไฟล์ ทำให้ JSON ใหญ่มาก และ API จะ rebuild dependencies เองเมื่อ deploy

---

#### ส่วนที่ 2 — `parseArgs()` (บรรทัด 50–68)

```js
// แปลง command line arguments เป็น object
// เช่น: --id my-lp --name "My LP" --upload
// ได้: { id: "my-lp", name: "My LP", upload: true, _: ["./folder"] }

function parseArgs(argv) {
  const args = { _: [] };           // _ เก็บ positional args (path ของ folder)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);     // ตัด -- ออก เช่น --id → "id"
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;           // --id my-lp → args.id = "my-lp"
        i++;
      } else {
        args[key] = true;           // --upload (ไม่มีค่า) → args.upload = true
      }
    } else {
      args._.push(arg);             // ./my-folder → args._[0]
    }
  }
  return args;
}
```

---

#### ส่วนที่ 3 — `collectFiles()` (บรรทัด 70–96) — หัวใจของ Script

```js
function collectFiles(dir, baseDir = dir, result = {}) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // ข้ามโฟลเดอร์ที่ไม่ต้องการ (node_modules, dist ฯลฯ)
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    // แปลง path เป็น relative จาก root folder และใช้ / แทน \ (Windows)
    // เช่น: F:\my-lp\src\pages\index.astro → src/pages/index.astro
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      // เรียกตัวเองซ้ำ (recursive) เพื่อเข้าไปใน subfolder
      collectFiles(fullPath, baseDir, result);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;   // ข้าม lock files

      const ext = path.extname(entry.name).toLowerCase();
      // ข้ามไฟล์ที่ไม่ใช่ source code (เช่น .png, .jpg, .woff)
      if (!ALLOWED_EXTENSIONS.has(ext) && ext !== '') continue;

      // อ่านเนื้อหาไฟล์เป็น string แล้วเก็บใน result
      // key = relative path, value = เนื้อหาไฟล์
      result[relPath] = fs.readFileSync(fullPath, 'utf-8');
    }
  }

  return result;
  // ผลลัพธ์: {
  //   "src/pages/index.astro": "<!doctype html>...",
  //   "astro.config.mjs": "import { defineConfig }...",
  //   "src/styles/global.css": "* { margin: 0; }",
  // }
}
```

> **สำคัญ:** key ของ `result` คือ relative path เช่น `"src/pages/index.astro"` — ระบบใช้ key นี้ในการ preview และ deploy

---

#### ส่วนที่ 4 — `slugify()` (บรรทัด 98–100)

```js
// แปลงชื่อ folder เป็น Template ID ที่ใช้งานได้
// เช่น: "My Awesome LP!" → "my-awesome-lp"
// เช่น: "elastic_credits_v4" → "elastic-credits-v4"
function slugify(str) {
  return str
    .toLowerCase()                          // ตัวพิมพ์เล็กทั้งหมด
    .replace(/[^a-z0-9]+/g, '-')           // แทนอักขระพิเศษด้วย -
    .replace(/^-|-$/g, '');                // ตัด - หัวและท้ายออก
}
```

---

#### ส่วนที่ 5 — `main()` ขั้นตอนหลัก (บรรทัด 104–208)

```js
// ขั้นตอนที่ 1: รับ argument
const args = parseArgs(process.argv.slice(2));
const folderArg = args._[0];   // path ของ Astro project folder

// ขั้นตอนที่ 2: กำหนดค่า metadata
const templateId   = args.id       || slugify(folderName);  // ถ้าไม่ระบุ --id ใช้ชื่อ folder
const templateName = args.name     || folderName;
const description  = args.desc     || '';
const badge        = args.badge    || 'New';
const category     = args.category || 'general';

// ขั้นตอนที่ 3: รวบรวมไฟล์
const files = collectFiles(folderPath);

// ขั้นตอนที่ 4: ตรวจสอบ index.astro
const hasIndex = Object.keys(files).some(
  f => f === 'src/pages/index.astro' || f.endsWith('/index.astro')
);
// ถ้าไม่มี → แค่เตือน ไม่ได้หยุด (เผื่อ template บางแบบใช้ชื่อไฟล์ต่างกัน)

// ขั้นตอนที่ 5: สร้าง payload
const payload = {
  templateId,    // "my-lp"
  name,          // "My LP Template"
  description,   // "คำอธิบาย"
  category,      // "general"
  badge,         // "New"
  sourceCode,    // comment บอกที่มา (ไม่ใช่โค้ดจริง)
  files,         // { "src/pages/index.astro": "...", ... }
};

// ขั้นตอนที่ 6: บันทึก JSON ไฟล์เสมอ (เป็น backup)
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

// ขั้นตอนที่ 7: ถ้าใช้ --upload → POST ไป API
if (args.upload) {
  const res = await fetch(`${apiUrl}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  // ถ้าสำเร็จ → Template ปรากฏใน LP Wizard ทันที
}
```

---

### ตัวอย่าง Output ที่ได้

```
📦 Converting: F:\astro.build\ppc-claude-web\templates\elastic-credits-v4
   Template ID : elastic-credits-v4
   Name        : Elastic Credits V4
   Category    : general

✅ Found 23 files:
   📄 astro.config.mjs
   📄 package.json
   📄 src/components/CalcStatic.astro
   📄 src/components/Footer.astro
   📄 src/components/Header.astro
   📄 src/layouts/Layout.astro
   📄 src/pages/index.astro          ← ไฟล์หลักสำหรับ preview
   📄 src/styles/global.css
   📄 tailwind.config.mjs
   📄 tsconfig.json
   ... (อีก 13 ไฟล์)

💾 Saved to: F:\astro.build\ppc-claude-web\elastic-credits-v4.template.json

💡 To upload directly, run with --upload flag:
   node scripts/folder-to-template-json.js ./templates/elastic-credits-v4 --upload --api-url http://localhost:8787
```

---

## Checklist ที่ใช้จริงก่อน Deploy

- ใช้คู่กับเอกสารนี้: `docs/template-worker-deploy-checklist.md`
- แนะนำให้รันทุกครั้งก่อน publish/redeploy template เพื่อกันปัญหา
  - Astro expression หลุดเป็นข้อความ
  - สี/สไตล์เพี้ยนใน worker deploy path
  - tracking script fail ตอน runtime

---

### โครงสร้าง JSON ที่ได้

```json
{
  "templateId": "elastic-credits-v4",
  "name": "Elastic Credits V4",
  "description": "Credit template with calculator",
  "category": "general",
  "badge": "New",
  "sourceCode": "// Imported from folder: elastic-credits-v4\n// Files: 23\n// Generated: 2026-02-22T...",
  "files": {
    "src/pages/index.astro": "---\nimport Layout from '../layouts/Layout.astro';\n...",
    "src/layouts/Layout.astro": "---\n...",
    "src/styles/global.css": "* { margin: 0; padding: 0; }...",
    "astro.config.mjs": "import { defineConfig } from 'astro/config';...",
    "package.json": "{ \"name\": \"elastic-credits-v4\", ... }",
    "tailwind.config.mjs": "export default { content: [...] }",
    "tsconfig.json": "{ \"extends\": \"astro/tsconfigs/strict\" }"
  }
}
```

---

### ข้อควรระวัง

| สถานการณ์ | ผลที่เกิด |
|-----------|-----------|
| ไม่มี `src/pages/index.astro` | เตือน แต่ยังทำงานต่อ — Preview ใน LP Wizard จะไม่แสดงผล |
| ไฟล์ binary (รูปภาพ, font) | ข้ามอัตโนมัติ — ต้องใช้ CDN หรือ public/ folder แทน |
| `--id` ซ้ำกับที่มีอยู่ใน DB | API จะ error — ต้องใช้ ID ที่ไม่ซ้ำ |
| ไม่ระบุ `--api-url` | ใช้ `http://localhost:8787` เป็น default |
| ไฟล์ใหญ่มาก (>5MB รวม) | อาจ timeout — ลองลบไฟล์ที่ไม่จำเป็นออกก่อน |

---

## 10. Event Flow เมื่อ Save Template สำเร็จ

```
กด "Save Template"
    │
    ▼
App.jsx → onSave(state)
    │
    ▼
POST /api/templates ← ส่ง payload ไป API
    │
    ├─ สำเร็จ → notify("Template saved successfully!", "success")
    │              │
    │              ├─ refreshCustomTemplates()  ← โหลด Cache ใหม่
    │              │
    │              └─ window.dispatchEvent(TEMPLATE_REFRESH_EVENT)
    │                      │
    │                      ▼
    │              StepDesign.jsx รับ event → reload template list
    │              Template ปรากฏใน LP Wizard ทันที ✅
    │
    └─ ล้มเหลว → notify("Error saving template", "error")
```
