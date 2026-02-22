import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dashboard
 *
 * These tests verify the dashboard functionality:
 * - Dashboard loads and displays metrics
 * - Quick actions work correctly
 * - Recent sites display
 * - System health indicators
 * - Risk alerts display when present
 * - Navigation to other pages
 *
 * Page: src/components/Dashboard.jsx
 */

test.describe('Dashboard - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard heading', async ({ page }) => {
    await expect(page.getByText(/Dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display version badge', async ({ page }) => {
    // Look for version indicator
    await expect(page.getByText(/v\d+\.\d+/i)).toBeVisible();
  });

  test('should display code signature card', async ({ page }) => {
    await expect(page.getByText(/Current Code Signature|Code Signature/i)).toBeVisible();
    await expect(page.getByText(/version:|mode:|marker:/i)).toBeVisible();
  });
});

test.describe('Dashboard - Metrics Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display all metric cards', async ({ page }) => {
    // Check for each metric label
    await expect(page.getByText(/Total Sites/i)).toBeVisible();
    await expect(page.getByText(/Active/i)).toBeVisible();
    await expect(page.getByText(/Builds/i)).toBeVisible();
    await expect(page.getByText(/API Spend/i)).toBeVisible();
    await expect(page.getByText(/Ops Domains/i)).toBeVisible();
    await expect(page.getByText(/Active Cards/i)).toBeVisible();
  });

  test('should display numeric values for metrics', async ({ page }) => {
    // Look for numeric values - they should be present
    const numbers = page.locator('text=/\\d+/');
    await expect(numbers.first()).toBeVisible();
  });

  test('should have clickable View All Sites button', async ({ page }) => {
    const viewAllBtn = page.getByRole('button').filter({ hasText: /View All Sites|All Sites/i });
    if (await viewAllBtn.isVisible()) {
      await viewAllBtn.click();
      await expect(page.getByText(/My Sites|Sites/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Dashboard - Recent Sites', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display Recent Sites section', async ({ page }) => {
    await expect(page.getByText(/Recent Sites/i)).toBeVisible();
  });

  test('should show empty state when no sites', async ({ page }) => {
    // Check for empty state or site list
    const emptyState = page.getByText(/No sites yet/i);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    const siteList = page.locator('[class*="site"]').first();
    const hasSites = await siteList.isVisible().catch(() => false);

    // Either should be true
    expect(hasEmpty || hasSites).toBeTruthy();
  });

  test('should display site cards with brand info', async ({ page }) => {
    const siteCards = page.locator('[class*="site"], [class*="brand"]');
    const count = await siteCards.count();

    if (count > 0) {
      await expect(siteCards.first()).toBeVisible();
    }
  });

  test('should navigate to sites when clicking View All', async ({ page }) => {
    const viewAllBtn = page.getByRole('button').filter({ hasText: /View All/i });
    if (await viewAllBtn.isVisible()) {
      await viewAllBtn.click();
      await expect(page.getByText(/My Sites|Sites/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Dashboard - Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display Quick Actions section', async ({ page }) => {
    await expect(page.getByText(/Quick Actions/i)).toBeVisible();
  });

  test('should have Build New action button', async ({ page }) => {
    const buildBtn = page.getByRole('button').filter({ hasText: /Build New|Create/i });
    await expect(buildBtn).toBeVisible();
  });

  test('should open wizard from Quick Actions', async ({ page }) => {
    const buildBtn = page.getByRole('button').filter({ hasText: /Build New/i });
    await buildBtn.click();

    await expect(page.getByText(/Brand Information|Create New LP/i)).toBeVisible({ timeout: 5000 });

    // Cancel
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();
  });

  test('should have AI Assets action button', async ({ page }) => {
    const aiBtn = page.getByRole('button').filter({ hasText: /AI Assets|Variant/i });
    await expect(aiBtn).toBeVisible();
  });

  test('should have Ops Center action button', async ({ page }) => {
    const opsBtn = page.getByRole('button').filter({ hasText: /Ops Center/i });
    await expect(opsBtn).toBeVisible();
  });

  test('should navigate to Ops Center', async ({ page }) => {
    const opsBtn = page.getByRole('button').filter({ hasText: /Ops Center/i });
    await opsBtn.click();

    await expect(page.getByText(/Ops Center|Domains|Accounts/i)).toBeVisible({ timeout: 5000 });
  });

  test('should have Settings action button', async ({ page }) => {
    const settingsBtn = page.getByRole('button').filter({ hasText: /Settings/i });
    await expect(settingsBtn).toBeVisible();
  });

  test('should navigate to Settings', async ({ page }) => {
    const settingsBtn = page.getByRole('button').filter({ hasText: /Settings/i });
    await settingsBtn.click();

    await expect(page.getByText(/Settings|API Key|Database/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard - AI Insight Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display AI Performance Hack card', async ({ page }) => {
    await expect(page.getByText(/AI Performance Hack|AI Insight/i)).toBeVisible();
  });

  test('should display actionable insight text', async ({ page }) => {
    // Card should have some text content
    const insightCard = page.locator('text=/AI|Performance|Hack|Insight/i').first();
    await expect(insightCard).toBeVisible();
  });
});

test.describe('Dashboard - System Health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display System Health section', async ({ page }) => {
    await expect(page.getByText(/System Health/i)).toBeVisible();
  });

  test('should display Data Store status', async ({ page }) => {
    await expect(page.getByText(/Data Store|Neon DB|API/i)).toBeVisible();
  });

  test('should display CF Pages Deploy status', async ({ page }) => {
    await expect(page.getByText(/CF Pages Deploy|Cloudflare/i)).toBeVisible();
  });

  test('should display Netlify Deploy status', async ({ page }) => {
    await expect(page.getByText(/Netlify Deploy/i)).toBeVisible();
  });

  test('should display LeadingCards API status', async ({ page }) => {
    await expect(page.getByText(/LeadingCards API/i)).toBeVisible();
  });

  test('should display status indicators', async ({ page }) => {
    // Look for status indicators (Ready, Not Set, Connected, etc.)
    await expect(page.getByText(/Ready|Not Set|Connected|Offline/i)).toBeVisible();
  });
});

test.describe('Dashboard - Risk Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display risk alert when risks exist', async ({ page }) => {
    const riskAlert = page.getByText(/Correlation Risks Detected|Risk/i);
    const hasAlert = await riskAlert.isVisible().catch(() => false);

    if (hasAlert) {
      // Should have View Ops Center button
      await expect(page.getByText(/View Ops Center/i)).toBeVisible();
    }
  });

  test('should navigate to Ops Center from risk alert', async ({ page }) => {
    const riskAlert = page.getByText(/Correlation Risks/i);
    const hasAlert = await riskAlert.isVisible().catch(() => false);

    if (hasAlert) {
      const viewOpsBtn = page.getByRole('button').filter({ hasText: /View Ops Center/i });
      await viewOpsBtn.click();

      await expect(page.getByText(/Ops Center/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Dashboard - Create New LP Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display Create New LP button in header', async ({ page }) => {
    const createBtn = page.getByRole('button').filter({ hasText: /Create New LP|Create/i });
    await expect(createBtn.first()).toBeVisible();
  });

  test('should open wizard when clicking Create New LP', async ({ page }) => {
    const createBtn = page.getByRole('button').filter({ hasText: /Create New LP/i });
    await createBtn.click();

    await expect(page.getByText(/Brand Information|Create New LP/i)).toBeVisible({ timeout: 5000 });

    // Cancel
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();
  });
});

test.describe('Dashboard - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to Sites page', async ({ page }) => {
    const sitesLink = page.getByRole('link', 'button').filter({ hasText: /Sites|My Sites/i }).first();
    if (await sitesLink.isVisible()) {
      await sitesLink.click();
      await expect(page.getByText(/My Sites/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate via sidebar', async ({ page }) => {
    // Try clicking on sidebar navigation
    const sidebar = page.locator('[class*="sidebar"], [class*="nav"]').first();
    if (await sidebar.isVisible()) {
      const sitesNav = sidebar.getByText(/Sites/i).first();
      if (await sitesNav.isVisible()) {
        await sitesNav.click();
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('Dashboard - Responsive Design', () => {
  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    // Take screenshot for visual regression
    await page.screenshot({ path: 'test-artifacts/dashboard/desktop.png' });
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    await page.screenshot({ path: 'test-artifacts/dashboard/tablet.png' });
  });

  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    await page.screenshot({ path: 'test-artifacts/dashboard/mobile.png' });
  });
});
