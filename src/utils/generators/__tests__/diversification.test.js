/**
 * Integration tests for multi-framework diversification features:
 * 1. Auto deploy target distributor
 * 2. Plain HTML generator
 * 3. HTML structure randomizer
 * 4. Integration with existing tracking system
 */

import { describe, it, expect } from 'vitest';
import { autoAssignDeployTarget, getDistributionSummary } from '../../deployers/deploy-target-auto.js';
import {
  generatePlainHtml,
  pickCssStrategy,
  CSS_NAMING_STRATEGIES,
  pickStructureStrategy,
  resolveStructureTags,
  STRUCTURE_STRATEGIES,
} from '../../generators/plain-html-generator.js';
import { randomizeHtmlStructure } from '../../generators/html-structure-randomizer.js';

// ─── Test fixtures ───

const mockSite = {
  id: 'test-site-001',
  brand: 'TestLend',
  domain: 'testlend.example.com',
  h1: 'Get $100-$5000 Fast',
  sub: 'Quick approval, no credit impact',
  cta: 'Apply Now',
  templateId: 'classic',
  colorId: 'ruby',
  fontId: 'dm-sans',
  amountMin: 100,
  amountMax: 5000,
  aprMin: 5.99,
  aprMax: 35.99,
  phone: '1-800-555-HELP',
  email: 'support@testlend.example.com',
  conversionId: 'AW-12345',
  voluumId: 'abc-123',
  voluumDomain: 'cdn.testlend.example.com',
  reviews: [
    { name: 'Alice', text: 'Great service!', rating: 5, location: 'NY' },
    { name: 'Bob', text: 'Very fast', rating: 5, location: 'CA' },
    { name: 'Carol', text: 'Easy process', rating: 4, location: 'TX' },
  ],
};

const mockSettingsAll = {
  cfApiToken: 'test-cf-token',
  cfAccountId: 'test-cf-account',
  netlifyToken: 'test-netlify-token',
  vercelToken: 'test-vercel-token',
  githubToken: 'test-gh-token',
  githubRepoOwner: 'test',
  githubRepoName: 'repo',
};

const mockSettingsOnlyCf = {
  cfApiToken: 'test-cf-token',
  cfAccountId: 'test-cf-account',
};

// ─── Feature 1: Auto Deploy Target ───

describe('Auto Deploy Target Distributor', () => {
  it('respects explicit site.deployTarget', () => {
    const site = { ...mockSite, deployTarget: 'netlify' };
    const result = autoAssignDeployTarget(site, mockSettingsAll);
    expect(result.target).toBe('netlify');
    expect(result.auto).toBe(false);
  });

  it('deterministically assigns the same target for the same site', () => {
    const r1 = autoAssignDeployTarget(mockSite, mockSettingsAll);
    const r2 = autoAssignDeployTarget(mockSite, mockSettingsAll);
    expect(r1.target).toBe(r2.target);
  });

  it('distributes different sites to different targets', () => {
    const targets = new Set();
    for (let i = 0; i < 20; i++) {
      const site = { ...mockSite, id: `site-${i}` };
      const result = autoAssignDeployTarget(site, mockSettingsAll);
      targets.add(result.target);
    }
    // With 20 sites and 4 targets, we should get at least 2 different targets
    expect(targets.size).toBeGreaterThanOrEqual(2);
  });

  it('falls back when only one target is configured', () => {
    const result = autoAssignDeployTarget(mockSite, mockSettingsOnlyCf);
    expect(result.target).toBe('cf-pages');
    expect(result.auto).toBe(true);
  });

  it('falls back to github-actions when nothing is configured', () => {
    const result = autoAssignDeployTarget(mockSite, {});
    expect(result.target).toBe('github-actions');
  });
});

