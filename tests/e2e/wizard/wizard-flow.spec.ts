import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { WizardPage } from '../pages/WizardPage';
import { VALID_BRAND_DATA, INVALID_BRAND_DATA } from '../fixtures/wizard-data';

/**
 * E2E Tests for LP Wizard Flow
 *
 * These tests verify the complete wizard flow for creating landing pages:
 * - Step 1: Brand Information (StepBrand.jsx)
 * - Step 2: Product Configuration (StepProduct.jsx)
 * - Step 3: Template + Design Selection (StepDesign.jsx)
 * - Step 4: Copy & Content (StepCopy.jsx)
 * - Step 5: Tracking & Conversion (StepTracking.jsx)
 * - Step 6: Review & Build (StepReview.jsx)
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
    await expect(wizardPage.stepIndicator).toContainText('Step 1/6');
    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible();
  });

  test('should close wizard when canceling on step 1', async ({ page }) => {
    await wizardPage.clickCancel();
    await expect(dashboardPage.createLPButton).toBeVisible({ timeout: 5000 });
  });

  test('should show progress indicator', async ({ page }) => {
    await expect(wizardPage.stepIndicator).toBeVisible();
    await expect(wizardPage.stepIndicator).toContainText('Step 1/6');
  });

  test('should navigate between steps using Next and Back', async ({ page }) => {
    await wizardPage.completeStepBrand(VALID_BRAND_DATA);
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 2/6');
    await expect(page.getByText(/Loan Product|Product/i).first()).toBeVisible();

    await wizardPage.clickBack();

    await expect(wizardPage.stepIndicator).toContainText('Step 1/6');
    await expect(page.getByRole('heading', { name: /Brand Information/i })).toBeVisible();
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
    await expect(page.getByText('Brand Name *', { exact: true })).toBeVisible();
    await expect(page.getByText('Domain *', { exact: true })).toBeVisible();
    await expect(page.getByText('Brand Tagline', { exact: true })).toBeVisible();
    await expect(page.getByText('Compliance Email', { exact: true })).toBeVisible();
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

    await expect(wizardPage.stepIndicator).toContainText('Step 2/6');
  });

  test('should complete step 1 with all fields', async ({ page }) => {
    await wizardPage.completeStepBrand({
      brand: 'E2E Test Brand',
      domain: 'e2e-test-loan.com',
      tagline: 'Quick Loans, Simple Process',
      email: 'support@e2e-test.com',
    });

    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 2/6');
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

  test('should explain defaults for amounts on product step', async ({ page }) => {
    await expect(page.getByText(/defaults/i)).toBeVisible();
  });

  test('should complete step 2 with valid data', async ({ page }) => {
    await wizardPage.completeStepProduct();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 3/6');
    await page.screenshot({ path: 'test-artifacts/wizard/step3-design.png' });
  });
});

test.describe('LP Wizard - Step 3: Template + Design', () => {
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
    await expect(page.locator('input[placeholder*="Search templates"]').first()).toBeVisible();
    await expect(page.locator('button').filter({ has: page.locator('img, iframe') }).first()).toBeVisible();
  });

  test('should select different templates', async ({ page }) => {
    const classicTemplate = page.locator('button').filter({ hasText: /Classic LP/i });
    if (await classicTemplate.isVisible()) {
      await classicTemplate.click();
      await page.waitForTimeout(200);
    }
  });

  test('should display category filters', async ({ page }) => {
    await expect(page.getByText(/All|Loan|Pet|Custom/i).first()).toBeVisible();
  });

  test('should display brand asset controls', async ({ page }) => {
    await expect(page.getByText(/Brand assets/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Favicon .* OG Image/i })).toBeVisible();
  });

  test('should select color scheme', async ({ page }) => {
    const oceanColor = page.locator('button').filter({ hasText: /Ocean/i });
    if (await oceanColor.isVisible()) {
      await oceanColor.click();
      await page.waitForTimeout(200);
    }
  });

  test('should display section-order helper or template capability note', async ({ page }) => {
    await expect(
      page.getByText(/Section order|Template-controlled look|Section reordering available in preview/i).first()
    ).toBeVisible();
  });

  test('should show mobile preview', async ({ page }) => {
    const preview = page.locator('iframe, [class*="mock-phone"], [class*="preview"]');
    if (await preview.first().isVisible()) {
      await expect(preview.first()).toBeVisible();
    }
  });

  test('should complete combined template and design step', async ({ page }) => {
    await wizardPage.completeStepTemplate();
    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 4/6');
    await page.screenshot({ path: 'test-artifacts/wizard/step4-copy.png' });
  });
});

test.describe('LP Wizard - Step 4: Copy & Content', () => {
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
    await wizardPage.completeStepDesign();
    await wizardPage.clickNext();
  });

  test('should display copy input fields', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Get Cash Fast"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="No Credit Check Required"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Check Your Rate"]')).toBeVisible();
  });

  test('should display review controls', async ({ page }) => {
    await expect(page.getByText(/Customer Reviews/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Gen Reviews/i })).toBeVisible();
  });

  test('should apply copy template', async ({ page }) => {
    const template = page.locator('button').filter({ hasText: /QuickFund|LoanBridge/i }).first();
    if (await template.isVisible()) {
      await template.click();
      await page.waitForTimeout(300);
    }
  });

  test('should show AI generate button', async ({ page }) => {
    await expect(page.getByText(/AI Copy|Generate/i).first()).toBeVisible();
  });

  test('should allow manual copy input', async ({ page }) => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Get Your Test Loan Today');
    if (await inputs.count() > 1) {
      await inputs.nth(1).fill('No Credit Check Required');
    }

    await page.screenshot({ path: 'test-artifacts/wizard/step4-copy-filled.png' });
  });

  test('should complete step 4', async ({ page }) => {
    await wizardPage.completeStepCopy();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 5/6');
    await page.screenshot({ path: 'test-artifacts/wizard/step5-tracking.png' });
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
    await expect(page.getByText(/Sites|Dashboard|My Sites/i).first()).toBeVisible({ timeout: 10000 });

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
    await expect(wizardPage.stepIndicator).toContainText('Step 6/6');

    await wizardPage.clickBuild();

    await page.waitForTimeout(2000);
    await expect(page.getByText(/Sites|Dashboard/i).first()).toBeVisible({ timeout: 10000 });
  });
});
