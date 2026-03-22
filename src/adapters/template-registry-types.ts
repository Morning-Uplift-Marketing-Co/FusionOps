import type { TemplateAdapter } from './template-adapter'

export type TemplateRegistryEntry = {
  id: string
  adapter?: TemplateAdapter
  generate?: (site: any) => string
  meta?: {
    title: string
    category?: string
    tags?: string[]
    isPremium?: boolean
    isExperimental?: boolean
  }
}
