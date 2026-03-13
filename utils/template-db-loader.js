/**
 * Template DB Loader - Load template files from D1 Database
 * Used for templates saved via Bolt.new that don't have physical directories
 */
import { writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Fetch template from API Worker D1 Database
 * @param {string} templateId - Template ID to fetch
 * @param {string} apiBase - API Worker base URL
 * @param {string} mcpSecret - MCP shared secret
 * @returns {Promise<Object|null>} Template object with files or null
 */
export async function fetchTemplateFromDB(templateId, apiBase, mcpSecret) {
  try {
    const url = `${apiBase}/api/mcp/templates`;
    const response = await fetch(url, {
      headers: {
        'x-mcp-secret': mcpSecret,
      },
    });

    if (!response.ok) {
      console.error(`[template-db-loader] Failed to fetch templates: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const template = data.data?.find((t) => t.template_id === templateId);

    if (!template) {
      console.warn(`[template-db-loader] Template not found in DB: ${templateId}`);
      return null;
    }

    // Parse files JSON
    let files = {};
    try {
      files = typeof template.files === 'string' ? JSON.parse(template.files) : template.files || {};
    } catch (e) {
      console.error(`[template-db-loader] Failed to parse files JSON:`, e.message);
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
    console.error(`[template-db-loader] Error fetching template:`, error.message);
    return null;
  }
}

/**
 * Generate temp directory from template files
 * @param {string} templateId - Template ID
 * @param {Object} files - Files object { 'path/to/file.ext': 'content' }
 * @param {string} tempRoot - Temp directory root (default: tmp/templates)
 * @returns {string} Path to generated temp directory
 */
export function generateTempDirectory(templateId, files, tempRoot = 'tmp/templates') {
  const tempDir = path.join(process.cwd(), tempRoot, templateId);

  // Clean existing temp directory
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore if doesn't exist
  }

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

  console.log(`[template-db-loader] Generated temp directory: ${tempDir}`);
  console.log(`[template-db-loader] Files written: ${Object.keys(files).length}`);

  return tempDir;
}

/**
 * Load template files from temp directory (same format as loadTemplateFiles in deploy scripts)
 * @param {string} dirPath - Directory path
 * @param {string} prefix - File path prefix
 * @returns {Object} Files object
 */
export function loadTemplateFilesFromDir(dirPath, prefix = '') {
  const files = {};

  try {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        Object.assign(files, loadTemplateFilesFromDir(`${dirPath}/${entry.name}`, rel));
      } else {
        files[rel] = readFileSync(`${dirPath}/${entry.name}`, 'utf8');
      }
    }
  } catch (e) {
    console.warn('[template-db-loader] Could not read directory:', e.message);
  }

  return files;
}

/**
 * Cleanup temp directory
 * @param {string} templateId - Template ID
 * @param {string} tempRoot - Temp directory root
 */
export function cleanupTempDirectory(templateId, tempRoot = 'tmp/templates') {
  const tempDir = path.join(process.cwd(), tempRoot, templateId);
  try {
    rmSync(tempDir, { recursive: true, force: true });
    console.log(`[template-db-loader] Cleaned up temp directory: ${tempDir}`);
  } catch (e) {
    console.warn(`[template-db-loader] Failed to cleanup temp directory:`, e.message);
  }
}
