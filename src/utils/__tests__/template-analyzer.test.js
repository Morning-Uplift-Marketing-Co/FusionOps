/**
 * Tests for template-analyzer.js
 * Tests: identifyFramework, detectDependencies, resolveEntryPoint, extractCssVariables, analyzeTemplate
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  identifyFramework,
  detectDependencies,
  resolveEntryPoint,
  extractCssVariables,
  analyzeTemplate,
  getTemplateFileContent,
  normalizeTemplatePath,
} from '../template-analyzer.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const ASTRO_PROJECT = {
  'package.json': JSON.stringify({ dependencies: { astro: '^5.2.0' } }),
  'astro.config.mjs': 'import { defineConfig } from "astro/config";\nexport default defineConfig({});',
  'src/pages/index.astro': '---\nconst title = "Hello";\n---\n<html><head><title>{title}</title></head><body><h1>Hello</h1></body></html>',
  'src/layouts/Layout.astro': '<html><head><slot /></head><body><slot /></body></html>',
  'src/styles/global.css': 'body { margin: 0; }',
};

const VITE_REACT_PROJECT = {
  'package.json': JSON.stringify({
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    devDependencies: { vite: '^5.0.0', tailwindcss: '^3.4.0', 'lucide-react': '^0.300.0' },
  }),
  'vite.config.ts': 'import { defineConfig } from "vite";\nexport default defineConfig({});',
  'tailwind.config.ts': 'export default { content: ["./src/**/*.tsx"] };',
  'index.html': '<!DOCTYPE html>\n<html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
  'src/main.tsx': 'import React from "react";\nimport App from "./App";\nReactDOM.render(<App />, document.getElementById("root"));',
  'src/App.tsx': 'export default function App() { return <div className="flex items-center p-4"><h1 className="text-2xl font-bold">Hello</h1></div>; }',
  'src/components/ui/button.tsx': 'export function Button() { return <button>Click</button>; }',
  'src/index.css': ':root {\n  --background: 0 0% 100%;\n  --foreground: 222.2 84% 4.9%;\n  --primary: 217 91% 60%;\n  --radius: 0.5rem;\n}\n@tailwind base;\n@tailwind components;\n@tailwind utilities;',
};

const NEXTJS_PROJECT = {
  'package.json': JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.2.0' } }),
  'next.config.js': 'module.exports = {};',
  'app/page.tsx': 'export default function Page() { return <h1>Hello</h1>; }',
  'app/layout.tsx': 'export default function Layout({ children }) { return <html><body>{children}</body></html>; }',
};

const BOLT_STATIC_PROJECT = {
  'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>My Site</title>\n<script src="https://cdn.tailwindcss.com"></script></head>\n<body><div class="flex items-center justify-center min-h-screen bg-blue-50"><h1 class="text-3xl font-bold text-blue-600">Hello from Bolt</h1></div></body></html>',
  'style.css': '.hero { padding: 2rem; }',
};

const MINIMAL_HTML = {
  'index.html': '<html><head><title>Minimal</title></head><body><h1>Hello</h1></body></html>',
};

const ASTRO_VERDANT_HTML = {
  'index.html': fs.readFileSync(path.resolve('templates/astro-verdant/index_html.txt'), 'utf8'),
};

const SHADCN_CSS = {
  'index.html': '<!DOCTYPE html><html><head></head><body><div class="bg-primary text-primary-foreground p-4 rounded-lg">Card</div></body></html>',
  'src/index.css': ':root {\n  --background: 0 0% 100%;\n  --foreground: 222.2 84% 4.9%;\n  --primary: 222.2 47.4% 11.2%;\n  --primary-foreground: 210 40% 98%;\n  --secondary: 210 40% 96.1%;\n  --muted: 210 40% 96.1%;\n  --accent: 210 40% 96.1%;\n  --destructive: 0 84.2% 60.2%;\n  --border: 214.3 31.8% 91.4%;\n  --input: 214.3 31.8% 91.4%;\n  --ring: 222.2 84% 4.9%;\n  --radius: 0.5rem;\n}',
};

// ─── identifyFramework ──────────────────────────────────────────────────────

describe('identifyFramework', () => {
  it('should detect Astro projects', () => {
    const result = identifyFramework(ASTRO_PROJECT);
    expect(result.id).toBe('astro');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.buildRequired).toBe(false);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('should detect Vite + React projects', () => {
    const result = identifyFramework(VITE_REACT_PROJECT);
    expect(result.id).toBe('vite-react');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.buildRequired).toBe(true);
  });

  it('should detect Next.js projects', () => {
    const result = identifyFramework(NEXTJS_PROJECT);
    expect(result.id).toBe('next');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.buildRequired).toBe(true);
  });

  it('should detect static HTML projects', () => {
    const result = identifyFramework(BOLT_STATIC_PROJECT);
    expect(result.id).toBe('html-static');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.buildRequired).toBe(false);
  });

  it('should detect minimal HTML as static', () => {
    const result = identifyFramework(MINIMAL_HTML);
    expect(result.id).toBe('html-static');
  });

  it('should return unknown for empty input', () => {
    expect(identifyFramework({}).id).toBe('unknown');
    expect(identifyFramework(null).id).toBe('unknown');
    expect(identifyFramework(undefined).id).toBe('unknown');
  });

  it('should prefer Astro over HTML when both signals present', () => {
    const mixed = {
      ...ASTRO_PROJECT,
      'index.html': '<html><body>fallback</body></html>',
    };
    const result = identifyFramework(mixed);
    expect(result.id).toBe('astro');
  });

  it('should include evidence descriptions', () => {
    const result = identifyFramework(ASTRO_PROJECT);
    expect(result.evidence).toContain('astro.config found');
    expect(result.evidence).toContain('src/pages/*.astro files');
  });
});

