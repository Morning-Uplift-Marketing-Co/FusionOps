/**
 * Template Analyzer
 * =================
 * Smart parser for AI-generated template imports (Bolt.new, Lovable, v0, AI IDEs).
 *
 * Responsibilities:
 *   1. identifyFramework()  — Detect project type from file structure + content
 *   2. detectDependencies() — Find external libs (Tailwind, Lucide, shadcn, etc.)
 *   3. resolveEntryPoint()  — Find the main renderable file regardless of structure
 *   4. analyzeTemplate()    — Full analysis: framework + deps + entry + issues
 *
 * Design decisions:
 *   - Pure functions, no side effects, no network calls
 *   - Works on a { [path]: content } file map (same format as JSZip output)
 *   - Scoring-based detection — the highest-confidence match wins
 *   - Every result includes a `confidence` field (0–1) so callers can show warnings
 */

// ─── Framework Detection ─────────────────────────────────────────────────────

/**
 * @typedef {'astro'|'vite-react'|'next'|'html-static'|'unknown'} FrameworkId
 *
 * @typedef {Object} FrameworkResult
 * @property {FrameworkId} id
 * @property {string}      label       — Human-readable label ("Astro 5", "Vite + React")
 * @property {number}      confidence  — 0–1
 * @property {string[]}    evidence    — Which signals matched
 * @property {boolean}     buildRequired — Whether the project needs `npm build` before serving
 */

const FRAMEWORK_SIGNALS = [
  // ─── Astro ───────────────────────────────
  {
    id: 'astro',
    label: 'Astro',
    buildRequired: false, // We can server-side compile Astro components
    signals: [
      { test: (keys) => keys.some(k => k === 'astro.config.mjs' || k === 'astro.config.ts'), weight: 0.35, desc: 'astro.config found' },
      { test: (keys) => keys.some(k => /src\/pages\/.*\.astro$/.test(k)),                     weight: 0.30, desc: 'src/pages/*.astro files' },
      { test: (keys) => keys.some(k => k.endsWith('.astro')),                                  weight: 0.15, desc: '.astro files present' },
      { test: (keys, files) => hasPkgDep(files, 'astro'),                                     weight: 0.15, desc: 'astro in package.json' },
      { test: (keys) => keys.some(k => /src\/layouts\/.*\.astro$/.test(k)),                    weight: 0.05, desc: 'Layout.astro found' },
    ],
  },
  // ─── Vite + React (Lovable, v0, Bolt sometimes) ──
  {
    id: 'vite-react',
    label: 'Vite + React',
    buildRequired: true,
    signals: [
      { test: (keys) => keys.some(k => k === 'vite.config.ts' || k === 'vite.config.js'),     weight: 0.25, desc: 'vite.config found' },
      { test: (keys) => keys.some(k => /src\/main\.(tsx?|jsx?)$/.test(k)),                     weight: 0.25, desc: 'src/main.tsx entry' },
      { test: (keys) => keys.some(k => /src\/App\.(tsx?|jsx?)$/.test(k)),                      weight: 0.15, desc: 'src/App.tsx found' },
      { test: (keys, files) => hasPkgDep(files, 'react'),                                     weight: 0.15, desc: 'react in package.json' },
      { test: (keys, files) => hasPkgDep(files, 'vite'),                                      weight: 0.10, desc: 'vite in package.json' },
      { test: (keys) => keys.some(k => k === 'tailwind.config.ts' || k === 'tailwind.config.js'), weight: 0.10, desc: 'tailwind.config found' },
    ],
  },
  // ─── Next.js ─────────────────────────────
  {
    id: 'next',
    label: 'Next.js',
    buildRequired: true,
    signals: [
      { test: (keys) => keys.some(k => k === 'next.config.js' || k === 'next.config.mjs' || k === 'next.config.ts'), weight: 0.35, desc: 'next.config found' },
      { test: (keys, files) => hasPkgDep(files, 'next'),                                      weight: 0.25, desc: 'next in package.json' },
      { test: (keys) => keys.some(k => /^app\/page\.(tsx?|jsx?)$/.test(k) || /^src\/app\/page\.(tsx?|jsx?)$/.test(k)), weight: 0.20, desc: 'app/page.tsx found' },
      { test: (keys) => keys.some(k => /^pages\/index\.(tsx?|jsx?)$/.test(k)),                 weight: 0.15, desc: 'pages/index.tsx found' },
      { test: (keys) => keys.some(k => /^pages\/_app\.(tsx?|jsx?)$/.test(k)),                  weight: 0.05, desc: 'pages/_app found' },
    ],
  },
  // ─── Static HTML (Bolt.new default, manual) ──
  {
    id: 'html-static',
    label: 'Static HTML',
    buildRequired: false,
    signals: [
      { test: (keys) => keys.some(k => k === 'index.html'),                                   weight: 0.35, desc: 'root index.html' },
      { test: (keys) => !keys.some(k => /\.(astro|tsx?|jsx?)$/.test(k)),                       weight: 0.20, desc: 'no framework files' },
      { test: (keys, files) => {
        const html = findFileContent(files, 'index.html');
        return html && /<!doctype html/i.test(html);
      }, weight: 0.20, desc: 'valid HTML doctype' },
      { test: (keys) => !keys.some(k => k === 'package.json'),                                weight: 0.15, desc: 'no package.json' },
      { test: (keys, files) => {
        const html = findFileContent(files, 'index.html');
        return html && /<script|<link/.test(html);
      }, weight: 0.10, desc: 'has script/link tags' },
    ],
  },
];

