import os
import httpx

# Env var names match what the Cloudflare Worker expects (API_SECRET → Bearer token)
API_BASE = os.getenv("FUSIONOPS_API_URL", os.getenv("FBIS_API_BASE", "")).rstrip("/")
API_KEY = os.getenv("FUSIONOPS_API_KEY", os.getenv("FBIS_API_KEY", ""))

def get_headers() -> dict:
    h = {"Content-Type": "application/json"}
    if API_KEY:
        # Worker auth guard requires Authorization: Bearer; keep x-api-key for older tools.
        h["Authorization"] = f"Bearer {API_KEY}"
        h["x-api-key"] = API_KEY
    return h

async def api_get(path: str, params: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{API_BASE}{path}", params=params, headers=get_headers())
        r.raise_for_status()
        return r.json()

async def api_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{API_BASE}{path}", json=body, headers=get_headers())
        r.raise_for_status()
        return r.json()
