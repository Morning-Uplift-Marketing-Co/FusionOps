export async function GET() {
  const domain = import.meta.env.PUBLIC_DOMAIN || 'goldrush-v2.com';
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: https://${domain}/sitemap.xml`,
    '',
    'User-agent: *',
    'Disallow: /apply/',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
