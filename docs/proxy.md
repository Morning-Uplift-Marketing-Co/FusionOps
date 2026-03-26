⚠️ Architecture ที่ “ถูกต้อง” (สำคัญสุด)
[Cloudflare Worker]  ❌ ห้ามต่อ proxy ตรง
          ↓
[Proxy Gateway (Node.js)] ✅ ตัวกลาง
          ↓
[Proxy Pool (Nodemaven / Residential / ISP)]
          ↓
[Target (LP / API / Google / Affiliate)]

👉 Worker = orchestration
👉 Node = execution จริง (proxy, TCP, retry, rotate)

🧠 System Overview (v2)
Core Components
Proxy Gateway (Node.js / Fastify)
Proxy Health Engine
Smart Rotation Engine
Scoring System
FusionOps Dashboard API
Retry + Failover Layer
📦 Project Structure (เอาไปสร้าง repo ได้เลย)
proxy-system-v2/
├── apps/
│   ├── gateway/              # Node proxy server
│   ├── health-checker/       # cron worker
│   ├── rotator/              # proxy selector
│
├── packages/
│   ├── proxy-core/           # shared logic
│   ├── scoring-engine/
│
├── db/
│   ├── schema.sql
│
├── .env
├── docker-compose.yml
🧱 1. Proxy Gateway (ตัวหลัก)
install
npm i fastify node-fetch https-proxy-agent pino
server.js
import Fastify from "fastify";
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

const app = Fastify({ logger: true });

const proxyPool = [
  "http://user:pass@gate.nodemaven.com:8080",
  // เพิ่มได้
];

// basic rotation
function getProxy() {
  return proxyPool[Math.floor(Math.random() * proxyPool.length)];
}

app.post("/fetch", async (req, reply) => {
  const { url } = req.body;

  for (let i = 0; i < 5; i++) {
    const proxy = getProxy();
    const agent = new HttpsProxyAgent(proxy);

    try {
      const res = await fetch(url, {
        agent,
        timeout: 8000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const data = await res.text();

      return {
        success: true,
        proxy,
        status: res.status,
        data
      };

    } catch (err) {
      app.log.error(`Proxy failed: ${proxy}`);
    }
  }

  return reply.code(502).send({
    success: false,
    error: "All proxies failed"
  });
});

app.listen({ port: 3000 });
🔁 2. Health Check Engine
logic
เช็คทุก 1–5 นาที
ยิง https://api.ipify.org
วัด latency + success rate
async function check(proxy) {
  const start = Date.now();

  try {
    const res = await fetch("https://api.ipify.org", {
      agent: new HttpsProxyAgent(proxy),
      timeout: 5000
    });

    return {
      ok: res.ok,
      latency: Date.now() - start
    };

  } catch {
    return { ok: false, latency: 9999 };
  }
}
📊 3. Scoring System (สำคัญมาก)
function score({ ok, latency }) {
  if (!ok) return 0;
  if (latency < 1000) return 100;
  if (latency < 3000) return 70;
  return 40;
}
🧠 4. Smart Rotation (ไม่ใช่ random)
function pickProxy(pool) {
  return pool
    .filter(p => p.score > 50)
    .sort((a, b) => b.score - a.score)[0];
}
🔥 5. Retry + Failover (กัน 502)
for (let i = 0; i < 3; i++) {
  try {
    return await fetchWithProxy(proxy);
  } catch {
    markProxyBad(proxy);
  }
}
🗄️ 6. DB Schema (Neon / D1 ใช้ได้)
CREATE TABLE proxies (
  id TEXT PRIMARY KEY,
  host TEXT,
  port INT,
  username TEXT,
  password TEXT,
  score INT DEFAULT 0,
  last_check TIMESTAMP,
  fail_count INT DEFAULT 0,
  success_count INT DEFAULT 0
);
🔌 7. Worker Integration (แก้ 502 ของคุณ)
// ❌ ห้ามใช้ proxy ใน worker
// ✅ เรียก gateway แทน

await fetch("https://your-gateway.com/fetch", {
  method: "POST",
  body: JSON.stringify({
    url: "https://api.ipify.org"
  })
});
🧠 Advanced (ระดับคุณต้องมี)
✅ Sticky Session
session_id → proxy เดิม
✅ Geo Targeting
US → US proxy only
TH → TH proxy
✅ Auto Kill Bad Proxy
if fail_count > 5 → disable
✅ Warm-up Logic
ยิง Google / Cloudflare ก่อนใช้งานจริง
🚨 Reality Check (สำคัญมาก)

สิ่งที่คุณเจอ:

502 = proxy pool ใช้ไม่ได้ + architecture ผิด

ถ้าไม่แก้ 2 อย่างนี้:

scale ไม่ได้
Ads ตาย
tracking เพี้ยน
🎯 สรุปให้สั้นที่สุด
❌ Worker ใช้ proxy ตรง = พัง
✅ ต้องมี Proxy Gateway
✅ ต้องมี health + scoring + rotation
✅ Proxy pool ต้อง “มีชีวิต” (ตอนนี้ของคุณ = ตายหมด)