/**
 * CORS Proxy Worker for Cloudflare & Multilogin APIs
 *
 * Deploy:  npx wrangler deploy --config apps/cf-proxy/wrangler.toml
 *
 * Routes:
 *   /cf/*   → api.cloudflare.com/client/v4/*
 *   /mlx/*  → api.multilogin.com/*
 *   /health → 200 ok
 */

const TARGETS = {
  "/cf/": "https://api.cloudflare.com/client/v4/",
  "/mlx/": "https://api.multilogin.com/",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: { ...CORS_HEADERS, "Content-Type": "text/plain" } });
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Find matching target
    let targetBase = null;
    let strippedPath = url.pathname;

    for (const [prefix, base] of Object.entries(TARGETS)) {
      if (url.pathname.startsWith(prefix)) {
        targetBase = base;
        strippedPath = url.pathname.slice(prefix.length);
        break;
      }
    }

    if (!targetBase) {
      return new Response(JSON.stringify({ error: "Unknown route" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Forward the request
    const targetUrl = `${targetBase}${strippedPath}${url.search}`;

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete("host");
    proxyHeaders.delete("origin");
    proxyHeaders.delete("referer");

    try {
      const proxyRes = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        redirect: "follow",
      });

      const responseHeaders = new Headers(proxyRes.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(k, v);
      }

      return new Response(proxyRes.body, {
        status: proxyRes.status,
        statusText: proxyRes.statusText,
        headers: responseHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  },
};
