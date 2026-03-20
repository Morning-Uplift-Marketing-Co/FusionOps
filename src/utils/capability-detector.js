/**
 * Capability Detector
 * ==================
 * Auto-detect template capabilities via pattern scoring.
 *
 * Responsibilities:
 *   - Scan template source for feature signals
 *   - Score capability likelihood using weighted signals
 *   - Return confidence scores for 5 capability types
 *
 * Design:
 *   - Pure functions, no side effects
 *   - Works on { [path]: content } file map from template extraction
 *   - Confidence threshold: 0.65 (if score >= 0.65, feature is enabled)
 *   - Each capability is isolated with its own signal set
 */

/**
 * Get all content from files (combined for pattern matching)
 * @private
 * @param {Record<string, string>} files
 * @returns {string}
 */
function getAllContent(files) {
  if (!files || typeof files !== 'object') return '';
  return Object.values(files).join('\n');
}

/**
 * Get all file paths in normalized form
 * @private
 * @param {Record<string, string>} files
 * @returns {string[]}
 */
function getNormalizedPaths(files) {
  if (!files || typeof files !== 'object') return [];
  return Object.keys(files).map(k => k.replace(/\\/g, '/').replace(/^\/+/, ''));
}

/**
 * Check if a component with a given name exists
 * @private
 * @param {Record<string, string>} files
 * @param {string} componentName - e.g., "Calculator"
 * @returns {boolean}
 */
function hasComponentNamed(files, componentName) {
  const content = getAllContent(files);
  // Simple substring match for component names: look for "ComponentName" as a standalone word
  // This is conservative but avoids complex regex escaping issues
  const patterns = [
    new RegExp(`function\\s+${componentName}\\s*\\(`, 'i'),
    new RegExp(`const\\s+${componentName}\\s*=`, 'i'),
    new RegExp(`export\\s+function\\s+${componentName}\\s*\\(`, 'i'),
    new RegExp(`<${componentName}[\\s>]`, 'i'),
  ];
  return patterns.some(p => p.test(content));
}

/**
 * Find number of occurrences of a regex pattern
 * @private
 * @param {Record<string, string>} files
 * @param {RegExp} pattern
 * @returns {number}
 */
