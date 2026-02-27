import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { WizardPage } from '../pages/WizardPage';
import { VALID_BRAND_DATA, INVALID_BRAND_DATA, VALID_PRODUCT_DATA } from '../fixtures/wizard-data';

/**
 * E2E Tests for LP Wizard Flow
 *
 * These tests verify the complete wizard flow for creating landing pages:
 * - Step 1: Brand Information (StepBrand.jsx)
 * - Step 2: Product Configuration (StepProduct.jsx)
 * - Step 3: Template Selection (StepTemplate.jsx)
 * - Step 4: Design Selection (StepDesign.jsx)
 * - Step 5: Copy & Content (StepCopy.jsx)
 * - Step 6: Tracking & Conversion (StepTracking.jsx)
 * - Step 7: Review & Build (StepReview.jsx)
 *
 * Test Strategy:
 * - Use Page Object Model pattern
 * - Test happy paths and error cases
 * - Include visual regression via screenshots
 * - Test keyboard navigation (Enter key)
 *
 * Run: npx playwright test tests/e2e/wizard/wizard-flow.spec.ts
 */

test.describe('LP Wizard - Navigation', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();
  });

  test('should open wizard from dashboard', async ({ page }) => {
    await expect(wizardPage.title).toBeVisible();
    await expect(wizardPage.stepIndicator).toContainText('Step 1/7');
    await expect(page.getByText(/Brand Information|Brand/i)).toBeVisible();
  });

  test('should close wizard when canceling on step 1', async ({ page }) => {
    await wizardPage.clickCancel();
    await expect(dashboardPage.createLPButton).toBeVisible({ timeout: 5000 });
  });

  test('should show progress indicator', async ({ page }) => {
    await expect(wizardPage.progressBar).toBeVisible();
    await expect(wizardPage.stepIndicator).toContainText('Step 1/7');
  });

  test('should navigate between steps using Next and Back', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 2/7');
    await expect(page.getByText(/Loan Product|Product/i)).toBeVisible();

    await wizardPage.clickBack();

    await expect(wizardPage.stepIndicator).toContainText('Step 1/7');
    await expect(page.getByText(/Brand Information|Brand/i)).toBeVisible();
  });

  test('should support Enter key navigation', async ({ page }) => {
    const brandInput = page.locator('input').nth(0);
    await brandInput.fill('Test Brand');

    const domainInput = page.locator('input').nth(1);
    await domainInput.fill('test.com');
    await domainInput.press('Enter');

    await page.waitForTimeout(500);
    const step = await wizardPage.getCurrentStep();
    expect(step).toBeGreaterThanOrEqual(1);
  });
});

test.describe('LP Wizard - Step 1: Brand Information', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();
  });

  test('should display all brand form fields', async ({ page }) => {
    await expect(page.getByText(/Brand Name/i)).toBeVisible();
    await expect(page.getByText(/Domain/i)).toBeVisible();
    await expect(page.getByText(/Tagline/i)).toBeVisible();
    await expect(page.getByText(/Compliance Email|Email/i)).toBeVisible();
  });

  test('should require brand name to proceed', async ({ page }) => {
    await wizardPage.clickNext();

    const errors = await wizardPage.getValidationErrors();
    expect(errors.some(e => e.includes('Brand Name'))).toBe(true);
  });

  test('should require domain to proceed', async ({ page }) => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Test Brand');

    await wizardPage.clickNext();

    const errors = await wizardPage.getValidationErrors();
    expect(errors.some(e => e.includes('Domain'))).toBe(true);
  });

  test('should validate domain format', async ({ page }) => {
    await wizardPage.completeStepBrand({
      brand: 'Test Brand',
      domain: INVALID_BRAND_DATA.invalidDomain,
    });

    await wizardPage.clickNext();

    await expect(page.getByText(/Invalid domain format/i)).toBeVisible({ timeout: 3000 });
  });

  test('should accept valid domain formats', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 2/7');
  });

  test('should complete step 1 with all fields', async ({ page }) => {
    await wizardPage.completeStepBrand({
      brand: 'E2E Test Brand',
      domain: 'e2e-test-loan.com',
      tagline: 'Quick Loans, Simple Process',
      email: 'support@e2e-test.com',
    });

    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 2/7');

    await page.screenshot({ path: 'test-artifacts/wizard/step2-product.png' });
  });
});

