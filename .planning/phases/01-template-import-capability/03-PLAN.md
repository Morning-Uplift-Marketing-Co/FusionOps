---
phase: 01-template-import-capability
plan: 03
type: execute
wave: 2
depends_on:
  - 01
  - 02
files_modified:
  - src/components/Wizard/step-mapper.js
  - src/components/Wizard/steps/StepDesign.jsx
  - src/components/Wizard/__tests__/step-mapper.test.js
  - src/components/Wizard/__tests__/wizard-capability.test.jsx
  - src/components/__tests__/StepReview.test.jsx
autonomous: true
requirements:
  - CAPAB-03
  - CAPAB-04
must_haves:
  truths:
    - "Wizard dynamically shows/hides Design, Tracking, and Copy steps based on template capabilities"
    - "Wizard gracefully degrades when template lacks a feature (skips step, shows warning, doesn't break)"
    - "User can override auto-detected capabilities via checkbox in Brand step"
    - "Preview renders templates with missing features without errors"
  artifacts:
    - path: "src/components/Wizard/step-mapper.js"
      provides: "Map template capabilities to enabled wizard steps"
      exports: ["getEnabledSteps", "renderWizardSteps"]
    - path: "src/components/Wizard/steps/StepDesign.jsx"
      provides: "Design step with conditional fields based on capabilities"
      exports: ["StepDesign"]
    - path: "src/components/__tests__/StepReview.test.jsx"
      provides: "Test suite for preview graceful degradation"
      exports: ["test suites"]
  key_links:
    - from: "src/utils/capability-resolver.js"
      to: "src/components/Wizard/step-mapper.js"
      via: "Wizard calls resolveCapabilities, passes result to step-mapper"
      pattern: "getEnabledSteps.*capabilities"
    - from: "src/components/Wizard/step-mapper.js"
      to: "src/components/Wizard/steps/*"
      via: "step-mapper returns list of step components with conditional fields"
      pattern: "hidden:.*enabledSteps"
    - from: "src/components/Wizard/steps/StepDesign.jsx"
      to: "src/components/Wizard/steps/StepBrand.jsx"
      via: "StepBrand renders capability override checkboxes that feed StepDesign"
      pattern: "supportsCalculator.*checkbox"
---

<objective>
Wire capability detection into wizard UI: dynamically show/hide steps based on what each template supports, handle missing features gracefully, and enable user overrides.

Purpose: Create seamless user experience where wizard only offers options that template actually supports.

Output: Step mapper component, enhanced Design step with conditional fields, test coverage for integration and graceful degradation.
</objective>

<execution_context>
@.planning/phases/01-template-import-capability/01-RESEARCH.md
@.planning/phases/01-template-import-capability/02-PLAN-SUMMARY.md
@.planning/codebase/STRUCTURE.md
</execution_context>

<context>
# Wizard Step Mapping (from RESEARCH.md, lines 386-429)

Current wizard steps:
1. Template Selection (required)
2. Product/Type (conditional)
3. Brand (required; show capability overrides here)
4. Copy (required)
5. Design (conditional; only if template supports section reorder/calculator)
6. Tracking (required)
7. Review (required)

Mapping logic:
- Design step should only show fields for capabilities template supports
- If calculator not supported, hide calculator fields
- If section reorder not supported, hide reorder UI
- If colors not supported, show warning but don't error

# Graceful Degradation (from RESEARCH.md, lines 500-515)

Strategy:
1. Conservative auto-detect: confidence < 0.65 disables feature by default
2. User override step: Step 2 checkbox in wizard: "Does this template support [feature]?"
3. Preview validation: When user configures a feature, preview it immediately; show warning if looks wrong
4. Show warnings if user configures feature template doesn't support

# Key Existing Code

From `src/components/Wizard/`:
- StepBrand.jsx — current step with color picker
- StepCopy.jsx — headline, subheading, CTA
- StepDesign.jsx — section reorder, calculator settings (needs enhancement)
- StepTracking.jsx — conversion pixel, form action
- StepReview.jsx — preview + deploy button

