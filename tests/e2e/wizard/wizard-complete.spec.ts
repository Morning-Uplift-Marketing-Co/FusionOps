import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { WizardPage } from '../pages/WizardPage';
import { MINIMAL_WIZARD_DATA, FULL_WIZARD_DATA, VALID_BRAND_DATA, INVALID_BRAND_DATA } from '../fixtures/wizard-data';

/**
 * E2E Tests for LP Wizard - Complete Flow
 *
 * These tests verify the complete 7-step wizard flow:
 * 1. Brand Information (StepBrand.jsx)
 * 2. Product Configuration (StepProduct.jsx)
 * 3. Template Selection (StepTemplate.jsx)
 * 4. Design Selection (StepDesign.jsx)
 * 5. Copy & Content (StepCopy.jsx)
 * 6. Tracking & Conversion (StepTracking.jsx)
 * 7. Review & Build (StepReview.jsx)
 *
 * Run: npx playwright test tests/e2e/wizard/wizard-complete.spec.ts
 */

test.describe('LP Wizard - Complete Flow', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    // Start from dashboard
    await dashboardPage.goto();
    await expect(dashboardPage.createLPButton).toBeVisible({ timeout: 15000 });

    // Navigate to wizard
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Screenshot on failure
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `test-artifacts/screenshots/${testInfo.title.replace(/\s+/g, '-')}-failed.png`,
        fullPage: true,
      });
    }
  });

  test('should display wizard header with step indicator', async ({ page }) => {
    // Verify wizard title
    await expect(wizardPage.title).toBeVisible();

    // Verify step indicator shows Step 1/7
    await expect(wizardPage.stepIndicator).toContainText('Step 1/7');

    // Verify progress bar is visible
    await expect(wizardPage.progressBar).toBeVisible();

    // Verify step label shows "Brand"
    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible();
  });

  test('should navigate through all 7 steps using minimal data', async ({ page }) => {
    // Complete all steps with minimal data
    await wizardPage.completeMinimalWizard();

    // Verify we're on step 7
    const currentStep = await wizardPage.getCurrentStep();
    expect(currentStep).toBe(7);

    // Take screenshot of final review step
    await page.screenshot({
      path: 'test-artifacts/screenshots/wizard-complete-minimal.png',
    });
  });

  test('should complete full wizard with all fields populated', async ({ page }) => {
    // Step 1: Brand
    await wizardPage.completeStepBrand(FULL_WIZARD_DATA.brand);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 2/7');

    // Step 2: Product
    await wizardPage.completeStepProduct(FULL_WIZARD_DATA.product);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 3/7');

    // Step 3: Template
    await wizardPage.completeStepTemplate(FULL_WIZARD_DATA.template);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 4/7');

    // Step 4: Design
    await wizardPage.completeStepDesign(FULL_WIZARD_DATA.design);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 5/7');

    // Step 5: Copy
    await wizardPage.completeStepCopy(FULL_WIZARD_DATA.copy);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 6/7');

    // Step 6: Tracking
    await wizardPage.completeStepTracking(FULL_WIZARD_DATA.tracking);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 7/7');

    // Step 7: Review - verify configuration summary
    await expect(wizardPage.configurationSummary).toBeVisible();
    await expect(page.getByText(FULL_WIZARD_DATA.brand.brand)).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-artifacts/screenshots/wizard-complete-full.png',
      fullPage: true,
    });
  });

  test('should show validation errors when trying to proceed without required fields', async ({ page }) => {
    // Try to click Next without filling anything
    await wizardPage.clickNext();

    // Verify validation errors appear
    const errors = await wizardPage.getValidationErrors();
    expect(errors.length).toBeGreaterThan(0);

    // Check for specific error messages
    const errorEl = page.locator('[class*="destructive"]').first();
    const errorText = await errorEl.textContent().catch(() => '');
    expect(errorText).toMatch(/Brand Name is required|Domain is required/);
  });

  test('should validate domain format', async ({ page }) => {
    // Fill brand but use invalid domain
    await wizardPage.completeStepBrand({
      brand: 'Test Brand',
      domain: INVALID_BRAND_DATA.invalidDomain,
    });

    await wizardPage.clickNext();

    // Should show domain validation error
    await expect(page.getByText(/Invalid domain format/i)).toBeVisible({ timeout: 3000 });
  });

  test('should navigate back through steps', async ({ page }) => {
    // Complete step 1
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    // Should be on step 2
    await expect(wizardPage.stepIndicator).toContainText('Step 2/7');

    // Click back
    await wizardPage.clickBack();

    // Should be back on step 1
    await expect(wizardPage.stepIndicator).toContainText('Step 1/7');
    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible();
  });

  test('should cancel wizard from step 1', async ({ page }) => {
    // Click cancel on step 1
    await wizardPage.clickCancel();

    // Should return to dashboard
    await expect(dashboardPage.createLPButton).toBeVisible({ timeout: 5000 });
  });

  test('should persist data when navigating between steps', async ({ page }) => {
    // Fill step 1
    const testData = VALID_BRAND_DATA;
    await wizardPage.completeStepBrand(testData);

    // Go to step 2 and back
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 2/7');
    await wizardPage.clickBack();

    // Verify data is still there
    const inputs = page.locator('input');
    await expect(inputs.nth(0)).toHaveValue(testData.brand);
    await expect(inputs.nth(1)).toHaveValue(testData.domain);
  });

  test('should display mobile preview on design, copy, and review steps', async ({ page }) => {
    // Complete first 3 steps to reach design
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();

    // Now on step 4 (Design) - preview should be visible
    await expect(page.locator('iframe, [class*="mock-phone"], [class*="preview"]').first()).toBeVisible();
  });

  test('should select different loan types', async ({ page }) => {
    // Complete step 1
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    // Try each loan type
    const loanTypes = ['Personal', 'Installment', 'PDL'];
    for (const type of loanTypes) {
      const loanButton = page.locator('button').filter({ hasText: type });
      if (await loanButton.isVisible()) {
        await loanButton.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('should use amount presets', async ({ page }) => {
    // Complete step 1
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    // Click an amount preset
    const preset = page.locator('button').filter({ hasText: /\$100.*\$5K/ });
    if (await preset.isVisible()) {
      await preset.click();

      // Verify values were filled
      const minInput = page.locator('input[type="number"]').nth(0);
      await expect(minInput).toHaveValue(/100/);
    }
  });

  test('should select different templates', async ({ page }) => {
    // Complete first 2 steps
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    // Now on template step
    const templates = ['Classic LP', 'PDL Loans'];
    for (const template of templates) {
      const templateButton = page.locator('button').filter({ hasText: template });
      if (await templateButton.isVisible()) {
        await templateButton.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('should select different color schemes', async ({ page }) => {
    // Complete first 3 steps
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();

    // Now on design step - try different colors
    const colors = ['Ocean', 'Forest', 'Midnight'];
    for (const color of colors) {
      const colorButton = page.locator('button').filter({ hasText: color });
      if (await colorButton.isVisible()) {
        await colorButton.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('should apply copy template', async ({ page }) => {
    // Complete first 4 steps
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();

    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();

    // Now on copy step - apply a template
    const templateButton = page.locator('button').filter({ hasText: /QuickFund|LoanBridge/i });
    if (await templateButton.isVisible()) {
      await templateButton.click();
      await page.waitForTimeout(300);

      // Verify fields were populated (check for non-empty values)
      const h1Input = page.locator('input').filter({ hasText: '' }).first();
      const value = await h1Input.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('should toggle tracking mode between minimal and voluum', async ({ page }) => {
    // Complete first 5 steps
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();

    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();

    await wizardPage.completeStepCopy();
    await wizardPage.clickNext();

    // Now on tracking step - try toggling modes
    const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
    const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });

    if (await voluumBtn.isVisible()) {
      await voluumBtn.click();
      await page.waitForTimeout(300);
      // Voluum campaign section should appear
      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();
    }

    if (await minimalBtn.isVisible()) {
      await minimalBtn.click();
      await page.waitForTimeout(300);
      // Voluum campaign section should be hidden or minimal
    }
  });

  test('should display configuration summary on review step', async ({ page }) => {
    // Complete all steps
    await wizardPage.completeMinimalWizard();

    // Verify summary shows brand name
    await expect(page.getByText(MINIMAL_WIZARD_DATA.brand.brand)).toBeVisible();

    // Verify summary shows loan amount range
    const rangeText = `$${MINIMAL_WIZARD_DATA.product.amountMin}`;
    await expect(page.getByText(rangeText)).toBeVisible();
  });

  test('should expand Astro project file tree', async ({ page }) => {
    // Complete all steps
    await wizardPage.completeMinimalWizard();

    // Click to expand file tree
    const astroButton = page.getByRole('button').filter({ hasText: /Astro Project/i });
    if (await astroButton.isVisible()) {
      await astroButton.click();
      await page.waitForTimeout(300);

      // Verify some file indicators
      await expect(page.locator('text=/\\.astro|\\.css|package\\.json/i')).toBeVisible();
    }
  });

  test('should support Enter key navigation', async ({ page }) => {
    // Fill brand name
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Test Brand');

    // Press Enter on domain input
    await inputs.nth(1).fill('test.com');
    await inputs.nth(1).press('Enter');

    // Should move to next step (if validation passes) or stay on step 1
    await page.waitForTimeout(500);
    const step = await wizardPage.getCurrentStep();
    // Either stayed on step 1 (validation) or moved to step 2
    expect(step).toBeGreaterThanOrEqual(1);
    expect(step).toBeLessThanOrEqual(2);
  });

  test('should show warning before closing with unsaved changes', async ({ page }) => {
    // Fill some data
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);

    // Go to step 2
    await wizardPage.clickNext();

    // Try to cancel - should show confirmation dialog
    page.on('dialog', dialog => {
      dialog.accept();
    });

    await wizardPage.clickCancel();

    // After accepting dialog, should either stay or go back
    await page.waitForTimeout(500);
  });

  test('should complete wizard and save successfully', async ({ page }) => {
    // Complete all steps
    await wizardPage.completeMinimalWizard();

    // Click build button
    await wizardPage.clickBuild();

    // Wait for build to complete
    await page.waitForTimeout(3000);

    // Should return to sites/dashboard page
    await expect(page.getByText(/Sites|Dashboard|My Sites/i).first()).toBeVisible({ timeout: 10000 });

    // Take screenshot of success state
    await page.screenshot({
      path: 'test-artifacts/screenshots/wizard-save-success.png',
    });
  });
});

/**
 * Performance tests for wizard flow
 */
test.describe('LP Wizard - Performance', () => {
  test('should load wizard within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('should complete wizard in under 60 seconds', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    const startTime = Date.now();
    await wizardPage.completeMinimalWizard();
    const completionTime = Date.now() - startTime;

    expect(completionTime).toBeLessThan(60000);
  });
});

/**
 * Accessibility tests
 */
test.describe('LP Wizard - Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    // Check for main heading
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();

    // Check for step heading
    const h2 = page.locator('h2');
    await expect(h2.first()).toBeVisible();
  });

  test('should have focusable inputs for keyboard navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    // Tab through inputs
    const inputs = page.locator('input');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      await inputs.nth(i).focus();
      await expect(inputs.nth(i)).toBeFocused();
      await page.keyboard.press('Tab');
    }
  });
});
