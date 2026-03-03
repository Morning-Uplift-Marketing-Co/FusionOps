import type { TemplateAdapter } from '../../adapters/template-adapter'
import { generatePDLLoansV1Preview } from '../../utils/lp-generator.js'

export const pdlLoansV1Adapter: TemplateAdapter = {
  id: 'pdl-loans-v1',
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

    if (site && site.templateId && !['pdl-loans-v1', 'pdl-loansv1'].includes(site.templateId)) {
      errors.push('Template mismatch for pdl-loans-v1 adapter')
    }

    return errors.length ? { valid: false, errors } : { valid: true }
  },
  map(site: any) {
    return site
  },
  render(site: any) {
    return generatePDLLoansV1Preview(this.map(site))
  },
}

export default pdlLoansV1Adapter