// ─── detectDependencies ─────────────────────────────────────────────────────

describe('detectDependencies', () => {
  it('should detect Tailwind from package.json', () => {
    const deps = detectDependencies(VITE_REACT_PROJECT);
    const tw = deps.find(d => d.id === 'tailwindcss');
    expect(tw).toBeTruthy();
    expect(tw.source).toBe('package.json');
    expect(tw.critical).toBe(true);
    expect(tw.cdnUrl).toContain('tailwindcss');
  });

  it('should detect Tailwind from class usage in HTML', () => {
    const deps = detectDependencies(BOLT_STATIC_PROJECT);
    const tw = deps.find(d => d.id === 'tailwindcss');
    expect(tw).toBeTruthy();
    // Should detect from class-scan since there's no package.json
    expect(['class-scan', 'config-file', 'css-directive', 'package.json']).toContain(tw.source);
  });

  it('should detect Lucide from package.json', () => {
    const deps = detectDependencies(VITE_REACT_PROJECT);
    const lucide = deps.find(d => d.id === 'lucide');
    expect(lucide).toBeTruthy();
    expect(lucide.source).toBe('package.json');
  });

  it('should detect shadcn/ui from file structure', () => {
    const deps = detectDependencies(VITE_REACT_PROJECT);
    const shadcn = deps.find(d => d.id === 'shadcn-ui');
    expect(shadcn).toBeTruthy();
  });

  it('should detect shadcn/ui from CSS variables', () => {
    const deps = detectDependencies(SHADCN_CSS);
    const shadcn = deps.find(d => d.id === 'shadcn-ui');
    expect(shadcn).toBeTruthy();
    expect(shadcn.source).toBe('css-variables');
  });

  it('should detect Google Fonts from link tags', () => {
    const files = {
      'index.html': '<html><head><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet"></head><body></body></html>',
    };
    const deps = detectDependencies(files);
    const gf = deps.find(d => d.id === 'google-fonts');
    expect(gf).toBeTruthy();
    expect(gf.version).toContain('Inter');
  });

  it('should return empty array for no dependencies', () => {
    expect(detectDependencies(MINIMAL_HTML)).toEqual([]);
  });

  it('should handle null/undefined input', () => {
    expect(detectDependencies(null)).toEqual([]);
    expect(detectDependencies(undefined)).toEqual([]);
  });
});

// ─── resolveEntryPoint ──────────────────────────────────────────────────────

describe('resolveEntryPoint', () => {
  it('should find Astro entry point', () => {
    const result = resolveEntryPoint(ASTRO_PROJECT);
    expect(result.path).toBe('src/pages/index.astro');
    expect(result.type).toBe('astro');
    expect(result.renderable).toBe(true);
  });

  it('should find HTML entry point', () => {
    const result = resolveEntryPoint(BOLT_STATIC_PROJECT);
    expect(result.path).toBe('index.html');
    expect(result.type).toBe('html');
    expect(result.renderable).toBe(true);
  });

  it('should find React entry point (not renderable)', () => {
    // Project with only TSX, no index.html
    const tsxOnly = {
      'src/App.tsx': 'export default function App() {}',
      'src/main.tsx': 'import App from "./App";',
    };
    const result = resolveEntryPoint(tsxOnly);
    expect(result.type).toBe('tsx');
    expect(result.renderable).toBe(false);
  });

  it('should prefer Astro over HTML', () => {
    const mixed = {
      'src/pages/index.astro': '<html></html>',
      'index.html': '<html></html>',
    };
    const result = resolveEntryPoint(mixed);
    expect(result.type).toBe('astro');
  });

  it('should prefer dist/index.html over Astro when both exist', () => {
    const built = {
      ...ASTRO_PROJECT,
      'dist/index.html':
        '<!DOCTYPE html><html><head><title>Built</title></head><body><h1>Built</h1></body></html>',
    };
    const result = resolveEntryPoint(built);
    expect(result.path).toBe('dist/index.html');
    expect(result.type).toBe('html');
    expect(result.renderable).toBe(true);
  });

  it('should find entry via suffix match', () => {
    const wrapped = {
      'my-project/src/pages/index.astro': '<html></html>',
    };
    const result = resolveEntryPoint(wrapped);
    expect(result.path).toBe('my-project/src/pages/index.astro');
    expect(result.type).toBe('astro');
  });

  it('should return null for no entry point', () => {
    const result = resolveEntryPoint({ 'readme.md': '# Hello' });
    expect(result.path).toBeNull();
    expect(result.type).toBeNull();
    expect(result.renderable).toBe(false);
  });
});

