/**
 * Template Parameterizer (Generic)
 * ================================
 * Converts hard-coded bolt.new / Lovable / any template to use ${variable} syntax
 * so FusionOps substituteSiteVariables() can inject site-specific content.
 *
 * Strategy:
 *   1. Auto-detect brand name, domain, title, CTA, etc. from template files
 *   2. Generate replacement rules dynamically
 *   3. Replace all occurrences with ${variable} placeholders
 *   4. Works with ANY template — not hardcoded to any specific brand
 *
 * Supported variables (matched to substituteSiteVariables):
 *   ${brand}, ${domain}, ${siteUrl}, ${h1}, ${sub}, ${cta},
 *   ${phone}, ${email}, ${address}, ${amountMin}, ${amountMax},
 *   ${aprMin}, ${aprMax}, ${redirectUrl}, ${conversionId},
 *   ${primaryColor}, ${accentColor}
 */

// ─── Auto-detection ────────────────────────────────────────────────────────────

/**
 * Extract brand, domain, and other constants from template files.
 * Works by analyzing index.html / index.astro for common patterns.
 *
 * @param {Record<string, string>} files
 * @returns {{ brand: string, domain: string, title: string, cta: string, phone: string, email: string, amounts: string[], apr: string }}
 */
export function detectTemplateConstants(files) {
  const indexHtml = files['index.html'] || files['src/pages/index.astro'] || '';
  const allHtml = Object.values(files).filter(c => typeof c === 'string').join('\n');

  // ─── Brand: from <title>, schema.org "name", og:site_name ───
  let brand = '';
  const titleBrandMatch = indexHtml.match(/<title>[^<]*?\|\s*([A-Za-z0-9]+(?:\s[A-Za-z0-9]+)?)\s*<\/title>/);
  const schemaBrandMatch = indexHtml.match(/"name":\s*"([^"]+)"/);
  const ogSiteName = indexHtml.match(/<meta\s+(?:property|name)="(?:og:)?site_name"\s+content="([^"]+)"/i);
  const h1BrandMatch = indexHtml.match(/<h1[^>]*>([^<]{1,60})<\/h1>/);

  if (titleBrandMatch) brand = titleBrandMatch[1].trim();
  else if (ogSiteName) brand = ogSiteName[1].trim();
  else if (schemaBrandMatch) brand = schemaBrandMatch[1].trim();
  else if (h1BrandMatch) brand = h1BrandMatch[1].trim();

  // ─── Domain: first https:// domain found in meta/url ───
  let domain = '';
  // Prioritize meta tags, og:url, canonical
  const metaUrlMatch = indexHtml.match(/content="https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/i);
  const schemaUrlMatch = indexHtml.match(/"url":\s*"https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/i);
  const canonicalMatch = indexHtml.match(/<link[^>]+rel="canonical"[^>]+href="https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/i);
  const anyUrlMatch = allHtml.match(/https?:\/\/([a-z0-9-]+\.[a-z]{2,})/i);

  if (canonicalMatch) domain = canonicalMatch[1];
  else if (metaUrlMatch) domain = metaUrlMatch[1];
  else if (schemaUrlMatch) domain = schemaUrlMatch[1];
  else if (anyUrlMatch) domain = anyUrlMatch[1];

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // ─── Title / H1 ───
  const h1Match = indexHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  let title = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';

  // ─── CTA: first button-style text ───
  let cta = '';
  const ctaMatch = indexHtml.match(/<a[^>]*class="[^"]*(?:btn|button|cta)[^"]*"[^>]*>([^<]+)</i)
    || indexHtml.match(/<button[^>]*>([^<]+)</i)
    || indexHtml.match(/<a[^>]*href="[^"]*(?:apply|signup|register|check)[^"]*"[^>]*>([^<]+)</i);
  if (ctaMatch) cta = ctaMatch[1].trim();

  // ─── Phone ───
  let phone = '';
  const phoneMatch = allHtml.match(/\b(?:1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/);
  if (phoneMatch) phone = phoneMatch[0];

  // ─── Email ───
  let email = '';
  const emailMatch = allHtml.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) email = emailMatch[0];

  // ─── Amounts ───
  const amounts = [];
  const amountRegex = /\$[\d,]+(?:\.\d{2})?/g;
  let m;
  while ((m = amountRegex.exec(allHtml)) !== null) {
    const val = m[0];
    if (!amounts.includes(val)) amounts.push(val);
  }

  // ─── APR ───
  let apr = '';
  const aprMatch = allHtml.match(/(\d+\.?\d*%\s*[-–]\s*\d+\.?\d*%)/);
  if (aprMatch) apr = aprMatch[1];

  // ─── Brand validation: skip generic phrases ───
  const GENERIC_BRANDS = ['hello world', 'untitled', 'home', 'index', 'welcome', 'page'];
  if (GENERIC_BRANDS.includes(brand.toLowerCase())) brand = '';

  return { brand, domain, title, cta, phone, email, amounts, apr };
}


// ─── Rule Generation ───────────────────────────────────────────────────────────

/**
 * Build replacement rules from detected constants.
 * Each rule: { find: RegExp, replace: string }
 *
 * @param {{ brand: string, domain: string, title: string, cta: string, phone: string, email: string, amounts: string[], apr: string }} constants
 * @returns {{ find: RegExp, replace: string }[]}
 */
function buildRules(constants) {
  const rules = [];
  const { brand, domain, title, cta, phone, email, amounts, apr } = constants;

  // ═══ ORDER MATTERS ═══
  // Email/phone/specific patterns must come BEFORE domain/brand rules
  // to avoid partial replacement breaking patterns

  // ─── Email (MUST be before domain) ───
  if (email) {
    const escaped = escapeRegex(email);
    rules.push({ find: new RegExp(escaped, 'g'), replace: '${email}' });
  }

  // ─── Phone ───
  if (phone) {
    const escaped = escapeRegex(phone);
    rules.push({ find: new RegExp(escaped, 'g'), replace: '${phone}' });
  }

  // ─── Title / H1 (only for real titles, not generic) ───
  const GENERIC_TITLES = ['hello world', 'untitled', 'home', 'welcome', 'page'];
  if (title && title.length > 5 && !GENERIC_TITLES.includes(title.toLowerCase())) {
    const escaped = escapeRegex(title);
    rules.push({
      find: new RegExp(`<title>[^<]*${escaped}[^<]*<\/title>`, 'g'),
      replace: '<title>${h1} | ${brand}</title>',
    });
    rules.push({
      find: new RegExp(`(<meta\\s+(?:property|name)="(?:og:)?title"\\s+content=")[^"]*${escaped}[^"]*(")`, 'g'),
      replace: '$1${h1} | ${brand}$2',
    });
    rules.push({
      find: new RegExp(`(<h1[^>]*>)${escaped}(</h1>)`, 'g'),
      replace: '$1${h1}$2',
    });
  }

  // ─── CTA text ───
  if (cta && cta.length > 3) {
    const escaped = escapeRegex(cta);
    rules.push({ find: new RegExp(`>${escaped}<`, 'g'), replace: '>${cta}<' });
  }

  // ─── Loan amounts ───
  if (amounts.length >= 2) {
    for (const amt of amounts) {
      const escaped = escapeRegex(amt);
      rules.push({
        find: new RegExp(escaped, 'g'),
        replace: amt === amounts[0] ? '$${amountMin}' : '$${amountMax}',
      });
    }
  }

  // ─── APR ───
  if (apr) {
    const parts = apr.match(/(\d+\.?\d*)%/g);
    if (parts && parts.length === 2) {
      const escaped = escapeRegex(apr);
      rules.push({ find: new RegExp(escaped, 'g'), replace: '${aprMin}% - ${aprMax}%' });
    }
  }

  // ─── Brand name ───
  if (brand && brand.length > 2) {
    const escaped = escapeRegex(brand);
    rules.push({ find: new RegExp(escaped, 'g'), replace: '${brand}' });
  }

  // ─── Domain (full URLs FIRST, then bare domain) ───
  if (domain) {
    const escaped = escapeRegex(domain);
    rules.push({ find: new RegExp(`https?://${escaped}`, 'g'), replace: '${siteUrl}' });
    rules.push({ find: new RegExp(escaped, 'g'), replace: '${domain}' });
  }

  // ─── OG description (only when brand detected) ───
  if (brand) {
    rules.push({
      find: /(<meta\s+property="og:description"\s+content=")[^"]*(")/g,
      replace: '$1${sub}$2',
    });
    rules.push({
      find: /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/g,
      replace: '$1${sub}$2',
    });
  }

  // ─── OG Image URL ───
  if (domain) {
    const escaped = escapeRegex(domain);
    rules.push({
      find: new RegExp(`https?://${escaped}/og-image\\.png`, 'g'),
      replace: '${siteUrl}/og-image.png',
    });
    rules.push({
      find: new RegExp(`https?://${escaped}/twitter-card\\.png`, 'g'),
      replace: '${siteUrl}/twitter-card.png',
    });
  }

  // ─── Schema.org (only when brand was detected) ───
  // Note: ${} inside <script type="application/ld+json"> is protected
  // by substituteSiteVariables — deploy pipeline handles them separately.
  if (brand) {
    rules.push({ find: /"name":\s*"([^"]+)"/g, replace: '"name": "${brand}"' });
    rules.push({
      find: /"url":\s*"https?:\/\/[^"]+"/g,
      replace: '"url": "${siteUrl}"',
    });
  }

  return rules;
}


// ─── Parameterize ──────────────────────────────────────────────────────────────

/**
 * Parameterize a single HTML string using generated rules.
 * @param {string} html
 * @param {{ find: RegExp, replace: string }[]} rules
 * @returns {string}
 */
function parameterizeHtml(html, rules) {
  let result = html;

  for (const rule of rules) {
    result = result.replace(rule.find, rule.replace);
  }

  return result;
}

/**
 * Parameterize all files in a template.
 * Converts hard-coded text to ${variable} syntax for any template.
 *
 * @param {Record<string, string>} files - { path: content }
 * @param {object} [options]
 * @param {boolean} [options.skipDist=true] - Skip dist/ directory
 * @returns {{ files: Record<string, string>, constants: object, rulesCount: number }}
 */
export function parameterizeTemplate(files, options = {}) {
  const { skipDist = true } = options;

  // Step 1: Detect constants
  const constants = detectTemplateConstants(files);
  console.log('[parameterizeTemplate] Detected:', constants);

  // Step 2: Build rules
  const rules = buildRules(constants);

  // Step 3: Apply rules to each file
  const result = {};
  let modifiedCount = 0;

  for (const [path, content] of Object.entries(files)) {
    // Skip binary, images, data files
    const ext = '.' + path.split('.').pop().toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.json'].includes(ext)) {
      result[path] = content;
      continue;
    }

    // Skip dist/ — it's pre-built and will be rebuilt
    if (skipDist && path.startsWith('dist/')) {
      result[path] = content;
      continue;
    }

    const before = content;
    result[path] = parameterizeHtml(content, rules);

    if (result[path] !== before) {
      modifiedCount++;
      const varCount = (result[path].match(/\$\{[a-zA-Z]+\}/g) || []).length;
      console.log(`  [param] ${path}: ${varCount} variables injected`);
    }
  }

  console.log(`  [param] Total files modified: ${modifiedCount}, rules applied: ${rules.length}`);

  return { files: result, constants, rulesCount: rules.length };
}

/**
 * Parameterize a single HTML string (for runtime use in preview/deploy).
 * Auto-detects constants from the HTML itself.
 *
 * @param {string} html
 * @returns {string}
 */
export function parameterizeHtmlString(html) {
  // Minimal detection from HTML alone
  const constants = {
    brand: '',
    domain: '',
    title: '',
    cta: '',
    phone: '',
    email: '',
    amounts: [],
    apr: '',
  };

  const brandMatch = html.match(/<title>[^<]*?\|\s*([A-Za-z0-9]+(?:\s[A-Za-z0-9]+)?)\s*<\/title>/);
  if (brandMatch) constants.brand = brandMatch[1].trim();

  const domainMatch = html.match(/https?:\/\/([a-z0-9-]+\.[a-z]{2,})/i);
  if (domainMatch) constants.domain = domainMatch[1].replace(/^www\./, '');

  if (!constants.brand && !constants.domain) return html;

  const rules = buildRules(constants);
  return parameterizeHtml(html, rules);
}


// ─── Helpers ───────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
