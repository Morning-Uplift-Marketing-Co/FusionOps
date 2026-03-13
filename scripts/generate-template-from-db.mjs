/**
 * Generate template directory from D1 Database
 * Used by GitHub Actions workflow when physical template directory doesn't exist
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const API_BASE = process.env.API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';
const MCP_SECRET = process.env.MCP_SECRET || '9f6a3c1d4e8b7a2f5c0d9e1b3a6f4c7d2e8a1b5c9d3f7a4e6b0c2d8f1a3e5b7c';

async function fetchTemplateFromDB(templateId) {
  try {
    const url = `${API_BASE}/api/mcp/templates`;
    const response = await fetch(url, {
      headers: {
        'x-mcp-secret': MCP_SECRET,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch templates: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const template = data.data?.find((t) => t.template_id === templateId);

    if (!template) {
      console.error(`Template not found in D1 Database: ${templateId}`);
      return null;
    }

    let files = {};
    try {
      files = typeof template.files === 'string' ? JSON.parse(template.files) : template.files || {};
    } catch (e) {
      console.error(`Failed to parse files JSON:`, e.message);
      return null;
    }

    return {
      id: template.id,
      templateId: template.template_id,
      name: template.name,
      source: template.badge || template.source || 'db',
      files,
    };
  } catch (error) {
    console.error(`Error fetching template:`, error.message);
    return null;
  }
}

function generateTempDirectory(templateId, files) {
  const tempDir = path.join(root, 'tmp', 'templates', templateId);

  // Create temp directory
  mkdirSync(tempDir, { recursive: true });

  // Write all files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    const dir = path.dirname(fullPath);

    // Create subdirectories if needed
    mkdirSync(dir, { recursive: true });

    // Write file
    writeFileSync(fullPath, content, 'utf8');
  }

  console.log(`Generated temp directory: ${tempDir}`);
  console.log(`Files written: ${Object.keys(files).length}`);

  return tempDir;
}

// CLI usage
const templateId = process.argv[2];

if (!templateId) {
  console.error('Usage: node scripts/generate-template-from-db.mjs <templateId>');
  process.exit(1);
}

console.log(`Fetching template from D1 Database: ${templateId}`);

const template = await fetchTemplateFromDB(templateId);

if (!template || !template.files) {
  console.error(`Failed to fetch template: ${templateId}`);
  process.exit(1);
}

console.log(`Template found: ${template.name} (source: ${template.source})`);

const tempDir = generateTempDirectory(templateId, template.files);

console.log(`✅ Template directory generated successfully: ${tempDir}`);
process.exit(0);
