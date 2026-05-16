#!/usr/bin/env python3
"""
HERMES Telegram Command Trigger
Polls Telegram for incoming commands and executes FBIS actions.

Commands:
  /fbis run        — Run full nightly pipeline now
  /fbis status     — Show last run results
  /fbis accounts   — List accounts + risk scores
  /fbis help       — Show all commands

Deploy: systemd or pm2 on Hetzner alongside fbis-mcp container.
"""

import os, sys, json, time, subprocess, httpx, datetime, pathlib

TG_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT   = os.getenv("TELEGRAM_CHAT_ID", "")
API       = os.getenv("FBIS_API_BASE", "https://lp-factory-api.misty-feather-556e.workers.dev")
SCRIPT    = os.path.expanduser("~/hermes/hermes-nightly.py")
LOG_FILE  = "/opt/fusionops/hermes/trigger.log"

POLL_INTERVAL = 3   # seconds between getUpdates polls
OFFSET_FILE   = "/opt/fusionops/hermes/.tg-offset"

client = httpx.Client(timeout=15)


def tg(method, **params):
    r = client.post(f"https://api.telegram.org/bot{TG_TOKEN}/{method}", json=params)
    r.raise_for_status()
    return r.json()


def send(text: str):
    if not TG_TOKEN or not TG_CHAT:
        print(f"[tg] {text}")
        return
    tg("sendMessage", chat_id=TG_CHAT, text=text, parse_mode="HTML")


def load_offset() -> int:
    try:
        return int(pathlib.Path(OFFSET_FILE).read_text().strip())
    except Exception:
        return 0


def save_offset(offset: int):
    pathlib.Path(OFFSET_FILE).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(OFFSET_FILE).write_text(str(offset))


def get_updates(offset: int):
    try:
        r = tg("getUpdates", offset=offset, timeout=25, allowed_updates=["message"])
        return r.get("result", [])
    except Exception as e:
        print(f"[poll] error: {e}")
        return []


# ── command handlers ──────────────────────────────────────────────────────────

def cmd_run():
    send("⚡ <b>FBIS pipeline starting...</b>\nThis takes ~60s. I'll report when done.")
    try:
        result = subprocess.run(
            [sys.executable, SCRIPT],
            capture_output=True, text=True, timeout=300,
            env={**os.environ,
                 "FBIS_API_BASE": API,
                 "TELEGRAM_BOT_TOKEN": TG_TOKEN,
                 "TELEGRAM_CHAT_ID": TG_CHAT}
        )
        if result.returncode == 0:
            send("✅ <b>Pipeline complete.</b> Telegram report sent separately.")
        else:
            err = (result.stderr or result.stdout or "unknown error")[-400:]
            send(f"❌ <b>Pipeline failed</b>\n<code>{err}</code>")
    except subprocess.TimeoutExpired:
        send("⚠️ Pipeline timed out after 5 minutes.")
    except Exception as e:
        send(f"❌ Error: {e}")


def cmd_status():
    try:
        r = client.get(f"{API}/api/analysis/agent-kpi", params={"limit": 20})
        r.raise_for_status()
        rows = r.json().get("data", [])
        if not rows:
            send("📊 No KPI data yet. Run <code>/fbis run</code> first.")
            return
        latest = {}
        for row in rows:
            key = f"{row['agent_name']}.{row['kpi_name']}"
            if key not in latest:
                latest[key] = row
        lines = ["📊 <b>Latest FBIS KPIs</b>\n"]
        for key, row in sorted(latest.items()):
            icon = "✅" if float(row.get("kpi_value", 0)) <= float(row.get("kpi_target", 0)) or \
                          row.get("kpi_unit") == "%" else "⚠️"
            lines.append(f"{icon} [{row['agent_name'].upper()}] {row['kpi_name']} = "
                         f"{row['kpi_value']} {row.get('kpi_unit','')}")
        send("\n".join(lines))
    except Exception as e:
        send(f"❌ Status error: {e}")


def cmd_accounts():
    try:
        r = client.get(f"{API}/api/analysis/accounts")
        r.raise_for_status()
        accounts = r.json().get("data", [])
        if not accounts:
            send("📋 No accounts found in database.")
            return
        lines = [f"📋 <b>{len(accounts)} accounts</b>\n"]
        for a in accounts[:15]:
            status = a.get("lifecycle_state") or a.get("status") or "unknown"
            risk = a.get("verdict_score")
            risk_str = f" | risk {risk}" if risk is not None else ""
            lines.append(f"• <code>{a.get('id','?')[:8]}</code> — {status}{risk_str}")
        if len(accounts) > 15:
            lines.append(f"... and {len(accounts) - 15} more")
        send("\n".join(lines))
    except Exception as e:
        send(f"❌ Accounts error: {e}")


def cmd_help():
    send(
        "🤖 <b>FBIS Telegram Commands</b>\n\n"
        "/fbis run — Run full nightly pipeline\n"
        "/fbis status — Show latest KPIs\n"
        "/fbis accounts — List accounts + risk\n"
        "/fbis help — This message\n\n"
        "Tip: Only messages from your chat_id are accepted."
    )


# ── dispatcher ────────────────────────────────────────────────────────────────

HANDLERS = {
    "/fbis run":      cmd_run,
    "/fbis status":   cmd_status,
    "/fbis accounts": cmd_accounts,
    "/fbis help":     cmd_help,
}


def handle(update: dict):
    msg = update.get("message", {})
    chat_id = str(msg.get("chat", {}).get("id", ""))
    text = (msg.get("text") or "").strip()

    # Security: only accept from configured chat
    if TG_CHAT and chat_id != str(TG_CHAT):
        print(f"[security] ignored message from chat {chat_id}")
        return

    if not text:
        return

    # Match command (case-insensitive, handles both /fbis run and /fbis@botname run)
    text_clean = text.lower().split("@")[0].strip()

    for pattern, handler in HANDLERS.items():
        if text_clean == pattern or text_clean.startswith(pattern + " "):
            print(f"[cmd] {text_clean} from {chat_id}")
            handler()
            return

    # Unknown /fbis command
    if text_clean.startswith("/fbis"):
        send(f"❓ Unknown command: <code>{text_clean}</code>\nSend /fbis help")


# ── main loop ─────────────────────────────────────────────────────────────────

def main():
    if not TG_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set")
        sys.exit(1)

    print(f"[hermes-trigger] started — polling every {POLL_INTERVAL}s")
    send("🤖 FBIS trigger online. Send /fbis help")

    offset = load_offset()

    while True:
        updates = get_updates(offset)
        for upd in updates:
            offset = upd["update_id"] + 1
            save_offset(offset)
            try:
                handle(upd)
            except Exception as e:
                print(f"[handle] error: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
