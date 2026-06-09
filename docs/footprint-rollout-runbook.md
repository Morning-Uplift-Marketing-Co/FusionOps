# Footprint Rollout Runbook

วิธี roll out งาน de-footprint (commit `17506be9` + `4bccabd9`) ลง production แบบปลอดภัย

---

## Phase 0 — สิ่งที่ทำเสร็จแล้ว (code พร้อม, ยังไม่ deploy)

- ✅ Pixel subdomain ตั้งต่อ brand ได้ (`pixelSubdomain` ใน config)
- ✅ ถ้าไม่ตั้ง → auto-assign deterministic จาก domain (pool: go/px/track/m/r/s/c, ตัด `t` ออก)
- ✅ pixel handler รองรับ subdomain ใดก็ได้
- ✅ Audit ([footprint-audit.md](footprint-audit.md)) + hosting plan ([hosting-diversity-plan.md](hosting-diversity-plan.md))

⚠️ **Workflow trigger เฉพาะ push `deploy-configs/**.json`** — แก้ scripts/workflow ไม่ auto-deploy

---

## Phase 1 — Pilot deploy 1 brand (ทำก่อนขยาย)

เลือก 1 brand ที่ active แล้ว trigger deploy โดยแตะ config ของมัน:

```bash
# 1. ดู subdomain ที่ brand จะได้ (เปลี่ยน DOMAIN เป็น brand จริง)
node -e "const pool=['go','px','track','m','r','s','c'];const d='DOMAIN.com'.replace(/^www\./,'');let h=2166136261;for(const c of d){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}console.log('subdomain =>',pool[h%pool.length])"

# 2. trigger deploy (touch config แล้ว push)
git checkout main && git pull
# แก้/touch deploy-configs/DOMAIN.com.json (เช่นเพิ่ม field ว่างๆ หรือแก้ค่าเล็กน้อย)
git add deploy-configs/DOMAIN.com.json
git commit -m "deploy: DOMAIN.com — migrate pixel subdomain"
git push   # ← จุดนี้ workflow รัน
```

### Verify checklist หลัง deploy
```bash
# subdomain ใหม่ตอบ (เปลี่ยน SUB + DOMAIN)
curl -sfI "https://SUB.DOMAIN.com/e" --max-time 20 && echo "PIXEL OK"

# ยิง event ทดสอบ
curl -sf -X POST "https://SUB.DOMAIN.com/e" -H "Content-Type: application/json" \
  -d '{"event":"page_view","domain":"DOMAIN.com"}' && echo "EVENT OK"
```
- [ ] `SUB.DOMAIN.com/e` ตอบ 200
- [ ] event ลง D1 `fusionops-pixel-new-v2`
- [ ] เปิดหน้า landing จริง → DevTools Network เห็น pixel ยิงไป `SUB.` (ไม่ใช่ `t.`)
- [ ] Voluum/conversion ยังทำงาน (ถ้า brand นั้นใช้)

ถ้าผ่าน → ขยายทีละ batch (5-10 brand) จนครบ active

---

## Phase 2 — Hosting diversity (เฟสใหญ่, ทำหลัง pilot นิ่ง)

อ้างอิง [hosting-diversity-plan.md](hosting-diversity-plan.md) — กระจาย 4 ASN

### ⚠️ กฎเหล็ก (gemini เตือน)
**ต้องตั้ง Cloudflare DNS เป็น grey-cloud (DNS Only) สำหรับทุก host ที่ไม่ใช่ Cloudflare** — ถ้าทิ้ง orange-cloud Google จะเห็น `AS13335` (Cloudflare) อยู่ดี → diversification เสียเปล่า

### นำร่อง 2-3 brand ก่อน
1. เพิ่ม secret: `NETLIFY_AUTH_TOKEN` หรือ `VERCEL_TOKEN`+`VERCEL_ORG_ID`
2. เพิ่ม field `"provider": "netlify"` ใน config ของ brand นำร่อง
3. เพิ่ม conditional deploy step ใน `deploy-lp.yml` (ตัวอย่างใน hosting plan ข้อ 3)
4. ตั้ง CNAME grey-cloud ชี้ provider
5. Verify ASN: `dig +short SUB.DOMAIN.com` แล้วเช็คว่า IP ไม่ใช่ Cloudflare range

---

## Phase 3 — Signal อื่นๆ (จาก research)

| Signal | งาน | ประเภท |
|--------|-----|--------|
| Build fingerprint | vary `package.json` deps / Astro integrations ต่อ brand | code |
| Font hosting | สลับ self-hosted / Bunny / Google Fonts | code/config |
| Brand identity | logo, สี, About Us, persona ต่างกันจริง | content/design |
| Google Ads isolation | anti-detect browser + billing/IP แยกต่อ account | operational |

> หมายเหตุ: Phase 3 ส่วนใหญ่เป็น content/operational ไม่ใช่ code ล้วน — ต้องตัดสินใจ business ก่อน

---

## ลำดับสรุป
```
Phase 1 (pilot 1 brand) → verify → ขยาย batch
        ↓
Phase 2 (hosting นำร่อง 2-3) → verify ASN → ขยาย
        ↓
Phase 3 (signal อื่น ตาม priority business)
```
