import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    // Pixel event received — could forward to analytics backend here
    console.log('[pixel]', payload);
  } catch (_) {}
  return new Response(null, { status: 204 });
};

export const GET: APIRoute = () => {
  return new Response(null, { status: 204 });
};
