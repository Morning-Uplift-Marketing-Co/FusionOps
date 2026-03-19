export const prerender = true;
export async function GET() {
  const domain = 'static-endpoint';
  return new Response(
    JSON.stringify({ ok: true, domain, ts: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}
