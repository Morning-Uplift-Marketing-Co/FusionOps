# LP Builder Team

## Role
End-to-end automated landing page creation: research → copy → build → QA → deploy.
Spawns 4 parallel sub-agents via mission-control.

## Tools Required
- `mission-control` MCP (spawn sub-agents)
- `browser` MCP (competitor research, QA testing)
- `mem0` MCP (store winning patterns, past LP data)
- FusionOps LP Factory API (deploy)

## Team Structure

```
LP Builder (orchestrator)
├── Research Agent    → find winning angles
├── Copy Agent        → write headlines + body + CTA
├── Build Agent       → configure + deploy via LP Factory API
└── QA Agent          → verify tracking, mobile, speed
```

## Process

### Phase 1: Research (Research Agent)
```
1. browser.navigate competitor URLs for the niche
2. Screenshot above-the-fold of top 5 competitors
3. Extract: headline patterns, CTA text, value props, trust signals
4. Load past winning LPs from mem0
5. Output: research_brief.md
```

### Phase 2: Copy (Copy Agent)
Input: `research_brief.md` + niche + offer details
Output:
```json
{
  "headline": "...",
  "subheadline": "...",
  "bullets": ["...", "...", "..."],
  "cta_text": "...",
  "trust_signals": ["...", "..."]
}
```

### Phase 3: Build (Build Agent)
```
POST /api/campaigns
{
  "template_id": "{best_template_for_niche}",
  "copy": {copy from Phase 2},
  "site_id": "{target_site_id}",
  "tracking": { "pixel": true, "gclid": true }
}
```

### Phase 4: QA (QA Agent)
```
1. browser.navigate(deployed_url)
2. Check: pixel fires on load
3. Check: form submits correctly
4. Check: mobile viewport renders
5. Check: page speed < 3s
6. Screenshot: desktop + mobile
7. Save screenshots to wiki/
```

### Phase 5: Report
Send Telegram message with:
- LP URL
- Screenshot preview
- Pixel status ✅/❌
- Speed score

## Templates Selection Logic
Load from mem0: `best_template_by_niche` mapping.
Fallback: query `/api/templates?niche={niche}` and pick highest conversion rate.

## Trigger
```
# Manual: hermes "build LP for {niche} with offer {offer}"
# Or via Mission Control dashboard
```
