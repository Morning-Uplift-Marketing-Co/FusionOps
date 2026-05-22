#!/usr/bin/env python3
"""
BOT_RADAR_TEST — Simulates Google Ads bot traffic to verify bot detection pipeline.

Sends POST /e requests with spoofed CF-Connecting-IP + Google bot User-Agents,
then queries /api/bot-radar/summary and /top-ips to confirm detection worked.

Usage:
  python run.py [--pixel <url>] [--api <url>] [--verbose]

Defaults:
  pixel = http://localhost:8789   (local pixel-worker dev)
  api   = http://localhost:8787   (local api-worker dev)

Production override:
  PIXEL_WORKER_BASE=https://lp-factory-pixel.misty-feather-556e.workers.dev
  API_WORKER_BASE=https://lp-factory-api.misty-feather-556e.workers.dev
"""

import os
import sys
import json
import time
import uuid
import argparse
import requests
from dataclasses import dataclass, field
from typing import Optional

# ── ANSI colours ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):  print(f"  {GREEN}✔{RESET} {msg}")
def fail(msg): print(f"  {RED}✘{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET} {msg}")
def info(msg): print(f"  {CYAN}·{RESET} {msg}")

# ── Test scenarios ──────────────────────────────────────────────────────────
# Real Googlebot IPs — these have valid forward-confirmed PTR records
# (66.249.64.x range → crawl-66-249-64-x.googlebot.com)
SCENARIOS = [
    {
        "name": "AdsBot-Google (ads crawl)",
        "ua":   "AdsBot-Google (+http://www.google.com/adsbot.html)",
        "ip":   "66.249.64.1",
        "site": "test-lp1.example.com",
        "expect_bot_type": "adsbot",
        "expect_recorded": True,
    },
    {
        "name": "Googlebot (search crawl)",
        "ua":   "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "ip":   "66.249.66.1",
        "site": "test-lp2.example.com",
        "expect_bot_type": "googlebot",
        "expect_recorded": True,
    },
    {
        "name": "Google-InspectionTool (manual review)",
        "ua":   "Mozilla/5.0 (compatible; Google-InspectionTool/1.0; +http://www.google.com/webmasters/tools/richsnippets)",
        "ip":   "66.249.68.1",
        "site": "test-lp3.example.com",
        "expect_bot_type": "inspection",
        "expect_recorded": True,
    },
    {
        "name": "AdsBot-Google-Mobile",
        "ua":   "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) AdsBot-Google-Mobile",
        "ip":   "66.249.70.1",
        "site": "test-lp1.example.com",  # Same site as AdsBot above
        "expect_bot_type": "adsbot",
        "expect_recorded": True,
    },
    {
        "name": "Normal human visitor (control — should NOT be recorded)",
        "ua":   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "ip":   "1.2.3.4",
        "site": "test-lp1.example.com",
        "expect_bot_type": None,
        "expect_recorded": False,
    },
]

# ── Helpers ─────────────────────────────────────────────────────────────────

def pixel_post(pixel_url: str, scenario: dict, verbose: bool) -> Optional[dict]:
    """Send a simulated pixel beacon POST /e"""
    payload = {
        "e":   "pv",
        "d":   scenario["site"],
        "sid": str(uuid.uuid4()),
        "ts":  str(int(time.time())),
        "url": f"https://{scenario['site']}/",
    }
    headers = {
        "Content-Type":    "application/json",
        "User-Agent":      scenario["ua"],
        "CF-Connecting-IP": scenario["ip"],
        # Simulate Cloudflare metadata that detectBot() reads from request.cf
        # (in local wrangler dev, request.cf may be empty — but IP + UA are enough)
        "X-Real-IP":       scenario["ip"],
    }
    try:
        r = requests.post(
            f"{pixel_url}/e",
            json=payload,
            headers=headers,
            timeout=10,
        )
        if verbose:
            info(f"POST /e → HTTP {r.status_code} (UA: {scenario['ua'][:60]}…)")
        return {"status": r.status_code, "ok": r.status_code in (200, 204)}
    except requests.exceptions.ConnectionError:
        return None
    except Exception as e:
        return {"status": 0, "ok": False, "error": str(e)}


def api_get(api_url: str, path: str, timeout: int = 10) -> Optional[dict]:
    try:
        r = requests.get(f"{api_url}{path}", timeout=timeout)
        if r.ok:
            return r.json()
        return None
    except Exception:
        return None


# ── Main test runner ─────────────────────────────────────────────────────────

