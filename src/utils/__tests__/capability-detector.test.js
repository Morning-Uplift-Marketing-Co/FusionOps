/**
 * Tests for capability-detector.js
 * Tests: autoDetectCapabilities, scoreSignals
 */

import { describe, it, expect } from 'vitest';
import { autoDetectCapabilities, scoreSignals } from '../capability-detector.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const CALCULATOR_TEMPLATE = {
  'src/components/Calculator.jsx': `
    export function Calculator() {
      const handleCalculate = (min, max, amount) => {
        return Math.min(max, Math.max(min, amount));
      };
      return (
        <div>
          <input type="range" min="0" max="100" />
          <span>Min: {minValue}</span>
          <span>Max: {maxValue}</span>
          <span>Amount: {loanAmount}</span>
        </div>
      );
    }
  `,
  'src/pages/index.astro': '<Calculator />',
};

const NO_CALCULATOR_TEMPLATE = {
  'src/pages/index.astro': '<h1>Welcome</h1><p>No calculator here</p>',
};

const WEAK_CALCULATOR_SIGNALS = {
  'src/pages/index.astro': `
    <input type="number" />
    <span>Amount: 100</span>
  `,
};

const SECTION_REORDER_TEMPLATE = {
  'src/pages/index.astro': `
    <section id="hero"><h1>Hero</h1></section>
    <section id="features"><h2>Features</h2></section>
    <section id="pricing"><h2>Pricing</h2></section>
    <section id="faq"><h2>FAQ</h2></section>
    {[...sections].map((s) => <Section key={s.id} {...s} />)}
  `,
};

const FIXED_LAYOUT_TEMPLATE = {
  'src/pages/index.astro': `
    <section id="hero"><h1>Hero</h1></section>
    <section id="features"><h2>Features</h2></section>
    <!-- This is a hardcoded layout with fixed sections -->
  `,
};

const CUSTOM_COLORS_TEMPLATE = {
  'src/styles/global.css': `:root {
  --primary: #3b82f6;
  --accent: #ff6b35;
  --secondary: #f0f0f0;
}
.button {
  background: hsl(217, 91%, 60%);
  color: rgb(255, 255, 255);
}`,
  'src/pages/index.astro': `<button style="color: #123abc">Click me</button>`,
};

const NO_COLORS_TEMPLATE = {
  'src/pages/index.astro': '<h1>Plain text only</h1>',
};

const FORM_TEMPLATE = {
  'src/pages/index.astro': `
    <form onSubmit={handleSubmit}>
      <input type="text" name="email" />
      <input type="password" name="password" />
      <textarea name="message"></textarea>
      <button type="submit">Submit</button>
    </form>
  `,
  'src/utils/form.js': `
    export function handleSubmit(e) {
      e.preventDefault();
      console.log('Form submitted');
    }
  `,
};

const NO_FORM_TEMPLATE = {
  'src/pages/index.astro': '<h1>Static page</h1><p>No forms here</p>',
};

const IMAGE_UPLOAD_TEMPLATE = {
  'src/components/ImageUpload.jsx': `export function ImageUpload() {
  const handleUpload = (file) => {
    const formData = new FormData();
    formData.append('image', file);
    fetch('/upload', { method: 'POST', body: formData });
  };
  return <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0])} />;
}`,
  'src/pages/index.astro': `<form enctype="multipart/form-data">
  <ImageUpload />
</form>`,
};

const NO_UPLOAD_TEMPLATE = {
  'src/pages/index.astro': '<h1>No uploads</h1>',
};

// ─── Tests for scoreSignals ─────────────────────────────────────────────────

