import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveWizardTemplateCapabilities } from '../wizard-template-capabilities.js';

vi.mock('../template-registry.js', () => ({
  resolveTemplateId: (id) => id,
  getCustomTemplatesCache: vi.fn(() => null),
}));

vi.mock('../template-router.js', () => ({
  isModuleTemplate: (id) => id === 'classic' || id === 'pdl-loans-v1',
  isLegacyModuleLikeTemplate: (id) => id === 'astro-test002',
}));

describe('resolveWizardTemplateCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns permissive defaults for empty id', () => {
    const c = resolveWizardTemplateCapabilities('');
    expect(c.supportsWizardTheme).toBe(true);
    expect(c.supportsCalculator).toBe(true);
    expect(c.supportsSectionReorder).toBe(true);
  });

  it('enables all panels for module templates', () => {
    const c = resolveWizardTemplateCapabilities('classic');
    expect(c.supportsWizardTheme).toBe(true);
    expect(c.supportsCalculator).toBe(true);
    expect(c.supportsSectionReorder).toBe(true);
  });

  it('enables all panels for legacy module-like templates', () => {
    const c = resolveWizardTemplateCapabilities('astro-test002');
    expect(c.supportsWizardTheme).toBe(true);
  });
});
