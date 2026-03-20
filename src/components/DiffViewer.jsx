/**
 * DiffViewer Component
 * ====================
 * Renders pre/post fingerprint HTML side-by-side with diff highlighting.
 * Shows visual diff between original and fingerprinted versions.
 *
 * Props:
 * - preHtml: string - Original HTML
 * - postHtml: string - Fingerprinted HTML
 * - diffs?: Array - Diff operations (optional, auto-computed if not provided)
 * - layout?: 'side-by-side' | 'tabbed' - Display layout
 * - maxLines?: number - Max diff lines before truncation
 * - showSummary?: boolean - Show change statistics
 */

import React from 'react';
import { generateHtmlDiff } from '../utils/html-diff.js';

export function DiffViewer({
  preHtml,
  postHtml,
  diffs = [],
  layout = 'side-by-side',
  maxLines = 100,
  showSummary = false,
}) {
  // Check if there are actual changes
  const hasChanges = preHtml !== postHtml && (diffs.length > 0 || preHtml !== postHtml);

  if (!hasChanges) {
    return <div data-testid="no-changes" className="diff-no-changes">No changes</div>;
  }

  // If no diffs provided, compute them
  let displayDiffs = diffs;
  let summary = null;

  if (diffs.length === 0) {
    const result = generateHtmlDiff(preHtml, postHtml, { maxDiffLines: maxLines });
    displayDiffs = result.diffs;
    summary = result.summary;
  } else {
    // If diffs provided, compute summary
    const result = generateHtmlDiff(preHtml, postHtml);
    summary = result.summary;
  }

  // Truncate diffs if necessary
  const truncatedDiffs = displayDiffs.slice(0, maxLines);
  const remainingCount = Math.max(0, displayDiffs.length - maxLines);

  if (layout === 'tabbed') {
    return (
      <div data-testid="diff-viewer" className="diff-viewer tabbed">
        <div className="tabs">
          <button className="tab-btn active">Original</button>
          <button className="tab-btn">Fingerprinted</button>
        </div>
        <div className="tab-content">
          <div className="pre-html" data-testid="pre-html">
            {preHtml}
          </div>
        </div>
      </div>
    );
  }

  // Side-by-side layout
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

      {truncatedDiffs.length > 0 && (
        <div className="diff-highlights">
          {truncatedDiffs.map((diff, idx) => {
            const [opType, text] = diff;
            // 0 = unchanged, 1 = added (green), -1 = removed (red)
            const className =
              opType === 1 ? 'diff-added' : opType === -1 ? 'diff-removed' : 'diff-unchanged';
            return (
              <span key={idx} className={className}>
                {text}
              </span>
            );
          })}
        </div>
      )}

      {remainingCount > 0 && (
        <div className="diff-truncated">
          ... {remainingCount} more changes
        </div>
      )}

      {showSummary && summary && (
        <div className="diff-summary">
          <div className="summary-stat">
            <span className="stat-label">Added:</span>
            <span className="stat-value added">{summary.added} chars</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Removed:</span>
            <span className="stat-value removed">{summary.removed} chars</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Unchanged:</span>
            <span className="stat-value unchanged">{summary.unchanged} chars</span>
          </div>
        </div>
      )}
    </div>
  );
}
