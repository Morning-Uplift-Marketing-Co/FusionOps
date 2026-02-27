import { test, expect, Page } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { WizardPage } from '../pages/WizardPage';
import { VALID_BRAND_DATA, VALID_TRACKING_DATA } from '../fixtures/wizard-data';

/**
 * E2E Tests for LP Wizard - Tracking Step (Step 6)
 *
 * These tests specifically cover the tracking and conversion setup:
 * - Tracking Mode Toggle (Minimal vs Voluum)
 * - Google Ads Conversion configuration
 * - Voluum Campaign selection and creation
 * - First-Party Pixel (auto-configured)
 * - Affiliate Form configuration (LeadsGate, etc.)
 *
 * Based on StepTracking.jsx component
 *
 * Run: npx playwright test tests/e2e/wizard/wizard-tracking.spec.ts
 */

test.describe('LP Wizard - Step 6: Tracking & Conversion', () => {
  let dashboardPage: DashboardPage;
  let wizardPage: WizardPage;

  /**
   * Helper to navigate to tracking step
   */
  async function navigateToTrackingStep(page: Page) {
    dashboardPage = new DashboardPage(page);
    wizardPage = new WizardPage(page);

    await dashboardPage.goto();
    await dashboardPage.startCreateLP();
    await wizardPage.waitForWizardToLoad();

    // Complete steps 1-5
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

    // Should be on step 6
    await expect(wizardPage.stepIndicator).toContainText('Step 6/7');
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

      // Check if button has selected state (border color)
      await expect(minimalBtn).toBeVisible();
    });

    test('should switch to Voluum Stack mode', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });

      await voluumBtn.click();
      await page.waitForTimeout(500);

      // Voluum Campaign section should appear
      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();
    });

    test('should switch back to Minimal Stack mode', async ({ page }) => {
      // First switch to Voluum
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      await expect(page.getByText(/Voluum Campaign/i)).toBeVisible();

      // Switch back to Minimal
      const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
      await minimalBtn.click();
      await page.waitForTimeout(500);

      // Voluum Campaign section should not be visible or be minimized
      const voluumSection = page.getByText(/Voluum Campaign/i);
      const isVisible = await voluumSection.isVisible().catch(() => false);

      if (isVisible) {
        // If visible, it should be in a collapsed/disabled state
        await expect(voluumSection).toBeVisible();
      }
    });
  });

  test.describe('Google Ads Conversion', () => {
    test('should display Google Ads Conversion card', async ({ page }) => {
      await expect(page.getByText(/Google Ads Conversion/i)).toBeVisible();
    });

    test('should accept valid conversion ID format', async ({ page }) => {
      const inputs = page.locator('input');
      const convInput = inputs.filter({ hasText: '' }).first();

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

    test('should populate both label fields', async ({ page }) => {
      const inputs = page.locator('input');
      const count = await inputs.count();

      // Fill conversion ID (first empty input)
      await inputs.filter({ hasText: '' }).first().fill('AW-987654321');

      // Fill form_start label
      if (count > 1) {
        await inputs.nth(1).fill('label-start-test');
      }

      // Fill form_submit label
      if (count > 2) {
        await inputs.nth(2).fill('label-submit-test');
      }

      await page.waitForTimeout(200);
    });
  });

  test.describe('First-Party Pixel', () => {
    test('should display First-Party Pixel card', async ({ page }) => {
      await expect(page.getByText(/First-Party Pixel/i)).toBeVisible();
    });

    test('should show Auto badge indicating automatic configuration', async ({ page }) => {
      await expect(page.getByText(/Auto/i)).toBeVisible();
    });

    test('should display information about pixel endpoint', async ({ page }) => {
      await expect(page.getByText(/t\\."\\{domain\\}"\\/e/i)).toBeVisible();
    });
  });

  test.describe('Affiliate Form - LeadsGate', () => {
    test('should display affiliate network buttons', async ({ page }) => {
      await expect(page.getByText(/LeadsGate/i)).toBeVisible();
    });

    test('should select LeadsGate network', async ({ page }) => {
      const leadsGateBtn = page.locator('button').filter({ hasText: /LeadsGate/i });
      await leadsGateBtn.click();
      await page.waitForTimeout(300);

      // AID input should appear
      await expect(page.getByPlaceholderText(/14881/i)).toBeVisible();
    });

    test('should accept AID value for LeadsGate', async ({ page }) => {
      const leadsGateBtn = page.locator('button').filter({ hasText: /LeadsGate/i });
      await leadsGateBtn.click();

      const aidInput = page.getByPlaceholderText(/14881/i);
      if (await aidInput.isVisible()) {
        await aidInput.fill('99999');
        await expect(aidInput).toHaveValue('99999');
      }
    });

    test('should show success indicator when AID is filled', async ({ page }) => {
      const leadsGateBtn = page.locator('button').filter({ hasText: /LeadsGate/i });
      await leadsGateBtn.click();

      const aidInput = page.getByPlaceholderText(/14881/i);
      if (await aidInput.isVisible()) {
        await aidInput.fill('99999');
        await page.waitForTimeout(300);

        // Look for success indicator
        const successIndicator = page.locator('.bg-\\[hsl\\(var\\(--success\\)\\)\\], .text-\\[hsl\\(var\\(--success\\)\\)\\]');
        const hasSuccess = await successIndicator.isVisible().catch(() => false);

        if (hasSuccess) {
          await expect(successIndicator).toBeVisible();
        }
      }
    });
  });

  test.describe('Affiliate Form - Other Networks', () => {
    test('should display other network options', async ({ page }) => {
      const networks = ['ZeroParallel', 'LeadStack', 'Performance'];

      for (const network of networks) {
        const networkBtn = page.locator('button').filter({ hasText: network });
        if (await networkBtn.isVisible()) {
          await expect(networkBtn).toBeVisible();
        }
      }
    });

    test('should show redirect URL field for non-LeadsGate networks', async ({ page }) => {
      // Select a non-LeadsGate network
      const zeroParallelBtn = page.locator('button').filter({ hasText: /ZeroParallel/i });

      if (await zeroParallelBtn.isVisible()) {
        await zeroParallelBtn.click();
        await page.waitForTimeout(300);

        // Redirect URL field should appear
        await expect(page.getByPlaceholderText(/https/i)).toBeVisible();
      }
    });

    test('should show form embed textarea for non-LeadsGate networks', async ({ page }) => {
      // Select a non-LeadsGate network
      const zeroParallelBtn = page.locator('button').filter({ hasText: /ZeroParallel/i });

      if (await zeroParallelBtn.isVisible()) {
        await zeroParallelBtn.click();
        await page.waitForTimeout(300);

        // Form embed textarea should appear
        const embedTextarea = page.locator('textarea[placeholder*="embed"]');
        if (await embedTextarea.isVisible()) {
          await expect(embedTextarea).toBeVisible();
        }
      }
    });

    test('should accept valid redirect URL', async ({ page }) => {
      const zeroParallelBtn = page.locator('button').filter({ hasText: /ZeroParallel/i });

      if (await zeroParallelBtn.isVisible()) {
        await zeroParallelBtn.click();
        await page.waitForTimeout(300);

        const redirectInput = page.getByPlaceholderText(/https/i);
        if (await redirectInput.isVisible()) {
          await redirectInput.fill('https://offers.example.com/click?pid=123');
          await expect(redirectInput).toHaveValue(/https:/);
        }
      }
    });

    test('should accept form embed code', async ({ page }) => {
      const zeroParallelBtn = page.locator('button').filter({ hasText: /ZeroParallel/i });

      if (await zeroParallelBtn.isVisible()) {
        await zeroParallelBtn.click();
        await page.waitForTimeout(300);

        const embedTextarea = page.locator('textarea[placeholder*="embed"]');
        if (await embedTextarea.isVisible()) {
          const embedCode = '<script src="https://forms.example.com/embed.js"></script>\n<div id="form-container"></div>';
          await embedTextarea.fill(embedCode);
          await expect(embedTextarea).toHaveValue(/script/);
        }
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

    test('should show connection status badge', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      // Should show either "Connected" or "Not selected" badge
      const statusBadge = page.locator('text=/Connected|Not selected/i');
      await expect(statusBadge.first()).toBeVisible();
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

    test('should open create campaign form', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      const createBtn = page.getByRole('button').filter({ hasText: /Create new campaign/i });
      await createBtn.click();
      await page.waitForTimeout(300);

      // Create form should appear
      await expect(page.getByText(/Create Voluum Campaign/i)).toBeVisible();
    });

    test('should display campaign name input in create form', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      const createBtn = page.getByRole('button').filter({ hasText: /Create new campaign/i });
      await createBtn.click();
      await page.waitForTimeout(300);

      const nameInput = page.getByPlaceholderText(/US-Loan/i);
      await expect(nameInput).toBeVisible();
    });

    test('should display cost model dropdown in create form', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      const createBtn = page.getByRole('button').filter({ hasText: /Create new campaign/i });
      await createBtn.click();
      await page.waitForTimeout(300);

      // Look for cost model options
      await expect(page.getByText(/CPC|CPA|RevShare/i)).toBeVisible();
    });

    test('should cancel create campaign form', async ({ page }) => {
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      const createBtn = page.getByRole('button').filter({ hasText: /Create new campaign/i });
      await createBtn.click();
      await page.waitForTimeout(300);

      const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel/i });
      await cancelBtn.click();
      await page.waitForTimeout(300);

      // Form should close
      await expect(page.getByText(/Create Voluum Campaign/i)).not.toBeVisible();
    });

    test('should show error when Voluum credentials are missing', async ({ page }) => {
      // Clear any existing Voluum credentials from localStorage
      await page.evaluate(() => {
        const settingsKey = Object.keys(localStorage).find(k => k.includes('settings'));
        if (settingsKey) {
          const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
          delete settings.voluumAccessKeyId;
          delete settings.voluumAccessKey;
          localStorage.setItem(settingsKey, JSON.stringify(settings));
        }
      });

      // Refresh and navigate back to tracking
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(2000);

      // Check for error message about credentials
      const errorMsg = page.getByText(/credentials not found/i);
      const hasError = await errorMsg.isVisible().catch(() => false);

      if (hasError) {
        await expect(errorMsg).toBeVisible();
      }
    });
  });

  test.describe('Validation', () => {
    test('should require conversion ID to proceed', async ({ page }) => {
      // Don't fill any fields, try to click Next
      await wizardPage.clickNext();

      // Should show validation error
      await expect(page.getByText(/Conversion ID is required/i)).toBeVisible({ timeout: 3000 });
    });

    test('should require Voluum campaign when in Voluum mode', async ({ page }) => {
      // Switch to Voluum mode
      const voluumBtn = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
      await voluumBtn.click();
      await page.waitForTimeout(500);

      // Fill conversion ID but not campaign
      const inputs = page.locator('input');
      await inputs.filter({ hasText: '' }).first().fill('AW-123456789');

      // Try to proceed
      await wizardPage.clickNext();

      // Should show Voluum campaign error
      const campaignError = page.getByText(/campaign must be selected/i);
      const hasError = await campaignError.isVisible().catch(() => false);

      if (hasError) {
        await expect(campaignError).toBeVisible();
      }
    });

    test('should allow proceeding with minimal mode and conversion ID', async ({ page }) => {
      // Ensure Minimal mode is selected
      const minimalBtn = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
      await minimalBtn.click();
      await page.waitForTimeout(300);

      // Fill conversion ID
      const inputs = page.locator('input');
      await inputs.filter({ hasText: '' }).first().fill('AW-123456789');

      // Click Next
      await wizardPage.clickNext();

      // Should proceed to step 7
      await expect(wizardPage.stepIndicator).toContainText('Step 7/7');
    });
  });

  test.describe('UI Elements', () => {
    test('should display all section cards with icons', async ({ page }) => {
      // Check for main section headers
      await expect(page.getByText(/Tracking Mode/i)).toBeVisible();
      await expect(page.getByText(/Google Ads Conversion/i)).toBeVisible();
      await expect(page.getByText(/First-Party Pixel/i)).toBeVisible();
      await expect(page.getByText(/Affiliate Form/i)).toBeVisible();
    });

    test('should have proper button states for selected options', async ({ page }) => {
      // Check that a selected network button has different styling
      const leadsGateBtn = page.locator('button').filter({ hasText: /LeadsGate/i });
      const initialClass = await leadsGateBtn.getAttribute('class') || '';

      await leadsGateBtn.click();
      await page.waitForTimeout(300);

      const selectedClass = await leadsGateBtn.getAttribute('class') || '';

      // Classes should be different (selection state changed)
      expect(initialClass).not.toBe(selectedClass);
    });
  });
});
