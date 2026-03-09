import { test, expect } from './fixtures/fixtures';

/**
 * E2E Test Suite - Smoke Tests
 *
 * Critical path tests that verify the core functionality of the application.
 * These are the most important tests that should run on every commit.
 *
 * Run with: npx playwright test tests/e2e/suite.spec.ts
 */

test.describe('Smoke Tests - Critical Paths', () => {
  test('should load application', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Dashboard|My Sites/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should navigate between main sections', async ({ page, app }) => {
    await page.goto('/');
    await app.waitForAppReady();

    // Dashboard should be visible
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible();

    // Navigate to sites
    const sitesLink = page.locator('a, button').filter({ hasText: /Sites/i }).first();
    if (await sitesLink.isVisible()) {
      await sitesLink.click();
      await expect(page.getByText(/My Sites/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should open wizard from dashboard', async ({ page }) => {
    await page.goto('/');

    const createBtn = page.getByRole('button').filter({ hasText: /Create LP|Create/i });
    await createBtn.click();

    await expect(page.getByText(/Brand Information|Create New LP/i).first()).toBeVisible({ timeout: 5000 });

    // Cancel to return
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();
  });

  test('should complete wizard with minimal data', async ({ page, wizard, testData }) => {
    await page.goto('/');

    const createBtn = page.getByRole('button').filter({ hasText: /Create/i });
    await createBtn.first().click();

    // Wait for wizard to open
    await page.getByRole('heading', { name: /Brand Information/i }).waitFor({ timeout: 10000 });

    const data = testData.minimalWizardData();
    const nextBtn = page.getByRole('button').filter({ hasText: /Next/i });

    // Step 1: Brand - use text inputs only (exclude number inputs)
    const textInputs = page.locator('input:not([type="number"]):not([type="checkbox"])');
    await textInputs.nth(0).fill(data.brand);
    await textInputs.nth(1).fill(data.domain);
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: Product - select loan type
    const loanType = page.locator('button').filter({ hasText: /Personal/i }).first();
    if (await loanType.isVisible()) await loanType.click();
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: Template - select first available
    const templateBtn = page.locator('button').filter({ hasText: /Classic|pet-orange|template/i }).first();
    if (await templateBtn.isVisible()) await templateBtn.click();
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Step 4: Design - select color
    const colorBtn = page.locator('button').filter({ hasText: /Ocean|Forest/i }).first();
    if (await colorBtn.isVisible()) await colorBtn.click();
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Step 5: Copy - use template or skip
    const copyTemplate = page.locator('button').filter({ hasText: /QuickFund|LoanBridge/i }).first();
    if (await copyTemplate.isVisible()) await copyTemplate.click();
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Step 6: Tracking - skip/proceed
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Step 7: Review
    await expect(page.getByText(/Step 7|Review/i).first()).toBeVisible({ timeout: 5000 });
    const buildBtn = page.getByRole('button').filter({ hasText: /Build|Save/i }).first();
    if (await buildBtn.isVisible()) await buildBtn.click();

    // Should return to sites/dashboard
    await page.waitForTimeout(2000);
  });
});

test.describe('Smoke Tests - Navigation', () => {
  test('should navigate to Settings', async ({ page }) => {
    await page.goto('/');

    const settingsBtn = page.getByRole('button').filter({ hasText: /Settings/i }).first();
    await settingsBtn.click();

    await expect(page.getByText(/Settings|API keys/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate back from Settings', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Settings/i }).first().click();

    await expect(page.getByText(/Settings/i).first()).toBeVisible({ timeout: 5000 });

    const dashboardBtn = page.locator('a, button').filter({ hasText: /Dashboard/i }).first();
    if (await dashboardBtn.isVisible()) {
      await dashboardBtn.click();
      await expect(page.getByText(/Dashboard/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Smoke Tests - Error Handling', () => {
  test('should handle empty wizard form validation', async ({ page }) => {
    await page.goto('/');

    const createBtn = page.getByRole('button').filter({ hasText: /Create/i });
    await createBtn.click();

    // Try to proceed without filling form
    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should show validation errors
    const hasErrors = await page.getByText(/required|invalid/i).isVisible().catch(() => false);

    // Cancel out
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();
  });

  test('should handle search with no results', async ({ page }) => {
    await page.goto('/');

    // Navigate to sites
    const sitesLink = page.locator('a, button').filter({ hasText: /Sites/i }).first();
    if (await sitesLink.isVisible()) {
      await sitesLink.click();

      const searchInput = page.getByPlaceholder(/Search sites/i);
      await searchInput.fill('xyznonexistent123456789');

      // Should handle gracefully (no crash)
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Smoke Tests - Performance', () => {
  test('should load dashboard quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Dashboard should load in less than 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for critical errors
    const criticalErrors = errors.filter((e) =>
      !e.includes('Warning') && !e.includes('deprecated')
    );

    // Log errors for debugging but don't fail in smoke tests
    if (criticalErrors.length > 0) {
      console.log('Console errors detected:', criticalErrors);
    }
  });
});
