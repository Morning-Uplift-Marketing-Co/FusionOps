/**
 * usePreviewDebounce Hook
 * =======================
 * Custom React hook for debounced preview generation.
 * Prevents excessive preview refreshes as users edit config.
 *
 * @param {object} config - Configuration object (brand, primaryColor, etc.)
 * @param {string} templateId - Template identifier
 * @param {number} [delay=400] - Debounce delay in milliseconds
 * @returns {object} { previewHtml, error, loading }
 */

import { useEffect, useRef, useState } from 'react';

// Simple error HTML builder
function buildErrorHtml(message) {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Preview Error</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
          .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="error">Error: ${escaped}</div>
      </body>
    </html>
  `;
}


export function usePreviewDebounce(config, templateId, delay = 400) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cleanup previous timer and abort controller
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    // Validation: if config or templateId is missing/empty, clear preview
    if (!config || !templateId) {
      setPreviewHtml('');
      setError(null);
      setLoading(false);
      return;
    }

    // Warn if delay is very short (potential performance issue)
    if (delay < 50) {
      console.warn(`usePreviewDebounce: delay ${delay}ms is very short, may cause excessive renders`);
    }

    setLoading(true);
    setError(null);

    // Create abort controller for this request
    const abort = new AbortController();
    abortRef.current = abort;

    // Set timer to trigger preview generation
    timerRef.current = setTimeout(async () => {
      try {
        // Generate preview HTML from config
        // This creates a simple preview that includes config values
        const html = `<div>Preview: ${config?.brand || 'Template'}</div>`;
        setPreviewHtml(html);
        setError(null);
      } catch (e) {
        // Ignore AbortError (user cancelled via unmount or config change)
        if (e.name === 'AbortError') {
          return;
        }

        // Log error but don't throw
        console.error('Preview generation failed:', e);
        setError(e.message || 'Failed to generate preview');
        setPreviewHtml(buildErrorHtml(e.message || 'Failed to generate preview'));
      } finally {
        setLoading(false);
      }
    }, delay);

    // Cleanup function: clear timer and abort pending requests
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [config, templateId, delay]);

  return { previewHtml, error, loading };
}
