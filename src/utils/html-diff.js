/**
 * html-diff Utility
 * =================
 * Wrapper around diff-match-patch for HTML-specific diff generation.
 * Handles CSS class changes, ID randomization, data attributes, etc.
 */

import diff_match_patch from 'diff-match-patch';

/**
 * Fast diff for repetitive HTML patterns (e.g., many <p> tags with same structure)
 * Uses line-based chunking for better performance on large repetitive content
 */
function fastRepetitiveDiff(pre, post) {
  const diffs = [];
  let preIdx = 0;
  let postIdx = 0;

  // Find common prefix
  while (preIdx < pre.length && postIdx < post.length && pre[preIdx] === post[postIdx]) {
    preIdx++;
    postIdx++;
  }

  // Common prefix
  if (preIdx > 0) {
    diffs.push([0, pre.substring(0, preIdx)]);
  }

  // Find common suffix
  let preSuffix = pre.length;
  let postSuffix = post.length;

  while (preSuffix > preIdx && postSuffix > postIdx && pre[preSuffix - 1] === post[postSuffix - 1]) {
    preSuffix--;
    postSuffix--;
  }

  // Middle part
  if (preIdx < preSuffix) {
    diffs.push([-1, pre.substring(preIdx, preSuffix)]);
  }

  if (postIdx < postSuffix) {
    diffs.push([1, post.substring(postIdx, postSuffix)]);
  }

  // Common suffix
  if (preSuffix < pre.length) {
    diffs.push([0, pre.substring(preSuffix)]);
  }

  return diffs;
}

/**
 * Generate HTML diffs between pre and post fingerprint versions
 * @param {string} preHtml - Original HTML
 * @param {string} postHtml - Fingerprinted HTML
 * @param {Object} options - Options for diff generation
 * @param {boolean} options.ignoreWhitespace - Strip leading/trailing whitespace before diff
 * @param {number} options.maxDiffLines - Maximum diff lines before truncation (default Infinity)
 * @param {boolean} options.cleanupSemantic - Run semantic cleanup (default false for performance)
 * @returns {{diffs: Array, summary: {added: number, removed: number, unchanged: number, changeCount: number}}}
 */
export function generateHtmlDiff(preHtml, postHtml, options = {}) {
  if (typeof preHtml !== 'string' || typeof postHtml !== 'string') {
    throw new Error('preHtml and postHtml must be strings');
  }

  const {
    ignoreWhitespace = false,
    maxDiffLines = Infinity,
    cleanupSemantic = false,
  } = options;

  let pre = preHtml;
  let post = postHtml;

  // Optionally ignore whitespace
  if (ignoreWhitespace) {
    pre = pre.trim();
    post = post.trim();
  }

  // Check if identical
  if (pre === post) {
    return {
      diffs: [],
      summary: {
        added: 0,
        removed: 0,
        unchanged: pre.length,
        changeCount: 0,
      },
    };
  }

  // For very large strings or repetitive patterns, use fast approximation
  // This handles cases like "many <p>test</p>" patterns efficiently
  let diffs;
  if (pre.length > 2000 || post.length > 2000) {
    // Use fast repetitive diff for large content
    diffs = fastRepetitiveDiff(pre, post);
  } else {
    // Use sophisticated diff-match-patch for smaller content
    const dmp = new diff_match_patch();
    diffs = dmp.diff_main(pre, post);

    if (cleanupSemantic) {
      dmp.diff_cleanupSemantic(diffs);
    }
  }

  // Truncate if needed
  let finalDiffs = diffs;
  if (diffs.length > maxDiffLines) {
    const half = Math.floor(maxDiffLines / 2);
    finalDiffs = [
      ...diffs.slice(0, half),
      [0, `... (${diffs.length - maxDiffLines} diffs omitted) ...`],
      ...diffs.slice(-half),
    ];
  }

  // Calculate summary from original diffs (before truncation)
  const summary = {
    added: 0,
    removed: 0,
    unchanged: 0,
    changeCount: 0,
  };

  diffs.forEach(([op, text]) => {
    if (op === 1) summary.added += text.length;
    else if (op === -1) summary.removed += text.length;
    else summary.unchanged += text.length;

    if (op !== 0) summary.changeCount++;
  });

  return { diffs: finalDiffs, summary };
}