describe('getTemplateFileContent', () => {
  it('reads dist/index.html when the key uses backslashes', () => {
    const files = { 'dist\\index.html': '<html>ok</html>' };
    expect(getTemplateFileContent(files, 'dist/index.html')).toBe('<html>ok</html>');
  });

  it('matches nested dist paths', () => {
    const files = { 'pkg/dist/index.html': '<html>n</html>' };
    expect(getTemplateFileContent(files, 'dist/index.html')).toBe('<html>n</html>');
  });
});

describe('normalizeTemplatePath', () => {
  it('normalizes backslashes and leading slashes', () => {
    expect(normalizeTemplatePath('dist\\index.html')).toBe('dist/index.html');
    expect(normalizeTemplatePath('/dist/index.html')).toBe('dist/index.html');
  });
});

// ─── extractCssVariables ────────────────────────────────────────────────────

describe('extractCssVariables', () => {
  it('should extract CSS custom properties', () => {
    const result = extractCssVariables(SHADCN_CSS);
    expect(result.variables.primary).toBeDefined();
    expect(result.variables.background).toBeDefined();
    expect(result.variables.radius).toBe('0.5rem');
  });

  it('should detect shadcn convention (3+ matching vars)', () => {
    const result = extractCssVariables(SHADCN_CSS);
    expect(result.hasShadcnVars).toBe(true);
  });

  it('should not flag shadcn for generic CSS vars', () => {
    const files = {
      'style.css': ':root { --color-primary: blue; --color-bg: white; }',
    };
    const result = extractCssVariables(files);
    expect(result.hasShadcnVars).toBe(false);
    expect(result.variables['color-primary']).toBe('blue');
  });

  it('should handle files with no CSS vars', () => {
    const result = extractCssVariables(MINIMAL_HTML);
    expect(Object.keys(result.variables).length).toBe(0);
    expect(result.hasShadcnVars).toBe(false);
  });
});

// ─── analyzeTemplate (full pipeline) ────────────────────────────────────────

describe('analyzeTemplate', () => {
  it('should fully analyze an Astro project', () => {
    const result = analyzeTemplate(ASTRO_PROJECT);
    expect(result.framework.id).toBe('astro');
    expect(result.entry.path).toBe('src/pages/index.astro');
    expect(result.errors).toHaveLength(0);
    expect(result.canPreview).toBe(true);
    expect(result.canDeploy).toBe(true);
  });

  it('should fully analyze a Vite+React project', () => {
    const result = analyzeTemplate(VITE_REACT_PROJECT);
    expect(result.framework.id).toBe('vite-react');
    expect(result.framework.buildRequired).toBe(true);
    expect(result.dependencies.length).toBeGreaterThan(0);
    expect(result.dependencies.find(d => d.id === 'tailwindcss')).toBeTruthy();
    expect(result.cssVars.hasShadcnVars).toBe(true);
    expect(result.canDeploy).toBe(false); // needs build
  });

  it('should fully analyze a static HTML project', () => {
    const result = analyzeTemplate(BOLT_STATIC_PROJECT);
    expect(result.framework.id).toBe('html-static');
    expect(result.entry.path).toBe('index.html');
    expect(result.errors).toHaveLength(0);
    expect(result.canPreview).toBe(true);
    expect(result.canDeploy).toBe(true);
  });

  it('should fully analyze the astro-verdant HTML template fixture', () => {
    const result = analyzeTemplate(ASTRO_VERDANT_HTML);
    expect(result.framework.id).toBe('html-static');
    expect(result.entry.path).toBe('index.html');
    expect(result.errors).toHaveLength(0);
    expect(result.canPreview).toBe(true);
    expect(result.canDeploy).toBe(true);
  });

  it('should error on empty/invalid projects', () => {
    const result = analyzeTemplate({ 'readme.md': '# No entry' });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('No entry point');
  });

  it('should warn about missing Tailwind CDN', () => {
    // Has Tailwind classes but no CDN
    const files = {
      'index.html': '<!DOCTYPE html><html><head></head><body><div class="flex items-center p-4 rounded-lg bg-blue-500 text-sm gap-4">Hi</div></body></html>',
    };
    const result = analyzeTemplate(files);
    const twWarning = result.warnings.find(w => w.includes('Tailwind'));
    expect(twWarning).toBeTruthy();
  });

  it('should warn about build-required frameworks', () => {
    const result = analyzeTemplate(VITE_REACT_PROJECT);
    const buildWarning = result.warnings.find(w => w.includes('build step'));
    expect(buildWarning).toBeTruthy();
  });

  it('should warn about large templates', () => {
    const large = {};
    for (let i = 0; i < 201; i++) {
      large[`file-${i}.txt`] = 'content';
    }
    large['index.html'] = '<!DOCTYPE html><html><body></body></html>';
    const result = analyzeTemplate(large);
    const sizeWarning = result.warnings.find(w => w.includes('Large template'));
    expect(sizeWarning).toBeTruthy();
  });
});
