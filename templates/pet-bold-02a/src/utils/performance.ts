/**
 * Performance monitoring utilities for Core Web Vitals
 */

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'LCP' | 'FCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  if (typeof window === 'undefined') return;

  // Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    });
  }

  // Send to analytics (gtag example)
  if (window.gtag) {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

/**
 * Measure and report Largest Contentful Paint (LCP)
 */
export function measureLCP(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number };

      const value = lastEntry.renderTime || lastEntry.startTime;
      const rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';

      reportWebVitals({
        name: 'LCP',
        value,
        rating,
        delta: value,
        id: `lcp-${Date.now()}`,
      });
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // Observer not supported
  }
}

/**
 * Measure and report First Input Delay (FID)
 */
export function measureFID(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstInput = entries[0] as PerformanceEventTiming;

      const value = firstInput.processingStart - firstInput.startTime;
      const rating = value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';

      reportWebVitals({
        name: 'FID',
        value,
        rating,
        delta: value,
        id: `fid-${Date.now()}`,
      });
    });

    observer.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // Observer not supported
  }
}

/**
 * Measure and report Cumulative Layout Shift (CLS)
 */
export function measureCLS(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    let clsValue = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }

      const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor';

      reportWebVitals({
        name: 'CLS',
        value: clsValue,
        rating,
        delta: clsValue,
        id: `cls-${Date.now()}`,
      });
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // Observer not supported
  }
}

/**
 * Initialize all Web Vitals measurements
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined') return;

  measureLCP();
  measureFID();
  measureCLS();
}

// Auto-initialize on client side
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    initWebVitals();
  } else {
    window.addEventListener('load', initWebVitals);
  }
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
