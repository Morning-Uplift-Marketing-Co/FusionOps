#!/usr/bin/env python3
"""
migrate-hermes-state-to-d1.py — one-time migration of legacy Hermes JSON/JSONL state to D1.

Run on the Hetzner VPS (where ~/.hermes/{aegis,scout,herald,oracle}-state/ lives).
Default = DRY-RUN (parse + print plan, no API calls).
Pass --apply to POST to /api/agents/state/* endpoints.

Re-running is safe — every endpoint uses ON CONFLICT upsert with idempotent keys.

Decision context: .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import httpx  # already present on Hetzner (used by hermes/hermes-nightly.py)

DEFAULT_API_BASE = os.getenv("FBIS_API_BASE", "https://lp-factory-api.misty-feather-556e.workers.dev")
DEFAULT_API_KEY = os.getenv("FUSIONOPS_API_KEY", os.getenv("FBIS_API_KEY", ""))
DEFAULT_ORIGIN = os.getenv("FBIS_API_ORIGIN", "https://fusionops-web.pages.dev")
DEFAULT_STATE_DIR = Path.home() / ".hermes"
BATCH_SIZE = 500  # matches MAX_LIMIT in apps/api-worker/src/handlers/agent-state.js

# ── ISO timestamp → unix epoch (best-effort, returns None on failure) ────────

def iso_to_unix(s):
    if not s:
        return None
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except Exception:
        return None


# ── AEGIS: seen.json → fingerprints, alerts.jsonl → alerts ───────────────────

def collect_aegis(state_dir: Path):
    fingerprints, alerts = [], []

    seen_file = state_dir / "aegis-state" / "seen.json"
    if seen_file.exists():
        try:
            data = json.loads(seen_file.read_text())
            for advertiser, ts_iso in data.items():
                fingerprints.append({
                    "agent": "AEGIS",
                    "scope": "_global",
                    "fingerprint_key": advertiser,
                    "fingerprint_hash": advertiser,
                    "payload": {"last_seen_iso": ts_iso},
                })
        except Exception as e:
            print(f"  ⚠️  AEGIS seen.json parse error: {e}", file=sys.stderr)

    alerts_file = state_dir / "aegis-state" / "alerts.jsonl"
    if alerts_file.exists():
        for line in alerts_file.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                alerts.append({
                    "agent": "AEGIS",
                    "severity": "high",
                    "title": f"Brand-jack: {row.get('keyword', '?')} → {row.get('domain', '?')}",
                    "payload": row,
                })
            except json.JSONDecodeError:
                continue

    return fingerprints, alerts


# ── SCOUT: snapshots.json → fingerprints (one per creative) ──────────────────

def collect_scout(state_dir: Path):
    fingerprints = []

    snapshots_file = state_dir / "scout-state" / "snapshots.json"
    if not snapshots_file.exists():
        return fingerprints

    try:
        data = json.loads(snapshots_file.read_text())
    except Exception as e:
        print(f"  ⚠️  SCOUT snapshots.json parse error: {e}", file=sys.stderr)
        return fingerprints

    for competitor_domain, snap in data.items():
        creatives = (snap or {}).get("creatives", {})
        if not isinstance(creatives, dict):
            continue
        for creative_id, creative in creatives.items():
            if not creative_id:
                continue
            creative_payload = creative if isinstance(creative, dict) else {"raw": creative}
            creative_payload.setdefault("creative_id", str(creative_id))
            fingerprints.append({
                "agent": "SCOUT",
                "scope": competitor_domain,
                "fingerprint_key": str(creative_id),
                "fingerprint_hash": str(creative_id),
                "payload": creative_payload,
            })

    return fingerprints


# ── HERALD: baselines.json → baselines, alerts.jsonl → alerts ────────────────

def collect_herald(state_dir: Path):
    baselines, alerts = [], []

    baselines_file = state_dir / "herald-state" / "baselines.json"
    if baselines_file.exists():
        try:
            data = json.loads(baselines_file.read_text())
            for baseline_key, row in data.items():
                if not isinstance(row, dict) or "value" not in row:
                    continue
                baselines.append({
                    "agent": "HERALD",
                    "metric": baseline_key,
                    "scope": "_global",
                    "window": "7d",
                    "value": float(row.get("value", 0) or 0),
                    "sample_count": 1,
                })
        except Exception as e:
            print(f"  ⚠️  HERALD baselines.json parse error: {e}", file=sys.stderr)

    alerts_file = state_dir / "herald-state" / "alerts.jsonl"
    if alerts_file.exists():
        for line in alerts_file.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                alerts.append({
                    "agent": "HERALD",
                    "severity": row.get("severity", "warn"),
                    "title": row.get("title") or row.get("message") or "HERALD alert",
                    "payload": row,
                })
            except json.JSONDecodeError:
                continue

    return baselines, alerts


# ── ORACLE: keywords.jsonl → oracle_keywords ─────────────────────────────────

def collect_oracle(state_dir: Path):
    keywords_map = {}  # (keyword, source) -> latest entry

    keywords_file = state_dir / "oracle-state" / "keywords.jsonl"
    if keywords_file.exists():
        for line in keywords_file.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            keyword = row.get("keyword")
            source = row.get("source") or "unknown"
            if not keyword:
                continue
            # last write wins (jsonl is append-only, latest line is freshest)
            keywords_map[(keyword, source)] = {
                "keyword": keyword,
                "source": source,
                "volume": int(row.get("search_volume", 0) or 0),
                "weekly_baseline_volume": 0,
            }

    # Ensure baseline-only keywords still get a row (volume=0, baseline=0).
    baseline_file = state_dir / "oracle-state" / "weekly_baseline.json"
    if baseline_file.exists():
        try:
            data = json.loads(baseline_file.read_text())
            for kw in data.get("keywords", []):
                key = (kw, "weekly_baseline")
                if key not in keywords_map:
                    keywords_map[key] = {
                        "keyword": kw,
                        "source": "weekly_baseline",
                        "volume": 0,
                        "weekly_baseline_volume": 0,
                    }
        except Exception as e:
            print(f"  ⚠️  ORACLE weekly_baseline.json parse error: {e}", file=sys.stderr)

    return list(keywords_map.values())


# ── HTTP POST in batches ─────────────────────────────────────────────────────

SINGLE_ROW_ENDPOINTS = {"/api/agents/state/baselines", "/api/agents/state/alerts"}


def post_batches(client: httpx.Client, api_base: str, endpoint: str, rows, batch_size: int, verbose: bool):
    if not rows:
        return 0
    url = f"{api_base}{endpoint}"
    posted = 0

    if endpoint in SINGLE_ROW_ENDPOINTS:
        for idx, row in enumerate(rows, 1):
            if verbose and idx % 50 == 0:
                print(f"    POST {endpoint} {idx}/{len(rows)}")
            r = client.post(url, json=row)
            r.raise_for_status()
            posted += 1
        return posted

    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        if verbose:
            print(f"    POST {endpoint} batch {i // batch_size + 1} ({len(chunk)} rows)")
        r = client.post(url, json=chunk)
        r.raise_for_status()
        posted += len(chunk)
    return posted


def main():
    ap = argparse.ArgumentParser(description="Migrate Hermes legacy state to D1 via API")
    ap.add_argument("--state-dir", type=Path, default=DEFAULT_STATE_DIR,
                    help=f"Hermes state root (default: {DEFAULT_STATE_DIR})")
    ap.add_argument("--api-base", default=DEFAULT_API_BASE,
                    help=f"API Worker base URL (default: {DEFAULT_API_BASE})")
    ap.add_argument("--api-key", default=DEFAULT_API_KEY,
                    help="Bearer token (default: $FUSIONOPS_API_KEY)")
    ap.add_argument("--origin", default=DEFAULT_ORIGIN,
                    help=f"Origin header for trusted-origin auth (default: {DEFAULT_ORIGIN})")
    ap.add_argument("--agent", choices=["AEGIS", "SCOUT", "HERALD", "ORACLE", "ALL"], default="ALL")
    ap.add_argument("--apply", action="store_true", help="Actually POST (default = dry-run)")
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    state_dir = args.state_dir
    if not state_dir.exists():
        print(f"❌ State dir not found: {state_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"📦 Hermes state migration → D1")
    print(f"   state_dir : {state_dir}")
    print(f"   api_base  : {args.api_base}")
    print(f"   mode      : {'APPLY (will POST)' if args.apply else 'DRY-RUN (no calls)'}")
    print(f"   agent     : {args.agent}")
    print()

    plan = {
        "fingerprints": [],
        "baselines": [],
        "alerts": [],
        "oracle_keywords": [],
    }

    if args.agent in ("AEGIS", "ALL"):
        fps, alerts = collect_aegis(state_dir)
        plan["fingerprints"] += fps
        plan["alerts"] += alerts
        print(f"  AEGIS  → {len(fps):4d} fingerprints, {len(alerts):4d} alerts")

    if args.agent in ("SCOUT", "ALL"):
        fps = collect_scout(state_dir)
        plan["fingerprints"] += fps
        print(f"  SCOUT  → {len(fps):4d} fingerprints")

    if args.agent in ("HERALD", "ALL"):
        bls, alerts = collect_herald(state_dir)
        plan["baselines"] += bls
        plan["alerts"] += alerts
        print(f"  HERALD → {len(bls):4d} baselines, {len(alerts):4d} alerts")

    if args.agent in ("ORACLE", "ALL"):
        kws = collect_oracle(state_dir)
        plan["oracle_keywords"] += kws
        print(f"  ORACLE → {len(kws):4d} keywords")

    print()
    total = sum(len(v) for v in plan.values())
    print(f"  TOTAL  → {total} rows queued across 4 tables")

    if args.verbose:
        print("\n── Sample rows (first 2 per category) ──")
        for category, rows in plan.items():
            if not rows:
                continue
            print(f"\n[{category}]")
            for row in rows[:2]:
                print(f"  {json.dumps(row, default=str)[:200]}")

    if not args.apply:
        print("\n💡 Dry-run only. Re-run with --apply to POST.")
        return

    if not args.api_key:
        print("❌ --apply requires FUSIONOPS_API_KEY (or --api-key)", file=sys.stderr)
        sys.exit(2)

    headers = {
        "Authorization": f"Bearer {args.api_key}",
        "Origin": args.origin,
        "Content-Type": "application/json",
    }
    print("\n🚀 Applying…")
    with httpx.Client(timeout=60, headers=headers) as client:
        posted_fp = post_batches(client, args.api_base, "/api/agents/state/fingerprints",
                                 plan["fingerprints"], BATCH_SIZE, args.verbose)
        posted_bl = post_batches(client, args.api_base, "/api/agents/state/baselines",
                                 plan["baselines"], BATCH_SIZE, args.verbose)
        posted_al = post_batches(client, args.api_base, "/api/agents/state/alerts",
                                 plan["alerts"], BATCH_SIZE, args.verbose)
        posted_kw = post_batches(client, args.api_base, "/api/agents/state/oracle-keywords",
                                 plan["oracle_keywords"], BATCH_SIZE, args.verbose)

    print(f"\n✅ Done. fingerprints={posted_fp} baselines={posted_bl} alerts={posted_al} keywords={posted_kw}")


if __name__ == "__main__":
    main()
