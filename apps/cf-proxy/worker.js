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
  "/ibs/": "https://api.internet.bs/",
};

function getCorsHeaders(hostname) {
  // Vary server header based on domain
  const serverVariants = [
    'nginx/1.20.2',
    'Apache/2.4.52',
    'cloudflare',
    'nginx/1.23.3',
    'Microsoft-IIS/10.0',
  ];
  const serverIndex = hostname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % serverVariants.length;
  
  // Vary max-age
  const maxAgeVariants = ['86400', '43200', '3600'];
  const maxAgeIndex = (serverIndex + 1) % maxAgeVariants.length;
  
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Requested-With",
    "Access-Control-Max-Age": maxAgeVariants[maxAgeIndex],
    "Server": serverVariants[serverIndex],
    "X-Content-Type-Options": "nosniff",
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(url.hostname);
    
    // Add random delay (0-6ms)
    const randomDelay = Math.random() * 6;
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
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
      // Vary error messages per domain
      const errorMessages = [
        { error: "Unknown route" },
        { error: "Route not found" },
        { message: "Invalid endpoint" },
        { status: "error", message: "Unknown route" },
      ];
      const msgIndex = url.hostname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % errorMessages.length;
      
      return new Response(JSON.stringify(errorMessages[msgIndex]), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      for (const [k, v] of Object.entries(corsHeaders)) {
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
