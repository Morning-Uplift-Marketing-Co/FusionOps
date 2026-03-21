# Template Import via MCP

Import templates from Bolt.new, Lovable, or any AI IDE directly into FusionOps Dashboard — no ZIP download needed.

## Prerequisites

1. **Fusion MCP Server** running (Docker on NAS or local)
2. **Environment variables** set on MCP server:
   ```
   FUSIONOPS_API_URL=https://your-worker.workers.dev
   FUSIONOPS_MCP_SECRET=your-secret
   ```
3. **MCP config** in Claude Code / Cursor:
   ```json
   {
     "mcpServers": {
       "fusion-mcp": {
         "url": "https://mcp.fusions.dev/mcp"
       }
     }
   }
   ```

## How to Import

### From Lovable

Open Claude Code or Cursor and type:

```
Import Lovable project "Credit Compass" เข้า FusionOps
ชื่อ: Trust Lend
ID: lov-loans-01
category: loan
```

AI will automatically:
1. Use Lovable MCP to read all source files
2. Use fusion-mcp `save_template` to send files to FusionOps API
3. Template appears in Dashboard with "LOVEABLE" badge

### From Bolt.new

```
Import Bolt project จาก https://bolt.new/~/sb1-xxxxx เข้า FusionOps
ชื่อ: QuickLoan Pro
ID: bolt-loan-01
category: loan
```

AI will automatically:
1. Use Bolt MCP to read all source files
2. Use fusion-mcp `save_template` to send files to FusionOps API
3. Template appears in Dashboard with "BOLT" badge

### From Local Folder

```
Import template จาก H:/DEV/templates/my-template เข้า FusionOps
ชื่อ: My Template
ID: my-template-01
category: loan
```

## What Happens Behind the Scenes

```
You: "Import this template"
  ↓
AI reads all files from source (Lovable MCP / Bolt MCP / local)
  ↓
AI calls fusion-mcp save_template with:
  - templateId: slug ID you specified
  - name: display name
  - category: loan / general / etc.
  - source: loveable / bolt / manual
  - files: { "src/App.tsx": "...", "index.html": "...", ... }
  - sourceCode: main entry file content
  ↓
Fusion MCP Server → POST to FusionOps Worker API
  ↓
Worker saves to Neon PostgreSQL database
  ↓
Dashboard shows template with badge + og-image thumbnail
  ↓
Ready to deploy via Wizard → GitHub Actions → Cloudflare Pages
```

## Important Notes

### DO before importing:
- Set project knowledge in Bolt/Lovable (see TEMPLATE-PROMPT.md)
- Make sure template uses `bg-primary` / `text-primary` (not hardcoded colors)
- Include `<meta property="og:image">` with static URL for thumbnail

### DO NOT include:
- `node_modules/` (auto-excluded)
- `apply.html` or apply page (pipeline generates this)
- Tracking/pixel scripts (pipeline injects these)
- Real HSL color values in CSS variables (pipeline sets per-site)

### If template already exists:
- Same `templateId` → updates existing template (creates new version)
- Different `templateId` → creates new template

## Verify Import

After importing, check in Dashboard:
1. Go to Template Manager
2. New template should appear with correct badge (BOLT/LOVEABLE/MCP)
3. Click template → check Quality Gate status
4. If Quality Gate fails, fix issues listed and re-import

## MCP Tools Reference

| Tool | What it does |
|------|-------------|
| `save_template` | Save/update a template in FusionOps |
| `list_remote_templates` | List all templates in FusionOps |
| `ping` | Health check |

### save_template parameters

| Parameter | Required | Example |
|-----------|----------|---------|
| templateId | Yes | `"lov-loans-01"` |
| name | Yes | `"Trust Lend"` |
| description | No | `"Dark luxury loan landing page"` |
| category | No | `"loan"` / `"general"` |
| source | No | `"bolt"` / `"loveable"` / `"manual"` / `"mcp"` |
| files | No | `{ "src/App.tsx": "content...", ... }` |
| sourceCode | No | Main entry file content |
