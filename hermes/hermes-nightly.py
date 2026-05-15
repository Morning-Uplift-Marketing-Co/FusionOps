#!/usr/bin/env python3
"""
HERMES — FusionOps FBIS Nightly Analysis Runner

Runs standalone on Hetzner server via system cron (no Claude session needed).
Calls Cloudflare Workers API directly, writes KPIs + risk scores, sends Telegram alert.

v2 (2026-05-16):
  - Adds Kanban task tracking on board `fbis-nightly` — each agent phase
    gets a durable task row with success/failure and structured metadata.
  - Kanban failures are non-fatal (observability layer, not critical path).
"""

import os, sys, json, subprocess, httpx, datetime
from contextlib import contextmanager
from collections import defaultdict

API   = os.getenv("FBIS_API_BASE", "https://lp-factory-api.misty-feather-556e.workers.dev")
TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT  = os.getenv("TELEGRAM_CHAT_ID", "")
TODAY    = datetime.date.today().isoformat()
KANBAN_BOARD = "fbis-nightly"
KANBAN_ENABLED = os.getenv("HERMES_KANBAN", "1") != "0"

client = httpx.Client(timeout=30)

# ── HTTP helpers ─────────────────────────────────────────────────────────────

def get(path, **params):
    r = client.get(f"{API}{path}", params=params)
    r.raise_for_status()
    return r.json()

def post(path, body):
    r = client.post(f"{API}{path}", json=body)
    r.raise_for_status()
    return r.json()

def kpi(agent, name, value, target, unit):
    post("/api/analysis/agent-kpi", {
        "agent_name": agent, "kpi_name": name,
        "kpi_value": value, "kpi_target": target, "kpi_unit": unit,
    })
    print(f"  [{agent}] {name} = {value} {unit} (target {target})")

def telegram(msg):
    if not TG_TOKEN or not TG_CHAT:
        print("  [telegram] no token/chat — skipping")
        return
    httpx.post(
        f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
        json={"chat_id": TG_CHAT, "text": msg, "parse_mode": "HTML"},
        timeout=10,
    )

# ── Kanban tracking (non-fatal observability layer) ──────────────────────────

def _kanban(*args):
    """Invoke hermes kanban CLI. Returns stdout (str) or None on failure."""
    if not KANBAN_ENABLED:
        return None
    try:
        r = subprocess.run(
            ["hermes", "kanban", "--board", KANBAN_BOARD, *args],
            check=True, capture_output=True, text=True, timeout=15,
        )
        return r.stdout.strip()
    except Exception as e:
        print(f"  [kanban] non-fatal: {e}")
        return None

@contextmanager
def kanban_phase(agent_name, title):
    """Create a Kanban task; on success, complete with metadata; on failure, comment + leave open for retry visibility."""
    if not KANBAN_ENABLED:
        yield None
        return

    out = _kanban(
        "create", f"[{agent_name}] {title}",
        "--body", f"Phase started at {datetime.datetime.utcnow().isoformat()}Z",
        "--assignee", "default",
        "--idempotency-key", f"fbis-{TODAY}-{agent_name}",
        "--max-runtime", "600",
        "--json",
    )
    task_id = None
    if out:
        try:
            task_id = json.loads(out).get("id") or json.loads(out).get("task_id")
        except Exception:
            pass

    error = None
    try:
        yield task_id
    except Exception as e:
        error = e
        if task_id:
            _kanban("comment", task_id, f"FAILED: {type(e).__name__}: {e}")
        raise
    else:
        if task_id:
            _kanban("complete", task_id, "--result", f"{agent_name} OK")

# ── ARGUS — proxy & IP risk ──────────────────────────────────────────────────

def run_argus(accounts):
    print("\n[ARGUS] proxy & IP risk analysis...")
    proxies = get("/api/analysis/proxy-pool").get("data", [])

    clean = sum(1 for p in proxies if (p.get("fraud_score") or 0) < 20)
    clean_rate = round(clean / len(proxies) * 100, 1) if proxies else 0

    subnet_map = defaultdict(list)
    for a in accounts:
        ip = a.get("proxy_ip") or ""
        if ip:
            subnet = ".".join(ip.split(".")[:3])
            subnet_map[subnet].append(a.get("id"))
    collisions = sum(1 for ids in subnet_map.values() if len(ids) > 1)

    low_trust = sum(1 for a in accounts if (a.get("proxy_trust_score") or 100) < 60)

    kpi("argus", "clean_proxy_rate",    clean_rate,  90,  "%")
    kpi("argus", "ip_collision_count",  collisions,  0,   "count")
    kpi("argus", "low_trust_accounts",  low_trust,   0,   "count")
    kpi("argus", "proxy_pool_size",     len(proxies), 0,  "count")
    return {"clean_rate": clean_rate, "collisions": collisions, "low_trust": low_trust}

# ── NEXUS — traffic quality ──────────────────────────────────────────────────

def run_nexus(accounts):
    print("\n[NEXUS] traffic quality analysis...")
    scores = []
    for a in accounts[:20]:
        try:
            d = get(f"/api/analysis/pixel-events/{a.get('site_domain','')}", days=30)
            events = d.get("data", [])
            if events:
                total = sum(e.get("event_count", 0) for e in events)
                scores.append(min(100, total))
        except Exception:
            pass

    avg_quality = round(sum(scores) / len(scores), 1) if scores else 0
    kpi("nexus", "avg_traffic_quality", avg_quality, 70,  "score")
    kpi("nexus", "accounts_analyzed",   len(accounts), len(accounts), "count")
    return {"avg_quality": avg_quality}

