# Bolt.new Template Upload Monitoring Guide

## วิธีดูสถานะการทำงานตอน Upload Template จาก Bolt.new

### 1. ผ่าน FusionOps UI (Dashboard)

**URL:** https://fusionops-web.pages.dev

#### Template Manager
1. เปิด **Template Manager** จากเมนูด้านซ้าย
2. ดู template ที่เพิ่งอัพโหลด:
   - **Badge:** `Bolt` (สีฟ้า) = มาจาก Bolt.new
   - **Status:** `draft` / `active`
   - **Files count:** จำนวนไฟล์ที่อัพโหลด
   - **Created at:** เวลาที่สร้าง

#### Template Details
1. คลิกที่ template card
2. ดูรายละเอียด:
   - **Source Code Preview** — ดู HTML/CSS/JS
   - **Files List** — ดูไฟล์ทั้งหมด
   - **Metadata** — ดู template ID, name, description

---

### 2. ผ่าน API Worker (Direct API Call)

#### List All Templates
```bash
curl -H "x-mcp-secret: YOUR_SECRET" \
  https://lp-factory-api.misty-feather-556e.workers.dev/api/mcp/templates
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "ce8c02608576",
      "template_id": "bolt-test-03",
      "name": "Test With SourceCode",
      "description": "Saved with sourceCode for preview",
      "badge": "Bolt",
      "source": "bolt",
      "category": "landing",
      "status": "draft",
      "files": "{...}",
      "created_at": "2026-03-14T06:30:00.000Z",
      "updated_at": "2026-03-14T06:30:00.000Z"
    }
  ]
}
```

#### Get Specific Template
```bash
curl -H "x-mcp-secret: YOUR_SECRET" \
  "https://lp-factory-api.misty-feather-556e.workers.dev/api/mcp/templates?templateId=bolt-test-03"
```

---

### 3. ผ่าน Browser DevTools (Real-time)

#### Network Tab
1. เปิด Browser DevTools (F12)
2. ไปที่ **Network** tab
3. รัน Bolt edge function
4. ดู request:
   - **Method:** `POST`
   - **URL:** `/api/mcp/templates`
   - **Status:** `200 OK` = สำเร็จ
   - **Response:** JSON ที่มี template ID

#### Console Tab
1. เปิด **Console** tab
2. ดู log จาก edge function:
   ```javascript
   {
     ok: true,
     data: {
       id: "ce8c02608576",
       template_id: "bolt-test-03",
       ...
     }
   }
   ```

---

### 4. ผ่าน Cloudflare D1 Console (Database)

#### Access D1 Database
1. Cloudflare Dashboard → **Workers & Pages** → **D1**
2. เลือก database: `lp-factory-db`
3. รัน SQL query:

```sql
-- ดู template ล่าสุด
SELECT 
  id,
  template_id,
  name,
  badge,
  status,
  created_at
FROM templates
WHERE badge = 'Bolt'
ORDER BY created_at DESC
LIMIT 10;
```

```sql
-- ดู template เฉพาะ
SELECT * FROM templates 
WHERE template_id = 'bolt-test-03';
```

```sql
-- นับจำนวน template จาก Bolt
SELECT COUNT(*) as total 
FROM templates 
WHERE badge = 'Bolt';
```

---

### 5. ผ่าน GitHub Actions Logs (Deploy)

#### ดู Deploy Status
1. GitHub Repository → **Actions** tab
2. เลือก workflow: **Deploy Landing Page**
3. ดู logs:
   - **Parse config** — ดู template ID
   - **Auto-detect template source** — ดูว่าใช้ physical directory หรือ D1
   - **Generate from D1** — ดูว่า generate temp directory สำเร็จหรือไม่
   - **Build Astro site** — ดูว่า build สำเร็จหรือไม่
   - **Deploy to Cloudflare Pages** — ดู deploy URL

#### Example Log Output
```
Using physical template directory: templates/pet-orange-white
✅ Template files loaded: 13 files
```

หรือ

```
Physical template not found, generating from D1 Database...
Fetching template from D1 Database: bolt-test-03
Template found: Test With SourceCode (source: bolt)
Generated temp directory: tmp/templates/bolt-test-03
✅ Template directory generated successfully
```

---

### 6. ผ่าน Local Scripts

#### Check Template in D1
```bash
node scripts/cleanup-db-templates.mjs
```

**Output:**
```
Found 5 templates
✅ bolt-test-03 - Has physical directory
❌ bolt-test-02 - No physical directory (source: bolt)
✅ pet-orange-white - Has physical directory
```

#### Generate Template Locally
```bash
node scripts/generate-template-from-db.mjs bolt-test-03
```

**Output:**
```
Fetching template from D1 Database: bolt-test-03
Template found: Test With SourceCode (source: bolt)
Generated temp directory: tmp/templates/bolt-test-03
Files written: 8
✅ Template directory generated successfully
```

---

## สรุป Monitoring Points

| Method | Use Case | Real-time | Detail Level |
|--------|----------|-----------|--------------|
| FusionOps UI | ดูภาพรวม template | ❌ | ⭐⭐⭐ |
| API Direct Call | Automation / Script | ✅ | ⭐⭐⭐⭐ |
| Browser DevTools | Debug upload | ✅ | ⭐⭐⭐⭐⭐ |
| Cloudflare D1 | Database query | ❌ | ⭐⭐⭐⭐⭐ |
| GitHub Actions | Deploy status | ❌ | ⭐⭐⭐⭐ |
| Local Scripts | Development | ❌ | ⭐⭐⭐ |

---

## Troubleshooting

### Template ไม่ปรากฏใน UI
1. ตรวจสอบ API response ใน DevTools
2. ตรวจสอบ D1 Database ว่ามี record หรือไม่
3. ตรวจสอบ `status` field (ต้องเป็น `draft` หรือ `active`)

### Deploy ล้มเหลว
1. ตรวจสอบ GitHub Actions logs
2. ตรวจสอบว่า template มี `files` JSON ครบหรือไม่
3. ตรวจสอบว่า `package.json` และ dependencies ถูกต้องหรือไม่

### Template หาย
1. ตรวจสอบ D1 Database ว่ายังมี record หรือไม่
2. ตรวจสอบ `deleted_at` field
3. ตรวจสอบ API Worker logs ใน Cloudflare Dashboard
