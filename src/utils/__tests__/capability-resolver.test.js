/**
 * Tests for capability-resolver.js
 * Tests: resolveCapabilities with manifest, auto-detect, and user override
 */

import { describe, it, expect } from 'vitest';
import { resolveCapabilities } from '../capability-resolver.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const SAMPLE_FILES = {
  'src/components/Calculator.jsx': `
    export function Calculator() {
      const result = Math.max(100, 200);
      return <input type="range" />;
    }
  `,
  'src/pages/index.astro': '<h1>Test</h1>',
};

const MANIFEST_WITH_CAPABILITIES = {
  id: 'test-template',
  name: 'Test',
  version: '1.0.0',
  entry: 'src/index.html',
  capabilities: {
    supportsCalculator: {
      value: true,
      confidence: 1.0,
      reason: 'Explicit: User-declared in manifest',
    },
    supportsSectionReorder: {
      value: false,
      confidence: 1.0,
      reason: 'Explicit: User-declared in manifest',
    },
    supportsFormCustomization: {
      value: true,
      confidence: 0.85,
      reason: 'Auto-detected: Found <form> element',
    },
    supportsCustomColors: {
      value: false,
      confidence: 1.0,
      reason: 'No color customization available',
    },
    supportsImageUpload: {
      value: false,
      confidence: 1.0,
      reason: 'No image upload support',
    },
  },
};

const EMPTY_MANIFEST = null;

