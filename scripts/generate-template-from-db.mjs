/**
 * Generate template directory from D1 Database
 * Used by GitHub Actions workflow when physical template directory doesn't exist.
 *
 * Safety guard:
 * - Only deploy published (`active`) templates from D1
 * - Reject non-Astro templates early with a clear error in Actions logs
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const API_BASE = process.env.API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';

function parseTemplateFiles(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return {};
    }
  }
  return {};
}

function parsePackageJson(files) {
  try {
    return JSON.parse(String(files['package.json'] || '{}'));
  } catch (_error) {
    return {};
  }
}

function getAstroValidationIssues(template) {
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
    'src/pages/e.ts',
    'src/pages/robots.txt.ts',
    'public/_headers',
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

async function fetchTemplates(status = '') {
  const url = new URL(`${API_BASE}/api/templates`);
  if (status) url.searchParams.set('status', status);

  const response = await fetch(url, {
    headers: {
      Origin: 'http://localhost:4322',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch templates (${response.status})`);
  }

  return response.json();
}

async function fetchTemplateFromDB(templateId) {
  try {
    console.log(`[db-template] Fetching active templates from ${API_BASE}/api/templates?status=active`);
    const activeTemplates = await fetchTemplates('active');
    const activeTemplate = activeTemplates.find((t) => t.template_id === templateId);

    if (activeTemplate) {
      const files = parseTemplateFiles(activeTemplate.files);
      return {
        id: activeTemplate.id,
        templateId: activeTemplate.template_id,
        name: activeTemplate.name,
        status: activeTemplate.status || 'unknown',
        source: activeTemplate.badge || activeTemplate.source || 'db',
        files,
      };
    }

    console.log(`[db-template] Template ${templateId} was not found in active templates; checking all template statuses...`);
    const allTemplates = await fetchTemplates();
    const existing = allTemplates.find((t) => t.template_id === templateId);

    if (existing) {
      const status = String(existing.status || 'draft');
      console.error(`[db-template] Template ${templateId} exists in D1 but is not deployable. status=${status}`);
      console.error('[db-template] Publish the template first so it passes the quality gate and becomes active.');
      return null;
    }

    console.error(`[db-template] Template not found in D1 Database: ${templateId}`);
    return null;
  } catch (error) {
    console.error(`[db-template] Error fetching template: ${error.message}`);
    return null;
  }
}

/**
 * Fix Astro frontmatter ordering: imports must come before const/let/var declarations.
 * Templates from Bolt.new sometimes have const declarations before imports, which
 * causes esbuild to fail with "Expected ';' but found ..." errors.
 */
function fixAstroFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return content;

  const frontmatter = fmMatch[1];
  const lines = frontmatter.split('\n');

  const importLines = [];
  const otherLines = [];

  for (const line of lines) {
    if (/^\s*import\s+/.test(line)) {
      importLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  if (importLines.length === 0) return content;

  const firstImportIdx = lines.findIndex((l) => /^\s*import\s+/.test(l));
  const lastNonImportBeforeImport = lines
    .slice(0, firstImportIdx)
    .some((l) => /^\s*(const|let|var)\s+/.test(l));

  if (!lastNonImportBeforeImport) return content;

  const reordered = [...importLines, '', ...otherLines].join('\n');
  const fixed = content.replace(fmMatch[0], `---\n${reordered}\n---`);
  console.log('[db-template] Fixed Astro frontmatter order (imports moved before declarations)');
  return fixed;
}

function generateTempDirectory(templateId, files) {
  const tempDir = path.join(root, 'tmp', 'templates', templateId);

  mkdirSync(tempDir, { recursive: true });

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    const dir = path.dirname(fullPath);

    mkdirSync(dir, { recursive: true });

    let fixedContent = content;
    if (filePath.endsWith('.astro') && typeof content === 'string') {
      fixedContent = fixAstroFrontmatter(content);
    }

    writeFileSync(fullPath, fixedContent, 'utf8');
  }

  console.log(`[db-template] Generated temp directory: ${tempDir}`);
  console.log(`[db-template] Files written: ${Object.keys(files).length}`);

  return tempDir;
}

const templateId = process.argv[2];

if (!templateId) {
  console.error('Usage: node scripts/generate-template-from-db.mjs <templateId>');
  process.exit(1);
}

console.log(`[db-template] Fetching template from D1 Database: ${templateId}`);

const template = await fetchTemplateFromDB(templateId);

if (!template || !template.files) {
  console.error(`[db-template] Failed to fetch deployable template: ${templateId}`);
  process.exit(1);
}

console.log(`[db-template] Template found: ${template.name} (status: ${template.status}, source: ${template.source})`);
console.log(`[db-template] Files count: ${Object.keys(template.files).length}`);

const astroIssues = getAstroValidationIssues(template);
if (astroIssues.length > 0) {
  console.error(`[db-template] Template ${template.templateId} is not valid for Astro deploy:`);
  for (const issue of astroIssues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

const tempDir = generateTempDirectory(templateId, template.files);

console.log(`[db-template] ✅ Template directory generated successfully: ${tempDir}`);