def run_tests(pixel_url: str, api_url: str, verbose: bool):
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  BOT_RADAR_TEST — Google Ads Bot Detection Verification{RESET}")
    print(f"{'='*60}")
    print(f"  Pixel  : {pixel_url}")
    print(f"  API    : {api_url}")
    print(f"{'='*60}\n")

    # ── Step 1: Check services are reachable ──────────────────────────────
    print(f"{BOLD}[1/4] Checking services…{RESET}")

    # Pixel: try /health, fall back to GET /e probe
    # Note: POST /e with a bot UA may be blocked by CF WAF on production —
    #       that's expected! Bots hitting the actual landing page trigger detection,
    #       not direct calls to the pixel endpoint.
    pixel_ok = False
    try:
        r = requests.get(f"{pixel_url}/health", timeout=8)
        if r.status_code == 200:
            pixel_ok = True
            ok(f"Pixel worker reachable — health OK ({pixel_url})")
        else:
            # Try GET /e (returns 204 per code)
            probe = requests.get(f"{pixel_url}/e", timeout=8)
            if probe.status_code in (200, 204, 404):
                # 404 is still the worker running (routes /e GET to 204, others to 404)
                # "error code: 1042" in body = CF worker disabled
                body = probe.text or ""
                if "1042" in body or "error code" in body.lower():
                    fail(f"Pixel worker disabled (CF error 1042) — check Cloudflare dashboard")
                    sys.exit(1)
                pixel_ok = True
                ok(f"Pixel worker reachable (HTTP {probe.status_code})")
            elif probe.status_code == 403:
                # CF WAF may block our test UA — worker is still running
                pixel_ok = True
                warn(f"Pixel worker reachable but CF WAF returned 403 (expected for bot UAs on production)")
                info("Test requests will still be sent — CF WAF may block them too")
            else:
                fail(f"Pixel worker probe returned {probe.status_code}")
    except requests.exceptions.ConnectionError:
        fail(f"Pixel worker NOT reachable at {pixel_url}")
        warn("Local: cd apps/pixel-worker && npx wrangler dev --port 8789")
        sys.exit(1)
    except Exception as e:
        fail(f"Pixel worker error: {e}")
        sys.exit(1)

    # API: use bot-radar/summary as health check (no auth needed)
    api_health = api_get(api_url, "/api/bot-radar/summary", timeout=5)
    if api_health is not None:
        ok(f"API worker reachable ({api_url})")
    else:
        warn(f"API worker not reachable at {api_url} — will skip post-send verification")

    # ── Step 2: Snapshot before ───────────────────────────────────────────
    print(f"\n{BOLD}[2/4] Baseline snapshot…{RESET}")
    before = api_get(api_url, "/api/bot-radar/summary") if api_health else None
    before_1h = before["totals"]["last_1h"] if before and "totals" in before else None

    if before_1h is not None:
        info(f"Bot visits (last 1h) before test: {before_1h}")
    else:
        warn("Could not read baseline — will skip delta check")

    # ── Step 3: Send bot traffic ──────────────────────────────────────────
    print(f"\n{BOLD}[3/4] Sending {len(SCENARIOS)} test scenarios…{RESET}")

    results = []
    for scenario in SCENARIOS:
        label = scenario["name"]
        r = pixel_post(pixel_url, scenario, verbose)
        if r is None:
            fail(f"{label} → connection refused")
            results.append({"scenario": scenario, "sent": False, "response": None})
        elif r["ok"]:
            ok(f"{label} → HTTP {r['status']}")
            results.append({"scenario": scenario, "sent": True, "response": r})
        elif r.get("status") == 403:
            warn(f"{label} → HTTP 403 (CF WAF blocked — expected on production)")
            results.append({"scenario": scenario, "sent": False, "response": r, "waf_blocked": True})
        else:
            fail(f"{label} → HTTP {r.get('status', '?')} (unexpected)")
            results.append({"scenario": scenario, "sent": True, "response": r})

    # ── Step 4: Verify detection ──────────────────────────────────────────
    print(f"\n{BOLD}[4/4] Verifying detection (wait 2s for async writes)…{RESET}")
    time.sleep(2)

    if not api_health:
        warn("API worker unavailable — skipping verification")
        _print_summary(results, None, None, None, before_1h)
        return

    after  = api_get(api_url, "/api/bot-radar/summary")
    top_ips = api_get(api_url, "/api/bot-radar/top-ips?limit=50")

    after_1h   = after["totals"]["last_1h"] if after and "totals" in after else None
    ip_set     = {e["ip"] for e in (top_ips.get("ips") or [])} if top_ips else set()

    # Delta check
    if before_1h is not None and after_1h is not None:
        delta = after_1h - before_1h
        expected_new = sum(1 for s in SCENARIOS if s["expect_recorded"])
        if delta >= expected_new:
            ok(f"Bot visits delta +{delta} (expected ≥{expected_new})")
        elif delta > 0:
            warn(f"Bot visits delta +{delta} (expected ≥{expected_new}) — partial detection")
        else:
            fail(f"No new bot visits recorded (delta=0, expected ≥{expected_new})")
            warn("Check: bot_visits table exists? pixel-worker DB binding?")
    else:
        warn("Could not compute delta (summary unavailable)")

    # Per-IP check for expected bots
    print()
    for s in SCENARIOS:
        if not s["expect_recorded"]:
            # Verify human IP is NOT in top-ips (good sign, though may be too recent)
            if s["ip"] in ip_set:
                fail(f"Human control IP {s['ip']} appeared in bot top-ips — false positive!")
            else:
                ok(f"Human control ({s['ip']}) correctly absent from top-ips")
            continue

        if s["ip"] in ip_set:
            # Find the entry for more detail
            entry = next((e for e in (top_ips.get("ips") or []) if e["ip"] == s["ip"]), {})
            bot_type = entry.get("bot_type", "?")
            score    = entry.get("avg_score", 0)
            sites    = [sv.get("domain") for sv in entry.get("sites", [])]
            type_ok  = bot_type == s["expect_bot_type"]
            if type_ok:
                ok(f"{s['ip']} detected as {BOLD}{bot_type}{RESET} (score {score:.2f}) sites={sites}")
            else:
                warn(f"{s['ip']} detected but type={bot_type} (expected {s['expect_bot_type']})")
        else:
            # May be score < 0.5 if no bot_ip_ranges seeded and PTR unavailable locally
            warn(f"{s['ip']} not in top-ips — score may be < 0.5 (UA-only = 0.20, needs PTR or IP range)")
            info("  → Run BOT_IP_SYNC first to seed bot_ip_ranges, then retest")

    _print_summary(results, after, top_ips, ip_set, before_1h)