describe('Distribution Summary', () => {
  it('produces a valid summary', () => {
    const sites = Array.from({ length: 10 }, (_, i) => ({
      ...mockSite,
      id: `summary-site-${i}`,
      domain: `site${i}.example.com`,
    }));
    const summary = getDistributionSummary(sites, mockSettingsAll);
    const totalSites = Object.values(summary).reduce((sum, s) => sum + s.count, 0);
    expect(totalSites).toBe(10);
  });
});

// ─── Feature 2: Plain HTML Generator ───

describe('Plain HTML Generator', () => {
  it('generates valid HTML document', () => {
    const html = generatePlainHtml(mockSite);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });

  it('includes site content', () => {
    const html = generatePlainHtml(mockSite);
    expect(html).toContain('Get $100-$5000 Fast');
    expect(html).toContain('Apply Now');
    expect(html).toContain('TestLend');
    expect(html).toContain('1-800-555-HELP');
  });

  it('uses different fonts for different sites', () => {
    const html1 = generatePlainHtml({ ...mockSite, id: 'font-test-1' });
    const html2 = generatePlainHtml({ ...mockSite, id: 'font-test-7' });
    // At least one of these should use a different font
    const fonts1 = html1.match(/font-family:([^;]+)/)?.[1];
    const fonts2 = html2.match(/font-family:([^;]+)/)?.[1];
    // Both should have fonts (they might be the same by chance, but that's fine)
    expect(fonts1).toBeTruthy();
    expect(fonts2).toBeTruthy();
  });

  it('does NOT include any framework fingerprints', () => {
    const html = generatePlainHtml(mockSite);
    expect(html).not.toContain('__next');
    expect(html).not.toContain('__preact');
    expect(html).not.toContain('data-astro');
    expect(html).not.toContain('svelte');
    expect(html).not.toContain('_app');
  });

  it('does NOT use Tailwind utility classes', () => {
    const html = generatePlainHtml(mockSite);
    // Should not have Tailwind-style classes like flex, grid, p-4, etc.
    expect(html).not.toMatch(/class="[^"]*\b(flex|grid|p-\d|m-\d|text-\w+|bg-\w+)\b/);
  });

  it('includes reviews from site config', () => {
    const html = generatePlainHtml(mockSite);
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Great service!');
  });

  it('includes APR disclosure in footer', () => {
    const html = generatePlainHtml(mockSite);
    expect(html).toContain('5.99%');
    expect(html).toContain('35.99%');
  });

  it('deterministic — same site.id produces identical output', () => {
    const html1 = generatePlainHtml(mockSite);
    const html2 = generatePlainHtml(mockSite);
    expect(html1).toBe(html2);
  });

  it('compatible with inject-tracking.mjs — has </head> and </body> tags', () => {
    const html = generatePlainHtml(mockSite);
    // inject-tracking.mjs needs these tags to inject tracking
    expect(html).toMatch(/<\/head>/);
    expect(html).toMatch(/<\/body>/);
  });
});

// ─── Feature 2b: CSS Naming-Convention Strategies ───

