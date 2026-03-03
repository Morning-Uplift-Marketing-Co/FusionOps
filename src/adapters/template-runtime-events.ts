export type TemplateRuntimeEvent =
  | 'template_render_start'
  | 'template_render_success'
  | 'template_validation_failed'
  | 'template_version_mismatch'

type Listener = (event: TemplateRuntimeEvent, payload: any) => void

let listener: Listener | null = null

export function registerTemplateRuntimeListener(fn: Listener) {
  listener = fn
}

export function emitTemplateRuntimeEvent(
  event: TemplateRuntimeEvent,
  payload: any
) {
  if (listener) {
    try {
      listener(event, payload)
    } catch {
      // swallow errors to avoid runtime impact
    }
  }
}
