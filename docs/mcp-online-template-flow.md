# MCP Online Template Flow

## Overview

Flow สำหรับส่ง template จาก Bolt.new เข้า FusionOps โดยไม่ต้อง export/import ด้วยมือ

```
Bolt.new ──MCP call──→ mcp.fusions.dev ──HTTP POST──→ lp-factory-api (CF Worker)
                       (save_template)                 (/api/mcp/templates)
                                                              ↓
                                                       D1 Database (templates table)
                                                              ↓
                                                       FusionOps Dashboard แสดงใน Template Manager
```

---

## Components

| Component | Location | Role |
|-----------|----------|------|
| MCP Server | `fusion-mcp-server` / `mcp.fusions.dev` | รับคำสั่งจาก Bolt/Windsurf แล้วส่งต่อ |
| API Worker | `apps/api-worker` / CF Workers | รับ template เก็บลง D1 |
| FusionOps UI | `src/components/TemplateManager.jsx` | แสดง template ที่นำเข้ามา |

---

## New Endpoints

### API Worker (`apps/api-worker/src/worker.js`)

#### `POST /api/mcp/templates`
รับ template จาก MCP server (create หรือ update อัตโนมัติ)

**Headers:**
- `Content-Type: application/json`
- `x-mcp-secret: <shared-secret>` (optional, ถ้าตั้ง `MCP_SHARED_SECRET`)

**Body:**
```json
{
  "templateId": "bolt-landing-01",
  "name": "Bolt Landing Page",
  "description": "SaaS landing page from Bolt",
  "category": "general",
  "source": "bolt",
  "sourceCode": "<html>...</html>",
  "files": {
    "index.astro": "---\n...",
    "Layout.astro": "..."
  }
}
```

**Response (201 created / 200 updated):**
```json
{ "id": "abc123", "action": "created", "success": true }
```

#### `GET /api/mcp/templates`
List templates (lightweight, for sync/polling)

**Headers:**
- `x-mcp-secret: <shared-secret>` (required only when `MCP_SHARED_SECRET` is set)

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "abc123",
      "template_id": "bolt-landing-01",
      "name": "Bolt Landing Page",
      "status": "draft",
      "created_at": "2026-03-13T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### MCP Server (`fusion-mcp-server/src/index.ts`)

#### Tool: `save_template`
Bolt/Windsurf เรียก tool นี้ → MCP server ส่งต่อไปที่ api-worker

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| templateId | string | yes | Unique slug (e.g. `bolt-landing-01`) |
| name | string | yes | Display name |
| description | string | no | Description |
| category | string | no | Category (default: `general`) |
| source | string | no | `bolt` / `manual` / `windsurf` |
| files | object | no | `{ filename: content }` map |
| sourceCode | string | no | Main HTML/Astro source |

#### Tool: `list_remote_templates`
ดึงรายการ template จาก FusionOps

---

## Environment Variables

### MCP Server (`.env`)
```
FUSIONOPS_API_URL=https://lp-factory-api.<account>.workers.dev
FUSIONOPS_MCP_SECRET=your-shared-secret
```

### API Worker (`wrangler.toml` vars)
```toml
[vars]
MCP_SHARED_SECRET = "your-shared-secret"
```

---

## Security

- `x-mcp-secret` header ใช้ shared secret ระหว่าง MCP server กับ API worker
- MCP server มี Bearer token auth สำหรับ Bolt/Windsurf connections
- CORS บน MCP server อนุญาตเฉพาะ `main.fusionops.pages.dev` + localhost

---

## Test Commands

### 1. Test API Worker endpoint (direct)
```bash
curl -X POST https://lp-factory-api.<account>.workers.dev/api/mcp/templates \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: your-secret" \
  -d '{
    "templateId": "test-mcp-01",
    "name": "Test MCP Template",
    "description": "Testing MCP online flow",
    "source": "bolt",
    "category": "general"
  }'
```

### 2. Test via MCP server (save_template tool)
```bash
# ผ่าน REST API ของ MCP server
curl -X POST https://mcp.fusions.dev/api/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Test from MCP REST",
    "description": "Testing REST → MCP → FusionOps flow",
    "stack": "Astro",
    "source": "bolt"
  }'
```

### 3. List templates from API Worker
```bash
curl https://lp-factory-api.<account>.workers.dev/api/mcp/templates
```

### 4. List templates from MCP server REST
```bash
curl https://mcp.fusions.dev/api/templates
```

---

## Deployment Checklist

- [ ] Set `FUSIONOPS_API_URL` in MCP server `.env`
- [ ] Set `FUSIONOPS_MCP_SECRET` in both MCP server and wrangler.toml
- [ ] Deploy API worker: `cd apps/api-worker && wrangler deploy`
- [ ] Restart MCP server (or redeploy on fusionprime)
- [ ] Test end-to-end: Bolt → save_template → verify in Template Manager
