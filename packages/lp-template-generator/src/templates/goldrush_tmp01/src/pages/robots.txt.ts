import type { APIRoute } from 'astro';
export const GET: APIRoute = () => {
  const domain = import.meta.env.PUBLIC_DOMAIN || import.meta.env.PUBLIC_SITE_URL || '';
  const sitemapUrl = domain ? `https://${domain}/sitemap.xml` : '';
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /apply/'];
  if (sitemapUrl) { lines.push(''); lines.push(`Sitemap: ${sitemapUrl}`); }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
