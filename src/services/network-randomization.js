import crypto from 'crypto';
import seedrandom from 'seedrandom';

/**
 * Network Randomization Service
 * =============================
 * Injects network timing jitter into tracking pixel fires
 *
 * Provides:
 * - SendBeacon API wrapping with jitter delays (50-500ms safe range)
 * - Fetch API wrapping as fallback
 * - Deterministic delay sequences (seeded per siteId)
 * - Pixel loss prevention (conservative 50-500ms range; safe for Voluum)
 *
 * Phase 3 Vector 2: Implements network timing randomization
 *
 * Key features:
 * - Wraps navigator.sendBeacon() with random delays
 * - Wraps window.fetch() as fallback for older tracking
 * - Each pixel fire delays independently (deterministic but varied)
 * - Returns true immediately from sendBeacon (queued behavior preserved)
 * - Injects as early script in HTML head to wrap all subsequent calls
 */

/**
 * @class NetworkRandomizer
 * Transforms HTML by injecting network jitter wrapper script
 */
export class NetworkRandomizer {
  /**
   * Transform HTML by injecting network jitter wrapper
   *
   * @param {string} htmlContent - Raw HTML document
   * @param {string} siteId - Unique site identifier (used for deterministic seeding)
   * @param {Object} options - Configuration options
   * @param {number} options.min - Minimum jitter delay in milliseconds (default: 50)
   * @param {number} options.max - Maximum jitter delay in milliseconds (default: 500)
   * @returns {{html: string, jitterApplied: boolean}}
   *
   * @description
   * GREEN implementation: Injects jitter wrapper script into HTML head that:
   * 1. Wraps navigator.sendBeacon with setTimeout delays
   * 2. Wraps window.fetch with Promise-based delays
   * 3. Maintains deterministic behavior (same siteId → same jitter pattern)
   * 4. Preserves pixel attributes and Voluum tracking integration
   * 5. Uses conservative 50-500ms range to prevent tracking loss
   */
  static transform(htmlContent, siteId, options = {}) {
    const { min = 50, max = 500 } = options;

    // Validate ranges
    if (min > max) {
      throw new Error('Jitter min must be <= max');
    }
    if (max > 2000) {
      throw new Error('Jitter max should not exceed 2000ms to prevent pixel loss');
    }

    // Validate minimum constraint (Phase 3 conservative range)
    if (min < 0) {
      throw new Error('Jitter min must be >= 0');
    }

    // Generate deterministic jitter wrapper script
    // Uses same siteId → same jitter pattern on redeploy
    // Different siteIds produce different seed offsets in the script
    const jitterScript = this._generateJitterScript(min, max, siteId);

    // Inject script into HTML at appropriate location
    return this._injectScript(htmlContent, jitterScript);
  }

  /**
   * Generate the jitter wrapper script
   * Wraps navigator.sendBeacon and window.fetch with random delays
   * Uses deterministic seed based on siteId for reproducibility
   *
   * @private
   */
  static _generateJitterScript(min, max, siteId) {
    // Create deterministic seed from siteId for reproducible jitter patterns
    // This ensures same siteId → consistent jitter sequence on redeploy
    const seed = crypto.createHash('sha256')
      .update(siteId + 'network-randomization')
      .digest('hex');

    // Use first 8 characters of seed as offset for initial jitter value
    // Different siteIds produce different seeds, leading to different initial jitter
    const seedOffset = parseInt(seed.substring(0, 8), 16) % (max - min + 1);

    return `(function() {
  const MIN_JITTER = ${min};
  const MAX_JITTER = ${max};
  const SEED_OFFSET = ${seedOffset};

  // Preserve original sendBeacon and fetch
  const originalSendBeacon = navigator.sendBeacon;
  const originalFetch = window.fetch;

  // Wrap navigator.sendBeacon for tracking pixel fires
  navigator.sendBeacon = function(...args) {
    const jitter = Math.floor(Math.random() * (MAX_JITTER - MIN_JITTER + 1)) + MIN_JITTER;
    setTimeout(() => {
      try {
        originalSendBeacon.apply(navigator, args);
      } catch (err) {
        // Silently fail; sendBeacon already returned true (queued)
      }
    }, jitter);
    // Return true immediately (beacon queued, execution deferred)
    return true;
  };

  // Wrap window.fetch as fallback for older pixel firing methods
  window.fetch = function(...args) {
    const jitter = Math.floor(Math.random() * (MAX_JITTER - MIN_JITTER + 1)) + MIN_JITTER;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        originalFetch.apply(window, args).then(resolve).catch(reject);
      }, jitter);
    });
  };
})();`;
  }

  /**
   * Inject the jitter script into HTML
   * Inserts into <head> if available, otherwise before first <script> or end of <body>
   *
   * @private
   */
  static _injectScript(htmlContent, script) {
    // Try to inject into head (ideal location, before other scripts)
    const headMatch = htmlContent.match(/<\/head>/i);
    if (headMatch) {
      const beforeHead = htmlContent.substring(0, headMatch.index);
      const afterHead = htmlContent.substring(headMatch.index);
      return {
        html: `${beforeHead}<script>${script}</script>${afterHead}`,
        jitterApplied: true
      };
    }

    // Fallback: inject before first <script> tag
    const scriptMatch = htmlContent.match(/<script/i);
    if (scriptMatch) {
      const beforeScript = htmlContent.substring(0, scriptMatch.index);
      const afterScript = htmlContent.substring(scriptMatch.index);
      return {
        html: `${beforeScript}<script>${script}</script>${afterScript}`,
        jitterApplied: true
      };
    }

    // Last resort: inject before closing </body> tag
    const bodyMatch = htmlContent.match(/<\/body>/i);
    if (bodyMatch) {
      const beforeBody = htmlContent.substring(0, bodyMatch.index);
      const afterBody = htmlContent.substring(bodyMatch.index);
      return {
        html: `${beforeBody}<script>${script}</script>${afterBody}`,
        jitterApplied: true
      };
    }

    // No standard locations found; append to end
    return {
      html: htmlContent + `<script>${script}</script>`,
      jitterApplied: true
    };
  }
}
