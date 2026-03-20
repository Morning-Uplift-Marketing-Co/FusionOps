/**
 * DiffViewer Component
 * ====================
 * React component for visualizing pre/post fingerprint HTML changes.
 * Supports side-by-side and tabbed layouts with visual diff highlighting.
 */

import React, { useState } from 'react';

/**
 * DiffViewer component - displays side-by-side or tabbed diff of pre/post HTML
 * @param {Object} props
 * @param {string} props.preHtml - Original HTML
 * @param {string} props.postHtml - Fingerprinted HTML
 * @param {Array} props.diffs - Array of [operation, text] tuples from generateHtmlDiff
 * @param {string} props.layout - 'side-by-side' or 'tabbed' (default: 'side-by-side')
 * @returns {JSX.Element}
 */
export function DiffViewer({ preHtml, postHtml, diffs = [], layout = 'side-by-side' }) {
  const [activeTab, setActiveTab] = useState('pre');

  // Check if there are actual changes
  const hasChanges = preHtml !== postHtml && (diffs.length > 0 || preHtml !== postHtml);

  if (!hasChanges) {
    return <div data-testid="no-changes">No changes</div>;
  }

  // Truncate large diffs to first 50 items
  const displayDiffs = diffs.length > 100 ? diffs.slice(0, 50) : diffs;
  const remainingCount = Math.max(0, diffs.length - 50);

  // Render diff segments with color coding
  const renderDiffSegment = () => (
    <code>
      {displayDiffs.map((diff, idx) => {
        const [opType, text] = diff;
        // 0 = unchanged, 1 = added (green), -1 = removed (red)
        const className =
          opType === 1
            ? 'diff-added'
            : opType === -1
              ? 'diff-removed'
              : 'diff-unchanged';
        return (
          <span key={idx} className={className}>
            {text}
          </span>
        );
      })}
    </code>
  );

  // Tabbed layout
  if (layout === 'tabbed') {
    return (
      <div data-testid="diff-viewer" className="diff-viewer tabbed">
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'pre' ? 'active' : ''}`}
            onClick={() => setActiveTab('pre')}
          >
            Original
          </button>
          <button
            className={`tab-btn ${activeTab === 'post' ? 'active' : ''}`}
            onClick={() => setActiveTab('post')}
          >
            Fingerprinted
          </button>
        </div>
        <div className="tab-content">
          {activeTab === 'pre' ? (
            <pre data-testid="pre-html" className="pre-html">
              {preHtml}
            </pre>
          ) : (
            <pre data-testid="post-html" className="post-html">
              {postHtml}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // Side-by-side layout (default)
  return (
    <div data-testid="diff-viewer" className="diff-viewer side-by-side">
      <div className="diff-column pre">
        <h3>Original</h3>
        <pre data-testid="pre-html" className="pre-html">
          {preHtml}
        </pre>
      </div>
      <div className="diff-column post">
        <h3>Fingerprinted</h3>
        <pre data-testid="post-html" className="post-html">
          {postHtml}
        </pre>
      </div>
      {displayDiffs.length > 0 && (
        <div className="diff-highlights">{renderDiffSegment()}</div>
      )}
      {remainingCount > 0 && (
        <div className="diff-truncated">
          ... {remainingCount} more changes
        </div>
      )}
    </div>
  );
}

export default DiffViewer;
