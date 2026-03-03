import type { TemplateAdapter } from '../../adapters/template-adapter'
import { generateAstrodeckLoanPreview } from '../../utils/lp-generator.js'

export const astrodeckLoanAdapter: TemplateAdapter = {
  id: 'astrodeck-loan',
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

    if (site && site.templateId && site.templateId !== 'astrodeck-loan') {
      errors.push('Template mismatch for astrodeck-loan adapter')
    }

    return errors.length ? { valid: false, errors } : { valid: true }
  },
  map(site: any) {
    return site
  },
  render(site: any) {
    return generateAstrodeckLoanPreview(this.map(site))
  },
}

export default astrodeckLoanAdapter
