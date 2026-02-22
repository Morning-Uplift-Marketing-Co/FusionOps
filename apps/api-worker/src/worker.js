// LP Factory V2 — Cloudflare Workers API
// Binds to D1 database "ppc-gen-claude"
// Origin: https://github.com/songsawat-w/ppc-gen-cfca

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function getLcSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('lcToken', 'lcTeamUuid')").all();
  const s = {};
  rows.results.forEach(r => { s[r.key] = r.value; });
  return s;
}

async function getMlSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('mlToken', 'mlEmail', 'mlPassword', 'mlFolderId')").all();
  const s = {};
  rows.results.forEach(r => { s[r.key] = r.value; });
  return s;
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isMaskedSecret(value) {
  return /^[•*]+$/.test(String(value || "").trim());
}

async function githubFetch(url, options = {}, GITHUB_TOKEN) {
  const mergedHeaders = new Headers(options.headers || {});
  mergedHeaders.set("Authorization", `Bearer ${GITHUB_TOKEN}`);
  mergedHeaders.set("Content-Type", "application/json");
  mergedHeaders.set("User-Agent", "FusionOps-LP-Factory");
  mergedHeaders.set("Accept", "application/vnd.github+json");
  mergedHeaders.set("X-GitHub-Api-Version", "2022-11-28");

  const reqOptions = {
    ...options,
    headers: mergedHeaders,
  };

  const res = await fetch(url, reqOptions);

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const method = String(reqOptions.method || "GET").toUpperCase();
    const bodySnippet = detail ? detail.slice(0, 1000) : res.statusText;
    const error = new Error(`GitHub API ${res.status} ${method} ${url}: ${bodySnippet}`);
    error.status = res.status;
    throw error;
  }

  return res;
}

async function githubApi(token, path, options = {}) {
  const res = await githubFetch(`https://api.github.com${path}`, options, token);

  if (res.status === 204) return null;
  return res.json();
}

async function getGithubFileSha(token, owner, repo, path, branch) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  try {
    const data = await githubApi(token, `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
    return data?.sha || null;
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

async function upsertGithubFile({ token, owner, repo, branch, filePath, content, message }) {
  const sha = await getGithubFileSha(token, owner, repo, filePath, branch);
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const payload = {
    message,
    content: toBase64(content),
    branch,
  };
  if (sha) payload.sha = sha;

  const data = await githubApi(token, `/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data?.content?.sha || null;
}

const DEPLOY_MANIFEST_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://lp-factory.dev/schemas/deploy-manifest.schema.json",
  "title": "DeployManifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "siteId", "brand", "templateId", "environment", "targets", "build", "tracking", "meta"],
  "properties": {
    "version": { "type": "integer", "minimum": 1 },
    "siteId": { "type": "string", "minLength": 1 },
    "brand": { "type": "string" },
    "templateId": { "type": "string", "minLength": 1 },
    "environment": { "type": "string", "enum": ["dev", "staging", "production"] },
    "targets": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["provider"],
        "properties": {
          "provider": { "type": "string", "enum": ["github-actions", "cloudflare-pages", "netlify", "vercel"] },
          "projectName": { "type": "string" },
          "siteId": { "type": "string" },
          "vercelProjectId": { "type": "string" },
          "customDomain": { "type": "string" },
          "branch": { "type": "string" }
        }
      }
    },
    "build": {
      "type": "object", "additionalProperties": false, "required": ["entry", "extraFiles"],
      "properties": {
        "entry": { "type": "string", "enum": ["index.html", "astro"] },
        "extraFiles": { "type": "array", "items": { "type": "string" } }
      }
    },
    "tracking": {
      "type": "object", "additionalProperties": false, "required": ["googleAdsId", "pixelEndpoint", "voluumDomain"],
      "properties": {
        "googleAdsId": { "type": "string" },
        "pixelEndpoint": { "type": "string" },
        "voluumDomain": { "type": "string" }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false, "required": ["requestedBy", "requestedAt", "requestId", "commitMessage"],
      "properties": {
        "requestedBy": { "type": "string" },
        "requestedAt": { "type": "string" },
        "requestId": { "type": "string" },
        "commitMessage": { "type": "string" },
        "deployRecordId": { "type": "string" }
      }
    }
  }
};

