// Cloudflare Pages Function — proxy /api/cfg to internal Worker
// Hides Worker URL from browser: domain.com/api/cfg instead of lp-factory-api.*.workers.dev/api/cfg
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const d = url.searchParams.get('d') || context.request.headers.get('host') || '';
  const workerUrl = `https://lp-factory-api.misty-feather-556e.workers.dev/api/cfg?d=${encodeURIComponent(d)}`;
  try {
    const res = await fetch(workerUrl, { cf: { cacheEverything: true, cacheTtl: 3600 } });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'cfg unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
