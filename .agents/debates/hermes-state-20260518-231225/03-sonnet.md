# Sonnet — Position

- **Cold-start cost**: D1 adds one HTTP round-trip per agent boot (~50ms, negligible vs DataForSEO latency). Rebuilding baselines from scratch each tick is far costlier — AEGIS needs 30+ days of fingerprints to detect anomalies meaningfully. The rebuild cost dwarfs the read cost.

- **Failure mode**: Hetzner local sqlite is a single point of failure — box dies, all state dies. D1 is geo-redundant with Cloudflare's backbone. Rate limits on D1 (50k reads/day free tier) are generous for 4 agents running at most hourly; fallback is cached last-known state, not a blank slate.

- **Multi-agent coordination**: D1 is the only option that gives HERALD visibility into AEGIS findings without explicit message-passing. Shared schema = natural coordination bus. Local VPS sqlite requires either a shared mount or an API layer you'd have to build anyway.

- **Operational simplicity**: D1 schema migrations are versioned; you can query state from anywhere using the existing API Worker. Local sqlite means SSH-and-inspect; backup is a cron job you'd have to write yourself.

- **Cost**: D1 free tier covers this workload comfortably. The 4 agents combined run maybe 200 writes/day — well inside limits.

**My pick: D1** because it's already in the stack, survives VPS failure, and gives all four agents a shared truth surface at near-zero marginal cost.
