import { registry } from '@/utils/template-registry'

export function getTemplateFeatureMatrix() {
  return Object.entries(registry)
    .filter(([, entry]) => entry?.adapter)
    .map(([templateId, entry]) => ({
      templateId: entry.id || templateId,
      version: entry.adapter.version,
      capabilities: entry.adapter.capabilities,
    }))
}
