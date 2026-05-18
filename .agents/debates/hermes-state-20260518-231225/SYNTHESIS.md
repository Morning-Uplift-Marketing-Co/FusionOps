# Debate Synthesis — Hermes Agent State: D1 vs In-Memory

**Date:** 2026-05-18
**Format:** 4-way, 1 round (fast), comparison matrix
**Question:** Should AEGIS/SCOUT/HERALD/ORACLE state live in D1, in-memory, or hybrid?

---

## Comparison Matrix

| Criterion | 🔴 Codex (GPT-5.4) | 🟡 Gemini 3.1 Pro | 🟢 Sonnet 4.6 | 🔵 Opus 4.7 (moderator) |
|---|---|---|---|---|
| **Pick** | **Hybrid** (D1 canonical + local cache) | **D1** | **D1** | **Hybrid** |
| **Cold-start cost** | Rebuilding from APIs burns DataForSEO quota; D1 row-read cheaper than re-deriving fingerprints | ~ms latency negligible for cron jobs | ~50ms HTTP — dwarfed by DataForSEO calls | Both correct: D1 read ≪ API rebuild cost |
| **Failure mode** | D1 survives VPS death; brief rate-limit → graceful single-tick degrade | Hetzner death → local files lost; D1 decoupled & persistent | Local sqlite = SPOF; D1 geo-redundant; 50k reads/day free tier ample | D1 wins decisively; local-only loses on disaster recovery |
| **Multi-agent coordination** | Trivial via shared D1 tables through existing API Worker; local files = ad-hoc coupling, format drift | AEGIS finding instantly queryable by HERALD without IPC | Shared schema = natural coordination bus; alternatives require re-building API anyway | Unanimous: D1 is the only clean answer |
| **Ops simplicity** | One schema, one backup surface, one migration story | Centralized via Wrangler; KPIs + agent memory in one layer | Versioned migrations; SSH-and-inspect for local is painful | D1 wins on observability + already-built API Worker |
| **Cost** | Tiny relative to external API spend | Free/cheap tier covers 2h/daily/weekly cadence | ~200 writes/day, well inside D1 free limits | Non-factor at this scale |
| **Unique insight** | Discovered repo already writes local JSONL under `~/.hermes/{aegis,scout,herald,oracle}-state/` — the real choice is whether to *promote* that to D1 | Emphasized network latency as "millisecond" — negligible for background cron | Quantified D1 free-tier headroom (50k reads/day) | Repo state means hybrid is closest to current reality |

---

## Vote Tally

- **D1 (pure):** 2 — Gemini, Sonnet
- **Hybrid (D1 canonical + local scratch):** 2 — Codex, Opus
- **In-memory only:** 0

**Consensus: All four reject pure in-memory.** The split is between *pure D1* and *hybrid*. Note that the hybrid position is a strict superset of the pure-D1 position — both agree D1 must be the canonical source of truth.

---

## Recommendation

**Promote canonical state to D1 via the existing API Worker; keep `~/.hermes/*-state/` as a local cache/checkpoint only.**

Rationale:
1. **D1 as source of truth** — covers all 5 criteria: failure resilience, multi-agent coordination, ops simplicity, cost, cold-start. Universally agreed.
2. **Local cache as performance optimization** — Codex's key insight: the local JSONL files already exist. Keep them as a write-through cache to avoid an extra round-trip on every boot, but treat them as *disposable*. If the VPS dies, a replacement runner re-syncs from D1.
3. **Graceful degradation** — if D1 is rate-limited (unlikely at 4 agents × ~200 writes/day), agents fall back to local cache for one tick and retry.

## Concrete next steps

1. **Define D1 schema** for shared agent state. Suggested tables:
   - `agent_fingerprints` (agent, key, fingerprint_hash, last_seen) — for SCOUT/AEGIS dedup
   - `agent_baselines` (agent, metric, window, value, updated_at) — for HERALD anomaly detection
   - `agent_alerts` (id, agent, severity, payload, ack_status, created_at) — pending human ack
   - `oracle_keywords` (keyword, source, first_seen, last_seen, weekly_baseline) — ORACLE corpus
2. **Add API Worker endpoints** under `/api/agents/state/*` (read + upsert), authed via existing `FUSIONOPS_API_KEY`.
3. **Refactor agent runs** to read-on-boot, write-on-exit. Local JSONL files keep current write paths as a fallback cache (one-line read fallback if D1 read fails).
4. **Monitor D1 quotas** in the Observability tab (already wired) — alert if approaching free-tier limits.

## Token / cost note

Codex: ~6k tokens (free local CLI w/ user's plan). Gemini: 1 retry due to 429, eventually succeeded (~3k tokens). Sonnet agent: 45k tokens via SDK. Opus moderator (this synthesis): ~3k tokens. **Total: ~57k tokens.**

---

## Files

- `PROMPT.md` — debate prompt with full context
- `01-codex.md` — Codex CLI position (with full trace)
- `02-gemini.md` — Gemini CLI position (with retry trace)
- `03-sonnet.md` — Sonnet Agent position
- `SYNTHESIS.md` — this file (Opus moderator)
