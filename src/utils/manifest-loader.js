/**
 * Manifest Loader
 * ==============
 * Load and validate .lp-manifest.json files from template distributions.
 *
 * Responsibilities:
 *   - Find .lp-manifest.json in file map (case-insensitive)
 *   - Parse JSON and validate schema
 *   - Return structured result with validation errors if present
 *
 * Design:
 *   - Pure function, no side effects
 *   - Works on { [path]: content } file map from template extraction
 *   - Returns object with { manifest, valid, error } instead of throwing
 *   - Required fields: id, name, version, entry, capabilities
 */

/**
 * @typedef {Object} ManifestValidationResult
 * @property {Object|null} manifest - Parsed and validated manifest, or null if invalid
 * @property {boolean} valid - true if manifest is valid or not present
 * @property {string|null} error - Human-readable error message, or null if valid
 */

/**
 * Find file by name in files map (case-insensitive)
 * @private
 * @param {Record<string, string>} files
 * @param {string} searchName - Filename to find (e.g., ".lp-manifest.json")
 * @returns {string|null} - Matched file content, or null
 */
function findFileContent(files, searchName) {
  if (!files || typeof files !== 'object') return null;

  const lowerSearch = searchName.toLowerCase();
  for (const [path, content] of Object.entries(files)) {
    const fileName = path.split('/').pop().toLowerCase();
    if (fileName === lowerSearch) {
      return content;
    }
  }
  return null;
}

/**
 * Validate manifest schema
 * @private
 * @param {Object} manifest
 * @returns {string|null} - Error message if invalid, null if valid
 */
function validateManifestSchema(manifest) {
  // Check required top-level fields
  if (!manifest.id || typeof manifest.id !== 'string' || manifest.id.trim() === '') {
    return 'Required field "id" must be a non-empty string';
  }
  if (!manifest.name || typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    return 'Required field "name" must be a non-empty string';
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    return 'Required field "version" must be a string';
  }
  if (!manifest.entry || typeof manifest.entry !== 'string') {
    return 'Required field "entry" must be a string (e.g., "src/pages/index.astro")';
  }

  // Check capabilities object
  if (!manifest.capabilities || typeof manifest.capabilities !== 'object') {
    return 'Required field "capabilities" must be an object';
  }

  if (Object.keys(manifest.capabilities).length === 0) {
    return 'Field "capabilities" must contain at least one capability';
  }

  // Validate each capability
  for (const [capKey, capValue] of Object.entries(manifest.capabilities)) {
    if (typeof capValue !== 'object' || capValue === null) {
      return `Capability "${capKey}" must be an object`;
    }

    if (typeof capValue.value !== 'boolean') {
      return `Capability "${capKey}" missing required boolean field "value"`;
    }

    if (typeof capValue.confidence !== 'number' || capValue.confidence < 0 || capValue.confidence > 1) {
      return `Capability "${capKey}" missing required "confidence" field (must be 0-1)`;
    }
  }

  return null;
}

/**
 * Load and validate .lp-manifest.json from template files
 *
 * @param {Record<string, string>} files - File map { "path/file.ext": "content" }
 * @returns {ManifestValidationResult}
 *
 * @example
 * const result = loadAndValidateManifest({
 *   'package.json': '...',
 *   '.lp-manifest.json': '{"id":"example",...}'
 * });
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export function loadAndValidateManifest(files) {
  // Find .lp-manifest.json file
  const manifestContent = findFileContent(files, '.lp-manifest.json');

  // If manifest not found, that's OK (optional)
  if (!manifestContent) {
    return { manifest: null, valid: true, error: null };
  }

  // Try to parse JSON
  let parsed;
  try {
    parsed = JSON.parse(manifestContent);
  } catch (e) {
    return {
      manifest: null,
      valid: false,
      error: `Invalid JSON in .lp-manifest.json: ${e.message}`,
    };
  }

  // Validate schema
  const validationError = validateManifestSchema(parsed);
  if (validationError) {
    return {
      manifest: null,
      valid: false,
      error: validationError,
    };
  }

  // Success
  return {
    manifest: parsed,
    valid: true,
    error: null,
  };
}
