export interface TemplateAdapter {
  id: string
  version: number
  capabilities: {
    supportsCalculator: boolean
    supportsSectionReorder: boolean
    requiredSections?: string[]
  }
  validate(site: any): { valid: boolean; errors?: string[] }
  map(site: any): any
  render(site: any): string
}
