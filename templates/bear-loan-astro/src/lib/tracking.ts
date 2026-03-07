// Tracking config — injected per site at deploy time
export const TRACKING = {
  conversionId: (typeof window !== 'undefined' && (window as any).__TRK?.conversionId) || '',
  formStartLabel: (typeof window !== 'undefined' && (window as any).__TRK?.formStartLabel) || '',
  formSubmitLabel: (typeof window !== 'undefined' && (window as any).__TRK?.formSubmitLabel) || '',
  aid: (typeof window !== 'undefined' && (window as any).__TRK?.aid) || '',
  domain: typeof window !== 'undefined' ? window.location.hostname : '',
};
