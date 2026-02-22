# วิธีตั้งค่า GitHub Actions Deployment

## ภาพรวม
Workflow นี้ deploy เว็บไปยัง **Cloudflare Pages**, **Vercel**, และ **Netlify** พร้อมกับ **Cloudflare Workers** ทั้งหมด

---

## Secrets ที่ต้องตั้งค่า

ไปที่: GitHub Repo → **Settings** → **Secrets and variables** → **Actions**

### สำหรับ Cloudflare (จำเป็น)
| Secret | วิธีหา |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens → Create Token → Edit Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | https://dash.cloudflare.com → Workers & Pages → มุมขวา |

### สำหรับ Vercel (ถ้าต้องการ deploy ไป Vercel)
| Secret | วิธีหา |
|--------|---------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create Token |
| `VERCEL_ORG_ID` | Vercel Project → Settings → General → Project ID (หรือจาก `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Vercel Project → Settings → General → Project ID |

### สำหรับ Netlify (ถ้าต้องการ deploy ไป Netlify)
| Secret | วิธีหา |
|--------|---------|
| `NETLIFY_AUTH_TOKEN` | https://app.netlify.com/user/applications → Personal access tokens → New access token |
| `NETLIFY_SITE_ID` | Netlify Site → Settings → Site details → Site ID (หรือจาก API) |

### Variables (Optional)
GitHub Repo → **Settings** → **Secrets and variables** → **Variables**
- `SITE_URL` - URL สำหรับ Cloudflare Pages build
- `VERCEL_SITE_URL` - URL สำหรับ Vercel build
- `NETLIFY_SITE_URL` - URL สำหรับ Netlify build

---

## วิธีการใช้งาน

### 1. Deploy ทุกที่ (Default)
Push ไป branch `main` → deploy ไปทั้ง Cloudflare, Vercel, Netlify พร้อมกัน

### 2. Deploy เฉพาะที่เลือก
ไปที่ **Actions** → **Deploy Web & Workers** → **Run workflow**
- เลือก `all` - deploy ทุกที่
- เลือก `cloudflare` - เฉพาะ Cloudflare
- เลือก `vercel` - เฉพาะ Vercel
- เลือก `netlify` - เฉพาะ Netlify
- เลือก `workers` - เฉพาะ Cloudflare Workers

---

## สร้าง Project ครั้งแรก

### Cloudflare Pages
1. ไปที่ https://dash.cloudflare.com
2. Workers & Pages → Create application → Pages
3. Project name: `lp-factory-web`
4. หรือให้ workflow สร้างให้อัตโนมัติในครั้งแรก

### Vercel
1. ไปที่ https://vercel.com/new
2. Import repo หรือเชื่อมต่อ GitHub
3. หรือ deploy ผ่าน CLI: `npx vercel link`
4. ได้ `ORG_ID` และ `PROJECT_ID` จาก `.vercel/project.json`

### Netlify
1. ไปที่ https://app.netlify.com/start
2. Connect Git repo
3. Build settings: `npm run build`, Publish directory: `dist`
4. ได้ `SITE_ID` จาก Site settings

---

## Workers ที่ถูก Deploy

- `api-worker` - Main API worker
- `cf-proxy` - CORS proxy worker
- `worker` - Callback worker
- `pixel-worker` - Analytics pixel worker

ทุก worker ต้องมี `wrangler.toml` อยู่ใน path ของตัวเอง