/**
 * Identify the framework/tool that generated a template.
 *
 * @param {Record<string, string>} files — { "path/file.ext": "content", ... }
 * @returns {FrameworkResult}
 */
export function identifyFramework(files) {
  if (!files || typeof files !== 'object') {
    return { id: 'unknown', label: 'Unknown', confidence: 0, evidence: [], buildRequired: false };
  }

  const keys = Object.keys(files).map(k => k.replace(/\\/g, '/').replace(/^\/+/, ''));

  let best = { id: 'unknown', label: 'Unknown', confidence: 0, evidence: [], buildRequired: false };

  for (const fw of FRAMEWORK_SIGNALS) {
    let score = 0;
    const evidence = [];

    for (const sig of fw.signals) {
      try {
        if (sig.test(keys, files)) {
          score += sig.weight;
          evidence.push(sig.desc);
        }
      } catch (_e) {
        // Individual signal failure shouldn't break detection
      }
    }

    if (score > best.confidence) {
      best = {
        id: fw.id,
        label: fw.label,
        confidence: Math.min(score, 1),
        evidence,
        buildRequired: fw.buildRequired,
      };
    }
  }

  return best;
}


// ─── Dependency Detection ────────────────────────────────────────────────────

/**
 * @typedef {Object} DependencyInfo
 * @property {string}   id          — e.g. "tailwindcss", "lucide-react"
 * @property {string}   label       — Human-readable name
 * @property {string}   source      — "package.json" | "cdn-link" | "import-scan" | "class-scan"
 * @property {string}   [version]   — Detected version if available
 * @property {string}   [cdnUrl]    — CDN URL to inject for preview
 * @property {boolean}  critical    — If true, preview will break without it
 */

