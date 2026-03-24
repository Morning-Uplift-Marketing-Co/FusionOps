/**
 * Wizard design step uses `designCapabilities` from resolveWizardTemplateCapabilities.
 */

import { describe, it, expect } from 'vitest';

describe('designCapabilities shape (Step 4)', () => {
  it('merges with defaults when partial', () => {
    const DEFAULT_CAPS = {
      supportsWizardTheme: true,
      supportsCalculator: true,
      supportsSectionReorder: true,
    };
    const caps = { ...DEFAULT_CAPS, supportsWizardTheme: false };
    expect(caps.supportsWizardTheme).toBe(false);
    expect(caps.supportsCalculator).toBe(true);
  });

  it('detects when any tunable panel exists', () => {
    const a = { supportsWizardTheme: false, supportsCalculator: false, supportsSectionReorder: false };
    const b = { supportsWizardTheme: true, supportsCalculator: false, supportsSectionReorder: false };
    const anyA = a.supportsWizardTheme || a.supportsCalculator || a.supportsSectionReorder;
    const anyB = b.supportsWizardTheme || b.supportsCalculator || b.supportsSectionReorder;
    expect(anyA).toBe(false);
    expect(anyB).toBe(true);
  });
});
