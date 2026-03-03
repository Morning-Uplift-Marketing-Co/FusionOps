import { TemplateAdapter } from './template-adapter'

export type TemplateRegistryEntry = {
  id: string
  adapter?: TemplateAdapter
  generate?: (site: any) => string
}
