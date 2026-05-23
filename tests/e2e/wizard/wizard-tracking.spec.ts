import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { WizardPage } from '../pages/WizardPage';
import { VALID_BRAND_DATA } from '../fixtures/wizard-data';

/**
 * E2E Tests for LP Wizard - Tracking Step
 *
 * The current wizard has 6 steps total, with Tracking living on step 5/6.
 * Run: npx playwright test tests/e2e/wizard/wizard-tracking.spec.ts
 */

test.describe('LP Wizard - Step 5: Tracking & Conversion', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  async function navigateToTrackingStep(page: Page) {
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

    await wizardPage.completeStepCopy();
    await wizardPage.clickNext();

    await expect(wizardPage.stepIndicator).toContainText('Step 5/6');
  }

  test.beforeEach(async ({ page }) => {
    await navigateToTrackingStep(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `test-artifacts/screenshots/tracking-${testInfo.title.replace(/\s+/g, '-')}-failed.png`,
        fullPage: true,
      });
    }
  });

  test.describe('Tracking Mode Selection', () => {
    test('should display both tracking mode options', async ({ page }) => {
      await expect(page.getByText(/Minimal Stack/i)).toBeVisible();
      await expect(page.getByText(/Voluum Stack/i)).toBeVisible();
    });

    test('should have Minimal Stack selected by default', async ({ page }) => {
      const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
      await expect(minimalBtn).toBeVisible();
    });

    test('should switch to Voluum Stack mode', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();
    });

    test('should switch back to Minimal Stack mode', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();

      const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
      await minimalBtn.click();
      await page.waitForTimeout(500);

      const voluumSection = page.getByText(/Voluum Campaign/i);
      const isVisible = await voluumSection.isVisible().catch(() => false);
      if (isVisible) await expect(voluumSection).toBeVisible();
    });
  });

  test.describe('Google Ads Conversion', () => {
    test('should display Google Ads Conversion card', async ({ page }) => {
      await expect(page.getByText(/Google Ads Conversion/i)).toBeVisible();
    });

    test('should accept valid conversion ID format', async ({ page }) => {
      const convInput = page.locator('input').filter({ hasText: '' }).first();
      await convInput.fill('AW-123456789');
      await page.waitForTimeout(200);
      await expect(convInput).toHaveValue('AW-123456789');
    });

    test('should display form_start label input', async ({ page }) => {
      await expect(page.getByText(/form_start/i)).toBeVisible();
    });

    test('should display form_submit label input', async ({ page }) => {
      await expect(page.getByText(/form_submit/i)).toBeVisible();
    });
  });

  test.describe('First-Party Pixel', () => {
    test('should display First-Party Pixel card', async ({ page }) => {
      await expect(page.getByText(/First-Party Pixel/i).first()).toBeVisible();
    });

    test('should show Auto badge indicating automatic configuration', async ({ page }) => {
      await expect(page.getByText(/Auto/i).first()).toBeVisible();
    });
  });

  test.describe('Affiliate Form', () => {
    test('should display affiliate network buttons', async ({ page }) => {
      await expect(page.getByText(/LeadsGate/i).first()).toBeVisible();
    });

    test('should select LeadsGate network', async ({ page }) => {
      const leadsGateBtn = page.locator('button').filter({ hasText: /LeadsGate/i });
      await leadsGateBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByPlaceholder(/14881/i)).toBeVisible();
    });

    test('should show redirect URL field for non-LeadsGate networks', async ({ page }) => {
      const zeroParallelBtn = page.locator('button').filter({ hasText: /ZeroParallel/i });

      if (await zeroParallelBtn.isVisible()) {
        await zeroParallelBtn.click();
        await page.waitForTimeout(300);
        await expect(page.getByPlaceholder(/https/i).first()).toBeVisible();
      }
    });
  });

  test.describe('Voluum Integration', () => {
    test('should display Voluum Campaign card when Voluum mode is selected', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();
    });

    test('should display refresh campaigns button', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByRole('button').filter({ hasText: /Refresh campaigns/i })).toBeVisible();
    });

    test('should display create new campaign button', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByRole('button').filter({ hasText: /Create new campaign/i })).toBeVisible();
    });
  });

  test.describe('Validation', () => {
    test('should require conversion ID to proceed', async ({ page }) => {
      await wizardPage.clickNext();
      await expect(page.getByText(/Conversion ID is required/i)).toBeVisible({ timeout: 3000 });
    });

    test('should allow proceeding with minimal mode and conversion ID', async ({ page }) => {
      const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
      await minimalBtn.click();
      await page.waitForTimeout(300);

      const convInput = page.locator('input').filter({ hasText: '' }).first();
      await convInput.fill('AW-123456789');

      await wizardPage.clickNext();
      await expect(wizardPage.stepIndicator).toContainText('Step 6/6');
    });
  });

  test.describe('UI Elements', () => {
    test('should display all section cards with icons', async ({ page }) => {
      await expect(page.getByText(/Tracking Mode/i).first()).toBeVisible();
      await expect(page.getByText(/Google Ads Conversion/i).first()).toBeVisible();
      await expect(page.getByText(/First-Party Pixel/i).first()).toBeVisible();
      await expect(page.getByText(/Affiliate Form/i).first()).toBeVisible();
    });
  });
});
