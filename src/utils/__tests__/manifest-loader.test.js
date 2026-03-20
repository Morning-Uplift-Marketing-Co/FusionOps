/**
 * Tests for manifest-loader.js
 * Tests: loadAndValidateManifest
 */

import { describe, it, expect } from 'vitest';
import { loadAndValidateManifest } from '../manifest-loader.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const VALID_MANIFEST_JSON = JSON.stringify({
  id: 'inbox-zero-clone',
  name: 'Inbox Zero Landing Page',
  version: '1.0.0',
  entry: 'src/pages/index.astro',
  capabilities: {
    supportsCalculator: {
      value: false,
      confidence: 1.0,
      reason: 'No calculator component in source',
    },
    supportsFormCustomization: {
      value: true,
      confidence: 0.85,
      reason: 'Found <form> element with input fields',
    },
    supportsCustomColors: {
      value: true,
      confidence: 0.90,
      reason: 'CSS custom properties detected in styles',
    },
  },
  requiredSections: ['hero', 'form', 'footer'],
});

const MINIMAL_VALID_MANIFEST = JSON.stringify({
  id: 'test-template',
  name: 'Test Template',
  version: '1.0.0',
  entry: 'src/index.html',
  capabilities: {
    supportsCalculator: {
      value: false,
      confidence: 0.5,
    },
  },
});

const PROJECT_WITH_MANIFEST = {
  'package.json': '{"name":"test"}',
  '.lp-manifest.json': VALID_MANIFEST_JSON,
  'src/pages/index.astro': '<h1>Test</h1>',
};

const PROJECT_WITHOUT_MANIFEST = {
  'package.json': '{"name":"test"}',
  'src/pages/index.astro': '<h1>Test</h1>',
};

const PROJECT_WITH_CASE_INSENSITIVE_MANIFEST = {
  'package.json': '{"name":"test"}',
  '.lp-Manifest.json': MINIMAL_VALID_MANIFEST,
};

const PROJECT_WITH_MALFORMED_JSON = {
  'package.json': '{"name":"test"}',
  '.lp-manifest.json': '{"id":"test","name":"Test Template","version":"1.0",invalid json}',
};

const PROJECT_MISSING_REQUIRED_ID = {
  '.lp-manifest.json': JSON.stringify({
    name: 'Test Template',
    version: '1.0.0',
    entry: 'src/index.html',
    capabilities: { test: { value: true, confidence: 1.0 } },
  }),
};

const PROJECT_MISSING_CAPABILITY_VALUE = {
  '.lp-manifest.json': JSON.stringify({
    id: 'test',
    name: 'Test Template',
    version: '1.0.0',
    entry: 'src/index.html',
    capabilities: {
      supportsCalculator: {
        confidence: 0.8,
      },
    },
  }),
};

const PROJECT_MISSING_CAPABILITY_CONFIDENCE = {
  '.lp-manifest.json': JSON.stringify({
    id: 'test',
    name: 'Test Template',
    version: '1.0.0',
    entry: 'src/index.html',
    capabilities: {
      supportsCalculator: {
        value: true,
      },
    },
  }),
};