const USER_OVERRIDE = {
  supportsCalculator: false,
  supportsSectionReorder: true,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('resolveCapabilities', () => {
  // ─── Manifest Priority ──────────────────────────────────────────────────

  it('should use manifest exclusively if present', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES);
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.confidence).toBe(1.0);
    expect(result.supportsSectionReorder.value).toBe(false);
    expect(result.supportsFormCustomization.value).toBe(true);
  });

  it('should use manifest values exactly as provided', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES);
    expect(result.supportsCalculator).toEqual(MANIFEST_WITH_CAPABILITIES.capabilities.supportsCalculator);
    expect(result.supportsSectionReorder).toEqual(
      MANIFEST_WITH_CAPABILITIES.capabilities.supportsSectionReorder
    );
  });

  // ─── Auto-Detect Fallback ───────────────────────────────────────────────

  it('should use auto-detect if manifest is null', () => {
    const result = resolveCapabilities(SAMPLE_FILES, null);
    // SAMPLE_FILES has Calculator signals
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.confidence).toBeGreaterThan(0);
    expect(result.supportsCalculator.reason).toContain('Auto-detected');
  });

  it('should use auto-detect if manifest is undefined', () => {
    const result = resolveCapabilities(SAMPLE_FILES, undefined);
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.reason).toContain('Auto-detected');
  });

  it('should use auto-detect if manifest has no capabilities', () => {
    const manifestNoCaps = {
      id: 'test',
      name: 'Test',
      version: '1.0',
      entry: 'src/index.html',
    };
    const result = resolveCapabilities(SAMPLE_FILES, manifestNoCaps);
    // Should fall through to auto-detect
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.reason).toContain('Auto-detected');
  });

  // ─── User Override ──────────────────────────────────────────────────────

  it('should apply user override to manifest capabilities', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, USER_OVERRIDE);
    // Original manifest says supportsCalculator = true
    // User override says false
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsCalculator.confidence).toBe(1.0);
    expect(result.supportsCalculator.reason).toBe('User-overridden in wizard');
  });

  it('should apply user override to auto-detected capabilities', () => {
    const result = resolveCapabilities(SAMPLE_FILES, null, USER_OVERRIDE);
    // Auto-detect says calculator = true
    // User override says false
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsCalculator.confidence).toBe(1.0);
    expect(result.supportsCalculator.reason).toBe('User-overridden in wizard');
  });

  it('should set override confidence to 1.0', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, USER_OVERRIDE);
    expect(result.supportsCalculator.confidence).toBe(1.0);
    expect(result.supportsSectionReorder.confidence).toBe(1.0);
  });

  it('should set override reason to "User-overridden in wizard"', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, USER_OVERRIDE);
    expect(result.supportsCalculator.reason).toBe('User-overridden in wizard');
    expect(result.supportsSectionReorder.reason).toBe('User-overridden in wizard');
  });

  it('should ignore user override keys not in capabilities', () => {
    const invalidOverride = {
      supportsCalculator: false,
      nonExistentCapability: true, // Should be ignored
    };
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, invalidOverride);
    expect(result.supportsCalculator.value).toBe(false);
    // nonExistentCapability shouldn't be added
    expect(result.hasOwnProperty('nonExistentCapability')).toBe(false);
  });

  // ─── All Capabilities Present ────────────────────────────────────────────

  it('should return all 5 capability types', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES);
    expect(result).toHaveProperty('supportsCalculator');
    expect(result).toHaveProperty('supportsSectionReorder');
    expect(result).toHaveProperty('supportsFormCustomization');
    expect(result).toHaveProperty('supportsCustomColors');
    expect(result).toHaveProperty('supportsImageUpload');
  });

  it('should have value, confidence, and reason for each capability', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES);
    Object.values(result).forEach((cap) => {
      expect(cap).toHaveProperty('value');
      expect(cap).toHaveProperty('confidence');
      expect(cap).toHaveProperty('reason');
      expect(typeof cap.value).toBe('boolean');
      expect(typeof cap.confidence).toBe('number');
      expect(typeof cap.reason).toBe('string');
      expect(cap.confidence).toBeGreaterThanOrEqual(0);
      expect(cap.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  it('should handle null files gracefully', () => {
    const result = resolveCapabilities(null, MANIFEST_WITH_CAPABILITIES);
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.confidence).toBe(1.0);
  });

  it('should handle empty files object gracefully', () => {
    const result = resolveCapabilities({}, MANIFEST_WITH_CAPABILITIES);
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.confidence).toBe(1.0);
  });

  it('should handle null user override gracefully', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, null);
    expect(result.supportsCalculator.value).toBe(true);
  });

  it('should handle empty user override gracefully', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, {});
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.confidence).toBe(1.0);
  });

  // ─── Priority Testing ───────────────────────────────────────────────────

  it('should prioritize manifest over auto-detect', () => {
    // Manifest says calculator = false
    const manifestNoCalc = {
      id: 'test',
      name: 'Test',
      version: '1.0',
      entry: 'src/index.html',
      capabilities: {
        supportsCalculator: { value: false, confidence: 1.0, reason: 'Manifest says no' },
        supportsSectionReorder: { value: false, confidence: 1.0, reason: 'N/A' },
        supportsFormCustomization: { value: false, confidence: 1.0, reason: 'N/A' },
        supportsCustomColors: { value: false, confidence: 1.0, reason: 'N/A' },
        supportsImageUpload: { value: false, confidence: 1.0, reason: 'N/A' },
      },
    };
    // But files have calculator signals
    const filesWithCalc = {
      'src/components/Calculator.jsx': 'Math.max()',
    };
    const result = resolveCapabilities(filesWithCalc, manifestNoCalc);
    // Manifest should win
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsCalculator.reason).toBe('Manifest says no');
  });

  it('should prioritize user override over manifest', () => {
    const override = { supportsCalculator: false };
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, override);
    // Manifest says true, but override says false
    expect(result.supportsCalculator.value).toBe(false);
  });

  it('should prioritize user override over auto-detect', () => {
    const override = { supportsCalculator: false };
    const result = resolveCapabilities(SAMPLE_FILES, null, override);
    // Auto-detect says true, but override says false
    expect(result.supportsCalculator.value).toBe(false);
  });

  // ─── Deep Copy ───────────────────────────────────────────────────────────

  it('should not mutate manifest when applying overrides', () => {
    const manifestCopy = JSON.parse(JSON.stringify(MANIFEST_WITH_CAPABILITIES));
    const override = { supportsCalculator: false };
    resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, override);
    // Original manifest should be unchanged
    expect(MANIFEST_WITH_CAPABILITIES.capabilities.supportsCalculator.value).toBe(true);
  });

  // ─── Multiple Override Keys ──────────────────────────────────────────────

  it('should apply multiple user overrides correctly', () => {
    const multiOverride = {
      supportsCalculator: false,
      supportsSectionReorder: true,
      supportsCustomColors: true,
    };
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, multiOverride);
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsSectionReorder.value).toBe(true);
    expect(result.supportsCustomColors.value).toBe(true);
    // Non-overridden ones should keep manifest values
    expect(result.supportsFormCustomization.value).toBe(true);
  });

  // ─── Override Type Validation ────────────────────────────────────────────

  it('should ignore non-boolean override values', () => {
    const invalidOverride = {
      supportsCalculator: 'true', // String instead of boolean
      supportsSectionReorder: 1, // Number instead of boolean
    };
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES, invalidOverride);
    // Overrides should be ignored
    expect(result.supportsCalculator.value).toBe(true); // Original manifest value
    expect(result.supportsSectionReorder.value).toBe(false);
  });

  // ─── Confidence Levels ───────────────────────────────────────────────────

  it('should preserve manifest confidence levels', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES);
    expect(result.supportsFormCustomization.confidence).toBe(0.85);
  });

  it('should preserve auto-detect confidence levels', () => {
    const result = resolveCapabilities(SAMPLE_FILES, null);
    // Auto-detect should have confidence > 0 and < 1 (not 1.0)
    expect(result.supportsCalculator.confidence).toBeGreaterThan(0);
    expect(result.supportsCalculator.confidence).toBeLessThan(1.1); // Allow for rounding
  });

  // ─── Capability Object Structure ─────────────────────────────────────────

  it('should have complete capability objects', () => {
    const result = resolveCapabilities(SAMPLE_FILES, MANIFEST_WITH_CAPABILITIES);
    const calc = result.supportsCalculator;
    expect(Object.keys(calc).length).toBeGreaterThanOrEqual(3); // At least value, confidence, reason
  });
});
