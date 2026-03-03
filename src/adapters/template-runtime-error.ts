export class TemplateRuntimeError extends Error {
  code: string
  templateId: string | undefined
  adapterId: string | undefined
  details: any

  constructor({
    code,
    message,
    templateId,
    adapterId,
    details
  }: {
    code: string
    message: string
    templateId?: string
    adapterId?: string
    details?: any
  }) {
    super(message)
    this.name = 'TemplateRuntimeError'
    this.code = code
    this.templateId = templateId
    this.adapterId = adapterId
    this.details = details
  }
}
