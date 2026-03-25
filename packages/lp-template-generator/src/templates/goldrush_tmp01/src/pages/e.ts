import type { APIRoute } from 'astro';
export const POST: APIRoute = async ({ request }) => {
  try { const payload = JSON.parse(await request.text()); console.log('[pixel]', payload); } catch (_) {}
  return new Response(null, { status: 204 });
};
export const GET: APIRoute = () => new Response(null, { status: 204 });
