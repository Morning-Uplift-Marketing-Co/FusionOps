/**
 * Template Structure Normalizer
 * =============================
 * Standardizes imported template directory structure and ensures required config files exist.
 *
 * Normalization steps:
 *   1. Move pages/ and components/ to src/ if src/ doesn't exist
 *   2. Create astro.config.mjs if missing (for Astro projects)
 *   3. Create tsconfig.json if missing
 *   4. Detect and return entry point
 *
 * Works on file maps (same format as JSZip output) and returns new object
 * with normalized structure and metadata.
 */

import { resolveEntryPoint } from './template-analyzer.js';

/**
 * Check if a directory exists in the file map
 * @param {Record<string, string>} files - File map
 * @param {string} dirPath - Directory path to check (e.g., "src")
 * @returns {boolean} True if any file starts with dirPath/
 */
function hasDirectory(files, dirPath) {
  const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
  return Object.keys(files).some(path => path.startsWith(prefix));
}

/**
 * Generate default Astro configuration
 * @returns {string} Valid astro.config.mjs content
 */
function generateDefaultAstroConfig() {
  return `export default {
  integrations: [],
  output: 'static',
};
`;
}

/**
 * Generate default TypeScript configuration
 * @returns {string} Valid tsconfig.json content
 */
function generateDefaultTsconfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        moduleResolution: 'bundler',
        module: 'ESNext',
        jsx: 'react-jsx',
      },
    },
    null,
    2
  );
}

/**
 * Check if package.json mentions Astro
 * @param {string} packageJsonContent - Content of package.json
 * @returns {boolean} True if astro is mentioned in package.json
 */
function isAstroProject(packageJsonContent) {
  try {
    const pkg = JSON.parse(packageJsonContent);
    return (
      (pkg.dependencies && pkg.dependencies.astro) ||
      (pkg.devDependencies && pkg.devDependencies.astro)
    );
  } catch {
    return false;
  }
}

/**
 * Normalize template structure to standard layout
 *
 * @param {Record<string, string>} files - File map { "path/file.ext": "content" }
 * @returns {Object} Object with structure:
 *   {
 *     files: { normalized file map },
 *     entryPoint: "src/pages/index.astro" or null,
 *     changes: ["moved pages/ to src/pages/", ...]
 *   }
 */
export function normalizeTemplate(files) {
  if (!files || typeof files !== 'object') {
    return {
      files: files || {},
      entryPoint: null,
      changes: [],
    };
  }

  const normalized = { ...files };
  const changes = [];

  // Step 1: Move pages/ and components/ to src/ if src/ doesn't exist
  if (!hasDirectory(normalized, 'src')) {
    const newFiles = {};

    for (const [path, content] of Object.entries(normalized)) {
      // Move pages/ to src/pages/
      if (path.startsWith('pages/')) {
        newFiles[`src/${path}`] = content;
      }
      // Move components/ to src/components/
      else if (path.startsWith('components/')) {
        newFiles[`src/${path}`] = content;
      }
      // Keep everything else as-is
      else {
        newFiles[path] = content;
      }
    }

    // Replace with new structure and remove old paths
    Object.assign(normalized, newFiles);
    for (const path of Object.keys(normalized)) {
      if (
        !path.startsWith('src') &&
        (path.startsWith('pages/') || path.startsWith('components/'))
      ) {
        delete normalized[path];
      }
    }

    if (Object.keys(newFiles).some(p => p.startsWith('src/'))) {
      changes.push('moved pages/ and components/ to src/');
    }
  }

  // Step 2: Ensure required config files exist
  const packageJsonContent = normalized['package.json'];

  // Create astro.config.mjs if missing and it's an Astro project
  if (!normalized['astro.config.mjs'] && packageJsonContent && isAstroProject(packageJsonContent)) {
    normalized['astro.config.mjs'] = generateDefaultAstroConfig();
    changes.push('created astro.config.mjs');
  }

  // Create tsconfig.json if missing
  if (!normalized['tsconfig.json']) {
    normalized['tsconfig.json'] = generateDefaultTsconfig();
    changes.push('created tsconfig.json');
  }

  // Step 3: Detect entry point
  let entryPoint = null;
  try {
    const entryResult = resolveEntryPoint(normalized);
    if (entryResult && entryResult.path) {
      entryPoint = entryResult.path;
    }
  } catch {
    // If entry point detection fails, try to find it manually
    const pageFiles = Object.keys(normalized).filter(
      p =>
        (p.startsWith('src/pages/') || p.startsWith('pages/')) &&
        (p.endsWith('.astro') || p.endsWith('.tsx') || p.endsWith('.jsx'))
    );
    if (pageFiles.length > 0) {
      entryPoint = pageFiles[0];
    }
  }

  return {
    files: normalized,
    entryPoint,
    changes,
  };
}
