/**
 * Deploy script with auto-generate template directory from D1 Database
 * Supports both physical template directories and DB-only templates (from Bolt.new)
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Import template DB loader
import {
  fetchTemplateFromDB,
  generateTempDirectory,
  loadTemplateFilesFromDir,
  cleanupTempDirectory,
} from '../utils/template-db-loader.js';

// Load env
function loadEnv() {
  try {
    const envPath = path.join(root, '.env');
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const API_BASE = env.VITE_API_BASE_URL || 'https://lp-factory-api.misty-feather-556e.workers.dev';
const MCP_SECRET = '9f6a3c1d4e8b7a2f5c0d9e1b3a6f4c7d2e8a1b5c9d3f7a4e6b0c2d8f1a3e5b7c';

/**
 * Load template files - auto-detect from physical directory or D1 Database
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Template files object
 */
async function loadTemplateFiles(templateId) {
  // Check if physical directory exists
  const templateDir = path.join(root, 'templates', templateId);
  
  if (existsSync(templateDir)) {
    console.log(`[deploy] Loading template from physical directory: ${templateDir}`);
    return loadTemplateFilesFromPhysicalDir(templateDir);
  }

  // Physical directory not found - try D1 Database
  console.log(`[deploy] Physical directory not found, fetching from D1 Database...`);
  const template = await fetchTemplateFromDB(templateId, API_BASE, MCP_SECRET);

  if (!template || !template.files) {
    throw new Error(`Template not found: ${templateId} (not in filesystem or D1 Database)`);
  }

  console.log(`[deploy] Template found in D1 Database (source: ${template.source})`);
  console.log(`[deploy] Generating temp directory...`);

  // Generate temp directory from DB files
  const tempDir = generateTempDirectory(templateId, template.files);

  // Load files from temp directory
  const files = loadTemplateFilesFromDir(tempDir);

  return { files, tempDir, fromDB: true };
}

/**
 * Load template files from physical directory
 * @param {string} dirPath - Directory path
 * @param {string} prefix - File path prefix
 * @returns {Object} Files object
 */
function loadTemplateFilesFromPhysicalDir(dirPath, prefix = '') {
  const files = {};
  try {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        Object.assign(files, loadTemplateFilesFromPhysicalDir(`${dirPath}/${entry.name}`, rel));
      } else {
        files[rel] = readFileSync(`${dirPath}/${entry.name}`, 'utf8');
      }
    }
  } catch (e) {
    console.warn('[deploy] Could not read template dir:', e.message);
  }
  return { files, fromDB: false };
}

/**
 * Main deploy function
 * @param {Object} site - Site configuration
 */
export async function deploySite(site) {
  const { templateId } = site;

  if (!templateId) {
    throw new Error('Site configuration missing templateId');
  }

  console.log(`[deploy] Deploying site: ${site.domain || site.brand}`);
  console.log(`[deploy] Template ID: ${templateId}`);

  let tempDir = null;
  let fromDB = false;

  try {
    // Load template files (auto-detect from filesystem or D1)
    const result = await loadTemplateFiles(templateId);
    const templateFiles = result.files;
    tempDir = result.tempDir;
    fromDB = result.fromDB;

    console.log(`[deploy] Template files loaded: ${Object.keys(templateFiles).length} files`);
    console.log(`[deploy] Source: ${fromDB ? 'D1 Database (Bolt.new)' : 'Physical directory'}`);

    // Import template router
    const { generateDeployAssetsByTemplate } = await import('../utils/template-router.js');
    const { setCustomTemplatesCache } = await import('../utils/template-registry.js');

    // Inject into cache
    setCustomTemplatesCache([
      {
        id: templateId,
        dbId: templateId,
        name: templateId,
        source: fromDB ? 'bolt' : 'local',
        files: templateFiles,
      },
    ]);

    // Generate HTML
    console.log('[deploy] Generating HTML...');
    const result2 = await Promise.resolve(generateDeployAssetsByTemplate(site));
    const indexHtml = typeof result2 === 'string' ? result2 : result2?.['/index.html'] || result2?.['/'];

    if (!indexHtml || indexHtml.length < 100) {
      throw new Error('Failed to generate HTML');
    }

    console.log(`[deploy] ✅ HTML generated successfully (${indexHtml.length} bytes)`);
    console.log(`[deploy] Next: Deploy to Cloudflare Pages/Workers`);

    return { success: true, html: indexHtml, fromDB };
  } catch (error) {
    console.error(`[deploy] ❌ Deploy failed:`, error.message);
    throw error;
  } finally {
    // Cleanup temp directory if created
    if (tempDir && fromDB) {
      cleanupTempDirectory(templateId);
    }
  }
}

// CLI usage
const isMainModule = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));

if (isMainModule) {
  const configFile = process.env.CONFIG_FILE || process.argv[2];

  if (!configFile) {
    console.error('Usage: CONFIG_FILE=deploy-configs/example.json node scripts/deploy-site-with-db-template.mjs');
    console.error('   or: node scripts/deploy-site-with-db-template.mjs deploy-configs/example.json');
    process.exit(1);
  }

  console.log(`[deploy] Loading config: ${configFile}`);
  const configPath = path.join(root, configFile);
  const siteConfig = JSON.parse(readFileSync(configPath, 'utf8'));

  deploySite(siteConfig)
    .then(() => {
      console.log('[deploy] ✅ Deploy completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[deploy] ❌ Deploy failed:', error.message);
      process.exit(1);
    });
}