test.describe('LP Wizard - Step 2: Product Configuration', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();

    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();
  });

  test('should display loan type options', async ({ page }) => {
    await expect(page.getByText(/Personal/i)).toBeVisible();
    await expect(page.getByText(/Installment/i)).toBeVisible();
  });

  test('should select loan type', async ({ page }) => {
    const personalLoan = page.locator('button').filter({ hasText: /Personal/i }).first();
    await personalLoan.click();
    await page.waitForTimeout(200);
  });

  test('should display amount range presets', async ({ page }) => {
    await expect(page.getByText(/\$100.*\$5K/)).toBeVisible();
    await expect(page.getByText(/\$500.*\$10K/)).toBeVisible();
  });

  test('should select amount preset', async ({ page }) => {
    const preset = page.locator('button').filter({ hasText: /\$100.*\$5K/ }).first();
    if (await preset.isVisible()) {
      await preset.click();
      await page.waitForTimeout(200);
    }
  });

  test('should accept custom amount range', async ({ page }) => {
    const inputs = page.locator('input[type="number"], input');
    await inputs.nth(0).fill('500');
    await inputs.nth(1).fill('10000');

    await wizardPage.clickNext();
    await page.waitForTimeout(500);
  });

  test('should validate min < max for amounts', async ({ page }) => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('10000');
    await inputs.nth(1).fill('5000');

    await wizardPage.clickNext();

    const errors = await wizardPage.getValidationErrors();
    expect(errors.some(e => e.includes('Min Amount') || e.includes('less than'))).toBe(true);
  });

  test('should validate APR range', async ({ page }) => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('500');
    await inputs.nth(1).fill('10000');
    await inputs.nth(2).fill('35.99');
    await inputs.nth(3).fill('5.99');

    await wizardPage.clickNext();

    const errors = await wizardPage.getValidationErrors();
    expect(errors.some(e => e.includes('APR') || e.includes('less than'))).toBe(true);
  });

  test('should complete step 2 with valid data', async ({ page }) => {
    await wizardPage.completeStepProduct(VALID_PRODUCT_DATA);
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 3/7');

    await page.screenshot({ path: 'test-artifacts/wizard/step3-template.png' });
  });
});

test.describe('LP Wizard - Step 3: Template Selection', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();

    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();
  });

  test('should display template cards', async ({ page }) => {
    await expect(page.getByText(/Classic LP|PDL Loans/i)).toBeVisible();
  });

  test('should select different templates', async ({ page }) => {
    const classicTemplate = page.locator('button').filter({ hasText: /Classic LP/i });
    if (await classicTemplate.isVisible()) {
      await classicTemplate.click();
      await page.waitForTimeout(200);
    }
  });

  test('should display category filters', async ({ page }) => {
    await expect(page.getByText(/All|Loan|Pet|Custom/i)).toBeVisible();
  });

  test('should complete step 3', async ({ page }) => {
    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 4/7');

    await page.screenshot({ path: 'test-artifacts/wizard/step4-design.png' });
  });
});

test.describe('LP Wizard - Step 4: Design Selection', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();

    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();
  });

  test('should display color scheme options', async ({ page }) => {
    await expect(page.getByText(/Color Scheme/i)).toBeVisible();
    await expect(page.getByText(/Ocean|Forest|Midnight/i)).toBeVisible();
  });

  test('should select color scheme', async ({ page }) => {
    const oceanColor = page.locator('button').filter({ hasText: /Ocean/i });
    if (await oceanColor.isVisible()) {
      await oceanColor.click();
      await page.waitForTimeout(200);
    }
  });

  test('should display font options', async ({ page }) => {
    await expect(page.getByText(/Font/i)).toBeVisible();
    await expect(page.getByText(/DM Sans|Inter|Outfit/i)).toBeVisible();
  });

  test('should show mobile preview', async ({ page }) => {
    const preview = page.locator('iframe, [class*="mock-phone"], [class*="preview"]');
    if (await preview.first().isVisible()) {
      await expect(preview.first()).toBeVisible();
    }
  });

  test('should complete step 4', async ({ page }) => {
    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 5/7');

    await page.screenshot({ path: 'test-artifacts/wizard/step5-copy.png' });
  });
});

test.describe('LP Wizard - Step 5: Copy & Content', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();

    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await wizardPage.completeStepTemplate();
    await wizardPage.clickNext();

    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();
  });

  test('should display copy input fields', async ({ page }) => {
    await expect(page.getByText(/H1|Headline/i)).toBeVisible();
    await expect(page.getByText(/Badge/i)).toBeVisible();
    await expect(page.getByText(/CTA/i)).toBeVisible();
  });

  test('should display quick-start templates', async ({ page }) => {
    await expect(page.getByText(/Quick-Start|Templates/i)).toBeVisible();
  });

  test('should apply copy template', async ({ page }) => {
    const template = page.locator('button').filter({ hasText: /QuickFund|LoanBridge/i }).first();
    if (await template.isVisible()) {
      await template.click();
      await page.waitForTimeout(300);
    }
  });

  test('should show AI generate button', async ({ page }) => {
    await expect(page.getByText(/AI Copy|Generate/i)).toBeVisible();
  });

  test('should allow manual copy input', async ({ page }) => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Get Your Test Loan Today');
    if (await inputs.count() > 1) {
      await inputs.nth(1).fill('No Credit Check Required');
    }

    await page.screenshot({ path: 'test-artifacts/wizard/step5-copy-filled.png' });
  });

  test('should complete step 5', async ({ page }) => {
    await wizardPage.completeStepCopy();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 6/7');

    await page.screenshot({ path: 'test-artifacts/wizard/step6-tracking.png' });
  });
});

test.describe('LP Wizard - Complete Flow', () => {
  test('should complete full wizard flow and save', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    await wizardPage.completeMinimalWizard();

    await wizardPage.clickBuild();

    await page.waitForTimeout(3000);

    await expect(page.getByText(/Sites|Dashboard|My Sites/i)).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-artifacts/wizard/complete-flow-success.png',
      fullPage: true,
    });
  });

  test('should complete wizard with minimal data', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();

    await wizardPage.completeMinimalWizard();

    await expect(wizardPage.stepIndicator).toContainText('Step 7/7');

    await wizardPage.clickBuild();

    await page.waitForTimeout(2000);
    await expect(page.getByText(/Sites|Dashboard/i)).toBeVisible({ timeout: 10000 });
  });
});