Use these as reference for step structure and props pattern.

# From VALIDATION.md (lines 37-48)

Test map shows:
- CAPAB-03: integration test for wizard-capability.test.jsx
- CAPAB-04: integration test for wizard-degradation.test.jsx
- StepReview tests for graceful handling of missing features
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create step-mapper to determine enabled steps based on capabilities</name>
  <files>
    src/components/Wizard/step-mapper.js
    src/components/Wizard/__tests__/step-mapper.test.js
  </files>
  <read_first>
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 5: Wizard Step Mapping to Capabilities, lines 386-429)
    - src/components/Wizard/steps/StepDesign.jsx (reference for Design step structure)
    - src/components/Wizard/steps/StepBrand.jsx (reference for step prop pattern)
  </read_first>
  <action>
Create `src/components/Wizard/step-mapper.js` with two functions:

**`getEnabledSteps(capabilities)`**

Input: capabilities object from resolveCapabilities (from Plan 02)
```javascript
{
  supportsCalculator: { value: true, confidence: 0.85 },
  supportsSectionReorder: { value: false, confidence: 0.40 },
  supportsFormCustomization: { value: true, confidence: 0.75 },
  supportsCustomColors: { value: true, confidence: 0.90 },
  supportsImageUpload: { value: false, confidence: 0.30 }
}
```

Output:
```javascript
{
  templateSelection: true,
  productType: capabilities.supportsFormCustomization?.value || false,
  brand: true,
  copy: true,
  design: {
    sectionReorder: capabilities.supportsSectionReorder?.value || false,
    calculator: capabilities.supportsCalculator?.value || false,
    colorOverride: capabilities.supportsCustomColors?.value || true, // Default true
  },
  tracking: true,
  review: true,
}
```

Logic:
- templateSelection: always true (required step)
- productType: true only if supportsFormCustomization
- brand: always true (required)
- copy: always true (required)
- design.sectionReorder: true if supportsSectionReorder.value
- design.calculator: true if supportsCalculator.value
- design.colorOverride: true if supportsCustomColors.value, else true (default support colors)
- tracking: always true (required)
- review: always true (required)

**`renderWizardSteps(enabledSteps, currentStep, onStepChange, template)`**

Input:
- enabledSteps: output from getEnabledSteps
- currentStep: current step index or ID
- onStepChange: callback(stepIndex) when user navigates
- template: template object with name, id

Output: Array of step objects
```javascript
[
  { id: 'template', label: 'Template', Component: StepTemplate, required: true, hidden: false },
  { id: 'product', label: 'Product Type', Component: StepProductType, required: false, hidden: !enabledSteps.productType },
  { id: 'brand', label: 'Brand', Component: StepBrand, required: true, hidden: false },
  { id: 'copy', label: 'Copy', Component: StepCopy, required: true, hidden: false },
  { id: 'design', label: 'Design', Component: StepDesign, required: false, hidden: !enabledSteps.design.sectionReorder && !enabledSteps.design.calculator, fields: enabledSteps.design },
  { id: 'tracking', label: 'Tracking', Component: StepTracking, required: true, hidden: false },
  { id: 'review', label: 'Review', Component: StepReview, required: true, hidden: false },
]
```

Logic:
- Import all step components from src/components/Wizard/steps/
- Mark hidden: true if step is conditional and its feature is disabled
- Pass `fields` object to Design step so it knows which sub-fields to render
- Mark required: true only for mandatory steps
- Return flat array (wizard will filter hidden steps during rendering)

Export as named exports: `export function getEnabledSteps(capabilities) { ... }` and `export function renderWizardSteps(enabledSteps, currentStep, onStepChange, template) { ... }`

