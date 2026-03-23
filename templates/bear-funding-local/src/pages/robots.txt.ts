export const GET = () => new Response(
  `User-agent: *\nAllow: /\nDisallow: /apply\nSitemap: https://${import.meta.env.PUBLIC_DOMAIN || 'example.com'}/sitemap.xml`,
  { headers: { 'Content-Type': 'text/plain' } }
);
