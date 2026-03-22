/**
 * PreviewModal Component
 * =====================
 * Live preview modal with viewport toggle and fingerprint comparison.
 *
 * Features:
 * - Render template HTML in iframe with sandbox security
 * - Toggle between mobile (320px) and desktop (1024px) viewports
 * - Switch between original and fingerprinted HTML views
 * - Error handling for missing/invalid preview data
 * - Clean modal UX with close button
 *
 * Props:
 * - isOpen: boolean - Whether modal is visible
 * - onClose: () => void - Callback to close modal
 * - config: object - Wizard configuration (brand, colors, etc.)
 * - templateId: string - Template identifier
 * - previewHtml: string - Original template HTML
 * - fingerprintedHtml: string - Fingerprinted template HTML
 */

import React, { useState, useRef, useEffect } from 'react';

/**
 * Helper: Generate a temporary siteId if missing
 * Used for fingerprint preview when config.siteId is not available
 */
function generateTemporarySiteId(templateId) {
  // Create a deterministic hash for debugging
  const hash = templateId
    .split('')
    .reduce((acc, char) => {
      const code = char.charCodeAt(0);
      return ((acc << 5) - acc) + code;
    }, 0)
    .toString(16)
    .substring(0, 8);
  return `temp-preview-${hash}`;
}

export function PreviewModal({
  isOpen = false,
  onClose = () => {},
  config = {},
  templateId = '',
  previewHtml = '',
  fingerprintedHtml = ''
}) {
  const [viewport, setViewport] = useState('desktop');
  const [showFingerprint, setShowFingerprint] = useState(false);
  const iframeRef = useRef(null);

  // Validate input - check for missing preview HTML
  const hasPreview = previewHtml && previewHtml.trim().length > 0;
  const hasFingerprinted = fingerprintedHtml && fingerprintedHtml.trim().length > 0;

  // Log warnings for edge cases (for debugging)
  useEffect(() => {
    if (!isOpen) return;
    if (!hasPreview) {
      console.warn('[PreviewModal] No preview HTML provided; will show placeholder');
    }
    if (!config.siteId && showFingerprint) {
      console.warn('[PreviewModal] Missing config.siteId; using temporary ID for preview fingerprint');
    }
  }, [isOpen, hasPreview, config.siteId, showFingerprint]);

  // Don't render if modal is closed
  if (!isOpen) return null;

  // Determine which HTML to display (original or fingerprinted)
  const currentHtml = showFingerprint && hasFingerprinted ? fingerprintedHtml : previewHtml;

  // Viewport dimensions
  const iframeWidth = viewport === 'mobile' ? '320px' : '1024px';
  const iframeHeight = viewport === 'mobile' ? '640px' : '768px';

  // Disable fingerprint toggle if no fingerprinted HTML available
  const canShowFingerprint = hasFingerprinted;

  const openInNewTab = () => {
    if (!currentHtml) return;
    const blob = new Blob([currentHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div role="dialog" aria-label="Template Preview Modal">
      <div className="preview-modal">
        <div className="modal-header">
          <h2>Preview: {config?.brand || 'Template'}</h2>
          <button onClick={onClose} aria-label="Close preview">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Viewport and Fingerprint Toggle Buttons */}
          <div className="controls" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="viewport-toggle"
              data-testid="viewport-toggle"
              onClick={() => setViewport(viewport === 'mobile' ? 'desktop' : 'mobile')}
              data-viewport={viewport}
              aria-label="Toggle viewport"
            >
              Toggle Viewport ({viewport})
            </button>

            <button
              className="fingerprint-toggle"
              data-testid="fingerprint-toggle"
              onClick={() => setShowFingerprint(!showFingerprint)}
              data-fingerprint={showFingerprint}
              disabled={!canShowFingerprint}
              aria-label="Toggle fingerprint view"
              title={canShowFingerprint ? 'Compare original and fingerprinted HTML' : 'Fingerprinted HTML not available'}
            >
              {showFingerprint ? 'Show Original' : 'Show Fingerprint'}
              {!canShowFingerprint && <span style={{ marginLeft: '4px', fontSize: '0.85em' }}>(unavailable)</span>}
            </button>
            
            <button
              className="viewport-toggle"
              onClick={openInNewTab}
              style={{ marginLeft: 'auto', background: '#e0e7ff', color: '#4f46e5', borderColor: '#c7d2fe', fontWeight: 600 }}
            >
              🚀 Open in New Tab (Tracking Test)
            </button>
          </div>

          {/* Warning: Missing siteId when fingerprint toggle attempted */}
          {!config.siteId && showFingerprint && (
            <div
              className="warning-banner"
              style={{
                padding: '8px 12px',
                marginTop: '12px',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                color: '#856404',
                fontSize: '12px',
              }}
            >
              ⚠️ Preview fingerprinting uses a temporary ID. Actual deployment will use your permanent site ID.
            </div>
          )}

          {/* Preview Container with iframe */}
          <div
            className="preview-container"
            style={{
              width: iframeWidth,
              height: iframeHeight,
              marginTop: '16px'
            }}
          >
            {currentHtml ? (
              <iframe
                ref={iframeRef}
                title="Template Preview"
                data-testid="preview-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                srcDoc={currentHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: '#fff'
                }}
              />
            ) : (
              <div className="preview-placeholder">No preview available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
