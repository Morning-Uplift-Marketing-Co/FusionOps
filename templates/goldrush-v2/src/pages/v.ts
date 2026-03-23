import type { APIRoute } from 'astro';

const handler = (url: URL): Response => {
  const p = url.searchParams;
  const clickId = p.get('click_id') || p.get('cid') || p.get('clickid') || '';
  const payout  = parseFloat(p.get('payout') || p.get('price') || '0');
  const leadId  = p.get('lead_id') || p.get('txid') || '';
  const type    = p.get('type') || 'soldLead'; // soldLead | rejectLead | newLead
  const domain  = url.hostname.replace(/^t\./, '');

  console.log('[postback]', { clickId, payout, leadId, type, domain, ts: Math.floor(Date.now() / 1000) });

  // TODO: store to DB for cross-validation dashboard
  // await db.insertVoluumPostback({ clickId, payout, leadId, type, domain, ts: Date.now() });

  return new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
};

export const GET: APIRoute = ({ url }) => handler(url);

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const text = await request.text();
    const body = Object.fromEntries(new URLSearchParams(text));
    const merged = new URL(url);
    Object.entries(body).forEach(([k, v]) => merged.searchParams.set(k, v));
    return handler(merged);
  } catch (_) {
    return handler(url);
  }
};
