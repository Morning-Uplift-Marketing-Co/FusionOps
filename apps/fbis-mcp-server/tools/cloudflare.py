"""
Cloudflare Browser Rendering tools for Hermes agents.
API base: /accounts/{id}/browser-rendering/
Response: {"success": true, "result": [...]}
"""
import os
import json
import httpx

CF_API = "https://api.cloudflare.com/client/v4"


def _headers():
    token = os.getenv("CLOUDFLARE_API_TOKEN", "")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _aid():
    return os.getenv("CLOUDFLARE_ACCOUNT_ID", "")


def _scrape(url: str, selector: str = "body") -> dict:
    r = httpx.post(
        f"{CF_API}/accounts/{_aid()}/browser-rendering/scrape",
        headers=_headers(),
        json={"url": url, "elements": [{"selector": selector}]},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def register(mcp):

    @mcp.tool
    def cf_crawl(url: str, depth: int = 1, format: str = "markdown") -> str:
        """Crawl a URL using Cloudflare Browser Rendering (JS-rendered).
        Returns page body text. format ignored (always text)."""
        try:
            data = _scrape(url, "body")
            if not data.get("success"):
                return f"error: {data}"
            results = data["result"]
            if results and results[0].get("results"):
                return results[0]["results"][0].get("text", "")[:6000]
            return "(no content)"
        except Exception as e:
            return f"error: {e}"

    @mcp.tool
    def cf_markdown(url: str) -> str:
        """Fetch a URL and return its content as clean text using Cloudflare Browser Rendering.
        Useful for reading landing page content (form presence, word count, etc.)."""
        try:
            data = _scrape(url, "body")
            if not data.get("success"):
                return f"error: {data}"
            results = data["result"]
            if results and results[0].get("results"):
                return results[0]["results"][0].get("text", "")[:6000]
            return "(no content)"
        except Exception as e:
            return f"error: {e}"

    @mcp.tool
    def cf_links(url: str) -> str:
        """Extract all hyperlinks from a URL using Cloudflare Browser Rendering.
        Returns JSON list of {href, text} objects."""
        try:
            data = _scrape(url, "a")
            if not data.get("success"):
                return f"error: {data}"
            results = data["result"]
            links = []
            if results and results[0].get("results"):
                for el in results[0]["results"]:
                    href = ""
                    for attr in el.get("attributes", []):
                        if attr.get("name") == "href":
                            href = attr.get("value", "")
                    links.append({"href": href, "text": el.get("text", "").strip()})
            return json.dumps(links, ensure_ascii=False)
        except Exception as e:
            return f"error: {e}"

    @mcp.tool
    def cf_json_extract(url: str, selector: str) -> str:
        """Scrape specific elements from a URL by CSS selector.
        Returns JSON array of matched elements with text, html, attributes."""
        try:
            data = _scrape(url, selector)
            if not data.get("success"):
                return f"error: {data}"
            results = data["result"]
            elements = results[0]["results"] if results else []
            return json.dumps(elements, ensure_ascii=False)
        except Exception as e:
            return f"error: {e}"

    @mcp.tool
    def cf_screenshot(url: str, width: int = 1280, height: int = 900) -> str:
        """Take a screenshot of a URL using Cloudflare Browser Rendering.
        Returns base64-encoded PNG or error message."""
        import base64
        try:
            r = httpx.post(
                f"{CF_API}/accounts/{_aid()}/browser-rendering/screenshot",
                headers=_headers(),
                json={"url": url, "viewport": {"width": width, "height": height}},
                timeout=30,
            )
            if r.status_code == 200 and "image" in r.headers.get("content-type", ""):
                return f"data:image/png;base64,{base64.b64encode(r.content).decode()}"
            return f"error: {r.status_code} {r.text[:300]}"
        except Exception as e:
            return f"error: {e}"
