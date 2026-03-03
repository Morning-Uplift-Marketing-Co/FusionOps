import type { TemplateAdapter } from '../../adapters/template-adapter'
import { generateLanderCorePreview } from '../../utils/lp-generator.js'

export const landerCoreAdapter: TemplateAdapter = {
  id: 'lander-core',
  version: 1,
  capabilities: {
    supportsCalculator: true,
    supportsSectionReorder: false,
    requiredSections: ['hero'],
  },
  validate(site: any) {
    const errors: string[] = []

    if (!site || typeof site !== 'object') {
      errors.push('Site config is required')
    }

    if (site && site.templateId && site.templateId !== 'lander-core') {
      errors.push('Template mismatch for lander-core adapter')
    }

    return errors.length ? { valid: false, errors } : { valid: true }
  },
  map(site: any) {
    return site
  },
  render(site: any) {
    return generateLanderCorePreview(this.map(site))
  },
}

export default landerCoreAdapter
