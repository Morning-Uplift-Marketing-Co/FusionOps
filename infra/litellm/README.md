# LiteLLM Proxy — Hermes → OpenRouter → Langfuse

Stateless proxy layer that instruments Hermes LLM calls for observability.

## Architecture

```
Hermes Agent (base_url=http://litellm:4000)
         ↓
    LiteLLM Proxy (port 4000)
         ↓
    OpenRouter API (provider="openrouter")
         ↓
    Backend LLM (Claude, Hermes, etc.)
         ↓
    Langfuse (traces ingested via LiteLLM SDK)
```

## Why LiteLLM?

1. **Zero code changes** — Hermes just changes `base_url` config
2. **Automatic instrumentation** — Catches all LLM calls (token counts, latency, costs)
3. **Provider agnostic** — Easy to swap OpenRouter for Anthropic, Together, etc. later
4. **Fallback routing** — If primary model fails, fallback to backup model
5. **Debug mode** — Logs all requests/responses for troubleshooting

## Deploy

### Prerequisites

- Langfuse v3 stack running (see [../langfuse/README.md](../langfuse/README.md))
- Langfuse API keys generated (Settings → API Keys)
- OpenRouter API key (https://openrouter.ai/keys)

### Steps

1. **Generate .env**
   ```bash
   cd /opt/fusionops/infra/litellm
   cp .env.example .env
   
   # Set your keys:
   # OPENROUTER_API_KEY=sk-or-v1-...
   # LANGFUSE_PUBLIC_KEY=pk-lf-...
   # LANGFUSE_SECRET_KEY=sk-lf-...
   ```

2. **Deploy container**
   ```bash
   docker compose up -d
   docker compose logs litellm-proxy -f  # watch startup
   ```

3. **Verify health**
   ```bash
   curl http://localhost:4000/health
   # Should return: {"status":"ok"}
   ```

4. **View API docs**
   - Open http://localhost:4000/docs (OpenAPI/Swagger UI)
   - Models list, chat completion endpoint docs

### Testing

```bash
# Test proxy with a simple request
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .env | grep LITELLM_MASTER_KEY | cut -d= -f2)" \
  -d '{
    "model": "hermes-2-pro-llama-3-8b",
    "messages": [{"role": "user", "content": "Say hello"}],
    "temperature": 0.7
  }'

# In Langfuse UI, you should see the trace appear within 30s
```

## Wire Up Hermes

### Update Hermes config.yaml

```yaml
# ~/.hermes/config.yaml

model:
  provider: "openrouter"
  base_url: "http://localhost:4000/v1"  # or http://litellm:4000/v1 if in Docker
  model: "hermes-2-pro-llama-3-8b"
  api_key: ${OPENROUTER_API_KEY}  # Still needed for auth, but routed through LiteLLM

cache:
  # Optional: cache LLM responses to reduce trace noise
  type: "redis"
  host: "redis"
  port: 6379
```

### Restart Hermes

```bash
# If Hermes is a systemd service:
systemctl restart hermes

# If Docker:
docker compose -f ~/.hermes/docker-compose.yml down && \
docker compose -f ~/.hermes/docker-compose.yml up -d
```

### Verify Traces

1. Open Langfuse UI: http://178.105.137.23:3030
2. Navigate to **Project → Traces**
3. Run a Hermes agent skill (e.g., `hermes skill run facebook_ads_search`)
4. Refresh Langfuse — new traces should appear

## Cost Tracking

Each trace includes:
- **Tokens**: input + output token counts (per OpenRouter response headers)
- **Cost**: calculated from model + provider + tokens (stored in Langfuse)
- **Latency**: end-to-end request time
- **Model**: "hermes-2-pro-llama-3-8b" etc.
- **Metadata**: Hermes skill name, agent version, user (if set)

View costs in Langfuse → **Analytics → Model Costs** or export via API.

## Troubleshooting

### 502 Bad Gateway / Connection refused

- **Cause**: Langfuse not reachable
- **Fix**: Check `LANGFUSE_HOST` in `.env` — use http://langfuse-web:3000 if same Docker network

### Traces not appearing in Langfuse

- **Cause**: LiteLLM not sending traces or API keys invalid
- **Fix**: Check LiteLLM logs: `docker compose logs litellm-proxy | grep -i trace`
- Verify credentials: `curl http://localhost:4000/health`

### Model not found / fallback triggered

- **Cause**: Model name in `config.yaml` doesn't match OpenRouter model
- **Fix**: Check [OpenRouter model list](https://openrouter.ai/docs#models), update `config.yaml`

## Performance

- **Latency overhead**: ~50-100ms per request (negligible for LLM calls)
- **Memory**: ~200MB (single proxy instance)
- **Throughput**: Handles 100+ concurrent requests (single pod)

Scale via:
```yaml
# Add replicas in docker-compose.yml
services:
  litellm-proxy-1:
    ...
  litellm-proxy-2:  # Add second proxy instance
    ...
```

Then place behind a load balancer (e.g., nginx, HAProxy).

## Reference

- [LiteLLM Docs](https://docs.litellm.ai/)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Langfuse Tracing](https://langfuse.com/docs/integrations/litellm)