/** Known dependencies and how to detect + provide them */
const KNOWN_DEPS = [
  {
    id: 'tailwindcss',
    label: 'Tailwind CSS',
    critical: true,
    cdnUrl: 'https://cdn.tailwindcss.com',
    detect: (keys, files) => {
      // Check package.json
      if (hasPkgDep(files, 'tailwindcss')) return { source: 'package.json', version: getPkgDepVersion(files, 'tailwindcss') };
      // Check for tailwind config file
      if (keys.some(k => /tailwind\.config\.(js|ts|mjs|cjs)$/.test(k))) return { source: 'config-file' };
      // Check for @tailwind directives in CSS
      const cssContent = getAllCssContent(files);
      if (/@tailwind\s+(base|components|utilities)/.test(cssContent)) return { source: 'css-directive' };
      // Check for Tailwind utility classes in HTML/JSX
      const htmlContent = getAllHtmlContent(files);
      if (hasTailwindClasses(htmlContent)) return { source: 'class-scan' };
      return null;
    },
  },
  {
    id: 'lucide',
    label: 'Lucide Icons',
    critical: false,
    cdnUrl: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
    detect: (keys, files) => {
      if (hasPkgDep(files, 'lucide-react') || hasPkgDep(files, 'lucide')) {
        return { source: 'package.json', version: getPkgDepVersion(files, 'lucide-react') || getPkgDepVersion(files, 'lucide') };
      }
      const allContent = getAllContent(files);
      if (/from\s+['"]lucide-react['"]|from\s+['"]lucide['"]/.test(allContent)) return { source: 'import-scan' };
      return null;
    },
  },
  {
    id: 'shadcn-ui',
    label: 'shadcn/ui',
    critical: false, // Components are inlined, but they depend on Tailwind + CSS vars
    detect: (keys, files) => {
      // shadcn doesn't show up in package.json; detect by file structure
      if (keys.some(k => /^(src\/)?components\/ui\/(button|card|input|dialog)\.(tsx?|jsx?)$/.test(k))) {
        return { source: 'file-structure' };
      }
      // Check for shadcn CSS variables
      const cssContent = getAllCssContent(files);
      if (/--radius|--primary|--card|--destructive/.test(cssContent)) return { source: 'css-variables' };
      return null;
    },
  },
  {
    id: 'framer-motion',
    label: 'Framer Motion',
    critical: false,
    detect: (keys, files) => {
      if (hasPkgDep(files, 'framer-motion')) return { source: 'package.json' };
      const allContent = getAllContent(files);
      if (/from\s+['"]framer-motion['"]/.test(allContent)) return { source: 'import-scan' };
      return null;
    },
  },
  {
    id: 'google-fonts',
    label: 'Google Fonts',
    critical: false,
    detect: (keys, files) => {
      const htmlContent = getAllHtmlContent(files);
      const match = htmlContent.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&\s]+)/);
      if (match) return { source: 'link-tag', version: decodeURIComponent(match[1]).replace(/\+/g, ' ') };
      return null;
    },
  },
];

/**
 * Detect all external dependencies a template uses.
 *
 * @param {Record<string, string>} files
 * @returns {DependencyInfo[]}
 */
export function detectDependencies(files) {
  if (!files || typeof files !== 'object') return [];

  const keys = Object.keys(files).map(k => k.replace(/\\/g, '/').replace(/^\/+/, ''));
  const deps = [];

  for (const dep of KNOWN_DEPS) {
    try {
      const result = dep.detect(keys, files);
      if (result) {
        deps.push({
          id: dep.id,
          label: dep.label,
          source: result.source,
          version: result.version || null,
          cdnUrl: dep.cdnUrl || null,
          critical: dep.critical,
        });
      }
    } catch (_e) {
      // Individual detection failure is non-fatal
    }
  }

  return deps;
}


// ─── Entry Point Resolution ──────────────────────────────────────────────────

/**
 * @typedef {Object} EntryResult
 * @property {string|null} path     — Relative path to the entry file
 * @property {'astro'|'html'|'tsx'|'jsx'|null} type
 * @property {boolean}     renderable — Can we render this directly in an iframe?
 */

const ENTRY_CANDIDATES = [
  // Astro (highest priority)
  { pattern: 'src/pages/index.astro',   type: 'astro',  renderable: true },
  { pattern: 'pages/index.astro',       type: 'astro',  renderable: true },
  { pattern: 'index.astro',             type: 'astro',  renderable: true },
  // Static HTML
  { pattern: 'index.html',              type: 'html',   renderable: true },
  { pattern: 'public/index.html',       type: 'html',   renderable: true },
  { pattern: 'dist/index.html',         type: 'html',   renderable: true },
  // React (needs build)
  { pattern: 'src/App.tsx',             type: 'tsx',     renderable: false },
  { pattern: 'src/App.jsx',             type: 'jsx',     renderable: false },
  { pattern: 'app/page.tsx',            type: 'tsx',     renderable: false },
  { pattern: 'src/app/page.tsx',        type: 'tsx',     renderable: false },
];

/**
 * Find the main entry point of a template project.
 *
 * @param {Record<string, string>} files
 * @returns {EntryResult}
 */
export function resolveEntryPoint(files) {
  if (!files || typeof files !== 'object') {
    return { path: null, type: null, renderable: false };
  }

  const keys = Object.keys(files).map(k => k.replace(/\\/g, '/').replace(/^\/+/, ''));

  for (const candidate of ENTRY_CANDIDATES) {
    // Direct match
    if (keys.includes(candidate.pattern)) {
      return { path: candidate.pattern, type: candidate.type, renderable: candidate.renderable };
    }
    // Suffix match (handles wrapper directories)
    const suffixMatch = keys.find(k => k.endsWith('/' + candidate.pattern));
    if (suffixMatch) {
      return { path: suffixMatch, type: candidate.type, renderable: candidate.renderable };
    }
  }

  return { path: null, type: null, renderable: false };
}


// ─── CSS Variable Extraction ─────────────────────────────────────────────────

/**
 * Extract CSS custom properties used in a template.
 * Used to build the override <style> block for theming.
 *
 * @param {Record<string, string>} files
 * @returns {{ variables: Record<string, string>, hasShadcnVars: boolean }}
 */
export function extractCssVariables(files) {
  const cssContent = getAllCssContent(files) + '\n' + getAllHtmlContent(files);
  const variables = {};

  // Match CSS custom property declarations: --name: value;
  const declRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
  let m;
  while ((m = declRegex.exec(cssContent)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    if (!variables[name]) {
      variables[name] = value;
    }
  }

  // Detect shadcn/ui variable convention
  const shadcnVarNames = ['background', 'foreground', 'primary', 'secondary', 'accent', 'destructive', 'muted', 'card', 'popover', 'border', 'input', 'ring', 'radius'];
  const hasShadcnVars = shadcnVarNames.filter(v => variables[v] !== undefined).length >= 3;

  return { variables, hasShadcnVars };
}


// ─── Full Analysis ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} TemplateAnalysis
 * @property {FrameworkResult}   framework
 * @property {DependencyInfo[]}  dependencies
 * @property {EntryResult}       entry
 * @property {{ variables: Record<string, string>, hasShadcnVars: boolean }} cssVars
 * @property {string[]}          warnings
 * @property {string[]}          errors
 * @property {boolean}           canPreview   — Can we render a live preview?
 * @property {boolean}           canDeploy    — Can we deploy to CF Workers as-is?
 */

/**
 * Run full analysis on a template file map.
 *
 * @param {Record<string, string>} files
 * @returns {TemplateAnalysis}
 */
export function analyzeTemplate(files) {
  const warnings = [];
  const errors = [];

  const framework = identifyFramework(files);
  const dependencies = detectDependencies(files);
  const entry = resolveEntryPoint(files);
  const cssVars = extractCssVariables(files);

  // ─── Validation ─────────────────────────────────────
  if (!entry.path) {
    errors.push('No entry point found. Expected index.astro, index.html, or App.tsx.');
  }

  if (framework.confidence < 0.3) {
    warnings.push(`Low confidence framework detection (${(framework.confidence * 100).toFixed(0)}%). Files may not render correctly.`);
  }

  if (framework.buildRequired && !entry.renderable) {
    warnings.push(`${framework.label} templates require a build step. Preview will show a placeholder.`);
  }

  const tailwindDep = dependencies.find(d => d.id === 'tailwindcss');
  if (tailwindDep) {
    // Check if Tailwind CDN is already included in the HTML
    const htmlContent = getAllHtmlContent(files);
    const hasCdnAlready = /cdn\.tailwindcss\.com/.test(htmlContent);
    if (!hasCdnAlready) {
      warnings.push('Tailwind CSS detected but no CDN link found. Will be auto-injected for preview.');
    }
  }

  const lucideDep = dependencies.find(d => d.id === 'lucide');
  if (lucideDep && framework.id !== 'html-static') {
    warnings.push('Lucide icons detected. React-based Lucide components will be replaced with SVG equivalents in preview.');
  }

  // shadcn needs both Tailwind AND CSS variables to work
  const shadcnDep = dependencies.find(d => d.id === 'shadcn-ui');
  if (shadcnDep && !tailwindDep) {
    warnings.push('shadcn/ui components detected without Tailwind CSS. Preview styling may be incomplete.');
  }

  // File count sanity check
  const fileCount = Object.keys(files).length;
  if (fileCount > 200) {
    warnings.push(`Large template (${fileCount} files). Consider removing unused files to reduce storage.`);
  }

  // Check for node_modules leak
  const keys = Object.keys(files);
  if (keys.some(k => k.includes('node_modules/'))) {
    warnings.push('node_modules detected in upload. These should be excluded.');
  }

  const canPreview = entry.renderable || framework.id === 'html-static' || framework.id === 'astro';
  const canDeploy = !framework.buildRequired || framework.id === 'astro';

  return {
    framework,
    dependencies,
    entry,
    cssVars,
    warnings,
    errors,
    canPreview,
    canDeploy,
  };
}


// ─── Internal Helpers ────────────────────────────────────────────────────────

function parsePkgJson(files) {
  const raw = findFileContent(files, 'package.json');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_e) { return null; }
}

function hasPkgDep(files, name) {
  const pkg = parsePkgJson(files);
  if (!pkg) return false;
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

function getPkgDepVersion(files, name) {
  const pkg = parsePkgJson(files);
  if (!pkg) return null;
  return pkg.dependencies?.[name] || pkg.devDependencies?.[name] || null;
}

function findFileContent(files, filename) {
  if (!files) return null;
  // Direct match
  if (files[filename]) return files[filename];
  // Suffix match
  const key = Object.keys(files).find(k => {
    const normalized = k.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalized === filename || normalized.endsWith('/' + filename);
  });
  return key ? files[key] : null;
}

function getAllCssContent(files) {
  if (!files) return '';
  return Object.entries(files)
    .filter(([k]) => k.endsWith('.css'))
    .map(([, v]) => v)
    .join('\n');
}

function getAllHtmlContent(files) {
  if (!files) return '';
  return Object.entries(files)
    .filter(([k]) => k.endsWith('.html') || k.endsWith('.astro'))
    .map(([, v]) => v)
    .join('\n');
}

function getAllContent(files) {
  if (!files) return '';
  // Limit to first 500KB to avoid perf issues on large templates
  let total = '';
  for (const content of Object.values(files)) {
    if (typeof content === 'string') {
      total += content + '\n';
      if (total.length > 512_000) break;
    }
  }
  return total;
}

/**
 * Check if a string contains Tailwind utility classes.
 * Uses a conservative regex that avoids false positives on generic class names.
 */
function hasTailwindClasses(str) {
  if (!str) return false;
  // Match at least 2 distinct Tailwind patterns to confirm
  const patterns = [
    /\bflex\b.*\bitems-center\b/,
    /\bbg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
    /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/,
    /\bp[xy]?-\d+\b.*\bm[xy]?-\d+\b/,
    /\brounded-(?:sm|md|lg|xl|2xl|full)\b/,
    /\bgrid-cols-\d+\b/,
    /\bw-full\b.*\bh-\d+\b/,
    /\bshadow-(?:sm|md|lg|xl|2xl)\b/,
    /\bgap-\d+\b/,
  ];
  let matches = 0;
  for (const p of patterns) {
    if (p.test(str)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}
