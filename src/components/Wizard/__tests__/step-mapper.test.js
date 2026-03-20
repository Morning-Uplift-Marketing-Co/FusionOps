/**
 * Step Mapper Tests
 * =================
 * Test suite for step-mapper.js: capability to step visibility mapping
 */

import { describe, it, expect } from 'vitest';
import {
  getEnabledSteps,
  getVisibleSteps,
  getStepIndex,
  areAllRequiredStepsVisible,
} from '../step-mapper.js';

describe('getEnabledSteps', () => {
  it('should return all required steps as true', () => {
    const capabilities = {};
    const result = getEnabledSteps(capabilities);

    expect(result.templateSelection).toBe(true);
    expect(result.brand).toBe(true);
    expect(result.copy).toBe(true);
    expect(result.tracking).toBe(true);
    expect(result.review).toBe(true);
  });

  it('should hide Product step if formCustomization not supported', () => {
    const capabilities = {
      supportsFormCustomization: { value: false, confidence: 0.8 },
    };
    const result = getEnabledSteps(capabilities);

    expect(result.productType).toBe(false);
  });

  it('should show Product step if formCustomization is supported', () => {
    const capabilities = {
      supportsFormCustomization: { value: true, confidence: 0.8 },
    };
    const result = getEnabledSteps(capabilities);

    expect(result.productType).toBe(true);
  });

  it('should include Design fields object', () => {
    const capabilities = {};
    const result = getEnabledSteps(capabilities);

    expect(result.design).toBeDefined();
    expect(typeof result.design).toBe('object');
  });

  it('should enable Design.calculator only if supportsCalculator is true', () => {
    const capTrue = {
      supportsCalculator: { value: true, confidence: 0.85 },
    };
    expect(getEnabledSteps(capTrue).design.calculator).toBe(true);

    const capFalse = {
      supportsCalculator: { value: false, confidence: 0.4 },
    };
    expect(getEnabledSteps(capFalse).design.calculator).toBe(false);
  });

  it('should enable Design.sectionReorder only if supportsSectionReorder is true', () => {
    const capTrue = {
      supportsSectionReorder: { value: true, confidence: 0.75 },
    };
    expect(getEnabledSteps(capTrue).design.sectionReorder).toBe(true);

    const capFalse = {
      supportsSectionReorder: { value: false, confidence: 0.3 },
    };
    expect(getEnabledSteps(capFalse).design.sectionReorder).toBe(false);
  });

  it('should enable Design.colorOverride by default', () => {
    const capDefault = {};
    expect(getEnabledSteps(capDefault).design.colorOverride).toBe(true);
  });

  it('should disable Design.colorOverride if supportsCustomColors is explicitly false', () => {
    const capFalse = {
      supportsCustomColors: { value: false, confidence: 0.9 },
    };
    expect(getEnabledSteps(capFalse).design.colorOverride).toBe(false);
  });

  it('should handle null capabilities gracefully', () => {
    const result = getEnabledSteps(null);
    expect(result.templateSelection).toBe(true);
    expect(result.productType).toBe(false);
    expect(result.design.calculator).toBe(false);
  });

  it('should handle empty capabilities object', () => {
    const result = getEnabledSteps({});
    expect(result.templateSelection).toBe(true);
    expect(result.productType).toBe(false);
    expect(result.design.colorOverride).toBe(true); // default true
  });

  it('should handle malformed capability values', () => {
    const capabilities = {
      supportsCalculator: null, // Invalid
      supportsSectionReorder: { value: true }, // Valid
    };
    const result = getEnabledSteps(capabilities);

    expect(result.design.calculator).toBe(false); // Defaults to false
    expect(result.design.sectionReorder).toBe(true); // Valid value
  });
});

describe('getVisibleSteps', () => {
  it('should return empty array if no steps provided', () => {
    expect(getVisibleSteps(null)).toEqual([]);
    expect(getVisibleSteps(undefined)).toEqual([]);
    expect(getVisibleSteps([])).toEqual([]);
  });

  it('should filter out hidden steps', () => {
    const steps = [
      { id: 'template', hidden: false },
      { id: 'product', hidden: true },
      { id: 'brand', hidden: false },
    ];
    const visible = getVisibleSteps(steps);

    expect(visible).toHaveLength(2);
    expect(visible.map((s) => s.id)).toEqual(['template', 'brand']);
  });

  it('should return all steps if none are hidden', () => {
    const steps = [
      { id: 'template', hidden: false },
      { id: 'brand', hidden: false },
      { id: 'review', hidden: false },
    ];
    const visible = getVisibleSteps(steps);

    expect(visible).toHaveLength(3);
  });

  it('should return empty array if all steps are hidden', () => {
    const steps = [
      { id: 'product', hidden: true },
      { id: 'design', hidden: true },
    ];
    const visible = getVisibleSteps(steps);

    expect(visible).toHaveLength(0);
  });

  it('should handle non-array input gracefully', () => {
    expect(getVisibleSteps('not an array')).toEqual([]);
    expect(getVisibleSteps({ some: 'object' })).toEqual([]);
    expect(getVisibleSteps(123)).toEqual([]);
  });
});

