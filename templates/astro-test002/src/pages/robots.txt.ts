import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const domain = import.meta.env.PUBLIC_DOMAIN || import.meta.env.PUBLIC_SITE_URL || '';
  const sitemapUrl = domain ? `https://${domain}/sitemap.xml` : '';

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /apply/',
    '',
    sitemapUrl ? `Sitemap: ${sitemapUrl}` : '',
  ].filter(line => line !== undefined).join('\n');

  return new Response(body.trim(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
