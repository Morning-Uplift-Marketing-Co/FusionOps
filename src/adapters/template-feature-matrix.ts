import { registry } from '@/utils/template-registry'
import type { TemplateRegistryEntry } from './template-registry-types'

export function getTemplateFeatureMatrix() {
  return (Object.entries(registry) as [string, TemplateRegistryEntry][])
    .filter(([, entry]) => entry?.adapter)
    .map(([templateId, entry]) => ({
      templateId: entry!.id || templateId,
      version: entry!.adapter!.version,
      capabilities: entry!.adapter!.capabilities,
    }))
}
