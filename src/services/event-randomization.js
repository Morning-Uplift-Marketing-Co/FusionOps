/**
 * Event Listener Randomization Service
 * ====================================
 * Randomizes event listener attachment order for tracking elements
 *
 * Provides:
 * - Selective event listener deferral (data-pixel, data-tracking only)
 * - Protected handler types (onclick, onsubmit, form handlers)
 * - Deterministic delay sequences (seeded)
 * - Form framework compatibility (React Hook Form, Formik)
 *
 * Phase 3 Vector 3: Implements event listener randomization
 */

import crypto from 'crypto';
import seedrandom from 'seedrandom';

/**
 * @class EventRandomizer
 * Transforms HTML by randomizing event listener attachment order
 */
export class EventRandomizer {
  /**
   * Transform HTML by randomizing event listener attachment order
   *
   * @param {string} htmlContent - Raw HTML document
   * @param {string} siteId - Unique site identifier (used for seeding)
   * @param {Object} options - Configuration options
   * @param {boolean} options.enabled - Enable randomization (default: true)
   * @returns {Promise<{html: string, eventRandomizationApplied: boolean}>}
   *
   * @description
   * Implements selective event listener randomization:
   * - Only randomizes listeners on elements with data-pixel or data-tracking attributes
   * - Protects form-related handlers (click, submit, change, input, blur, focus)
   * - Protects elements with data-form, data-validate, data-submit attributes
   * - Uses deterministic seeding for reproducible delay sequences
   * - Delays within 50-300ms range per listener
   * - Compatible with React Hook Form and Formik form frameworks
   */
  static async transform(htmlContent, siteId, options = {}) {
    const { enabled = true } = options;

    if (!enabled) {
      return {
        html: htmlContent,
        eventRandomizationApplied: false
      };
    }

    // Deterministic seeding: same siteId → same listener delay sequence
    const seed = crypto.createHash('sha256')
      .update(siteId + 'event-randomization')
      .digest('hex');
    const rng = seedrandom(seed);

    // Generate event randomizer wrapper script
    // Monkey-patches Element.prototype.addEventListener
    const randomizerScript = `
(function() {
  const originalAddEventListener = Element.prototype.addEventListener;
  const PROTECTED_TYPES = ['click', 'submit', 'change', 'input', 'blur', 'focus'];
  const PROTECTED_ATTRS = ['data-form', 'data-validate', 'data-submit'];
  const DELAY_POOL = [50, 100, 150, 200, 250, 300];
  let delayIndex = 0;

  Element.prototype.addEventListener = function(type, listener, options) {
    // Check if this is a tracking-related element
    const isTrackingElement = this.dataset?.pixel || this.dataset?.tracking;
    const isProtectedType = PROTECTED_TYPES.includes(type);
    const isProtectedAttr = PROTECTED_ATTRS.some(attr => this.hasAttribute(attr));

    // Don't randomize: form handlers, protected types, protected attributes
    if (isProtectedType || isProtectedAttr) {
      return originalAddEventListener.call(this, type, listener, options);
    }

    // Randomize only tracking listeners
    if (isTrackingElement) {
      const delay = DELAY_POOL[delayIndex % DELAY_POOL.length];
      delayIndex++;

      setTimeout(() => {
        originalAddEventListener.call(this, type, listener, options);
      }, delay);
      return;
    }

    // Default: attach immediately
    return originalAddEventListener.call(this, type, listener, options);
  };
})();
    `;

    // Inject into HTML head (before tracking scripts)
    const headMatch = htmlContent.match(/<\/head>/i);
    if (!headMatch) {
      // No head, inject before first script
      const scriptMatch = htmlContent.match(/<script/i);
      if (scriptMatch) {
        return {
          html: htmlContent.substring(0, scriptMatch.index)
            + `<script>${randomizerScript}</script>`
            + htmlContent.substring(scriptMatch.index),
          eventRandomizationApplied: true
        };
      }
      // No head or scripts, inject before body close
      return {
        html: htmlContent.replace(/<\/body>/i, `<script>${randomizerScript}</script></body>`),
        eventRandomizationApplied: true
      };
    }

    // Inject into head
    const beforeHead = htmlContent.substring(0, headMatch.index);
    const afterHead = htmlContent.substring(headMatch.index);
    return {
      html: beforeHead + `<script>${randomizerScript}</script>` + afterHead,
      eventRandomizationApplied: true
    };
  }
}
