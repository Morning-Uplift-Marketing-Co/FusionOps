# ============================================
# FusionOps V2 — Cloudflare Pages Deploy Guide
# ============================================
#
# เลือกวิธีที่สะดวก: CLI (เร็วสุด) หรือ Git (auto-deploy)
#

# ═══════════════════════════════════════════
# วิธีที่ 1: Wrangler CLI (แนะนำ — ง่ายสุด)
# ═══════════════════════════════════════════

# Step 1: Build
npm run build

# Step 2: Deploy (ครั้งแรก — สร้าง project ใหม่)
npx wrangler pages deploy dist --project-name=fusionops

# Step 3: Deploy (ครั้งถัดไป)
npx wrangler pages deploy dist --project-name=fusionops

# ═══════════════════════════════════════════
# วิธีที่ 2: Git Connect (auto-deploy on push)
# ═══════════════════════════════════════════
#
# 1. ไป https://dash.cloudflare.com → Pages → Create a project
# 2. Connect to Git → เลือก repo
# 3. Build settings:
#    - Framework preset: Astro
#    - Build command: npm run build
#    - Build output directory: dist
#    - Root directory: (leave empty)
# 4. Environment variables → ใส่ตาม .env.pages ด้านล่าง
# 5. Deploy!

# ═══════════════════════════════════════════
# Environment Variables สำหรับ CF Pages
# ═══════════════════════════════════════════
#
# ⚠️  VITE_ vars จะถูก bundle เข้า JS — ใส่เฉพาะที่จำเป็น
# ⚠️  อย่าใส่ NEON_DATABASE_URL (ใช้ฝั่ง Worker เท่านั้น)
#
# Required:
#   VITE_API_BASE = https://lp-factory-api.misty-feather-556e.workers.dev
#
# Optional (auto-fill Settings page):
#   VITE_CF_API_TOKEN = your-token
#   VITE_CF_ACCOUNT_ID = your-account-id
#   VITE_SENTRY_DSN = your-sentry-dsn
#
# Node version:
#   NODE_VERSION = 20