const PROJECT_EMPTY_CAPABILITIES = {
  '.lp-manifest.json': JSON.stringify({
    id: 'test',
    name: 'Test Template',
    version: '1.0.0',
    entry: 'src/index.html',
    capabilities: {},
  }),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('loadAndValidateManifest', () => {
  it('should load valid manifest successfully', () => {
    const result = loadAndValidateManifest(PROJECT_WITH_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.manifest).not.toBeNull();
    expect(result.manifest.id).toBe('inbox-zero-clone');
    expect(result.manifest.name).toBe('Inbox Zero Landing Page');
    expect(result.manifest.version).toBe('1.0.0');
    expect(result.manifest.capabilities).toBeDefined();
    expect(result.manifest.capabilities.supportsFormCustomization.value).toBe(true);
    expect(result.manifest.capabilities.supportsFormCustomization.confidence).toBe(0.85);
  });

  it('should return null manifest with valid=true when .lp-manifest.json is absent', () => {
    const result = loadAndValidateManifest(PROJECT_WITHOUT_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.manifest).toBeNull();
  });

  it('should handle case-insensitive manifest file finding', () => {
    const result = loadAndValidateManifest(PROJECT_WITH_CASE_INSENSITIVE_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.manifest).not.toBeNull();
    expect(result.manifest.id).toBe('test-template');
  });

  it('should return error for malformed JSON', () => {
    const result = loadAndValidateManifest(PROJECT_WITH_MALFORMED_JSON);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid JSON');
    expect(result.manifest).toBeNull();
  });

  it('should return error when required field "id" is missing', () => {
    const result = loadAndValidateManifest(PROJECT_MISSING_REQUIRED_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('id');
    expect(result.manifest).toBeNull();
  });

  it('should return error when capability missing "value" field', () => {
    const result = loadAndValidateManifest(PROJECT_MISSING_CAPABILITY_VALUE);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('value');
    expect(result.manifest).toBeNull();
  });

  it('should return error when capability missing "confidence" field', () => {
    const result = loadAndValidateManifest(PROJECT_MISSING_CAPABILITY_CONFIDENCE);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('confidence');
    expect(result.manifest).toBeNull();
  });

  it('should return error when capabilities object is empty', () => {
    const result = loadAndValidateManifest(PROJECT_EMPTY_CAPABILITIES);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least one capability');
    expect(result.manifest).toBeNull();
  });

  it('should load minimal valid manifest with only required fields', () => {
    const result = loadAndValidateManifest({
      '.lp-manifest.json': MINIMAL_VALID_MANIFEST,
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.manifest).not.toBeNull();
    expect(result.manifest.requiredSections).toBeUndefined(); // Optional field not provided
  });

  it('should handle empty files object gracefully', () => {
    const result = loadAndValidateManifest({});
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.manifest).toBeNull();
  });

  it('should handle null files gracefully', () => {
    const result = loadAndValidateManifest(null);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.manifest).toBeNull();
  });

  it('should validate all 5 required capability fields structure', () => {
    const manifest = {
      '.lp-manifest.json': JSON.stringify({
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        entry: 'src/index.html',
        capabilities: {
          supportsCalculator: { value: true, confidence: 0.8 },
          supportsSectionReorder: { value: false, confidence: 0.6 },
          supportsFormCustomization: { value: true, confidence: 0.9 },
          supportsCustomColors: { value: true, confidence: 0.95 },
          supportsImageUpload: { value: false, confidence: 0.4 },
        },
      }),
    };
    const result = loadAndValidateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.manifest.capabilities).length).toBe(5);
  });

  it('should preserve optional fields like reason in capabilities', () => {
    const manifest = {
      '.lp-manifest.json': JSON.stringify({
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        entry: 'src/index.html',
        capabilities: {
          supportsCalculator: {
            value: true,
            confidence: 0.85,
            reason: 'Custom reason text',
          },
        },
      }),
    };
    const result = loadAndValidateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.manifest.capabilities.supportsCalculator.reason).toBe('Custom reason text');
  });

  it('should reject invalid confidence values (out of range)', () => {
    const manifest = {
      '.lp-manifest.json': JSON.stringify({
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        entry: 'src/index.html',
        capabilities: {
          supportsCalculator: { value: true, confidence: 1.5 },
        },
      }),
    };
    const result = loadAndValidateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('confidence');
  });

  it('should reject empty id string', () => {
    const manifest = {
      '.lp-manifest.json': JSON.stringify({
        id: '   ',
        name: 'Test',
        version: '1.0.0',
        entry: 'src/index.html',
        capabilities: { test: { value: true, confidence: 0.5 } },
      }),
    };
    const result = loadAndValidateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('id');
  });
});