Test file `src/components/Wizard/__tests__/step-mapper.test.js`:
- 6+ test cases:
  1. Product step hidden if formCustomization not supported
  2. Design step hidden if neither calculator nor sectionReorder supported
  3. Design.calculator visible only if supportsCalculator.value true
  4. Design.sectionReorder visible only if supportsSectionReorder.value true
  5. Colors enabled by default (colorOverride: true unless explicitly false)
  6. Required steps always visible (template, brand, copy, tracking, review)
  7. renderWizardSteps returns correct component for each step
  8. Hidden steps included in array but marked hidden: true

Each test uses exact array length and hidden property assertions.
  </action>
  <verify>
    <automated>npx vitest run src/components/Wizard/__tests__/step-mapper.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 6+ test cases pass
- getEnabledSteps correctly maps capabilities to step visibility
- renderWizardSteps returns all required steps + conditional steps
- Hidden steps marked with hidden: true
- Design step receives fields object showing which sub-fields to render
- Product step hidden if formCustomization not supported
- Colors enabled by default unless supportsCustomColors.value is explicitly false
- Functions are pure; no side effects
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Enhance StepDesign to conditionally render fields based on capabilities</name>
  <files>
    src/components/Wizard/steps/StepDesign.jsx
    src/components/Wizard/__tests__/wizard-capability.test.jsx
  </files>
  <read_first>
    - src/components/Wizard/steps/StepDesign.jsx (current implementation)
    - src/components/Wizard/step-mapper.js (Task 1 output; created in this plan)
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 5, lines 408-417)
  </read_first>
  <action>
Enhance `src/components/Wizard/steps/StepDesign.jsx`:

Current structure (if it exists):
- Renders form fields for Design step

Required changes:
1. **Accept `fields` prop from step-mapper:**
   ```jsx
   export function StepDesign({ template, onSave, fields = {} }) {
   ```

2. **Conditionally render sub-fields based on `fields` object:**
   ```jsx
   if (!fields.sectionReorder && !fields.calculator && !fields.colorOverride) {
     return <p>This template doesn't support design customization.</p>;
   }

   return (
     <form>
       {fields.sectionReorder && (
         <section>
           <label>Section Reorder</label>
           <p>Drag sections to reorder</p>
           {/* section reorder UI */}
         </section>
       )}

       {fields.calculator && (
         <section>
           <label>Calculator Settings</label>
           <input ... /> {/* calculator fields */}
         </section>
       )}

       {fields.colorOverride && (
         <section>
           <label>Colors</label>
           {/* color picker UI */}
         </section>
       )}
     </form>
   );
   ```

3. **Handle empty case gracefully:**
   - If all sub-fields are false (template doesn't support design customization), show friendly message
   - Message: "This template doesn't support design customization. Proceeding with default settings."
   - Show as info message (not error)

4. **Preserve existing functionality:**
   - Still accept and use onSave prop
   - Still integrate with template preview (if it exists)
   - No changes to API or prop types outside of adding `fields`

Test file `src/components/Wizard/__tests__/wizard-capability.test.jsx`:
- 5+ test cases (integration tests; use React Testing Library):
  1. StepDesign shows all fields when all capabilities enabled
  2. StepDesign hides calculator field when supportsCalculator false
  3. StepDesign hides sectionReorder field when supportsSectionReorder false
  4. StepDesign shows friendly message when all sub-fields disabled
  5. StepDesign accepts onSave and calls it on form submit
  6. Color picker enabled by default even if not in fields

Each test should render StepDesign with different `fields` objects and verify rendered elements.
  </action>
  <verify>
    <automated>npx vitest run src/components/Wizard/__tests__/wizard-capability.test.jsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 5+ test cases pass
- StepDesign accepts `fields` prop and renders conditionally
- All sub-fields render when capabilities enabled
- All sub-fields hidden when capabilities disabled
- Friendly message shown when design customization not supported
- onSave callback still works correctly
- No console errors or warnings in test output
- Component gracefully handles missing `fields` prop (defaults to {})
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Add graceful degradation tests for missing features in preview</name>
  <files>
    src/components/__tests__/StepReview.test.jsx
  </files>
  <read_first>
    - src/components/Wizard/steps/StepReview.jsx (current implementation)
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pitfall 2: False Positives/Negatives, lines 480-515)
    - src/utils/template-preview-runtime.js (reference for preview rendering)
  </read_first>
  <action>
