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
    const sectionOrder = site?.layout?.sectionOrder
    const features = site?.features

    if (!site || typeof site !== 'object') {
      errors.push('Site config is required')
    }

    if (site && site.templateId && site.templateId !== 'worker-safe-loan') {
      errors.push('Template mismatch for worker-safe-loan adapter')
    }

    if (features?.calculator === true && this.capabilities.supportsCalculator === false) {
      errors.push('Calculator feature is enabled but this template does not support calculator')
    }

    if (sectionOrder !== undefined && this.capabilities.supportsSectionReorder === false) {
      errors.push('Section order is provided but this template does not support section reorder')
    }

    if (this.capabilities.requiredSections?.length && Array.isArray(sectionOrder)) {
      const missingSections = this.capabilities.requiredSections.filter(
        (section) => !sectionOrder.includes(section)
      )
      if (missingSections.length) {
        errors.push(`Missing required sections: ${missingSections.join(', ')}`)
      }
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