def _print_summary(results, after, top_ips, ip_set, before_1h):
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  SUMMARY{RESET}")
    print(f"{'='*60}")

    sent       = sum(1 for r in results if r["sent"])
    waf_blocked = sum(1 for r in results if r.get("waf_blocked"))
    expected_bot_ips = {s["ip"] for s in SCENARIOS if s["expect_recorded"]}
    detected = len(expected_bot_ips & ip_set) if ip_set is not None else "N/A"

    print(f"  Requests sent     : {sent}/{len(SCENARIOS)}")
    if waf_blocked:
        print(f"  CF WAF blocked    : {waf_blocked} (expected on production — bots come from Google IPs)")
    print(f"  Expected bots     : {len(expected_bot_ips)}")
    print(f"  Detected in radar : {detected}")
    if before_1h is not None and after and "totals" in after:
        delta = after["totals"]["last_1h"] - before_1h
        print(f"  New visits (1h Δ) : +{delta}")

    if waf_blocked == len(SCENARIOS):
        print(f"\n  {YELLOW}CF WAF Note:{RESET} Direct calls to POST /e are blocked on production.")
        print(f"  Real Googlebot detection happens when Google's IPs visit landing pages.")
        print(f"  To test locally: run pixel-worker with wrangler dev, then rerun with --pixel http://localhost:8789")

    print(f"\n{BOLD}  Signal weights reminder:{RESET}")
    print(f"    IP CIDR  35%  — needs bot_ip_ranges seeded (run BOT_IP_SYNC)")
    print(f"    Ptr DNS  35%  — real Googlebot IPs have valid PTR; local loopback does not")
    print(f"    UA regex 20%  — always works (User-Agent header)")
    print(f"    CF score 10%  — only on Cloudflare edge (not local dev)")
    print(f"\n  UA-only score = 0.20 → not recorded (threshold 0.50)")
    print(f"  UA + PTR score = 0.55 → recorded (confirmed bot requires 0.70)")
    print(f"  UA + PTR + IP  = 0.90 → is_bot=true, confidence=high")
    print(f"{'='*60}\n")


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Google Ads bot detection test")
    parser.add_argument("--pixel",   default=os.getenv("PIXEL_WORKER_BASE", "http://localhost:8789"))
    parser.add_argument("--api",     default=os.getenv("API_WORKER_BASE",   "http://localhost:8787"))
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    run_tests(args.pixel, args.api, args.verbose)
