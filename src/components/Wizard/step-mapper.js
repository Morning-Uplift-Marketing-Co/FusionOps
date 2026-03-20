/**
 * Step Mapper
 * ===========
 * Map template capabilities to enabled wizard steps.
 *
 * Responsibilities:
 *   - Translate resolved capabilities into UI step visibility
 *   - Determine which Design sub-fields to render
 *   - Generate step definitions with conditional rendering metadata
 *
 * Design:
 *   - Pure functions, no side effects
 *   - Input: capabilities from capability-resolver
 *   - Output: step definitions with hidden/fields metadata
 */

// Import step components (these should be created/exist in the wizard steps directory)
// For now, we use dynamic imports in renderWizardSteps to avoid circular dependencies

/**
 * @typedef {Object} StepDefinition
 * @property {string} id - Step identifier (template, product, brand, copy, design, tracking, review)
 * @property {string} label - Human-readable step name
 * @property {Function} Component - React component to render
 * @property {boolean} required - Whether step is mandatory
 * @property {boolean} hidden - Whether step should be hidden from user
 * @property {Object} [fields] - For Design step: which sub-fields to render
 */

/**
 * Determine which wizard steps should be enabled based on capabilities.
 *
 * Mapping:
 * - templateSelection: always true (required)
 * - productType: true only if supportsFormCustomization
 * - brand: always true (required)
 * - copy: always true (required)
 * - design: true if any sub-field is enabled (sectionReorder OR calculator OR colorOverride)
 *   - design.sectionReorder: true if supportsSectionReorder.value
 *   - design.calculator: true if supportsCalculator.value
 *   - design.colorOverride: true if supportsCustomColors.value, else true (default support colors)
 * - tracking: always true (required)
 * - review: always true (required)
 *
 * @param {Object} capabilities - Output from resolveCapabilities
 * @example
 * const capabilities = {
 *   supportsCalculator: { value: true, confidence: 0.85 },
 *   supportsSectionReorder: { value: false, confidence: 0.40 },
 *   supportsFormCustomization: { value: true, confidence: 0.75 },
 *   supportsCustomColors: { value: true, confidence: 0.90 },
 *   supportsImageUpload: { value: false, confidence: 0.30 }
 * };
 * const enabled = getEnabledSteps(capabilities);
 * // Returns: { templateSelection: true, productType: true, ... design: { ... } }
 *
 * @returns {Object} - Enabled steps configuration
 */
export function getEnabledSteps(capabilities = {}) {
  // Default to empty capability set if not provided
  if (!capabilities || typeof capabilities !== 'object') {
    capabilities = {};
  }

  return {
    templateSelection: true,
    productType: capabilities.supportsFormCustomization?.value || false,
    brand: true,
    copy: true,
    design: {
      sectionReorder: capabilities.supportsSectionReorder?.value || false,
      calculator: capabilities.supportsCalculator?.value || false,
      colorOverride: capabilities.supportsCustomColors?.value !== false, // Default true
    },
    tracking: true,
    review: true,
  };
}

/**
 * Render wizard steps as an array of step definitions.
 *
 * Returns all steps (required + conditional) with hidden property.
 * Hidden steps are excluded from navigation flow but included in the array.
 *
 * @param {Object} enabledSteps - Output from getEnabledSteps
 * @param {number} [currentStep] - Current step index (unused, for future use)
 * @param {Function} [onStepChange] - Callback when step changes (unused, for future use)
 * @param {Object} [template] - Template object { id, name, ... } (optional)
 *
 * @returns {Array<StepDefinition>} - Step definitions with Component, hidden, fields metadata
 */
export async function renderWizardSteps(
  enabledSteps = {},
  currentStep = 0,
  onStepChange = null,
  template = null
) {
  // Dynamically import step components to avoid circular dependencies
  const StepTemplate = (await import('./StepTemplate.jsx')).StepTemplate;
  const StepProduct = (await import('./StepProduct.jsx')).StepProduct;
  const StepBrand = (await import('./StepBrand.jsx')).StepBrand;
  const StepCopy = (await import('./StepCopy.jsx')).StepCopy;
  const StepDesign = (await import('./StepDesign.jsx')).StepDesign;
  const StepTracking = (await import('./StepTracking.jsx')).StepTracking;
  const StepReview = (await import('./StepReview.jsx')).StepReview;

  // Determine if Design step should be hidden
  const designFields = enabledSteps.design || {};
  const hasDesignFields =
    designFields.sectionReorder ||
    designFields.calculator ||
    designFields.colorOverride;

  return [
    {
      id: 'template',
      label: 'Template',
      Component: StepTemplate,
      required: true,
      hidden: false,
    },
    {
      id: 'product',
      label: 'Product Type',
      Component: StepProduct,
      required: false,
      hidden: !enabledSteps.productType,
    },
    {
      id: 'brand',
      label: 'Brand',
      Component: StepBrand,
      required: true,
      hidden: false,
    },
    {
      id: 'copy',
      label: 'Copy',
      Component: StepCopy,
      required: true,
      hidden: false,
    },
    {
      id: 'design',
      label: 'Design',
      Component: StepDesign,
      required: false,
      hidden: !hasDesignFields,
      fields: designFields,
    },
    {
      id: 'tracking',
      label: 'Tracking',
      Component: StepTracking,
      required: true,
      hidden: false,
    },
    {
      id: 'review',
      label: 'Review',
      Component: StepReview,
      required: true,
      hidden: false,
    },
  ];
}

/**
 * Get only the visible steps (hidden: false) from the full step array.
 *
 * Useful for rendering only steps that should be shown to the user.
 *
 * @param {Array<StepDefinition>} steps - Output from renderWizardSteps
 * @returns {Array<StepDefinition>} - Filtered steps with hidden: false
 */
export function getVisibleSteps(steps = []) {
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.filter((step) => !step.hidden);
}

/**
 * Get the index of a step by its ID.
 *
 * @param {Array<StepDefinition>} steps - Step array
 * @param {string} stepId - Step ID to find
 * @returns {number} - Index of step, or -1 if not found
 */
export function getStepIndex(steps = [], stepId) {
  if (!Array.isArray(steps)) {
    return -1;
  }
  return steps.findIndex((step) => step.id === stepId);
}

/**
 * Check if all required steps are visible.
 *
 * @param {Array<StepDefinition>} steps - Step array
 * @returns {boolean} - True if all required steps are visible
 */
export function areAllRequiredStepsVisible(steps = []) {
  if (!Array.isArray(steps)) {
    return true; // No steps = no required steps = all visible
  }
  return steps
    .filter((step) => step.required)
    .every((step) => !step.hidden);
}
