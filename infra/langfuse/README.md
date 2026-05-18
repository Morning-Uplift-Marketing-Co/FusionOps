# Langfuse v3 — Self-Hosted on FusionOps Hetzner

Production observability for LLM calls across all Hermes agents (FBIS + Gmail + LP Builder + future Keyword team).

## Why

Clawmetry (see [../docker-compose.yml](../docker-compose.yml) and [clawmetry_hermes_compat.md](../../memory/clawmetry_hermes_compat.md)) handles cron + infra observability for Hermes. But it does NOT track LLM token/cost (`model: "unknown"`, `provider: "unknown"`). Langfuse fills that gap by tracing at the LLM provider layer — agnostic to whether the runtime is Hermes, OpenClaw, or anything else.

## Prerequisite: Hetzner CX32 (8GB RAM)

Langfuse v3 needs ~3GB RAM (Postgres + Clickhouse + Redis + web + worker + minio). The original CX22 (3.7Gi total) is not enough. Upgrade via [Hetzner Cloud Console](https://console.hetzner.cloud) → server 130402777 → Rescale → CX32.

## Deploy

```bash
# Generate secrets
cd /opt/fusionops/infra/langfuse
cp .env.example .env
for key in POSTGRES_PASSWORD CLICKHOUSE_PASSWORD REDIS_AUTH MINIO_ROOT_PASSWORD; do
  sed -i "s|^${key}=.*|${key}=$(openssl rand -hex 32)|" .env
done
for key in NEXTAUTH_SECRET LANGFUSE_SALT LANGFUSE_ENCRYPTION_KEY; do
  sed -i "s|^${key}=.*|${key}=$(openssl rand -base64 32 | tr -d '\n')|" .env
done

# Start
docker compose up -d

# Watch logs while it migrates Postgres + Clickhouse
docker compose logs -f langfuse-web langfuse-worker

# When you see "Ready in XXXms" — open http://178.105.137.23:3030
```

## First-Run Setup

1. **Open** http://178.105.137.23:3030
2. **Sign up** first account — this becomes admin
3. Create **Organization**: e.g. `FusionOps`
4. Create **Project**: e.g. `hermes-production`
5. Go to **Settings → API Keys** → create new public+secret key pair
6. Copy keys back into `infra/langfuse/.env` (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY)
7. **Disable signup** to prevent random access: set `AUTH_DISABLE_SIGNUP: "true"` in compose, restart

## Connect Hermes → LiteLLM → Langfuse

Hermes uses OpenRouter directly. To get trace data into Langfuse, insert a LiteLLM proxy in between:

```
Hermes (config: provider=openrouter) → OpenRouter
                       ↓
                   becomes
                       ↓
Hermes (config: base_url=http://litellm:4000) → LiteLLM proxy → OpenRouter
                                                        ↓
                                                    sends traces
                                                        ↓
                                                    Langfuse
```

See [../litellm/README.md](../litellm/README.md) (draft after Langfuse is verified) for the proxy setup.

## Backups

Langfuse data lives in Postgres + Clickhouse volumes. Add weekly backup:

```bash
# Postgres
docker compose exec -T postgres pg_dump -U langfuse langfuse | gzip > /backups/langfuse-pg-$(date +%F).sql.gz

# Clickhouse (traces — can be replayed but large)
docker compose exec -T clickhouse clickhouse-client --user clickhouse --password "$CLICKHOUSE_PASSWORD" \
  --query "BACKUP DATABASE default TO Disk('default', 'langfuse-$(date +%F).zip')"
```

## Reference

- [Langfuse self-hosting docs](https://langfuse.com/self-hosting)
- [Langfuse v3 docker-compose reference](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml)