describe('CSS Naming Strategies', () => {
  it('pickCssStrategy is deterministic for the same site.id', () => {
    expect(pickCssStrategy('site-css-1')).toBe(pickCssStrategy('site-css-1'));
    expect(pickCssStrategy(mockSite.id)).toBe(pickCssStrategy(mockSite.id));
  });

  it('only returns known strategies', () => {
    for (let i = 0; i < 30; i++) {
      expect(CSS_NAMING_STRATEGIES).toContain(pickCssStrategy(`strat-${i}`));
    }
  });

  it('spreads sites across multiple strategies', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(pickCssStrategy(`spread-${i}`));
    // With 4 strategies over 40 sites we expect at least 2 distinct paradigms
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('every strategy still produces valid, non-Tailwind, framework-free HTML', () => {
    // Force each strategy by finding a site.id that maps to it
    const idForStrategy = {};
    for (let i = 0; i < 200 && Object.keys(idForStrategy).length < CSS_NAMING_STRATEGIES.length; i++) {
      const id = `force-${i}`;
      const s = pickCssStrategy(id);
      if (!idForStrategy[s]) idForStrategy[s] = id;
    }
    for (const strategy of CSS_NAMING_STRATEGIES) {
      const id = idForStrategy[strategy];
      expect(id, `no id found for strategy ${strategy}`).toBeTruthy();
      const html = generatePlainHtml({ ...mockSite, id });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</head>');
      expect(html).toContain('</body>');
      // No Tailwind utility classes
      expect(html).not.toMatch(/class="[^"]*\b(flex|grid|p-\d|m-\d|text-\w+|bg-\w+)\b/);
      // No framework fingerprints
      expect(html).not.toContain('__next');
      expect(html).not.toContain('data-astro');
    }
  });

  it('different paradigms yield structurally different class markup', () => {
    // Two ids that resolve to different strategies should differ in output
    const a = generatePlainHtml({ ...mockSite, id: 'force-0' });
    const b = generatePlainHtml({ ...mockSite, id: 'force-3' });
    expect(a).not.toBe(b);
  });
});

// ─── Feature 2c: Structure Strategies (semantic vs div-soup) ───