describe('scoreSignals', () => {
  it('should calculate confidence as matched weight / total weight', () => {
    const signals = [
      { test: () => true, weight: 0.5, description: 'First signal' },
      { test: () => true, weight: 0.3, description: 'Second signal' },
      { test: () => false, weight: 0.2, description: 'Third signal' },
    ];
    const result = scoreSignals({}, signals);
    expect(result.confidence).toBe(0.8); // (0.5 + 0.3) / (0.5 + 0.3 + 0.2)
  });

  it('should include matched signal descriptions in evidence', () => {
    const signals = [
      { test: () => true, weight: 0.5, description: 'Signal A' },
      { test: () => true, weight: 0.3, description: 'Signal B' },
      { test: () => false, weight: 0.2, description: 'Signal C' },
    ];
    const result = scoreSignals({}, signals);
    expect(result.evidence).toEqual(['Signal A', 'Signal B']);
  });

  it('should handle empty signal array', () => {
    const result = scoreSignals({}, []);
    expect(result.confidence).toBe(0);
    expect(result.evidence).toEqual([]);
  });

  it('should handle all failing signals', () => {
    const signals = [
      { test: () => false, weight: 0.5, description: 'First' },
      { test: () => false, weight: 0.5, description: 'Second' },
    ];
    const result = scoreSignals({}, signals);
    expect(result.confidence).toBe(0);
    expect(result.evidence).toEqual([]);
  });

  it('should handle signal test exceptions gracefully', () => {
    const signals = [
      { test: () => true, weight: 0.5, description: 'Good signal' },
      { test: () => { throw new Error('Boom'); }, weight: 0.3, description: 'Bad signal' },
      { test: () => true, weight: 0.2, description: 'Another good' },
    ];
    const result = scoreSignals({}, signals);
    expect(result.confidence).toBe(0.7); // (0.5 + 0.2) / 1.0
    expect(result.evidence).toEqual(['Good signal', 'Another good']);
  });
});

// ─── Tests for autoDetectCapabilities ────────────────────────────────────────