function countMatches(files, pattern) {
  const content = getAllContent(files);
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Check if regex matches in files
 * @private
 * @param {Record<string, string>} files
 * @param {RegExp} pattern
 * @returns {boolean}
 */
function hasPattern(files, pattern) {
  const content = getAllContent(files);
  return pattern.test(content);
}

/**
 * Count specific HTML tags in all content
 * @private
 * @param {Record<string, string>} files
 * @param {string} tagName - e.g., "section", "form"
 * @returns {number}
 */
function countHtmlTag(files, tagName) {
  const content = getAllContent(files);
  const regex = new RegExp(`<${tagName}[\\s>]`, 'gi');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Score capability based on matched signals
 * Calculates: (sum of matched signal weights) / (sum of all signal weights)
 *
 * @param {Record<string, string>} files
 * @param {Array<{test: Function, weight: number, description: string}>} signals
 * @returns {{confidence: number, evidence: string[]}}
 *
 * @example
 * const signals = [
 *   { test: (f) => hasComponentNamed(f, 'Calculator'), weight: 0.35, description: 'Calculator component' },
 *   { test: (f) => hasPattern(f, /range|slider/i), weight: 0.25, description: 'Range input' }
 * ];
 * const result = scoreSignals(files, signals);
 * // { confidence: 0.6, evidence: ['Calculator component', 'Range input'] }
 */
export function scoreSignals(files, signals) {
  if (!signals || signals.length === 0) {
    return { confidence: 0, evidence: [] };
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  const evidence = [];

  for (const signal of signals) {
    totalWeight += signal.weight;

    try {
      if (signal.test(files)) {
        matchedWeight += signal.weight;
        evidence.push(signal.description);
      }
    } catch (_e) {
      // Individual signal failure shouldn't break scoring
    }
  }

  const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    confidence: Math.min(confidence, 1),
    evidence,
  };
}

/**
 * Auto-detect all template capabilities
 * Scans files for 5 capability types and returns confidence scores
 *
 * @param {Record<string, string>} files - File map { "path/file.ext": "content" }
 * @returns {Object} - Capabilities with value, confidence, and reason
 *
 * @example
 * const capabilities = autoDetectCapabilities({
 *   'src/components/Calculator.jsx': '...',
 *   'src/pages/index.astro': '<input type="range">'
 * });
 * // {
 * //   supportsCalculator: {
 * //     value: true,
 * //     confidence: 0.8,
 * //     reason: "Auto-detected: Calculator component, Range input, ..."
 * //   },
 * //   ...
 * // }
 */
export function autoDetectCapabilities(files) {
  if (!files || typeof files !== 'object') {
    return {
      supportsCalculator: { value: false, confidence: 0, reason: 'No files to analyze' },
      supportsSectionReorder: { value: false, confidence: 0, reason: 'No files to analyze' },
      supportsFormCustomization: { value: false, confidence: 0, reason: 'No files to analyze' },
      supportsCustomColors: { value: false, confidence: 0, reason: 'No files to analyze' },
      supportsImageUpload: { value: false, confidence: 0, reason: 'No files to analyze' },
    };
  }

  // ─── Calculator Detection ────────────────────────────────────────────────────

  const calculatorSignals = [
    {
      test: (f) => hasComponentNamed(f, 'Calculator'),
      weight: 0.35,
      description: 'Calculator component found',
    },
    {
      test: (f) => hasPattern(f, /input\s+.*type\s*=\s*['"]*range/i),
      weight: 0.25,
      description: 'Range input detected',
    },
    {
      test: (f) => hasPattern(f, /Math\.(min|max|pow|sqrt)/),
      weight: 0.20,
      description: 'Math functions detected',
    },
    {
      test: (f) => hasPattern(f, /amountMin|amountMax|loanAmount|minValue|maxValue/i),
      weight: 0.15,
      description: 'Amount/calculator variables detected',
    },
  ];

  const calculatorScore = scoreSignals(files, calculatorSignals);
  const supportsCalculator = {
    value: calculatorScore.confidence >= 0.65,
    confidence: calculatorScore.confidence,
    reason:
      calculatorScore.evidence.length > 0
        ? `Auto-detected: ${calculatorScore.evidence.join(', ')}`
        : 'No calculator signals detected',
  };

  // ─── Section Reorder Detection ───────────────────────────────────────────────

  const sectionReorderSignals = [
    {
      test: (f) => countHtmlTag(f, 'section') > 3,
      weight: 0.35,
      description: 'Multiple sections (>3) found',
    },
    {
      test: (f) => hasPattern(f, /\[\s*\.\.\.\s*sections?\s*\]/),
      weight: 0.30,
      description: 'Dynamic section spreading detected',
    },
    {
      test: (f) => !hasPattern(f, /hardcoded|fixed.*layout|static.*layout/i),
      weight: 0.20,
      description: 'No hardcoded layout detected',
    },
  ];

  const reorderScore = scoreSignals(files, sectionReorderSignals);
  const supportsSectionReorder = {
    value: reorderScore.confidence >= 0.65,
    confidence: reorderScore.confidence,
    reason:
      reorderScore.evidence.length > 0
        ? `Auto-detected: ${reorderScore.evidence.join(', ')}`
        : 'No section reorder signals detected',
  };

  // ─── Custom Colors Detection ─────────────────────────────────────────────────

  const customColorsSignals = [
    {
      test: (f) =>
        hasPattern(f, /--primary|--accent|--secondary|--background|--color-primary|--color-accent/) ||
        hasPattern(f, /:\s*root\s*\{[^}]*--[a-z-]+\s*:/i),
      weight: 0.40,
      description: 'CSS custom properties detected',
    },
    {
      test: (f) => hasPattern(f, /colorProp|customColor|color\s*:\s*\{.*\}/i),
      weight: 0.25,
      description: 'Color component/prop detected',
    },
    {
      test: (f) => hasPattern(f, /hsl\s*\(\s*\d+\s*,|rgb\s*\(\s*\d+\s*,|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i),
      weight: 0.35,
      description: 'Color values detected',
    },
  ];

  const customColorsScore = scoreSignals(files, customColorsSignals);
  const supportsCustomColors = {
    value: customColorsScore.confidence >= 0.65,
    confidence: customColorsScore.confidence,
    reason:
      customColorsScore.evidence.length > 0
        ? `Auto-detected: ${customColorsScore.evidence.join(', ')}`
        : 'No custom colors signals detected',
  };

  // ─── Form Customization Detection ────────────────────────────────────────────

  const formCustomizationSignals = [
    {
      test: (f) => hasPattern(f, /<form[>\s]/i),
      weight: 0.40,
      description: 'Form element found',
    },
    {
      test: (f) => hasPattern(f, /<input[>\s]|<textarea|<select/i),
      weight: 0.30,
      description: 'Input fields found',
    },
    {
      test: (f) => hasPattern(f, /handleSubmit|onSubmit|formHandler|handleForm/i),
      weight: 0.20,
      description: 'Form handler function detected',
    },
  ];

  const formScore = scoreSignals(files, formCustomizationSignals);
  const supportsFormCustomization = {
    value: formScore.confidence >= 0.65,
    confidence: formScore.confidence,
    reason:
      formScore.evidence.length > 0
        ? `Auto-detected: ${formScore.evidence.join(', ')}`
        : 'No form signals detected',
  };

  // ─── Image Upload Detection ──────────────────────────────────────────────────

  const imageUploadSignals = [
    {
      test: (f) => hasPattern(f, /image\s+.*upload|file\s+.*input|upload\s+.*image/i),
      weight: 0.30,
      description: 'Image upload pattern detected',
    },
    {
      test: (f) => hasComponentNamed(f, 'Upload') || hasComponentNamed(f, 'ImageUpload'),
      weight: 0.35,
      description: 'Upload component found',
    },
    {
      test: (f) => hasPattern(f, /FormData|enctype\s*=\s*['"]*multipart/i),
      weight: 0.35,
      description: 'Multipart form data detected',
    },
  ];

  const imageUploadScore = scoreSignals(files, imageUploadSignals);
  const supportsImageUpload = {
    value: imageUploadScore.confidence >= 0.65,
    confidence: imageUploadScore.confidence,
    reason:
      imageUploadScore.evidence.length > 0
        ? `Auto-detected: ${imageUploadScore.evidence.join(', ')}`
        : 'No image upload signals detected',
  };

  return {
    supportsCalculator,
    supportsSectionReorder,
    supportsFormCustomization,
    supportsCustomColors,
    supportsImageUpload,
  };
}
