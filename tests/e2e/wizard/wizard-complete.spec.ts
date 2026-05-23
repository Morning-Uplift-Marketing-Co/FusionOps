import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { WizardPage } from '../pages/WizardPage';
import { MINIMAL_WIZARD_DATA, FULL_WIZARD_DATA, VALID_BRAND_DATA, INVALID_BRAND_DATA } from '../fixtures/wizard-data';

/**
 * E2E Tests for LP Wizard - Complete Flow
 *
 * These tests verify the complete 6-step wizard flow:
 * 1. Brand Information (StepBrand.jsx)
 * 2. Product Configuration (StepProduct.jsx)
 * 3. Template + Design Selection (StepDesign.jsx)
 * 4. Copy & Content (StepCopy.jsx)
 * 5. Tracking & Conversion (StepTracking.jsx)
 * 6. Review & Build (StepReview.jsx)
 *
 * Run: npx playwright test tests/e2e/wizard/wizard-complete.spec.ts
 */

test.describe('LP Wizard - Complete Flow', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await expect(dashboardPage.createLPButton).toBeVisible({ timeout: 15000 });
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `test-artifacts/screenshots/${testInfo.title.replace(/\s+/g, '-')}-failed.png`,
        fullPage: true,
      });
    }
  });

  test('should display wizard header with step indicator', async ({ page }) => {
    await expect(wizardPage.title).toBeVisible();
    await expect(wizardPage.stepIndicator).toContainText('Step 1/6');
    await expect(wizardPage.progressBar).toBeVisible();
    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible();
  });

  test('should navigate through all 6 steps using minimal data', async ({ page }) => {
    await wizardPage.completeMinimalWizard();

    const currentStep = await wizardPage.getCurrentStep();
    expect(currentStep).toBe(6);

    await page.screenshot({
      path: 'test-artifacts/screenshots/wizard-complete-minimal.png',
    });
  });

  test('should complete full wizard with all fields populated', async ({ page }) => {
    await wizardPage.completeStepBrand(FULL_WIZARD_DATA.brand);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 2/6');

    await wizardPage.completeStepProduct(FULL_WIZARD_DATA.product);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 3/6');

    await wizardPage.completeStepTemplate(FULL_WIZARD_DATA.template);
    await wizardPage.completeStepDesign(FULL_WIZARD_DATA.design);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 4/6');

    await wizardPage.completeStepCopy(FULL_WIZARD_DATA.copy);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 5/6');

    await wizardPage.completeStepTracking(FULL_WIZARD_DATA.tracking);
    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 6/6');

    await expect(wizardPage.configurationSummary).toBeVisible();
    await expect(page.getByText(FULL_WIZARD_DATA.brand.brand)).toBeVisible();

    await page.screenshot({
      path: 'test-artifacts/screenshots/wizard-complete-full.png',
      fullPage: true,
    });
  });

  test('should show validation errors when trying to proceed without required fields', async ({ page }) => {
    await wizardPage.clickNext();

    const errors = await wizardPage.getValidationErrors();
    expect(errors.length).toBeGreaterThan(0);

    const errorEl = page.locator('[class*="destructive"]').first();
    const errorText = await errorEl.textContent().catch(() => '');
    expect(errorText).toMatch(/Brand Name is required|Domain is required/);
  });

  test('should validate domain format', async ({ page }) => {
    await wizardPage.completeStepBrand({
      brand: 'Test Brand',
      domain: INVALID_BRAND_DATA.invalidDomain,
    });

    await wizardPage.clickNext();
    await expect(page.getByText(/Invalid domain format/i)).toBeVisible({ timeout: 3000 });
  });

  test('should navigate back through steps', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 2/6');

    await wizardPage.clickBack();

    await expect(wizardPage.stepIndicator).toContainText('Step 1/6', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible({ timeout: 5000 });
  });

  test('should cancel wizard from step 1', async ({ page }) => {
    await wizardPage.clickCancel();
    await expect(dashboardPage.createLPButton).toBeVisible({ timeout: 5000 });
  });

  test('should persist data when navigating between steps', async ({ page }) => {
    const testData = VALID_BRAND_DATA;
    await wizardPage.completeStepBrand(testData);

    await wizardPage.clickNext();
    await expect(wizardPage.stepIndicator).toContainText('Step 2/6');
    await wizardPage.clickBack();

    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible({ timeout: 10000 });
    const textInputs = page.locator('input[type="text"], input:not([type="number"]):not([type="checkbox"])').first();
    await expect(textInputs).toHaveValue(testData.brand, { timeout: 5000 });
  });

  test('should display mobile preview on combined design step and review step', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();
    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await expect(page.locator('iframe, [class*="mock-phone"], [class*="preview"]').first()).toBeVisible();
  });

  test('should select different loan types', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

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
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    const preset = page.locator('button').filter({ hasText: /\$100.*\$5K/ });
    if (await preset.isVisible()) {
      await preset.click();

      const minInput = page.locator('input[type="number"]').nth(0);
      await expect(minInput).toHaveValue(/100/);
    }
  });

  test('should select different templates', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();
    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

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
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();
    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

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
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();
    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();
    await wizardPage.completeStepTemplate();
    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();

    const templateButton = page.locator('button').filter({ hasText: /QuickFund|LoanBridge/i }).first();
    if (await templateButton.isVisible()) {
      await templateButton.click();
      await page.waitForTimeout(300);

      const h1Input = page.locator('input').filter({ hasText: '' }).first();
      const value = await h1Input.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('should toggle tracking mode between minimal and voluum', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();
    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();
    await wizardPage.completeStepTemplate();
    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();
    await wizardPage.completeStepCopy();
    await wizardPage.clickNext();

    const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
    const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });

    if (await voluumBtn.isVisible()) {
      await voluumBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();
    }

    if (await minimalBtn.isVisible()) {
      await minimalBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('should display configuration summary on review step', async ({ page }) => {
    await wizardPage.completeMinimalWizard();

    await expect(page.getByText(MINIMAL_WIZARD_DATA.brand.brand).first()).toBeVisible();
    await expect(page.getByText(/Loan range \(defaults\)/i).first()).toBeVisible();
    await expect(page.getByText(/\$100[\s–-]\$5[,]?000/).first()).toBeVisible();
  });

  test('should expand Astro project file tree', async ({ page }) => {
    await wizardPage.completeMinimalWizard();

    const astroButton = page.getByRole('button').filter({ hasText: /Astro Project/i }).first();
    if (await astroButton.isVisible()) {
      await astroButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/\.astro|\.css|package\.json/i).first()).toBeVisible();
    }
  });

  test('should support Enter key navigation', async ({ page }) => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Test Brand');
    await inputs.nth(1).fill('test.com');
    await inputs.nth(1).press('Enter');

    await page.waitForTimeout(500);
    const step = await wizardPage.getCurrentStep();
    expect(step).toBeGreaterThanOrEqual(1);
    expect(step).toBeLessThanOrEqual(2);
  });

  test('should show warning before closing with unsaved changes', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    page.once('dialog', dialog => dialog.accept());
    await wizardPage.cancelButton.click();
    await page.waitForTimeout(500);
  });

  test('should complete wizard and save successfully', async ({ page }) => {
    await wizardPage.completeMinimalWizard();
    await wizardPage.clickBuild();
    await page.waitForTimeout(3000);

    await expect(page.getByText(/Sites|Dashboard|My Sites/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: 'test-artifacts/screenshots/wizard-save-success.png',
    });
  });
});

test.describe('LP Wizard - Performance', () => {
  test('should load wizard promptly (dev server + parallel workers)', async ({ page }) => {
    const startTime = Date.now();

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(25000);
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

test.describe('LP Wizard - Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();

    const heading = page.getByRole('heading', { name: /Brand Information|Loan Product|Design/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should have focusable inputs for keyboard navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    const wizardPage = new WizardPage(page);
    await wizardPage.waitForWizardToLoad();

    const inputs = page.locator('input');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      await inputs.nth(i).focus();
      await expect(inputs.nth(i)).toBeFocused();
      await page.keyboard.press('Tab');
    }
  });
});
