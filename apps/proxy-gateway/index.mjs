#!/usr/bin/env node
/**
 * Local/VPS HTTP relay: same paths as the Cloudflare Worker for residential proxy checks
 * when Worker → proxy TCP fails (502). CORS * for browser calls from the FusionOps app.
 *
 * Usage: npm run proxy-relay
 * Env:   PORT=8789 (default 8789)
 *
 * In Settings → Proxy resolve relay, set e.g. http://127.0.0.1:8789 (no trailing /api).
 * Or build with VITE_PROXY_RESOLVE_RELAY for a fixed relay URL.
 */
import { createServer } from "node:http";
import { ProxyAgent, fetch } from "undici";

const PORT = parseInt(process.env.PORT || "8789", 10);
const FIELDS =
  "status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
      if (d.length > 2e6) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(d));
    req.on("error", reject);
  });
}

function proxyDispatcher(host, port, username, password) {
  const u = encodeURIComponent(String(username));
  const p = encodeURIComponent(String(password));
  return new ProxyAgent(`http://${u}:${p}@${host}:${port}`);
}

async function httpGetThroughProxy(host, port, username, password, targetHttpUrl) {
  const dispatcher = proxyDispatcher(host, port, username, password);
  const res = await fetch(targetHttpUrl, {
    dispatcher,
    headers: { "User-Agent": "FusionOps-ProxyRelay/1.0" },
  });
  const text = await res.text();
  return { status: res.status, text };
}

function looksLikeProxyAuthFailure(status, text) {
  const bodyLower = String(text || "").toLowerCase();
  const head = String(text || "").slice(0, 400).toLowerCase();
  return (
    status === 407 ||
    head.includes(" 407 ") ||
    bodyLower.includes("access denied") ||
    bodyLower.includes("couldn't log you in") ||
    bodyLower.includes("could not log you in") ||
    bodyLower.includes("proxy authentication") ||
    (bodyLower.includes("confirm") && bodyLower.includes("password"))
  );
}

function parseIpApiJson(text) {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return null;
  try {
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
}

async function handleResolve(body) {
  const { host, port, username, password } = body;
  if (!host || !port || !username || !password) {
    return { status: 400, json: { error: "Missing proxy credentials (host, port, username, password)" } };
  }
  const url = `http://ip-api.com/json/?fields=${FIELDS}`;
  let status;
  let text;
  try {
    ({ status, text } = await httpGetThroughProxy(host, port, username, password, url));
  } catch (e) {
    return {
      status: 502,
      json: { error: e.message || String(e), hint: "Relay could not reach proxy or upstream." },
    };
  }
  if (looksLikeProxyAuthFailure(status, text)) {
    return {
      status: 502,
      json: {
        error:
          "Proxy rejected credentials. Check user/password and host:port (same as Worker troubleshooting).",
        raw: String(text).slice(0, 280),
      },
    };
  }
  if (status !== 200) {
    return { status: 502, json: { error: `Upstream ip-api HTTP ${status}`, raw: String(text).slice(0, 200) } };
  }
  const ipData = parseIpApiJson(text);
  if (!ipData) {
    return {
      status: 502,
      json: { error: "Invalid response from ip-api (non-JSON body)", raw: String(text).slice(0, 200) },
    };
  }
  if (ipData.status === "fail") {
    return { status: 502, json: { error: ipData.message || "ip-api returned fail" } };
  }
  return {
    status: 200,
    json: {
      ip: ipData.query,
      country: ipData.country,
      countryCode: ipData.countryCode,
      region: ipData.regionName,
      regionCode: ipData.region,
      city: ipData.city,
      zip: ipData.zip,
      lat: ipData.lat,
      lon: ipData.lon,
      timezone: ipData.timezone,
      isp: ipData.isp,
      org: ipData.org,
      as: ipData.as,
      proxy: ipData.proxy,
      hosting: ipData.hosting,
    },
  };
}

createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const path = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

  // Add ping route for platform health checks
  if (path === "/api/proxy/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (path === "/api/proxy/resolve-ip" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    const out = await handleResolve(body);
    res.writeHead(out.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(out.json));
    return;
  }

  if (path === "/api/proxy/dns-check" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    const { host, port, username, password } = body;
    if (!host || !port || !username || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing proxy credentials" }));
      return;
    }
    let st;
    let txt;
    try {
      ({ status: st, text: txt } = await httpGetThroughProxy(
        host,
        port,
        username,
        password,
        "http://ip-api.com/json/?fields=query,countryCode,isp"
      ));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message || String(e) }));
      return;
    }
    if (looksLikeProxyAuthFailure(st, txt) || st !== 200) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: st !== 200 ? `Upstream HTTP ${st}` : "Proxy auth failure",
          raw: String(txt).slice(0, 200),
        })
      );
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        leak_detected: false,
        dns_country: "unknown",
        proxy_country: "unknown",
        note: "Basic DNS check — proxy connection confirmed",
      })
    );
    return;
  }

  if (path === "/api/proxy/latency-check" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    const { host, port, username, password } = body;
    if (!host || !port || !username || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing proxy credentials" }));
      return;
    }
    const t0 = Date.now();
    try {
      const { status: st, text: txt } = await httpGetThroughProxy(
        host,
        port,
        username,
        password,
        "http://ip-api.com/json/?fields=query"
      );
      const latencyMs = Date.now() - t0;
      if (looksLikeProxyAuthFailure(st, txt) || st !== 200) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: st !== 200 ? `Latency check failed: HTTP ${st}` : "Proxy auth failure",
            latencyMs,
            raw: String(txt).slice(0, 200),
          })
        );
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ latencyMs }));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message || String(e), latencyMs: Date.now() - t0 }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}).listen(PORT, () => {
  console.log(
    `[proxy-resolve-relay] listening http://127.0.0.1:${PORT}  POST /api/proxy/resolve-ip | dns-check | latency-check`
  );
});
