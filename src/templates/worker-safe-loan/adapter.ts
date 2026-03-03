import type { TemplateAdapter } from '../../adapters/template-adapter'
import { generateWorkerSafeLoanPreview } from '../../utils/lp-generator.js'

export const workerSafeLoanAdapter: TemplateAdapter = {
  id: 'worker-safe-loan',
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

    if (site && site.templateId && site.templateId !== 'worker-safe-loan') {
      errors.push('Template mismatch for worker-safe-loan adapter')
    }

    return errors.length ? { valid: false, errors } : { valid: true }
  },
  map(site: any) {
    return site
  },
  render(site: any) {
    return generateWorkerSafeLoanPreview(this.map(site))
  },
}

export default workerSafeLoanAdapter