async function ensureGithubBranch(token, owner, repo, branchName, sourceBranch) {
  try {
    await githubApi(token, `/repos/${owner}/${repo}/git/ref/${encodeURIComponent(`heads/${branchName}`)}`);
    return;
  } catch (e) {
    if (e?.status !== 404) throw e;
  }
  const sourceRef = await githubApi(token, `/repos/${owner}/${repo}/git/ref/${encodeURIComponent(`heads/${sourceBranch}`)}`);
  const sha = sourceRef?.object?.sha;
  if (!sha) throw new Error(`Cannot resolve source branch ${sourceBranch}`);
  await githubApi(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
}

// Column whitelists for PUT endpoints (SQL injection protection)
const ALLOWED_COLS = {
  domains: new Set(['domain', 'registrar', 'accountId', 'profileId', 'cfAccountId', 'zoneId', 'nameservers', 'status', 'registrarAccountId']),
  accounts: new Set(['label', 'email', 'paymentId', 'budget', 'status', 'cardUuid', 'cardLast4', 'cardStatus', 'profileId', 'proxyIp', 'monthlySpend']),
  profiles: new Set(['name', 'proxyIp', 'browserType', 'os', 'status', 'mlProfileId', 'mlFolderId', 'proxyHost', 'proxyPort', 'proxyUser', 'fingerprintOs']),
  payments: new Set(['label', 'type', 'last4', 'bankName', 'status', 'lcCardUuid', 'lcBinUuid', 'cardLimit', 'cardExpiry', 'totalSpend']),
};

// Secret keys that should never be returned in API responses
const SECRET_KEYS = new Set(['apiKey', 'geminiKey', 'netlifyToken', 'lcToken', 'mlToken', 'mlPassword', 'githubToken']);

function redactSettings(obj) {
  const safe = {};
  for (const [k, v] of Object.entries(obj)) {
    safe[k] = SECRET_KEYS.has(k) ? (v ? '••••' : '') : v;
  }
  return safe;
}

// Convert snake_case DB columns to camelCase for frontend
function snakeToCamel(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

// ═══════════════════════════════════════════
// PROXY HANDLER — forwards requests to external APIs
// Handles CORS by proxying through the Worker
// ═══════════════════════════════════════════
const PROXY_TARGETS = {
  '/api/proxy/cf/': 'https://api.cloudflare.com/client/v4/',
  '/api/proxy/mlx/': 'https://api.multilogin.com/',
  '/api/proxy/netlify/': 'https://api.netlify.com/api/v1/',
};

async function handleProxy(request, url) {
  let targetBase = null;
  let strippedPath = url.pathname;

  for (const [prefix, base] of Object.entries(PROXY_TARGETS)) {
    if (url.pathname.startsWith(prefix)) {
      targetBase = base;
      strippedPath = url.pathname.slice(prefix.length);
      break;
    }
  }

  // Check for generic pass-through: /api/proxy/pass?url=<encoded-target>
  if (!targetBase && url.pathname === '/api/proxy/pass') {
    const passUrl = url.searchParams.get('url');
    if (!passUrl) return json({ error: 'Missing ?url= parameter' }, 400);
    // Only allow HTTPS targets
    if (!passUrl.startsWith('https://')) return json({ error: 'Only HTTPS targets allowed' }, 400);
    const targetUrl = passUrl;
    const proxyHeaders = new Headers(request.headers);
    // Strip headers that expose original client IP — targets see Worker IP only
    proxyHeaders.delete('host');
    proxyHeaders.delete('origin');
    proxyHeaders.delete('referer');
    proxyHeaders.delete('x-forwarded-for');
    proxyHeaders.delete('x-real-ip');
    proxyHeaders.delete('cf-connecting-ip');
    proxyHeaders.delete('cf-ipcountry');
    proxyHeaders.delete('cf-ray');
    proxyHeaders.delete('cf-visitor');
    try {
      const proxyRes = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow',
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
      return json({ error: e.message }, 502);
    }
  }

  if (!targetBase) return null; // not a proxy route

  const targetUrl = `${targetBase}${strippedPath}${url.search}`;

  const proxyHeaders = new Headers(request.headers);
  // Strip headers that expose original client IP — targets see Worker IP only
  proxyHeaders.delete('host');
  proxyHeaders.delete('origin');
  proxyHeaders.delete('referer');
  proxyHeaders.delete('x-forwarded-for');
  proxyHeaders.delete('x-real-ip');
  proxyHeaders.delete('cf-connecting-ip');
  proxyHeaders.delete('cf-ipcountry');
  proxyHeaders.delete('cf-ray');
  proxyHeaders.delete('cf-visitor');

  try {
    const proxyRes = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
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
    return json({ error: e.message }, 502);
  }
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ═══ PROXY ROUTES (no auth required — proxy forwards auth headers) ═══
    if (path.startsWith('/api/proxy/')) {
      const proxyRes = await handleProxy(request, url);
      if (proxyRes) return proxyRes;
    }

    // ═══ VPS DEPLOY (SSH via Worker — limited, returns instructions) ═══
    if (path === '/api/deploy/vps' && method === 'POST') {
      // CF Workers cannot open SSH connections.
      // This endpoint writes the HTML to a KV/R2 download link,
      // then returns instructions for the user to rsync it manually.
      try {
        const body = await request.json();
        const { html, host, user, remotePath, siteName } = body;
        if (!html) return json({ error: 'Missing html in body' }, 400);

        // Store HTML temporarily in D1 for download
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO vps_deploys (id, html, host, created_at) VALUES (?, ?, ?, ?)'
        ).bind(id, html, host || 'unknown', new Date().toISOString()).run().catch(() => { });

        const downloadUrl = `${url.origin}/api/deploy/vps/download/${id}`;
        const sshCmd = `curl -sL "${downloadUrl}" -o /tmp/index.html && scp /tmp/index.html ${user}@${host}:${remotePath}/index.html`;

        return json({
          success: true,
          url: `http://${host}${remotePath?.endsWith('/') ? remotePath : (remotePath || '/') + '/'}`,
          downloadUrl,
          sshCommand: sshCmd,
          note: 'CF Workers cannot SSH directly. Use the download URL or command above.',
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // VPS deploy download endpoint
    if (path.startsWith('/api/deploy/vps/download/') && method === 'GET') {
      const id = path.split('/').pop();
      try {
        const row = await env.DB.prepare('SELECT html FROM vps_deploys WHERE id = ?').bind(id).first();
        if (!row) return json({ error: 'Not found or expired' }, 404);
        return new Response(row.html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ OPENAPI SPEC (public — for API discovery) ═══
    if (path === '/api/openapi.json' && method === 'GET') {
      const spec = {
        openapi: '3.0.3',
        info: {
          title: 'LP Factory Automation API',
          version: '2.1.0',
          description: 'Automation endpoints for LP Factory V2',
        },
        servers: [{ url: 'https://lp-factory-api.songsawat-w.workers.dev', description: 'Production' }],
        tags: [
          { name: 'Registrar', description: 'Domain registrar operations (Internet.bs)' },
          { name: 'Cloudflare', description: 'Cloudflare DNS and zone management' },
          { name: 'Deploy', description: 'Deployment platform linking' },
          { name: 'LeadingCards', description: 'Virtual card management' },
          { name: 'Multilogin', description: 'Browser profile automation' },
        ],
        paths: {
          '/api/automation/registrar/check': {
            post: {
              tags: ['Registrar'],
              summary: 'Check domain availability',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'provider'],
                      properties: {
                        domain: { type: 'string', example: 'example.com' },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/register': {
            post: {
              tags: ['Registrar'],
              summary: 'Register a domain',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'provider'],
                      properties: {
                        domain: { type: 'string' },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                        period: { type: 'string', default: '1Y' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/nameservers': {
            put: {
              tags: ['Registrar'],
              summary: 'Update domain nameservers',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'nameservers', 'provider'],
                      properties: {
                        domain: { type: 'string' },
                        nameservers: { type: 'array', items: { type: 'string' } },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/import': {
            post: {
              tags: ['Registrar'],
              summary: 'Import all domains',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['provider'],
                      properties: {
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/ping': {
            post: {
              tags: ['Registrar'],
              summary: 'Test registrar connection',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['provider'],
                      properties: {
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/cf-validate': {
            post: {
              tags: ['Cloudflare'],
              summary: 'Validate Cloudflare API token and account ID',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['accountId', 'apiToken'],
                      properties: {
                        accountId: { type: 'string' },
                        apiToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Valid credentials' },
                '400': { description: 'Invalid credentials' },
              },
            },
          },
          '/api/automation/cf/zone': {
            post: {
              tags: ['Cloudflare'],
              summary: 'Create or get zone',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'cfAccountId'],
                      properties: {
                        domain: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/cf/dns': {
            get: {
              tags: ['Cloudflare'],
              summary: 'List DNS records',
              parameters: [
                { name: 'zoneId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'cfAccountId', in: 'query', required: true, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Cloudflare'],
              summary: 'Create DNS record',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['zoneId', 'cfAccountId', 'type', 'name', 'content'],
                      properties: {
                        zoneId: { type: 'string' },
                        cfAccountId: { type: 'string' },
                        type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'TXT', 'NS', 'MX', 'SRV'] },
                        name: { type: 'string' },
                        content: { type: 'string' },
                        ttl: { type: 'integer', default: 3600 },
                        proxied: { type: 'boolean', default: false },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
            put: {
              tags: ['Cloudflare'],
              summary: 'Update DNS record',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['dnsRecordId', 'zoneId', 'cfAccountId'],
                      properties: {
                        dnsRecordId: { type: 'string' },
                        zoneId: { type: 'string' },
                        cfAccountId: { type: 'string' },
                        type: { type: 'string' },
                        name: { type: 'string' },
                        content: { type: 'string' },
                        ttl: { type: 'integer' },
                        proxied: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
            delete: {
              tags: ['Cloudflare'],
              summary: 'Delete DNS record',
              parameters: [
                { name: 'dnsRecordId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'zoneId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'cfAccountId', in: 'query', required: true, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/vercel': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Vercel project',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['projectName', 'accessToken'],
                      properties: {
                        projectName: { type: 'string' },
                        accessToken: { type: 'string' },
                        teamId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/netlify': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Netlify site',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['siteName', 'accessToken'],
                      properties: {
                        siteName: { type: 'string' },
                        accessToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/cf-pages': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Cloudflare Pages project',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['projectName', 'cfAccountId'],
                      properties: {
                        projectName: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/cf-workers': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Cloudflare Workers script',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['scriptName', 'cfAccountId'],
                      properties: {
                        scriptName: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/create': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Create virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        limit: { type: 'number' },
                        currency: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/block': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Block virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid'],
                      properties: {
                        cardUuid: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/activate': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Activate virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid'],
                      properties: {
                        cardUuid: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/change_limit': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Change card limit',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid', 'limit'],
                      properties: {
                        cardUuid: { type: 'string' },
                        limit: { type: 'number' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/d1/query': {
            post: {
              tags: ['D1 Database'],
              summary: 'Execute SQL query on D1 database',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['sql', 'accountId', 'databaseId'],
                      properties: {
                        sql: { type: 'string', description: 'SQL query with ? placeholders' },
                        params: { type: 'array', description: 'Parameters for prepared statement' },
                        accountId: { type: 'string', description: 'Cloudflare Account ID' },
                        databaseId: { type: 'string', description: 'D1 Database UUID' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Query results' },
                '400': { description: 'Bad request' },
              },
            },
          },
          '/api/automation/d1/execute': {
            post: {
              tags: ['D1 Database'],
              summary: 'Execute SQL command (INSERT, UPDATE, DELETE)',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['sql', 'accountId', 'databaseId'],
                      properties: {
                        sql: { type: 'string', description: 'SQL command' },
                        params: { type: 'array', description: 'Parameters for prepared statement' },
                        accountId: { type: 'string', description: 'Cloudflare Account ID' },
                        databaseId: { type: 'string', description: 'D1 Database UUID' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Command executed' },
                '400': { description: 'Bad request' },
              },
            },
          },
          '/api/automation/ml/signin': {
            post: {
              tags: ['Multilogin'],
              summary: 'Sign in to Multilogin',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/refresh_token': {
            post: {
              tags: ['Multilogin'],
              summary: 'Refresh Multilogin token',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles': {
            get: {
              tags: ['Multilogin'],
              summary: 'List Multilogin profiles',
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Multilogin'],
              summary: 'Create Multilogin profile',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/start': {
            post: {
              tags: ['Multilogin'],
              summary: 'Start Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/stop': {
            post: {
              tags: ['Multilogin'],
              summary: 'Stop Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/clone': {
            post: {
              tags: ['Multilogin'],
              summary: 'Clone Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
        },
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'API_SECRET',
            },
          },
        },
      };
      return json(spec);
    }

    // Auth check — if API_SECRET is set, require Bearer token
    if (env.API_SECRET) {
      const auth = request.headers.get('Authorization');
      if (!auth || auth !== `Bearer ${env.API_SECRET}`) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    const db = env.DB;

    try {
      // ═══ SITES ═══
      if (path === '/api/sites' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
        return json(results);
      }

      if (path === '/api/sites' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare(`
          INSERT INTO sites (id, brand, domain, tagline, email, loan_type, amount_min, amount_max,
            apr_min, apr_max, color_id, font_id, layout, radius, h1, badge, cta, sub,
            gtm_id, network, redirect_url, conversion_id, conversion_label,
            copy_id, sections, compliance, status, cost, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.brand || '', body.domain || '', body.tagline || '', body.email || '',
          body.loanType || 'personal', body.amountMin || 100, body.amountMax || 5000,
          body.aprMin || 5.99, body.aprMax || 35.99,
          body.colorId || 'ocean', body.fontId || 'dm-sans', body.layout || 'hero-left',
          body.radius || 'rounded', body.h1 || '', body.badge || '', body.cta || '', body.sub || '',
          body.gtmId || '', body.network || 'LeadsGate', body.redirectUrl || '',
          body.conversionId || '', body.conversionLabel || '',
          body.copyId || '', body.sections || 'default', body.compliance || 'standard',
          body.status || 'completed', body.cost || 0, body.createdBy || ''
        ).run();
        return json({ id, success: true }, 201);
      }

      if (path.match(/^\/api\/sites\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      if (path.match(/^\/api\/sites\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json();

        const fields = [];
        const values = [];
        const map = [
          ['brand', 'brand'],
          ['domain', 'domain'],
          ['tagline', 'tagline'],
          ['email', 'email'],
          ['loanType', 'loan_type'],
          ['amountMin', 'amount_min'],
          ['amountMax', 'amount_max'],
          ['aprMin', 'apr_min'],
          ['aprMax', 'apr_max'],
          ['colorId', 'color_id'],
          ['fontId', 'font_id'],
          ['layout', 'layout'],
          ['radius', 'radius'],
          ['h1', 'h1'],
          ['badge', 'badge'],
          ['cta', 'cta'],
          ['sub', 'sub'],
          ['gtmId', 'gtm_id'],
          ['network', 'network'],
          ['redirectUrl', 'redirect_url'],
          ['conversionId', 'conversion_id'],
          ['conversionLabel', 'conversion_label'],
          ['copyId', 'copy_id'],
          ['sections', 'sections'],
          ['compliance', 'compliance'],
          ['status', 'status'],
          ['cost', 'cost'],
        ];

        for (const [from, to] of map) {
          if (Object.prototype.hasOwnProperty.call(body, from)) {
            fields.push(`${to} = ?`);
            values.push(body[from]);
          }
        }

        if (fields.length === 0) {
          return json({ error: 'No updatable fields provided' }, 400);
        }

        values.push(id);
        await db.prepare(`UPDATE sites SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
        return json({ success: true });
      }

      // ═══ DEPLOYS ═══
      if (path === '/api/deploys' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM deploys ORDER BY created_at DESC LIMIT 100').all();
        return json(results);
      }

      if (path === '/api/deploys' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare(`
          INSERT INTO deploys (id, site_id, brand, url, type, deployed_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(id, body.siteId || '', body.brand || '', body.url || '', body.type || 'new', body.deployedBy || '').run();
        return json({ id, success: true }, 201);
      }

      if (path.startsWith('/api/deploys/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await db.prepare('DELETE FROM deploys WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ═══ VARIANTS ═══
      if (path === '/api/variants' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM variants ORDER BY created_at DESC').all();
        return json(results);
      }

      if (path === '/api/variants' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare(`
          INSERT INTO variants (id, color_id, font_id, layout, radius, copy_id, sections, compliance, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.colorId || 'ocean', body.fontId || 'dm-sans', body.layout || 'hero-left',
          body.radius || 'rounded', body.copyId || 'smart', body.sections || 'default',
          body.compliance || 'standard', body.createdBy || ''
        ).run();
        return json({ id, success: true }, 201);
      }

      if (path === '/api/variants/batch' && method === 'POST') {
        const body = await request.json();
        const items = body.variants || [];
        const stmt = db.prepare(`
          INSERT INTO variants (id, color_id, font_id, layout, radius, copy_id, sections, compliance, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const batch = items.map(v => stmt.bind(
          v.id || uid(), v.colorId, v.fontId, v.layout, v.radius, v.copyId, v.sections, v.compliance, v.createdBy || ''
        ));
        await db.batch(batch);
        return json({ success: true, count: items.length }, 201);
      }

      if (path.match(/^\/api\/variants\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        await db.prepare('DELETE FROM variants WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ═══ TEMPLATES ═══
      if (path === '/api/templates' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
        return json(results);
      }

      if (path === '/api/templates' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        const now = new Date().toISOString();

        // Check if template_id already exists
        const existing = await db.prepare('SELECT id FROM templates WHERE template_id = ?').bind(body.templateId || '').first();
        if (existing) {
          return json({ error: 'Template ID already exists' }, 400);
        }

        await db.prepare(`
          INSERT INTO templates (id, template_id, name, description, category, badge, source_code, files, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.templateId || '',
          body.name || '',
          body.description || '',
          body.category || 'general',
          body.badge || 'New',
          body.sourceCode || '',
          body.files ? JSON.stringify(body.files) : '{}',
          now
        ).run();
        return json({ id, success: true }, 201);
      }

      if (path.match(/^\/api\/templates\/[\w-]+$/) && method === 'GET') {
        const id = path.split('/').pop();
        const template = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
        if (!template) return json({ error: 'Template not found' }, 404);
        return json(template);
      }

      if (path.match(/^\/api\/templates\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        await db.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ═══ OPS: DOMAINS ═══
      if (path === '/api/ops/domains' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM ops_domains ORDER BY created_at DESC').all();
        return json(results);
      }
      if (path === '/api/ops/domains' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare('INSERT INTO ops_domains (id, domain, registrar, account_id, profile_id, cf_account_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(id, body.domain || '', body.registrar || '', body.accountId || '', body.profileId || '', body.cfAccountId || '', body.status || 'active').run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added domain: ${body.domain}`).run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/ops\/domains\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        const item = await db.prepare('SELECT domain FROM ops_domains WHERE id = ?').bind(id).first();
        await db.prepare('DELETE FROM ops_domains WHERE id = ?').bind(id).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted domain: ${item?.domain || id}`).run();
        return json({ success: true });
      }
      if (path.match(/^\/api\/ops\/domains\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json();
        const sets = [];
        const vals = [];
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id' || key === 'createdAt') continue;
          if (!ALLOWED_COLS.domains.has(key)) continue;
          if (key === 'nameservers') {
            const nsValue = Array.isArray(value) ? JSON.stringify(value) : String(value || '');
            sets.push('nameservers = ?');
            vals.push(nsValue);
            continue;
          }
          sets.push(`${camelToSnake(key)} = ?`);
          vals.push(value);
        }
        if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
        vals.push(id);
        await db.prepare(`UPDATE ops_domains SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated domain: ${id}`).run();
        return json({ success: true });
      }

      // ═══ OPS: ACCOUNTS ═══
      if (path === '/api/ops/accounts' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM ops_accounts ORDER BY created_at DESC').all();
        return json(results);
      }
      if (path === '/api/ops/accounts' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare('INSERT INTO ops_accounts (id, label, email, payment_id, budget, status, card_uuid, card_last4, card_status, profile_id, proxy_ip, monthly_spend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, body.label || '', body.email || '', body.paymentId || '', body.budget || '', body.status || 'active',
            body.cardUuid || '', body.cardLast4 || '', body.cardStatus || '', body.profileId || '', body.proxyIp || '', body.monthlySpend || 0).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added account: ${body.label}`).run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/ops\/accounts\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        const item = await db.prepare('SELECT label FROM ops_accounts WHERE id = ?').bind(id).first();
        await db.prepare('DELETE FROM ops_accounts WHERE id = ?').bind(id).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted account: ${item?.label || id}`).run();
        return json({ success: true });
      }
      if (path.match(/^\/api\/ops\/accounts\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json();
        const sets = [];
        const vals = [];
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id' || key === 'createdAt') continue;
          if (!ALLOWED_COLS.accounts.has(key)) continue;
          sets.push(`${camelToSnake(key)} = ?`);
          vals.push(value);
        }
        if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
        vals.push(id);
        await db.prepare(`UPDATE ops_accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated account: ${id}`).run();
        return json({ success: true });
      }

      // ═══ OPS: PROFILES ═══
      if (path === '/api/ops/profiles' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM ops_profiles ORDER BY created_at DESC').all();
        return json(results);
      }
      if (path === '/api/ops/profiles' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare('INSERT INTO ops_profiles (id, name, proxy_ip, browser_type, os, status, ml_profile_id, ml_folder_id, proxy_host, proxy_port, proxy_user, fingerprint_os) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, body.name || '', body.proxyIp || '', body.browserType || '', body.os || '', body.status || 'active',
            body.mlProfileId || '', body.mlFolderId || '', body.proxyHost || '', body.proxyPort || '', body.proxyUser || '', body.fingerprintOs || '').run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added profile: ${body.name}`).run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/ops\/profiles\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        const item = await db.prepare('SELECT name FROM ops_profiles WHERE id = ?').bind(id).first();
        await db.prepare('DELETE FROM ops_profiles WHERE id = ?').bind(id).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted profile: ${item?.name || id}`).run();
        return json({ success: true });
      }
      if (path.match(/^\/api\/ops\/profiles\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json();
        const sets = [];
        const vals = [];
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id' || key === 'createdAt') continue;
          if (!ALLOWED_COLS.profiles.has(key)) continue;
          sets.push(`${camelToSnake(key)} = ?`);
          vals.push(value);
        }
        if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
        vals.push(id);
        await db.prepare(`UPDATE ops_profiles SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated profile: ${id}`).run();
        return json({ success: true });
      }

      // ═══ OPS: PAYMENTS ═══
      if (path === '/api/ops/payments' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM ops_payments ORDER BY created_at DESC').all();
        return json(results);
      }
      if (path === '/api/ops/payments' && method === 'POST') {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare('INSERT INTO ops_payments (id, label, type, last4, bank_name, status, lc_card_uuid, lc_bin_uuid, card_limit, card_expiry, total_spend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, body.label || '', body.type || '', body.last4 || '', body.bankName || '', body.status || 'active',
            body.lcCardUuid || '', body.lcBinUuid || '', body.cardLimit || 0, body.cardExpiry || '', body.totalSpend || 0).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added payment: ${body.label}`).run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/ops\/payments\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        const item = await db.prepare('SELECT label FROM ops_payments WHERE id = ?').bind(id).first();
        await db.prepare('DELETE FROM ops_payments WHERE id = ?').bind(id).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted payment: ${item?.label || id}`).run();
        return json({ success: true });
      }
      if (path.match(/^\/api\/ops\/payments\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json();
        const sets = [];
        const vals = [];
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id' || key === 'createdAt') continue;
          if (!ALLOWED_COLS.payments.has(key)) continue;
          sets.push(`${camelToSnake(key)} = ?`);
          vals.push(value);
        }
        if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
        vals.push(id);
        await db.prepare(`UPDATE ops_payments SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated payment: ${id}`).run();
        return json({ success: true });
      }

      // ═══ OPS: LOGS ═══
      if (path === '/api/ops/logs' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM ops_logs ORDER BY created_at DESC LIMIT 200').all();
        return json(results);
      }

      // ═══ SETTINGS ═══
      if (path === '/api/settings' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM settings').all();
        const obj = {};
        results.forEach(r => { obj[r.key] = r.value; });
        return json(obj);
      }

      if (path === '/api/settings' && method === 'POST') {
        const body = await request.json();
        for (const [key, value] of Object.entries(body)) {
          await db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
          `).bind(key, String(value), String(value)).run();
        }
        return json({ success: true });
      }

      // ═══ AI: GENERATION ═══
      if (path === "/api/ai/generate-copy" && method === "POST") {
        try {
          const body = await request.json();
          const settingsRow = await db.prepare("SELECT * FROM settings WHERE key = 'geminiKey'").first();
          const key = (settingsRow?.value || "").trim();

          if (!key || isMaskedSecret(key)) {
            return json({ error: "Gemini Key not configured or invalid" }, 400);
          }

          const prompt = `Generate high-converting loan landing page copy.
            Brand: "${body.brand || "ElasticCredits"}"
            Loan Type: "${body.loanType || "Personal"}"
            Amount Range: $${body.amountMin || 100}-$${body.amountMax || 5000}
            Language: ${body.lang || "English"}
            Format: Strict JSON object only. No markdown.
            Structure: {"h1":"","badge":"","cta":"","sub":"","tagline":"","trust_msg":""}`;

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });

          if (!res.ok) {
            const errDetail = await res.text().catch(() => "Unknown error");
            console.error("[AI] Gemini API error:", res.status, errDetail);
            return json({ error: `Gemini API Error (${res.status})`, details: errDetail }, 502);
          }

          const d = await res.json();
          const candidate = d.candidates?.[0];
          if (!candidate) {
            console.error("[AI] No candidates returned from Gemini", d);
            return json({ error: "AI failed to generate a response", details: d }, 500);
          }

          const text = candidate.content?.parts?.[0]?.text?.replace(/```json|```/g, "").trim();
          if (!text) {
            return json({ error: "AI returned empty text" }, 500);
          }

          try {
            return json(JSON.parse(text));
          } catch (pe) {
            console.warn("[AI] JSON Parse error for text:", text);
            return json({ error: "AI Format Error (Invalid JSON)", raw: text }, 500);
          }
        } catch (e) {
          console.error("[AI] Unexpected error in generate-copy:", e.message);
          return json({ error: `Internal Server Error: ${e.message}` }, 500);
        }

      }


      if (path === "/api/ai/generate-assets" && method === "POST") {
        const body = await request.json();
        const settingsRes = await db.prepare("SELECT * FROM settings WHERE key = 'geminiKey'").first();
        const key = settingsRes?.value;
        if (!key) return json({ error: "Gemini Key not configured" }, 400);

        const type = body.type || "logo";
        const promptGen = `Act as an expert AI prompt engineer.Create a highly detailed, professional prompt for an image generator(DALL - E 3 style).
            Brand: "${body.brand}"
          Context: "${type === 'logo' ? 'Fintech logo design' : 'High-converting hero background for loan site'}"
          Style: "${body.style || 'Modern & Clean'}"
          Requirements: ${type === 'logo' ? 'Flat vector, minimalist, white background, no text except brand' : 'Photorealistic, soft lighting, lots of copy space, 16:9'}
          Output: ONLY the refined prompt text.No chatter.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptGen }] }] })
        });
        const d = await res.json();
        const refinedPrompt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Modern fintech visual";

        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(refinedPrompt)}?width=${type === 'logo' ? 512 : 1280}&height=${type === 'logo' ? 512 : 720}&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

        return json({ url: imageUrl, prompt: refinedPrompt });
      }

      // ═══ CF ACCOUNTS ═══
      if (path === "/api/cf-accounts" && method === "GET") {
        const { results } = await db.prepare("SELECT * FROM cf_accounts ORDER BY label ASC").all();
        return json(results);
      }
      if (path === "/api/cf-accounts" && method === "POST") {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare("INSERT INTO cf_accounts (id, email, api_key, api_token, account_id, label) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, body.email || "", body.apiKey || "", body.apiToken || "", body.accountId || "", body.label || "").run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/cf-accounts\/[\w-]+$/) && method === "DELETE") {
        const id = path.split("/").pop();
        await db.prepare("DELETE FROM cf_accounts WHERE id = ?").bind(id).run();
        return json({ success: true });
      }

      // ═══ REGISTRAR ACCOUNTS ═══
      if (path === "/api/registrar-accounts" && method === "GET") {
        const { results } = await db.prepare("SELECT * FROM registrar_accounts ORDER BY provider ASC, label ASC").all();
        return json(results);
      }
      if (path === "/api/registrar-accounts" && method === "POST") {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare("INSERT INTO registrar_accounts (id, provider, label, api_key, secret_key) VALUES (?, ?, ?, ?, ?)")
          .bind(id, body.provider || "internetbs", body.label || "", body.apiKey || "", body.secretKey || "").run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added registrar account: ${body.label || body.provider}`).run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/registrar-accounts\/[\w-]+$/) && method === "DELETE") {
        const id = path.split("/").pop();
        await db.prepare("DELETE FROM registrar_accounts WHERE id = ?").bind(id).run();
        return json({ success: true });
      }

      // ═══ DEPLOYMENT HISTORY ═══
      if (path === "/api/ops/deployments" && method === "GET") {
        const domain = url.searchParams.get("domain") || "";
        const status = url.searchParams.get("status") || "";
        const target = url.searchParams.get("target") || "";
        const limitRaw = url.searchParams.get("limit");
        const limit = Number.parseInt(limitRaw || "50", 10);
        let query = "SELECT * FROM ops_deployments";
        const conditions = [];
        const params = [];

        if (domain) {
          conditions.push("domain = ?");
          params.push(domain);
        }
        if (status) {
          conditions.push("status = ?");
          params.push(status);
        }
        if (target) {
          conditions.push("target = ?");
          params.push(target);
        }

        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY created_at DESC LIMIT " + (Number.isFinite(limit) && limit > 0 ? limit : 50);

        try {
          const stmt = db.prepare(query);
          const { results } = await stmt.bind(...params).all();
          return json((results || []).map(snakeToCamel));
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deployments")) {
            return json([]);
          }
          throw e;
        }
      }

      if (path === "/api/ops/deployments" && method === "POST") {
        const body = await request.json();
        const id = body.id || uid();
        const now = new Date().toISOString();

        try {
          await db.prepare(`
            INSERT INTO ops_deployments (id, domain_id, domain, target, environment, url, status, config, deployed_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id,
            body.domainId || "",
            body.domain || "",
            body.target || "",
            body.environment || "production",
            body.url || "",
            body.status || "pending",
            JSON.stringify(body.config || {}),
            body.deployedBy || "",
            now,
            now
          ).run();

          await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)')
            .bind(uid(), `Deployment started: ${body.domain} to ${body.target}`).run();

          return json({ id, success: true }, 201);
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deployments")) {
            return json({ id: null, success: false, skipped: true, error: "ops_deployments table not found" });
          }
          throw e;
        }
      }

      if (path === "/api/ops/deployments/git-push" && method === "POST") {
        const body = await request.json();
        const siteId = body.siteId || body.domainId || uid();
        const deployRecordId = body.deployRecordId || "";
        const branch = body.branch || "main";
        const environment = body.environment || "production";
        const files = body.files && typeof body.files === "object" ? body.files : null;
        if (!files) {
          return json({ success: false, error: "Missing files payload" }, 400);
        }

        const hasIndexHtml = !!files["index.html"];
        const isAstroProject =
          (!!files["package.json"] && (!!files["astro.config.mjs"] || !!files["astro.config.ts"]))
          || !!files["src/pages/index.astro"];

        if (!hasIndexHtml && !isAstroProject) {
          return json({
            success: false,
            error: "Unsupported payload: provide index.html or an Astro project (package.json + astro.config.* or src/pages/index.astro)",
          }, 400);
        }

        const settingsRows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('githubToken','githubRepoOwner','githubRepoName','githubRepoBranch','githubDeployWorkflow')").all();
        const settingsObj = {};
        (settingsRows?.results || []).forEach(r => {
          settingsObj[r.key] = r.value;
        });

        const requestToken = String(body.githubToken || "").trim();
        const token = String(
          (requestToken && !isMaskedSecret(requestToken))
            ? requestToken
            : (settingsObj.githubToken || "")
        ).trim();
        const repoOwner = String(body.repoOwner || settingsObj.githubRepoOwner || "").trim();
        const repoName = String(body.repoName || settingsObj.githubRepoName || "").trim();
        const sourceBranch = String(branch || settingsObj.githubRepoBranch || "main").trim() || "main";
        const deployBranch = "deploy/auto";

        if (!token || !repoOwner || !repoName) {
          return json({
            success: false,
            error: "GitHub pipeline not configured. Set githubToken/githubRepoOwner/githubRepoName in Settings.",
          }, 400);
        }

        const safeSiteFolder = String(siteId).replace(/[^a-zA-Z0-9_-]/g, "-");
        const basePath = `sites/${safeSiteFolder}`;
        const manifest = {
          version: 1,
          siteId,
          brand: body.brand || "",
          templateId: body.templateId || "classic",
          environment,
          targets: Array.isArray(body.targets) && body.targets.length ? body.targets : [{ provider: "github-actions" }],
          build: hasIndexHtml
            ? { entry: "index.html", extraFiles: Object.keys(files).filter(name => name !== "index.html") }
            : { entry: "astro", extraFiles: Object.keys(files) },
          tracking: {
            googleAdsId: body.tracking?.googleAdsId || "",
            pixelEndpoint: body.tracking?.pixelEndpoint || "",
            voluumDomain: body.tracking?.voluumDomain || "",
          },
          meta: {
            requestedBy: body.requestedBy || "unknown",
            requestedAt: new Date().toISOString(),
            requestId: body.requestId || uid(),
            commitMessage: body.commitMessage || `deploy(${siteId}): ${body.brand || body.domain || siteId}`,
            deployRecordId,
          },
        };

        const commitMessage = manifest.meta.commitMessage;
        const writeEntries = Object.entries(files).map(([name, content]) => {
          const cleanName = String(name || "").replace(/^\/+/, "");
          return [`${basePath}/${cleanName}`, String(content ?? "")];
        });
        writeEntries.push([`${basePath}/deploy-manifest.json`, JSON.stringify(manifest, null, 2)]);

        try {
          await ensureGithubBranch(token, repoOwner, repoName, deployBranch, sourceBranch);

          writeEntries.push(["schemas/deploy-manifest.schema.json", JSON.stringify(DEPLOY_MANIFEST_SCHEMA, null, 2)]);

          for (const [filePath, content] of writeEntries) {
            await upsertGithubFile({
              token,
              owner: repoOwner,
              repo: repoName,
              branch: deployBranch,
              filePath,
              content,
              message: commitMessage,
            });
          }

          const commitInfo = await githubApi(token, `/repos/${repoOwner}/${repoName}/commits/${encodeURIComponent(deployBranch)}`);
          const commitSha = commitInfo?.sha || "";
          const commitUrl = commitInfo?.html_url || `https://github.com/${repoOwner}/${repoName}/commit/${commitSha}`;
          const workflowFile = String(body.workflowFile || settingsObj.githubDeployWorkflow || "deploy-sites.yml").trim() || "deploy-sites.yml";
          const workflowUrl = `https://github.com/${repoOwner}/${repoName}/actions/workflows/${workflowFile}`;
          let workflowDispatched = false;
          let workflowDispatchError = "";

          try {
            await githubApi(token, `/repos/${repoOwner}/${repoName}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
              method: "POST",
              body: JSON.stringify({
                ref: deployBranch,
                inputs: {
                  site_id: String(siteId),
                  environment: String(environment),
                  deploy_record_id: String(deployRecordId || ""),
                },
              }),
            });
            workflowDispatched = true;
          } catch (dispatchError) {
            workflowDispatchError = String(dispatchError?.message || dispatchError || "");
          }

          return json({
            success: true,
            queued: true,
            deployId: `git-${siteId}-${Date.now()}`,
            branch: deployBranch,
            commitSha,
            commitUrl,
            workflowUrl,
            workflowDispatched,
            workflowDispatchError,
            url: workflowUrl,
            message: "Artifacts committed to GitHub. CI pipeline should deploy shortly.",
          });
        } catch (e) {
          return json({
            success: false,
            error: `Git push failed: ${e?.message || e}`,
          }, 500);
        }
      }

      if (path.match(/^\/api\/ops\/deployments\/[\w-]+$/) && method === "PATCH") {
        const id = path.split("/").pop();
        const body = await request.json();
        const sets = [];
        const vals = [];

        if (body.status !== undefined) {
          sets.push("status = ?");
          vals.push(body.status);
        }
        if (body.url !== undefined) {
          sets.push("url = ?");
          vals.push(body.url);
        }
        if (body.errorMessage !== undefined) {
          sets.push("error_message = ?");
          vals.push(body.errorMessage);
        }
        if (body.durationMs !== undefined) {
          sets.push("duration_ms = ?");
          vals.push(body.durationMs);
        }

        if (sets.length > 0) {
          sets.push("updated_at = ?");
          vals.push(new Date().toISOString());
          vals.push(id);

          await db.prepare(`UPDATE ops_deployments SET ${sets.join(", ")} WHERE id = ?`)
            .bind(...vals).run();
        }

        return json({ success: true });
      }

      if (path === "/api/ops/deployments/stats" && method === "GET") {
        const domain = url.searchParams.get("domain") || "";
        const params = [];
        const baseConditions = [];
        if (domain) {
          baseConditions.push("domain = ?");
          params.push(domain);
        }
        const whereWith = (extra) => {
          const conditions = [...baseConditions];
          if (extra) conditions.push(extra);
          return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        };

        try {
          const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("")}`);
          const successStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("status = 'success'")}`);
          const failedStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("status = 'failed'")}`);
          const avgDurationStmt = db.prepare(`SELECT AVG(duration_ms) as avg FROM ops_deployments ${whereWith("status = 'success' AND duration_ms > 0")}`);
          const last24hStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("created_at >= datetime('now', '-24 hours')")}`);

          const [total, success, failed, avgDuration, last24h] = await Promise.all([
            totalStmt.bind(...params).first(),
            successStmt.bind(...params).first(),
            failedStmt.bind(...params).first(),
            avgDurationStmt.bind(...params).first(),
            last24hStmt.bind(...params).first(),
          ]);

          const totalCount = total?.count || 0;
          const successCount = success?.count || 0;
          const failedCount = failed?.count || 0;

          return json({
            total: totalCount,
            success: successCount,
            failed: failedCount,
            successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
            avgDurationMs: Math.round(avgDuration?.avg || 0),
            last24h: last24h?.count || 0,
          });
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deployments")) {
            return json({
              total: 0,
              success: 0,
              failed: 0,
              successRate: 0,
              avgDurationMs: 0,
              last24h: 0,
            });
          }
          throw e;
        }
      }

      // ═══ DEPLOY CONFIGS ═══
      if (path === "/api/ops/deploy-configs" && method === "GET") {
        const domainId = url.searchParams.get("domainId");
        if (!domainId) return json({ error: "Missing domainId" }, 400);

        let rows = [];
        try {
          const r = await db.prepare("SELECT * FROM ops_deploy_configs WHERE domain_id = ?")
            .bind(domainId).all();
          rows = r?.results || [];
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (!msg.includes("no such table: ops_deploy_configs")) throw e;
        }

        const configs = {};
        rows.forEach(r => {
          configs[r.target_key] = JSON.parse(r.config || "{}");
        });

        return json(configs);
      }

      if (path === "/api/ops/deploy-configs" && method === "POST") {
        const body = await request.json();
        const { domainId, targetKey, config } = body;
        if (!domainId || !targetKey || !config) {
          return json({ error: "Missing domainId, targetKey, or config" }, 400);
        }

        const id = uid();
        const now = new Date().toISOString();

        try {
          await db.prepare(`
            INSERT INTO ops_deploy_configs (id, domain_id, target_key, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(domain_id, target_key) DO UPDATE SET
              config = excluded.config,
              updated_at = excluded.updated_at
          `).bind(id, domainId, targetKey, JSON.stringify(config), now, now).run();

          return json({ success: true });
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deploy_configs")) {
            return json({ success: false, skipped: true, error: "ops_deploy_configs table not found" });
          }
          throw e;
        }
      }

      // ═══ STATS (computed) ═══
      if (path === '/api/stats' && method === 'GET') {
        const sites = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(cost),0) as spend FROM sites').first();
        const deploys = await db.prepare('SELECT COUNT(*) as count FROM deploys').first();
        const domains = await db.prepare('SELECT COUNT(*) as count FROM ops_domains').first();
        return json({
          builds: sites.count,
          spend: sites.spend,
          deployed: deploys.count,
          domains: domains.count,
        });
      }

      // ═══ ALL DATA (initial load) ═══
      if (path === '/api/init' && method === 'GET') {
        const safeAll = async (sql, fallback = []) => {
          try {
            const r = await db.prepare(sql).all();
            return r?.results || fallback;
          } catch (e) {
            console.warn('[init] safeAll failed:', sql, e?.message || e);
            return fallback;
          }
        };

        const safeFirst = async (sql, fallback = {}) => {
          try {
            return (await db.prepare(sql).first()) || fallback;
          } catch (e) {
            console.warn('[init] safeFirst failed:', sql, e?.message || e);
            return fallback;
          }
        };

        const [sites, deploys, variants, domains, accounts, profiles, payments, logs, settingsRows, stats, cfAccountsResults, registrarAccountsResults, deploymentsResults] = await Promise.all([
          safeAll('SELECT * FROM sites ORDER BY created_at DESC'),
          safeAll('SELECT * FROM deploys ORDER BY created_at DESC LIMIT 100'),
          safeAll('SELECT * FROM variants ORDER BY created_at DESC'),
          safeAll('SELECT * FROM ops_domains ORDER BY created_at DESC'),
          safeAll('SELECT * FROM ops_accounts ORDER BY created_at DESC'),
          safeAll('SELECT * FROM ops_profiles ORDER BY created_at DESC'),
          safeAll('SELECT * FROM ops_payments ORDER BY created_at DESC'),
          safeAll('SELECT * FROM ops_logs ORDER BY created_at DESC LIMIT 200'),
          safeAll('SELECT * FROM settings'),
          safeFirst('SELECT COUNT(*) as builds, COALESCE(SUM(cost),0) as spend FROM sites', { builds: 0, spend: 0 }),
          safeAll('SELECT * FROM cf_accounts ORDER BY label ASC'),
          safeAll('SELECT * FROM registrar_accounts ORDER BY provider ASC, label ASC'),
          safeAll('SELECT * FROM ops_deployments ORDER BY created_at DESC LIMIT 50'),
        ]);

        const settingsObj = {};
        settingsRows.forEach(r => { settingsObj[r.key] = r.value; });

        return json({
          sites: sites.map(snakeToCamel),
          deploys: deploys.map(snakeToCamel),
          variants: variants.map(snakeToCamel),
          ops: {
            domains: domains.map(snakeToCamel),
            accounts: accounts.map(snakeToCamel),
            profiles: profiles.map(snakeToCamel),
            payments: payments.map(snakeToCamel),
            logs: logs.map(snakeToCamel),
            deployments: deploymentsResults.map(snakeToCamel),
          },
          cfAccounts: cfAccountsResults.map(snakeToCamel),
          registrarAccounts: registrarAccountsResults.map(snakeToCamel),
          settings: redactSettings(settingsObj),
          stats: { builds: stats.builds || 0, spend: stats.spend || 0 },
          integrations: {
            lcConfigured: !!settingsObj.lcToken,
            mlConfigured: !!settingsObj.mlToken,
            netlifyConfigured: !!settingsObj.netlifyToken,
          },
        });
      }

      // ═══ LEADINGCARDS PROXY ═══
      if (path === '/api/lc/cards' && method === 'GET') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const params = new URLSearchParams(url.search);
        if (lc.lcTeamUuid) params.set('team_uuid', lc.lcTeamUuid);
        const res = await fetch(`https://app.leadingcards.media/v1/cards/?${params.toString()}`, {
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path === '/api/lc/cards' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        if (lc.lcTeamUuid) body.team_uuid = lc.lcTeamUuid;
        const res = await fetch('https://app.leadingcards.media/v1/cards/', {
          method: 'POST',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/cards\/[\w-]+\/(block|activate)$/) && method === 'PUT') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const parts = path.split('/');
        const action = parts.pop();
        const uuid = parts.pop();
        const res = await fetch(`https://app.leadingcards.media/v1/cards/${uuid}/${action}/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/cards\/[\w-]+\/change_limit$/) && method === 'PUT') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const parts = path.split('/');
        parts.pop(); // change_limit
        const uuid = parts.pop();
        const body = await request.json();
        const res = await fetch(`https://app.leadingcards.media/v1/cards/${uuid}/change_limit/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/(bins|billing|tags|transactions|teams)$/) && method === 'GET') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const resource = path.split('/').pop();
        const apiMap = { bins: 'cards/bins', billing: 'billing_addresses', tags: 'tags', transactions: 'transactions', teams: 'teams' };
        const endpoint = apiMap[resource];
        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://app.leadingcards.media/v1/${endpoint}/?${params.toString()}`, {
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path === '/api/lc/billing' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const res = await fetch('https://app.leadingcards.media/v1/billing_addresses/', {
          method: 'POST',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      // ═══ MULTILOGIN PROXY ═══
      if (path === '/api/ml/signin' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlEmail || !ml.mlPassword) return json({ error: 'Multilogin email/password not configured' }, 400);
        const res = await fetch('https://api.multilogin.com/user/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ml.mlEmail, password: ml.mlPassword }),
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
          `).bind(data.data.token, data.data.token).run();
        }
        return json(data, res.status);
      }

      if (path === '/api/ml/refresh-token' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const res = await fetch('https://api.multilogin.com/user/refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
          `).bind(data.data.token, data.data.token).run();
        }
        return json(data, res.status);
      }

      if (path === '/api/ml/profiles' && method === 'GET') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://api.multilogin.com/profile/list?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path === '/api/ml/profiles' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const res = await fetch('https://api.multilogin.com/profile/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/ml\/profiles\/[\w-]+\/(start|stop)$/) && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const parts = path.split('/');
        const action = parts.pop();
        const profileId = parts.pop();
        const res = await fetch(`https://api.multilogin.com/profile/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/ml\/profiles\/[\w-]+\/clone$/) && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const parts = path.split('/');
        parts.pop(); // clone
        const profileId = parts.pop();
        const res = await fetch('https://api.multilogin.com/profile/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // AUTOMATION API — Structured endpoints for external automation tools
      // ═══════════════════════════════════════════════════════════════════════════════

      // ═══ REGISTRAR AUTOMATION ═══
      if (path === '/api/automation/registrar/check' && method === 'POST') {
        const body = await request.json();
        const { domain, provider, accountId } = body;
        if (!domain || !provider) return json({ error: 'Missing domain or provider' }, 400);

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/Check`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          Domain: domain,
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        return json({
          success: data.status?.toLowerCase() !== 'failure',
          available: data.status?.toLowerCase() === 'available',
          domain,
          provider,
          status: data.status,
          message: data.message,
        });
      }

      if (path === '/api/automation/registrar/register' && method === 'POST') {
        const body = await request.json();
        const { domain, provider, accountId, period = '1Y' } = body;
        if (!domain || !provider) return json({ error: 'Missing domain or provider' }, 400);

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/Create`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          Domain: domain,
          responseformat: 'JSON',
          Domain: domain,
          Period: period,
        });

        // Add nameservers if provided
        if (body.nameservers && Array.isArray(body.nameservers)) {
          body.nameservers.forEach((ns, i) => {
            formData.append(`Ns${i + 1}`, ns);
          });
        }

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        const success = data.status?.toLowerCase() === 'success';
        return json({
          success,
          domain,
          provider,
          transactionId: data.transactid,
          status: data.status,
          message: data.message,
          product: data.product,
        });
      }

      if (path === '/api/automation/registrar/nameservers' && method === 'PUT') {
        const body = await request.json();
        const { domain, nameservers, provider, accountId } = body;
        if (!domain || !nameservers || !Array.isArray(nameservers)) return json({ error: 'Missing domain or nameservers' }, 400);

        const cleanedNameservers = nameservers
          .map((ns) => String(ns || '').trim().toLowerCase().replace(/\.$/, ''))
          .filter(Boolean);
        if (cleanedNameservers.length < 2) {
          return json({ error: 'At least 2 valid nameservers are required' }, 400);
        }

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/Update`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          Domain: domain,
          Ns_list: cleanedNameservers.join(','),
        });

        // Internet.bs Domain/Update expects Ns_list; Ns1/Ns2 can be rejected.

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        const rawText = await res.text();
        let data = null;
        try {
          data = JSON.parse(rawText);
        } catch (_e) {
          data = { status: 'FAILURE', message: rawText?.slice(0, 800) || 'Non-JSON response from registrar' };
        }

        const statusText = String(data?.status || '').toLowerCase();
        const isSuccess = statusText === 'success' || statusText === 'ok';
        const message = data?.message || data?.error || data?.msg || 'Unknown registrar response';

        return json({
          success: isSuccess,
          domain,
          nameservers: cleanedNameservers,
          status: data.status,
          message,
          raw: data,
        });
      }

      if (path === '/api/automation/registrar/import' && method === 'POST') {
        const body = await request.json();
        const { provider, accountId } = body;
        if (!provider) return json({ error: 'Missing provider' }, 400);

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/List`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          CompactList: 'no',
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        const domains = Array.isArray(data.domain) ? data.domain : (data.domain ? [data.domain] : []);
        return json({
          success: data.status?.toLowerCase() !== 'failure',
          provider,
          count: domains.length,
          domains: domains.map(d => ({
            domain: typeof d === 'string' ? d : d.name,
            status: typeof d === 'string' ? 'ACTIVE' : d.status,
            expiration: typeof d === 'string' ? null : d.expiration,
            autoRenew: typeof d === 'string' ? null : d.autorenew?.toLowerCase() === 'yes',
          })),
        });
      }

      if (path === '/api/automation/registrar/ping' && method === 'POST') {
        const body = await request.json();
        const { provider, accountId, apiKey, secretKey } = body;
        if (!provider) return json({ error: 'Missing provider' }, 400);

        // Support testing unsaved credentials directly from UI
        let resolvedApiKey = apiKey || '';
        let resolvedSecretKey = secretKey || '';

        if (!resolvedApiKey || !resolvedSecretKey) {
          const acctRow = accountId
            ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
            : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
          if (!acctRow) return json({ error: 'Registrar account not found' }, 404);
          resolvedApiKey = acctRow.api_key || '';
          resolvedSecretKey = acctRow.secret_key || '';
        }

        if (!resolvedApiKey || !resolvedSecretKey) {
          return json({ error: 'Missing registrar credentials' }, 400);
        }

        const apiUrl = `https://api.internet.bs/Account/Balance/Get`;
        const formData = new URLSearchParams({
          ApiKey: resolvedApiKey,
          Password: resolvedSecretKey,
          responseformat: 'JSON',
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        return json({
          success: data.status?.toLowerCase() === 'success',
          provider,
          balance: data.balance,
          currency: data.balance?.[0]?.currency,
          message: data.message,
        });
      }

      if (path === '/api/automation/registrar/ip' && method === 'GET') {
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          return json({ success: true, ip: data.ip });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // ═══ CLOUDFLARE AUTOMATION ═══
      // Validate CF API token and account ID
      if (path === '/api/automation/cf-validate' && method === 'POST') {
        const body = await request.json();
        const { accountId, apiToken } = body;
        if (!accountId || !apiToken) return json({ error: 'Missing accountId or apiToken' }, 400);

        // Validate by fetching account info
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const data = await res.json();
            errMsg = data.errors?.[0]?.message || errMsg;
          } catch { }
          return json({ success: false, error: errMsg }, 400);
        }

        const data = await res.json();
        if (!data.success) {
          return json({ success: false, error: data.errors?.[0]?.message || 'Invalid credentials' }, 400);
        }

        return json({ success: true, account: data.result });
      }

      if (path === '/api/automation/cf/zone' && method === 'POST') {
        const body = await request.json();
        const { domain, cfAccountId, cfApiToken, apiToken } = body;
        if (!domain || !cfAccountId) return json({ error: 'Missing domain or cfAccountId' }, 400);

        let token = cfApiToken || apiToken || '';
        let resolvedAccountId = cfAccountId;

        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
          resolvedAccountId = acctRow.account_id || cfAccountId;
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        // First check if zone exists
        const checkRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const checkData = await checkRes.json();
        if (checkData.success && checkData.result?.[0]) {
          return json({ success: true, exists: true, zoneId: checkData.result[0].id, zone: checkData.result[0] });
        }

        // Create zone
        const createRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: domain, account: { id: resolvedAccountId }, type: 'full' }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          return json({ success: false, error: createData.errors?.[0]?.message || 'Zone creation failed' }, 400);
        }
        return json({ success: true, exists: false, zoneId: createData.result.id, zone: createData.result });
      }

      if (path === '/api/automation/cf/dns' && method === 'GET') {
        const zoneId = url.searchParams.get('zoneId');
        const cfAccountId = url.searchParams.get('cfAccountId');
        const apiToken = url.searchParams.get('apiToken') || '';
        if (!zoneId || !cfAccountId) return json({ error: 'Missing zoneId or cfAccountId' }, 400);

        let token = apiToken;
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: data.success, records: data.result || [], error: data.errors?.[0]?.message });
      }

      if (path === '/api/automation/cf/dns' && method === 'POST') {
        const body = await request.json();
        const { zoneId, cfAccountId, apiToken, type, name, content, ttl = 3600, proxied = false } = body;
        if (!zoneId || !cfAccountId || !type || !name || content === undefined) {
          return json({ error: 'Missing zoneId, cfAccountId, type, name, or content' }, 400);
        }

        let token = apiToken || '';
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name, content, ttl, proxied }),
        });
        const data = await res.json();
        if (!data.success) return json({ success: false, error: data.errors?.[0]?.message }, 400);
        return json({ success: true, record: data.result });
      }

      if (path === '/api/automation/cf/dns' && method === 'PUT') {
        const body = await request.json();
        const { dnsRecordId, zoneId, cfAccountId, apiToken, type, name, content, ttl, proxied } = body;
        if (!dnsRecordId || !zoneId || !cfAccountId) return json({ error: 'Missing dnsRecordId, zoneId, or cfAccountId' }, 400);

        let token = apiToken || '';
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const updateData = {};
        if (type) updateData.type = type;
        if (name) updateData.name = name;
        if (content !== undefined) updateData.content = content;
        if (ttl !== undefined) updateData.ttl = ttl;
        if (proxied !== undefined) updateData.proxied = proxied;

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${dnsRecordId}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        const data = await res.json();
        if (!data.success) return json({ success: false, error: data.errors?.[0]?.message }, 400);
        return json({ success: true, record: data.result });
      }

      if (path === '/api/automation/cf/dns' && method === 'DELETE') {
        const dnsRecordId = url.searchParams.get('dnsRecordId');
        const zoneId = url.searchParams.get('zoneId');
        const cfAccountId = url.searchParams.get('cfAccountId');
        const apiToken = url.searchParams.get('apiToken') || '';
        if (!dnsRecordId || !zoneId || !cfAccountId) return json({ error: 'Missing dnsRecordId, zoneId, or cfAccountId' }, 400);

        let token = apiToken;
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${dnsRecordId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: data.success });
      }

      // ═══ DEPLOY ADAPTERS ═══
      if (path === '/api/automation/deploy/vercel' && method === 'POST') {
        const body = await request.json();
        const { projectName, accessToken, teamId } = body;
        if (!projectName || !accessToken) return json({ error: 'Missing projectName or accessToken' }, 400);

        const apiUrl = teamId
          ? `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}?teamId=${teamId}`
          : `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}`;

        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({
          success: res.ok,
          linked: !!data.id,
          project: data,
        });
      }

      if (path === '/api/automation/deploy/netlify' && method === 'POST') {
        const body = await request.json();
        const { siteName, accessToken } = body;
        if (!siteName || !accessToken) return json({ error: 'Missing siteName or accessToken' }, 400);

        const res = await fetch(`https://api.netlify.com/api/v1/sites`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        const site = data.find(s => s.name === siteName || s.id === siteName);
        return json({
          success: true,
          linked: !!site,
          site: site || null,
        });
      }

      if (path === '/api/automation/deploy/cf-pages' && method === 'POST') {
        const body = await request.json();
        const { projectName, cfAccountId } = body;
        if (!projectName || !cfAccountId) return json({ error: 'Missing projectName or cfAccountId' }, 400);

        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();
        if (!acctRow) return json({ error: 'Cloudflare account not found' }, 404);

        const resolvedAccountId = acctRow.account_id || cfAccountId;

        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/pages/projects/${encodeURIComponent(projectName)}`, {
          headers: { 'Authorization': `Bearer ${acctRow.api_token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({
          success: data.success || res.status === 404,
          linked: data.success ? !!data.result : false,
          project: data.result || null,
        });
      }

      if (path === '/api/automation/deploy/cf-workers' && method === 'POST') {
        const body = await request.json();
        const { scriptName, cfAccountId } = body;
        if (!scriptName || !cfAccountId) return json({ error: 'Missing scriptName or cfAccountId' }, 400);

        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();
        if (!acctRow) return json({ error: 'Cloudflare account not found' }, 404);

        const resolvedAccountId = acctRow.account_id || cfAccountId;

        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/workers/scripts/${encodeURIComponent(scriptName)}`, {
          headers: { 'Authorization': `Bearer ${acctRow.api_token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({
          success: res.ok,
          linked: res.ok,
          script: res.ok ? { name: scriptName } : null,
        });
      }

      // ═══ LEADINGCARDS AUTOMATION ═══
      if (path === '/api/automation/lc/create' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        if (lc.lcTeamUuid) body.team_uuid = lc.lcTeamUuid;

        const res = await fetch('https://app.leadingcards.media/v1/cards/', {
          method: 'POST',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json({
          success: res.ok,
          card: data,
          status: res.status,
        });
      }

      if (path === '/api/automation/lc/block' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const { cardUuid } = body;
        if (!cardUuid) return json({ error: 'Missing cardUuid' }, 400);

        const res = await fetch(`https://app.leadingcards.media/v1/cards/${cardUuid}/block/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: res.ok, card: data, status: res.status });
      }

      if (path === '/api/automation/lc/activate' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const { cardUuid } = body;
        if (!cardUuid) return json({ error: 'Missing cardUuid' }, 400);

        const res = await fetch(`https://app.leadingcards.media/v1/cards/${cardUuid}/activate/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: res.ok, card: data, status: res.status });
      }

      if (path === '/api/automation/lc/change_limit' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const { cardUuid, limit } = body;
        if (!cardUuid || !limit) return json({ error: 'Missing cardUuid or limit' }, 400);

        const res = await fetch(`https://app.leadingcards.media/v1/cards/${cardUuid}/change_limit/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit }),
        });
        const data = await res.json();
        return json({ success: res.ok, card: data, status: res.status });
      }

      // ═══ MULTILOGIN AUTOMATION ═══
      if (path === '/api/automation/ml/signin' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlEmail || !ml.mlPassword) return json({ error: 'Multilogin credentials not configured' }, 400);

        const res = await fetch('https://api.multilogin.com/user/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ml.mlEmail, password: md5(ml.mlPassword) }),
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
            .bind(data.data.token, data.data.token).run();
        }
        return json({
          success: !!data.data?.token,
          token: data.data?.token || null,
          message: data.message,
        });
      }

      if (path === '/api/automation/ml/refresh_token' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);

        const res = await fetch('https://api.multilogin.com/user/refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
            .bind(data.data.token, data.data.token).run();
        }
        return json({
          success: !!data.data?.token,
          token: data.data?.token || null,
          message: data.message,
        });
      }

      if (path === '/api/automation/ml/profiles' && method === 'GET') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);

        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://api.multilogin.com/profile/list?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        return json({
          success: res.ok,
          profiles: data.data || [],
          total: data.total || 0,
        });
      }

      if (path === '/api/automation/ml/profiles' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();

        const res = await fetch('https://api.multilogin.com/profile/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json({
          success: !!data.data?.profile_id,
          profileId: data.data?.profile_id || null,
          profile: data.data || null,
        });
      }

      if (path === '/api/automation/ml/profiles/start' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const { profileId } = body;
        if (!profileId) return json({ error: 'Missing profileId' }, 400);

        const res = await fetch('https://api.multilogin.com/profile/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json({
          success: !!data.data?.connection_url,
          connectionUrl: data.data?.connection_url || null,
          profileId: data.data?.profile_id || profileId,
        });
      }

      if (path === '/api/automation/ml/profiles/stop' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const { profileId } = body;
        if (!profileId) return json({ error: 'Missing profileId' }, 400);

        const res = await fetch('https://api.multilogin.com/profile/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json({
          success: res.ok,
          profileId,
          message: data.message,
        });
      }

      if (path === '/api/automation/ml/profiles/clone' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const { profileId } = body;
        if (!profileId) return json({ error: 'Missing profileId' }, 400);

        const res = await fetch('https://api.multilogin.com/profile/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json({
          success: !!data.data?.profile_id,
          newProfileId: data.data?.profile_id || null,
          profile: data.data || null,
        });
      }

      // ═══ D1 DATABASE QUERIES ═══
      // Direct SQL queries to D1 database (proxied to avoid CORS)
      if (path === '/api/automation/d1/query' && method === 'POST') {
        const body = await request.json();
        const { sql, params = [], accountId, databaseId, apiToken } = body;

        if (!sql) return json({ success: false, error: 'Missing SQL query' }, 400);
        if (!accountId) return json({ success: false, error: 'Missing accountId' }, 400);
        if (!databaseId) return json({ success: false, error: 'Missing databaseId' }, 400);
        if (!apiToken) return json({ success: false, error: 'Missing apiToken (send from request body)' }, 400);

        try {
          // Cloudflare D1 Query API
          const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

          console.log('[D1 Query]', {
            url: url.replace(accountId, '***').replace(databaseId, '***'),
            sql: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
            hasToken: !!apiToken,
            tokenPrefix: apiToken ? apiToken.substring(0, 10) + '...' : 'none',
          });

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params }),
          });

          const responseText = await res.text();

          if (!res.ok) {
            let errData = {};
            try {
              errData = JSON.parse(responseText);
            } catch { }

            const errorMessage = errData.errors?.[0]?.message || errData.errors?.[0]?.code || responseText || `HTTP ${res.status}`;

            console.error('[D1 Error]', {
              status: res.status,
              error: errorMessage,
              details: errData.errors?.[0] || {},
            });

            return json({
              success: false,
              error: errorMessage,
              code: errData.errors?.[0]?.code,
              details: errData.errors?.[0] || {},
              httpStatus: res.status,
            }, res.status);
          }

          const data = JSON.parse(responseText);
          return json({
            success: true,
            results: data.result?.[0]?.results || [],
          });
        } catch (e) {
          console.error('[D1 Exception]', e.message, e.stack);
          return json({ success: false, error: e.message, stack: e.stack }, 500);
        }
      }

      if (path === '/api/automation/d1/execute' && method === 'POST') {
        const body = await request.json();
        const { sql, params = [], accountId, databaseId, apiToken } = body;

        if (!sql) return json({ success: false, error: 'Missing SQL command' }, 400);
        if (!accountId) return json({ success: false, error: 'Missing accountId' }, 400);
        if (!databaseId) return json({ success: false, error: 'Missing databaseId' }, 400);
        if (!apiToken) return json({ success: false, error: 'Missing apiToken (send from request body)' }, 400);

        try {
          const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return json({
              success: false,
              error: errData.errors?.[0]?.message || `HTTP ${res.status}`,
            }, res.status);
          }

          return json({ success: true });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // ═══ D1 DATABASE DIRECT (using env.DB binding) ═══
      // Test endpoint - no API token needed, uses Worker's D1 binding directly
      if (path === '/api/automation/d1/test' && method === 'GET') {
        try {
          // Query using env.DB binding (no token needed)
          const { results } = await env.DB
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .all();

          return json({
            success: true,
            tables: results.map(r => r.name),
            message: 'D1 connection successful',
          });
        } catch (e) {
          return json({
            success: false,
            error: e.message,
          }, 500);
        }
      }

      // ═══ D1 DATABASE DIRECT QUERY ═══
      // Execute SQL using env.DB binding directly (no API token needed)
      if (path === '/api/automation/d1/direct-query' && method === 'POST') {
        try {
          const body = await request.json();
          const { sql, params = [] } = body;

          if (!sql) return json({ success: false, error: 'Missing SQL query' }, 400);

          // Use env.DB binding directly
          const stmt = env.DB.prepare(sql);
          let result;
          if (params && params.length > 0) {
            result = await stmt.bind(...params).all();
          } else {
            result = await stmt.all();
          }

          return json({
            success: true,
            results: result.results || [],
          });
        } catch (e) {
          return json({
            success: false,
            error: e.message,
          }, 500);
        }
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500);
    }
  },
};
