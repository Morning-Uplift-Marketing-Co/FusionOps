# คู่มือ OpenClaw × LP Factory (FusionOps)

> **รูปแบบไฟล์:** Markdown (`.md`) — แก้ใน Cursor/VS Code ได้ เปิดบน GitHub ได้ ส่งต่อเป็นคู่มือ PDF/HTML ภายหลัง (Pandoc, VS Code “Print to PDF”, ฯลฯ)  
> **อัปเดต:** 2026-03-25 — สังเคราะห์จากการตั้งค่า skills + use cases สำหรับโปรเจ็กต์นี้

เอกสารนี้เป็นภาพรวม **ทำไมถึงใช้ OpenClaw กับ LP Factory** และ **skill ไหนทำอะไร** รายละเอียดติดตั้ง ตัวแปรแวดล้อม และคำสั่ง cron อยู่ที่ [`openclaw/README.md`](../openclaw/README.md)

---

## 1. OpenClaw คืออะไร (สั้น ๆ)

[OpenClaw](https://openclaw.ai/) เป็นผู้ช่วย AI ที่รันบนเครื่องคุณ คุยได้ผ่าน Telegram / Discord / ฯลฯ มี memory, รันคำสั่ง shell, อ่าน/เขียนไฟล์, ควบคุมเบราว์เซอร์ (ตามที่ตั้งค่า), และขยายด้วย **skills**

LP Factory เป็นระบบสร้าง/ดีพลอย Landing Page สำหรับ PPC (Wizard, เทมเพลต, Cloudflare, tracking, Voluum, Google Ads) — OpenClaw เหมาะกับงานที่ **ไม่อยู่แค่ใน dashboard** เช่น รันสคริปต์ใน repo, ไล่ log GitHub, เช็ค URL จริงหลัง deploy, สรุปสถานะให้ทีม

---

## 2. ไฟล์สำคัญใน repo

| ตำแหน่ง | หน้าที่ |
|---------|--------|
| [`openclaw/README.md`](../openclaw/README.md) | ตัวแปร env, คัดลอก skills, ตัวอย่าง `openclaw cron add` |
| `openclaw/skills/<ชื่อโฟลเดอร์>/SKILL.md` | คำอธิบาย skill แต่ละตัว (OpenClaw โหลดจากโฟลเดอร์นี้) |
| `.planning/PROJECT.md` | วิสัยทัศน์ LP Factory (อ้างอิงใน runbook skill) |
| `docs/template-worker-deploy-checklist.md` | checklist หลัง deploy / tracking (อ้างอิงใน live-verify skill) |
| `scripts/README-TEMPLATES.md` | convert-template / pack-template |

---

## 3. แผนที่ use case → skill

| ความต้องการ | Skill ที่เกี่ยวข้อง |
|-------------|---------------------|
| แจ้งเตือน deploy GitHub (`deploy-lp.yml`) | `lp_deploy_monitor` |
| เช็คโดเมนขึ้นไหม / SSL / DNS | `lp_domain_health` |
| คุมงบผ่าน Voluum (+ LendingCards) | `lp_spend_alert` |
| เทมเพลตใหม่ผ่าน quality gate | `lp_quality_gate_reporter` |
| ล้าง Cloudflare เก่า (ต้องยืนยันก่อนลบ) | `lp_cf_cleanup` |
| ค้นหาไอเดียเทมเพลต Bolt/Lovable | `lp_template_scout` |
| Google Ads / policy (Multilogin) | `lp_ads_watchdog` |
| บนเครื่อง dev: convert / pack / inject-tracking / test | `lp_template_pipeline` |
| หลัง deploy: ดู HTML จริง + gtag / Voluum / pixel | `lp_live_tracking_verify` |
| CI แดงบนเครื่อง: check / lint / test | `lp_ci_local_triage` |
| ทำตามแผนใน `.planning/**/*.md` | `lp_planning_runbook` |
| อยากได้ log ล้ำจาก GitHub Actions | `lp_github_workflow_triage` |
| ส่งมอบงานเขียนโค้ดให้ Claude Code / Codex / Cursor | `lp_dev_session_delegate` |
| สรุปวันเดียว: deploy + snapshot API + ชี้ spend | `lp_ops_daily_brief` |

---

## 4. รายการ skills ทั้งหมด (14 โฟลเดอร์)

คัดลอกทั้งโฟลเดอร์ `openclaw/skills/*` ไปยัง workspace ของ OpenClaw (path ตาม [docs.openclaw.ai/skills](https://docs.openclaw.ai/skills))

| โฟลเดอร์ | ชื่อใน OpenClaw (`name:`) |
|-----------|----------------------------|
| `deploy-monitor` | `lp_deploy_monitor` |
| `domain-health` | `lp_domain_health` |
| `ads-watchdog` | `lp_ads_watchdog` |
| `spend-alert` | `lp_spend_alert` |
| `quality-gate-reporter` | `lp_quality_gate_reporter` |
| `cf-cleanup` | `lp_cf_cleanup` |
| `template-scout` | `lp_template_scout` |
| `lp-template-pipeline` | `lp_template_pipeline` |
| `lp-live-tracking-verify` | `lp_live_tracking_verify` |
| `lp-ci-local-triage` | `lp_ci_local_triage` |
| `lp-planning-runbook` | `lp_planning_runbook` |
| `lp-github-workflow-triage` | `lp_github_workflow_triage` |
| `lp-dev-session-delegate` | `lp_dev_session_delegate` |
| `lp-ops-daily-brief` | `lp_ops_daily_brief` |

---

## 5. ติดตั้งแบบย่อ

1. ติดตั้ง OpenClaw ตาม [Getting started](https://docs.openclaw.ai/start/getting-started)  
2. `gh auth login` และตั้ง `GH_REPO` ให้ตรง repo จริง  
3. ตั้ง `LP_API_BASE`, Telegram, Cloudflare, Voluum ฯลฯ ตาม [`openclaw/README.md`](../openclaw/README.md)  
4. คัดลอก skills: `cp -r openclaw/skills/* <path-to-openclaw-skills>/`  
5. (ถ้าใช้ cron) ลงทะเบียนตามบล็อกใน `openclaw/README.md`

**Windows:** ใช้ Git Bash / WSL สำหรับคำสั่ง `cp`, `curl`, `grep` ในบาง skill ได้สะดวกกว่า PowerShell ล้วน ๆ — หรือให้ OpenClaw รันบนเครื่องที่เป็น Linux/macOS

---

## 6. คำสั่งที่มักใช้หลังติดตั้ง

```bash
openclaw skills list
openclaw cron list
```

---

## 7. เอกสารอ้างอิงภายนอก

- [openclaw.ai](https://openclaw.ai/) — ภาพรวมผลิตภัณฑ์  
- [docs.openclaw.ai/skills](https://docs.openclaw.ai/skills) — การลงทะเบียน skills  

---

*คู่มือนี้ไม่ใช่ transcript แชทดิบ แต่สรุปเป็นขั้นตอนใช้งานจริง หากต้องการเก็บ log สนทนาแบบเต็ม ให้ export จาก Cursor แยกต่างหาก (เช่น `.md` หรือ `.txt`)*
