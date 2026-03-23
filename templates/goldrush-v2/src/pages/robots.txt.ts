---
const domain = import.meta.env.PUBLIC_DOMAIN || 'goldrush-v2.com';
---

User-agent: *
Allow: /

Sitemap: https://{domain}/sitemap.xml

# Disallow apply page
User-agent: *
Disallow: /apply/
