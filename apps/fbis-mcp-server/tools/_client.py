"""Shared HTTP client for FusionOps API."""

import os
import httpx

_API_URL = os.getenv("FUSIONOPS_API_URL", "https://lp-factory-api.misty-feather-556e.workers.dev")
_API_KEY = os.getenv("FUSIONOPS_API_KEY", "")


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if _API_KEY:
        h["Authorization"] = f"Bearer {_API_KEY}"
    return h


async def get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{_API_URL}{path}", headers=_headers())
        r.raise_for_status()
        return r.json()


async def post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{_API_URL}{path}", json=body, headers=_headers())
        r.raise_for_status()
        return r.json()
