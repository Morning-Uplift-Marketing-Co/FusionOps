/**
 * PreviewModal Component
 * =====================
 * Live preview modal with viewport toggle and fingerprint comparison.
 *
 * Features:
 * - Render template HTML in iframe with sandbox security
 * - Toggle between mobile (320px) and desktop (1024px) viewports
 * - Switch between original and fingerprinted HTML views
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

import React, { useState, useRef } from 'react';

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

  // Don't render if modal is closed
  if (!isOpen) return null;

  // Determine which HTML to display (original or fingerprinted)
  const currentHtml = showFingerprint ? fingerprintedHtml : previewHtml;

  // Viewport dimensions
  const iframeWidth = viewport === 'mobile' ? '320px' : '1024px';
  const iframeHeight = viewport === 'mobile' ? '640px' : '768px';

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
          <div className="controls">
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
              aria-label="Toggle fingerprint view"
            >
              {showFingerprint ? 'Show Original' : 'Show Fingerprint'}
            </button>
          </div>

          {/* Preview Container with iframe */}
          <div
            className="preview-container"
            style={{
              width: iframeWidth,
              height: iframeHeight,
            }}
          >
            {currentHtml ? (
              <iframe
                ref={iframeRef}
                title="Template Preview"
                data-testid="preview-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms"
                srcDoc={currentHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
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