describe('autoDetectCapabilities', () => {
  // ─── Calculator Detection ────────────────────────────────────────────

  it('should detect calculator with high confidence when multiple signals present', () => {
    const result = autoDetectCapabilities(CALCULATOR_TEMPLATE);
    expect(result.supportsCalculator.value).toBe(true);
    expect(result.supportsCalculator.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.supportsCalculator.reason).toContain('Auto-detected');
  });

  it('should not detect calculator when signals absent', () => {
    const result = autoDetectCapabilities(NO_CALCULATOR_TEMPLATE);
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsCalculator.confidence).toBeLessThan(0.65);
  });

  it('should detect calculator with low confidence on weak signals', () => {
    const result = autoDetectCapabilities(WEAK_CALCULATOR_SIGNALS);
    expect(result.supportsCalculator.value).toBe(result.supportsCalculator.confidence >= 0.65);
    // Reason depends on whether any signals matched
    if (result.supportsCalculator.confidence > 0) {
      expect(result.supportsCalculator.reason).toContain('Auto-detected');
    } else {
      expect(result.supportsCalculator.reason).toContain('No');
    }
  });

  // ─── Section Reorder Detection ───────────────────────────────────────

  it('should detect section reorder when multiple sections and dynamic spreading present', () => {
    const result = autoDetectCapabilities(SECTION_REORDER_TEMPLATE);
    expect(result.supportsSectionReorder.value).toBe(true);
    expect(result.supportsSectionReorder.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('should not detect section reorder for fixed layouts', () => {
    const result = autoDetectCapabilities(FIXED_LAYOUT_TEMPLATE);
    expect(result.supportsSectionReorder.confidence).toBeLessThan(0.65);
  });

  // ─── Custom Colors Detection ─────────────────────────────────────────

  it('should detect custom colors from CSS variables and color values', () => {
    const result = autoDetectCapabilities(CUSTOM_COLORS_TEMPLATE);
    expect(result.supportsCustomColors.value).toBe(true);
    expect(result.supportsCustomColors.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.supportsCustomColors.reason).toContain('Auto-detected');
  });

  it('should not detect custom colors when not present', () => {
    const result = autoDetectCapabilities(NO_COLORS_TEMPLATE);
    expect(result.supportsCustomColors.value).toBe(false);
    expect(result.supportsCustomColors.confidence).toBeLessThan(0.65);
  });

  // ─── Form Customization Detection ────────────────────────────────────

  it('should detect form customization with form and inputs present', () => {
    const result = autoDetectCapabilities(FORM_TEMPLATE);
    expect(result.supportsFormCustomization.value).toBe(true);
    expect(result.supportsFormCustomization.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.supportsFormCustomization.reason).toContain('Auto-detected');
  });

  it('should not detect form customization when forms absent', () => {
    const result = autoDetectCapabilities(NO_FORM_TEMPLATE);
    expect(result.supportsFormCustomization.value).toBe(false);
    expect(result.supportsFormCustomization.confidence).toBeLessThan(0.65);
  });

  // ─── Image Upload Detection ──────────────────────────────────────────

  it('should detect image upload with component and multipart form', () => {
    const result = autoDetectCapabilities(IMAGE_UPLOAD_TEMPLATE);
    expect(result.supportsImageUpload.value).toBe(true);
    expect(result.supportsImageUpload.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.supportsImageUpload.reason).toContain('Auto-detected');
  });

  it('should not detect image upload when signals absent', () => {
    const result = autoDetectCapabilities(NO_UPLOAD_TEMPLATE);
    expect(result.supportsImageUpload.value).toBe(false);
    expect(result.supportsImageUpload.confidence).toBeLessThan(0.65);
  });

  // ─── All capabilities present ────────────────────────────────────────

  it('should return all 5 capability types in output', () => {
    const result = autoDetectCapabilities(CALCULATOR_TEMPLATE);
    expect(result).toHaveProperty('supportsCalculator');
    expect(result).toHaveProperty('supportsSectionReorder');
    expect(result).toHaveProperty('supportsFormCustomization');
    expect(result).toHaveProperty('supportsCustomColors');
    expect(result).toHaveProperty('supportsImageUpload');
  });

  it('should have value, confidence, and reason for each capability', () => {
    const result = autoDetectCapabilities(CALCULATOR_TEMPLATE);
    Object.values(result).forEach((cap) => {
      expect(cap).toHaveProperty('value');
      expect(cap).toHaveProperty('confidence');
      expect(cap).toHaveProperty('reason');
      expect(typeof cap.value).toBe('boolean');
      expect(typeof cap.confidence).toBe('number');
      expect(typeof cap.reason).toBe('string');
      expect(cap.confidence).toBeGreaterThanOrEqual(0);
      expect(cap.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ─── Confidence threshold behavior ───────────────────────────────────

  it('should enable feature when confidence >= 0.65', () => {
    // Confidence at exactly 0.65 should enable
    const signals = [
      { test: () => true, weight: 0.65, description: 'A' },
      { test: () => false, weight: 0.35, description: 'B' },
    ];
    const result = scoreSignals({}, signals);
    expect(result.confidence).toBe(0.65);
  });

  it('should disable feature when confidence < 0.65', () => {
    const signals = [
      { test: () => true, weight: 0.64, description: 'A' },
      { test: () => false, weight: 0.36, description: 'B' },
    ];
    const result = scoreSignals({}, signals);
    expect(result.confidence).toBeLessThan(0.65);
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  it('should handle null files gracefully', () => {
    const result = autoDetectCapabilities(null);
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsCalculator.confidence).toBe(0);
  });

  it('should handle empty files object gracefully', () => {
    const result = autoDetectCapabilities({});
    expect(result.supportsCalculator.value).toBe(false);
    Object.values(result).forEach((cap) => {
      expect(cap.value).toBe(false);
      expect(cap.confidence).toBeGreaterThanOrEqual(0);
      expect(cap.confidence).toBeLessThanOrEqual(1);
    });
  });

  it('should handle files with no matching patterns', () => {
    const result = autoDetectCapabilities({
      'README.md': '# My Template',
      'LICENSE': 'MIT',
    });
    expect(result.supportsCalculator.value).toBe(false);
    expect(result.supportsFormCustomization.value).toBe(false);
  });

  // ─── Case-insensitive pattern matching ───────────────────────────────

  it('should match patterns case-insensitively where appropriate', () => {
    const template = {
      'src/pages/index.html': `
        <FORM>
          <INPUT type="TEXT" />
        </FORM>
      `,
    };
    const result = autoDetectCapabilities(template);
    expect(result.supportsFormCustomization.value).toBe(true);
  });

  it('should detect component names case-insensitively', () => {
    const template = {
      'src/components/imageupload.jsx': `export function ImageUpload() {
  return <input type="file" />;
}`,
    };
    const result = autoDetectCapabilities(template);
    // Should match because component is named ImageUpload (case-insensitive search)
    expect(result.supportsImageUpload.confidence).toBeGreaterThan(0);
  });

  // ─── Reason strings ─────────────────────────────────────────────────

  it('should include signal descriptions in reason string', () => {
    const result = autoDetectCapabilities(CALCULATOR_TEMPLATE);
    const reason = result.supportsCalculator.reason;
    expect(reason).toContain('Auto-detected');
    // Should mention at least one of the signals
    const hasSignal =
      reason.includes('Calculator') ||
      reason.includes('Range') ||
      reason.includes('Math') ||
      reason.includes('Amount');
    expect(hasSignal).toBe(true);
  });

  it('should provide explanation when no signals detected', () => {
    const result = autoDetectCapabilities(NO_CALCULATOR_TEMPLATE);
    expect(result.supportsCalculator.reason).toContain('No');
  });
});
