/**
 * Pure validation for templates materialized from D1 (CI: generate-template-from-db).
 * Exported for unit tests and used by scripts/generate-template-from-db.mjs.
 */

/** Normalize ZIP/MCP keys so validation matches Linux CI paths (backslashes, leading ./). */
export function normalizeTemplateFiles(files) {
  const raw = files && typeof files === 'object' ? files : {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = String(k).trim().replace(/\\/g, '/').replace(/^\.\//, '');
    out[nk] = v;
  }
  return out;
}

export function parsePackageJson(files) {
  try {
    return JSON.parse(String(files['package.json'] || '{}'));
  } catch (_error) {
    return {};
  }
}

export function getAstroValidationIssues(template) {
  const files = template?.files || {};
  const keys = Object.keys(files);
  const pkg = parsePackageJson(files);
  const buildScript = String(pkg?.scripts?.build || '');
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  const requiredFiles = [
    'package.json',
    'src/pages/index.astro',
    'src/layouts/Layout.astro',
  ];
  const issues = [];

  for (const requiredFile of requiredFiles) {
    if (!keys.includes(requiredFile)) {
      issues.push(`Missing required Astro deploy file: ${requiredFile}`);
    }
  }

  const hasAstroBuild =
    buildScript.includes('astro build') ||
    buildScript.includes('astro check') ||
    Boolean(deps.astro) ||
    keys.includes('astro.config.mjs') ||
    keys.includes('astro.config.ts');

  if (!hasAstroBuild) {
    issues.push('Template is not Astro-based (missing astro build signal in package.json/config).');
  }

  return issues;
}

/** Loveable / Vite+React LP — must be buildable with npm run build in CI */
export function getViteValidationIssues(template) {
  const files = template?.files || {};
  const keys = Object.keys(files);
  const issues = [];

  if (!keys.includes('package.json')) {
    issues.push('Missing package.json');
    return issues;
  }

  const pkg = parsePackageJson(files);
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  };
  const buildScript = String(pkg?.scripts?.build || '').trim();

  const hasViteDep = Boolean(deps.vite);
  const hasViteConfig = keys.some((k) => /(^|\/)vite\.config\.(ts|mts|cts|js|mjs|cjs)$/i.test(k));

  if (!hasViteDep && !hasViteConfig) {
    issues.push('Missing Vite (no vite dependency and no vite.config.*)');
  }

  if (!keys.includes('index.html')) {
    issues.push('Missing root index.html (required for Vite)');
  }

  const mainEntry = ['src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js'].find((k) => keys.includes(k));
  if (!mainEntry) {
    issues.push('Missing src/main.tsx or src/main.jsx (or main.ts/js)');
  }

  if (!buildScript) {
    issues.push('Missing npm build script in package.json');
  } else if (!/\b(npx\s+)?vite\s+build\b/i.test(buildScript)) {
    issues.push('package.json build script should run vite build (or npx vite build)');
  }

  return issues;
}

/** @returns {{ stack: 'astro' | 'vite' | null, astroIssues: string[], viteIssues: string[], files: Record<string, unknown> }} */
export function resolveDeployStack(template) {
  const files = normalizeTemplateFiles(template?.files);
  const t = { ...template, files };
  const astroIssues = getAstroValidationIssues(t);
  const viteIssues = getViteValidationIssues(t);
  if (astroIssues.length === 0) {
    return { stack: 'astro', astroIssues, viteIssues, files };
  }
  if (viteIssues.length === 0) {
    return { stack: 'vite', astroIssues, viteIssues, files };
  }
  return { stack: null, astroIssues, viteIssues, files };
}