Create test file `src/components/__tests__/StepReview.test.jsx` to verify graceful degradation:

Purpose: Test that StepReview (preview) renders templates with missing features without errors.

Test file structure (using React Testing Library + vitest):
- Import StepReview component
- Create mock template with missing features
- Verify preview renders without crashing

5+ test cases:
1. Preview renders when template lacks calculator
   - Template with supportsCalculator=false
   - User configured calculator settings anyway (false positive scenario)
   - Preview should render without calculator functionality
   - Should show warning: "Calculator not supported by this template"

2. Preview renders when template lacks color customization
   - User selected custom colors
   - Template doesn't support colors
   - Preview should ignore color settings and use template defaults
   - Should show info: "Colors not customizable for this template"

3. Preview renders when template lacks section reordering
   - Template with supportsSectionReorder=false
   - Preview should show sections in original order
   - No errors or console warnings

4. Preview renders with all supported features
   - All capabilities enabled
   - All user inputs applied
   - No warnings

5. Preview handles missing required fields gracefully
   - Brand name, headline, etc. may be missing during wizard
   - Preview should show placeholders ("Your Brand", "Your Headline")
   - No console errors

Each test:
- Renders StepReview with mock template and capabilities
- Verifies rendered output (via screen queries)
- Checks for warnings/error messages
- Ensures no console.error or exceptions

No actual iframe/preview rendering required; mock template-preview-runtime.js if needed.

Test command: `npx vitest run src/components/__tests__/StepReview.test.jsx --reporter=verbose`
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/StepReview.test.jsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 5+ test cases pass
- Preview renders templates with unsupported features without crashing
- Warnings displayed for unsupported features
- Placeholders shown for missing user inputs
- No console.error or unhandled exceptions
- Test file uses React Testing Library best practices
- Mock templates are realistic (match actual template structure)
  </acceptance_criteria>
</task>

</tasks>

<verification>
After all tasks complete:
1. Run full wizard tests: `npx vitest run src/components/Wizard/__tests__/ --reporter=verbose` (all wizard-related tests green)
2. Run step review tests: `npx vitest run src/components/__tests__/StepReview.test.jsx --reporter=verbose`
3. Verify step mapper logic manually:
   - Create sample capabilities object (all true)
   - Call getEnabledSteps; verify all steps enabled
   - Create sample with supportsCalculator=false
   - Verify design.calculator is false
4. Integration smoke test (manual):
   - Open wizard
   - Select a template
   - Verify Design step shows only supported fields
   - Verify warnings appear for unsupported features
</verification>

<success_criteria>
- All 3 tasks completed with full test coverage (16+ tests total)
- Step mapper correctly translates capabilities to UI visibility
- StepDesign conditionally renders sub-fields
- Graceful degradation verified with test coverage
- No console errors or warnings
- All tests pass in <30 seconds
- Components are composable and reusable
- User experience clear: warnings for unsupported features, graceful fallbacks
</success_criteria>

<output>
Create `.planning/phases/01-template-import-capability/03-PLAN-SUMMARY.md` with:
- Components updated: StepDesign.jsx, step-mapper.js added
- Test coverage: 16+ integration tests passing
- Key functions: getEnabledSteps, renderWizardSteps, enhanced StepDesign
- Capabilities wired to UI:
  - Product step hidden unless supportsFormCustomization
  - Design.calculator hidden unless supportsCalculator
  - Design.sectionReorder hidden unless supportsSectionReorder
  - Design.colorOverride enabled by default
- Graceful degradation: warnings shown for unsupported features, preview renders safely
- Test command for verification
- Integration notes: StepBrand should accept capability overrides checkbox (future enhancement)
- Phase 1 complete: Ready for Phase 2 (Multi-Format Build)
</output>
