---
name: lp_template_scout
description: Browse Bolt.new and Lovable galleries to find new loan landing page templates
metadata.openclaw.requires.bins: ["curl"]
---

# LP Factory Template Scout

Automatically browse AI template galleries (Bolt.new, Lovable) to discover new landing page templates suitable for loan/finance campaigns. Report the best finds weekly.

## When to Use

Run weekly (Monday morning). Low priority but saves time by surfacing new template options without manual browsing.

## Configuration

Required environment variables:
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Target chat ID

## How It Works

1. Use OpenClaw browser automation to visit:
   - `https://bolt.new/explore` (or community gallery)
   - `https://lovable.dev/explore` (or showcase)

2. Search/filter for keywords:
   - "loan", "lending", "finance", "personal loan"
   - "landing page", "lead generation", "conversion"
   - "calculator", "comparison"

3. For each result, extract:
   - Template name
   - Preview URL / screenshot
   - Tech stack (Astro, React, HTML)
   - Creator / ratings
   - Whether it uses Tailwind CSS (preferred)

4. Score compatibility with LP Factory:
   - Uses Tailwind CSS? +2
   - Single page (no routing)? +2
   - Finance/loan niche? +3
   - Has calculator component? +2
   - Mobile responsive? +1
   - Score >= 7 → recommend

5. Send top 3 via Telegram.

## Message Format

```
Weekly Template Scout Report

1. "QuickLoan Pro" (Bolt.new)
   Score: 9/10 | Stack: Astro + Tailwind
   Has: calculator, APR table, mobile CTA
   Link: https://bolt.new/~/sb1-xxxxx

2. "FinanceHub Landing" (Lovable)
   Score: 8/10 | Stack: React + Vite + Tailwind
   Has: calculator, testimonials, responsive
   Link: https://lovable.dev/projects/xxxxx

3. "LendEasy Page" (Bolt.new)
   Score: 7/10 | Stack: HTML + Tailwind CDN
   Has: basic form, comparison table
   Link: https://bolt.new/~/sb1-yyyyy

To import: paste link in MCP import or download ZIP.
```

## Cron Setup

```bash
openclaw cron add \
  --name "LP Template Scout" \
  --cron "0 10 * * 1" \
  --tz "Asia/Bangkok" \
  --session isolated \
  --message "Browse Bolt.new and Lovable galleries for new loan/finance landing page templates. Score by LP Factory compatibility and report top 3 via Telegram." \
  --announce --channel telegram
```

## Safety

- Read-only browsing, no downloads or imports
- Browser automation only visits public gallery pages
- No login required for public galleries