# ── IRIS — link health ───────────────────────────────────────────────────────

def run_iris(accounts):
    print("\n[IRIS] link health analysis...")
    healthy, broken = 0, 0
    for a in accounts[:20]:
        try:
            d = get(f"/api/analysis/link-audit/{a.get('id','')}", days=30)
            for link in d.get("data", []):
                if link.get("status_code", 200) >= 400:
                    broken += 1
                else:
                    healthy += 1
        except Exception:
            pass

    total = healthy + broken
    health_score = round(healthy / total * 100, 1) if total else 100
    kpi("iris", "link_health_score", health_score, 80,   "score")
    kpi("iris", "broken_links",      broken,        0,   "count")
    return {"health_score": health_score, "broken": broken}

# ── CHRONO — ban patterns ────────────────────────────────────────────────────

def run_chrono(accounts):
    print("\n[CHRONO] ban pattern analysis...")
    bans = get("/api/analysis/ban-events", days=30).get("data", [])

    ban_count = len(bans)
    banned_ids = set(b.get("account_id") for b in bans)
    at_risk = len([a for a in accounts if a.get("id") in banned_ids])

    kpi("chrono", "ban_rate_30d",              ban_count, 0, "count")
    kpi("chrono", "accounts_at_timeline_risk", at_risk,   0, "count")
    return {"bans": ban_count, "at_risk": at_risk}

# ── VERDICT — aggregate risk score ───────────────────────────────────────────

def run_verdict(accounts, argus, nexus, iris, chrono):
    print("\n[VERDICT] computing risk scores...")
    critical, at_risk, watch_count, healthy_count = 0, 0, 0, 0

    for a in accounts:
        acc_id = a.get("id")
        if not acc_id:
            continue

        proxy_risk      = 100 - (a.get("proxy_trust_score") or 100)
        isolation_score = 50 if argus["collisions"] > 0 else 0
        traffic_quality = nexus["avg_quality"]
        timeline_risk   = 80 if a.get("id") in {b.get("account_id") for b in []} else 0

        verdict_score = round(
            proxy_risk      * 0.30 +
            isolation_score * 0.20 +
            (100 - traffic_quality) * 0.25 +
            timeline_risk   * 0.25
        )
        verdict_score = max(0, min(100, verdict_score))

        if   verdict_score >= 80: status = "critical"; critical += 1
        elif verdict_score >= 60: status = "risk";     at_risk  += 1
        elif verdict_score >= 40: status = "watch";    watch_count += 1
        else:                      status = "healthy";  healthy_count += 1

        try:
            post("/api/analysis/risk-score", {
                "account_id":      acc_id,
                "proxy_risk":      round(proxy_risk),
                "isolation_score": isolation_score,
                "traffic_quality": round(traffic_quality),
                "timeline_risk":   timeline_risk,
                "verdict_score":   verdict_score,
                "verdict_status":  status,
            })
        except Exception as e:
            print(f"  [verdict] write_risk_score failed for {acc_id[:8]}: {e}")

    kpi("verdict", "accounts_scored",  len(accounts),  len(accounts), "count")
    kpi("verdict", "critical_accounts", critical,       0,            "count")
    kpi("verdict", "healthy_accounts",  healthy_count,  len(accounts), "count")

    return {
        "healthy": healthy_count, "watch": watch_count,
        "risk": at_risk, "critical": critical,
    }

# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'='*60}")
    print(f"  HERMES nightly run — {TODAY}")
    print(f"{'='*60}")

    accounts = get("/api/analysis/accounts").get("data", [])
    print(f"\n[hermes] {len(accounts)} accounts loaded")

    with kanban_phase("argus",  "Proxy & IP risk analysis"):
        argus = run_argus(accounts)
    with kanban_phase("nexus",  "Traffic quality analysis"):
        nexus = run_nexus(accounts)
    with kanban_phase("iris",   "Link health analysis"):
        iris = run_iris(accounts)
    with kanban_phase("chrono", "Ban pattern analysis"):
        chrono = run_chrono(accounts)
    with kanban_phase("verdict", "Aggregate risk score + auto-pause eval"):
        dist = run_verdict(accounts, argus, nexus, iris, chrono)

    print("\n[hermes] sending Telegram report...")
    msg = (
        f"🌙 <b>HERMES</b> nightly run — {TODAY}\n\n"
        f"📊 Accounts: {len(accounts)}\n"
        f"🛡 Risk: {dist['healthy']}✅ {dist['watch']}👀 {dist['risk']}⚠️ {dist['critical']}🚨\n"
        f"🔗 Proxy pool: {argus.get('clean_rate',0)}% clean\n"
        f"🔄 Bans (30d): {chrono.get('bans',0)}\n"
        f"🎨 Link health: {iris.get('health_score',100)}%\n\n"
        f"✅ All agents complete"
    )
    if dist["critical"] > 0:
        msg += f"\n\n🚨 <b>{dist['critical']} CRITICAL accounts — review immediately</b>"

    telegram(msg)
    print(f"\n{'='*60}")
    print("  HERMES run complete")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