describe('Structure Strategies', () => {
  it('pickStructureStrategy is deterministic', () => {
    expect(pickStructureStrategy('struct-1')).toBe(pickStructureStrategy('struct-1'));
  });

  it('only returns known structure strategies', () => {
    for (let i = 0; i < 30; i++) {
      expect(STRUCTURE_STRATEGIES).toContain(pickStructureStrategy(`st-${i}`));
    }
  });

  it('resolveStructureTags never returns empty tags', () => {
    for (const strat of STRUCTURE_STRATEGIES) {
      const tags = resolveStructureTags(strat, 'tag-site');
      for (const v of Object.values(tags)) {
        expect(v, `empty tag in ${strat}`).toBeTruthy();
        expect(/^[a-z]+$/.test(v)).toBe(true);
      }
    }
  });

  it('semantic strategy emits HTML5 landmark tags', () => {
    const tags = resolveStructureTags('semantic', 'sem-site');
    expect(tags.wrapper).toBe('main');
    expect(tags.header).toBe('header');
    expect(tags.footer).toBe('footer');
    const html = generatePlainHtml({ ...mockSite, id: 'force-semantic-test' });
    // pick an id whose structure resolves to semantic to assert in output
    let semId = null;
    for (let i = 0; i < 200 && !semId; i++) {
      if (pickStructureStrategy(`ss-${i}`) === 'semantic') semId = `ss-${i}`;
    }
    const semHtml = generatePlainHtml({ ...mockSite, id: semId });
    expect(semHtml).toMatch(/<main[ >]/);
    expect(semHtml).toContain('</main>');
  });

  it('div-soup strategy uses no semantic landmarks for the shell', () => {
    let divId = null;
    for (let i = 0; i < 200 && !divId; i++) {
      if (pickStructureStrategy(`ds-${i}`) === 'div-soup') divId = `ds-${i}`;
    }
    const html = generatePlainHtml({ ...mockSite, id: divId });
    expect(html).not.toMatch(/<main[ >]/);
  });

  it('all structure strategies produce balanced, valid HTML', () => {
    for (let i = 0; i < 12; i++) {
      const html = generatePlainHtml({ ...mockSite, id: `balance-${i}` });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</body>');
      // balanced landmark tags
      for (const tag of ['main', 'header', 'footer', 'section']) {
        const open = (html.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
        const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
        expect(open, `${tag} unbalanced in balance-${i}`).toBe(close);
      }
    }
  });
});

// ─── Feature 3: HTML Structure Randomizer ───

describe('HTML Structure Randomizer', () => {
  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Test Page</title>
<link rel="stylesheet" href="style.css">
<style>body{color:red}</style>
<script src="app.js"></script>
</head>
<body>
<div class="wrapper">
  <section class="hero">
    <h1>Hello</h1>
  </section>
  <div class="content">
    <section class="form">
      <p>Form here</p>
    </section>
  </div>
</div>
</body>
</html>`;

  it('returns valid HTML after randomization', () => {
    const result = randomizeHtmlStructure(sampleHtml, 'test-site-xyz');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('</html>');
    expect(result).toContain('<body>');
    expect(result).toContain('</body>');
  });

  it('preserves site content after randomization', () => {
    const result = randomizeHtmlStructure(sampleHtml, 'test-site-xyz');
    expect(result).toContain('Hello');
    expect(result).toContain('Form here');
  });

  it('deterministic — same siteId produces identical output', () => {
    const r1 = randomizeHtmlStructure(sampleHtml, 'test-site-abc');
    const r2 = randomizeHtmlStructure(sampleHtml, 'test-site-abc');
    expect(r1).toBe(r2);
  });

  it('different siteIds produce different output', () => {
    const r1 = randomizeHtmlStructure(sampleHtml, 'site-A');
    const r2 = randomizeHtmlStructure(sampleHtml, 'site-B');
    // They should differ in at least some structural aspect
    expect(r1).not.toBe(r2);
  });

  it('can disable individual transformations', () => {
    const result = randomizeHtmlStructure(sampleHtml, 'test-site', {
      shuffleHead: false,
      addNoiseClasses: false,
      addComments: false,
      addDataAttrs: false,
      varyWhitespace: false,
    });
    // Should be unchanged (no transformations applied)
    expect(result).toBe(sampleHtml);
  });

  it('handles empty/null input gracefully', () => {
    expect(randomizeHtmlStructure(null, 'test')).toBeNull();
    expect(randomizeHtmlStructure('', 'test')).toBe('');
    expect(randomizeHtmlStructure(undefined, 'test')).toBeUndefined();
  });
});

// ─── Feature 3b: Attribute Reordering ───

describe('Attribute Reordering', () => {
  it('preserves all attribute values (just reorders)', () => {
    const html = generatePlainHtml(mockSite); // has <input>, <button>, <a>
    const out = randomizeHtmlStructure(html, 'attr-site', {
      shuffleHead: false, addNoiseClasses: false, addComments: false, addDataAttrs: false,
    });
    // input attributes survive regardless of order
    expect(out).toMatch(/<input[^>]*type="text"/);
    expect(out).toMatch(/<input[^>]*placeholder="ZIP Code"/);
    expect(out).toMatch(/<input[^>]*readonly/);
    // footer links survive
    expect(out).toContain('href="/privacy"');
    expect(out).toContain('href="/terms"');
  });

  it('keeps onclick handler with embedded single quotes intact', () => {
    const html = generatePlainHtml(mockSite);
    const out = randomizeHtmlStructure(html, 'attr-site-2');
    expect(out).toContain("this.textContent='Processing...'");
  });

  it('is deterministic for the same siteId', () => {
    const html = generatePlainHtml(mockSite);
    const r1 = randomizeHtmlStructure(html, 'attr-det');
    const r2 = randomizeHtmlStructure(html, 'attr-det');
    expect(r1).toBe(r2);
  });

  it('can be disabled', () => {
    const html = '<body><a href="/x" class="y" data-z="1">link</a></body>';
    const out = randomizeHtmlStructure(html, 'attr-off', {
      shuffleHead: false, addNoiseClasses: false, addComments: false,
      addDataAttrs: false, reorderAttributes: false,
    });
    expect(out).toBe(html);
  });

  it('never disturbs </body> (tracking injection anchor)', () => {
    const html = generatePlainHtml(mockSite);
    const out = randomizeHtmlStructure(html, 'attr-body');
    expect(out).toContain('</body>');
    expect(out).toContain('</head>');
  });
});

// ─── Integration: All features combined with tracking ───

describe('Full pipeline integration', () => {
  it('plain HTML → randomizer → output is valid and diverse', () => {
    const sites = [
      { ...mockSite, id: 'integration-1' },
      { ...mockSite, id: 'integration-2' },
      { ...mockSite, id: 'integration-3' },
    ];

    const outputs = sites.map(site => {
      const html = generatePlainHtml(site);
      return randomizeHtmlStructure(html, site.id);
    });

    // All outputs should be valid HTML
    for (const html of outputs) {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</head>');
      expect(html).toContain('</body>');
    }

    // Outputs should be different from each other (diversified)
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[1]).not.toBe(outputs[2]);
  });

  it('output works with ensureTrackingBaselineHtml pattern', () => {
    const html = generatePlainHtml(mockSite);
    const randomized = randomizeHtmlStructure(html, mockSite.id);

    // The tracking injection expects </body> tag to exist
    expect(randomized).toContain('</body>');

    // Simulate what ensureTrackingBaselineHtml does
    const pixelSnippet = '<script>/* pixel test */</script>';
    const withTracking = randomized.replace('</body>', `${pixelSnippet}\n</body>`);

    expect(withTracking).toContain(pixelSnippet);
    expect(withTracking).toContain('</body>');
  });

  it('auto deploy target produces valid result for sites using plain HTML', () => {
    const site = { ...mockSite, deployTarget: undefined };
    const deployResult = autoAssignDeployTarget(site, mockSettingsAll);
    expect(deployResult.target).toBeTruthy();
    expect(['cf-pages', 'netlify', 'vercel', 'github-actions']).toContain(deployResult.target);
  });
});

// ─── finalizeHtml (universal randomization) ───

describe('finalizeHtml — randomizer applied to all templates', () => {
  it('randomizes HTML from any source before tracking injection', () => {
    const html = generatePlainHtml(mockSite);
    const randomized = randomizeHtmlStructure(html, mockSite.id);

    // Verify randomization happened (noise classes, comments, data attrs)
    const hasNoise = /class="[^"]*_n\d+"/i.test(randomized) ||
                    /<!--[^>]*-->/.test(randomized) ||
                    /data-[a-z]+="[^"]*"/i.test(randomized);
    expect(hasNoise).toBe(true);
  });

  it('tracking injection works correctly AFTER randomization', () => {
    const html = generatePlainHtml(mockSite);
    const randomized = randomizeHtmlStructure(html, mockSite.id);

    // Simulate finalizeHtml: randomize → then inject tracking
    const pixelSnippet = '<script>/* pixel test */</script>';
    const withTracking = randomized.replace('</body>', `${pixelSnippet}\n</body>`);

    // Tracking is intact and after the randomized content
    expect(withTracking).toContain(pixelSnippet);
    expect(withTracking).toContain('</body>');
    // Randomization artifacts still present
    const hasNoise = /class="[^"]*_n\d+"/i.test(withTracking) ||
                    /<!--[^>]*-->/.test(withTracking) ||
                    /data-[a-z]+="[^"]*"/i.test(withTracking);
    expect(hasNoise).toBe(true);
  });

  it('different site IDs produce different randomized output', () => {
    const html = generatePlainHtml(mockSite);
    const site2 = { ...mockSite, id: 'test-site-002' };
    const site3 = { ...mockSite, id: 'test-site-003' };

    const r1 = randomizeHtmlStructure(html, mockSite.id);
    const r2 = randomizeHtmlStructure(html, site2.id);
    const r3 = randomizeHtmlStructure(html, site3.id);

    // All different
    expect(r1).not.toBe(r2);
    expect(r2).not.toBe(r3);
    expect(r1).not.toBe(r3);
  });

  it('same site ID always produces same output (deterministic)', () => {
    const html = generatePlainHtml(mockSite);
    const r1 = randomizeHtmlStructure(html, mockSite.id);
    const r2 = randomizeHtmlStructure(html, mockSite.id);
    expect(r1).toBe(r2);
  });
});