describe('getStepIndex', () => {
  it('should return index of step by ID', () => {
    const steps = [
      { id: 'template' },
      { id: 'brand' },
      { id: 'review' },
    ];

    expect(getStepIndex(steps, 'template')).toBe(0);
    expect(getStepIndex(steps, 'brand')).toBe(1);
    expect(getStepIndex(steps, 'review')).toBe(2);
  });

  it('should return -1 if step not found', () => {
    const steps = [
      { id: 'template' },
      { id: 'brand' },
    ];

    expect(getStepIndex(steps, 'nonexistent')).toBe(-1);
  });

  it('should handle empty steps array', () => {
    expect(getStepIndex([], 'template')).toBe(-1);
    expect(getStepIndex(null, 'template')).toBe(-1);
  });

  it('should handle case-sensitive step ID matching', () => {
    const steps = [{ id: 'Template' }];

    expect(getStepIndex(steps, 'Template')).toBe(0);
    expect(getStepIndex(steps, 'template')).toBe(-1);
  });
});

describe('areAllRequiredStepsVisible', () => {
  it('should return true if all required steps are visible', () => {
    const steps = [
      { id: 'template', required: true, hidden: false },
      { id: 'brand', required: true, hidden: false },
      { id: 'product', required: false, hidden: true },
    ];

    expect(areAllRequiredStepsVisible(steps)).toBe(true);
  });

  it('should return false if any required step is hidden', () => {
    const steps = [
      { id: 'template', required: true, hidden: false },
      { id: 'brand', required: true, hidden: true },
      { id: 'product', required: false, hidden: true },
    ];

    expect(areAllRequiredStepsVisible(steps)).toBe(false);
  });

  it('should ignore non-required steps that are hidden', () => {
    const steps = [
      { id: 'template', required: true, hidden: false },
      { id: 'design', required: false, hidden: true },
      { id: 'product', required: false, hidden: true },
    ];

    expect(areAllRequiredStepsVisible(steps)).toBe(true);
  });

  it('should handle empty steps array', () => {
    expect(areAllRequiredStepsVisible([])).toBe(true); // No required steps = all visible
    expect(areAllRequiredStepsVisible(null)).toBe(true);
  });

  it('should handle no required steps', () => {
    const steps = [
      { id: 'product', required: false, hidden: true },
      { id: 'design', required: false, hidden: true },
    ];

    expect(areAllRequiredStepsVisible(steps)).toBe(true);
  });
});

describe('Integration: Capability -> Step Mapping', () => {
  it('should correctly map all supported capabilities to step visibility', () => {
    const capabilities = {
      supportsCalculator: { value: true, confidence: 0.85 },
      supportsSectionReorder: { value: true, confidence: 0.75 },
      supportsFormCustomization: { value: true, confidence: 0.9 },
      supportsCustomColors: { value: true, confidence: 0.95 },
      supportsImageUpload: { value: true, confidence: 0.8 },
    };

    const enabledSteps = getEnabledSteps(capabilities);

    // All required steps enabled
    expect(enabledSteps.templateSelection).toBe(true);
    expect(enabledSteps.brand).toBe(true);
    expect(enabledSteps.copy).toBe(true);
    expect(enabledSteps.tracking).toBe(true);
    expect(enabledSteps.review).toBe(true);

    // Conditional steps enabled
    expect(enabledSteps.productType).toBe(true);

    // Design sub-fields all enabled
    expect(enabledSteps.design.calculator).toBe(true);
    expect(enabledSteps.design.sectionReorder).toBe(true);
    expect(enabledSteps.design.colorOverride).toBe(true);
  });

  it('should correctly map minimal capabilities (no optional features)', () => {
    const capabilities = {
      supportsCalculator: { value: false, confidence: 0.3 },
      supportsSectionReorder: { value: false, confidence: 0.2 },
      supportsFormCustomization: { value: false, confidence: 0.4 },
      supportsCustomColors: { value: false, confidence: 0.5 },
      supportsImageUpload: { value: false, confidence: 0.1 },
    };

    const enabledSteps = getEnabledSteps(capabilities);

    // Required steps still enabled
    expect(enabledSteps.templateSelection).toBe(true);
    expect(enabledSteps.brand).toBe(true);
    expect(enabledSteps.copy).toBe(true);

    // Optional steps disabled
    expect(enabledSteps.productType).toBe(false);
    expect(enabledSteps.design.calculator).toBe(false);
    expect(enabledSteps.design.sectionReorder).toBe(false);
    expect(enabledSteps.design.colorOverride).toBe(false);
  });

  it('should handle mixed capability support', () => {
    const capabilities = {
      supportsCalculator: { value: true, confidence: 0.8 },
      supportsSectionReorder: { value: false, confidence: 0.3 },
      supportsFormCustomization: { value: false, confidence: 0.5 },
      supportsCustomColors: { value: true, confidence: 0.9 },
    };

    const enabledSteps = getEnabledSteps(capabilities);

    expect(enabledSteps.productType).toBe(false);
    expect(enabledSteps.design.calculator).toBe(true);
    expect(enabledSteps.design.sectionReorder).toBe(false);
    expect(enabledSteps.design.colorOverride).toBe(true);
  });
});
