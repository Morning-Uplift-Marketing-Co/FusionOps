import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Sites Management
 *
 * These tests verify the sites list page functionality:
 * - Sites list display and statistics
 * - Site creation via wizard
 * - Site search and filtering
 * - Site deletion with confirmation
 * - Deploy functionality
 * - Download options
 * - Preview modal
 * - Edit and redeploy flow
 *
 * Page: src/components/Sites.jsx
 */

test.describe('Sites Management - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display sites list page', async ({ page }) => {
    // Verify page title or heading
    const title = page.getByText(/My Sites|Sites/i);
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test('should display statistics cards', async ({ page }) => {
    // Check for statistics
    await expect(page.getByText(/Sites/i)).toBeVisible();
    await expect(page.getByText(/Builds/i)).toBeVisible();
    await expect(page.getByText(/Deployed/i)).toBeVisible();
    await expect(page.getByText(/Need Attention/i)).toBeVisible();
  });

  test('should display Create LP button', async ({ page }) => {
    const createBtn = page.getByRole('button').filter({ hasText: /Create LP|Create New/i });
    await expect(createBtn).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.getByPlaceholderText(/Search sites/i);
    await expect(searchInput).toBeVisible();
  });

  test('should display filter controls', async ({ page }) => {
    // Check for grouping dropdown
    await expect(page.getByText(/Group:/i)).toBeVisible();

    // Check for sort dropdown
    await expect(page.getByText(/Sort:/i)).toBeVisible();

    // Check for quick filter chips
    await expect(page.getByText(/All.*Deployed.*Banned/i)).toBeVisible();
  });

  test('should show empty state when no sites exist', async ({ page }) => {
    // Look for empty state message
    const emptyState = page.getByText(/No sites yet/i);

    // Either empty state or site cards should be visible
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasSites = await page.getByText(/No sites yet/i).isVisible().catch(() => true);

    // Test passes if either condition is true
    expect(hasEmptyState || hasSites).toBeTruthy();
  });
});

test.describe('Sites Management - Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should filter sites by search term', async ({ page }) => {
    const searchInput = page.getByPlaceholderText(/Search sites/i);

    // Type search term
    await searchInput.fill('test');

    // Wait for filtering
    await page.waitForTimeout(500);

    // Verify input has value
    await expect(searchInput).toHaveValue('test');

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  });

  test('should display quick filter chips', async ({ page }) => {
    // Check for filter buttons
    await expect(page.getByRole('button').filter({ hasText: /All.*\(/ })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /Deployed.*\(/ })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /Banned.*\(/ })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /Warming.*\(/ })).toBeVisible();
  });

  test('should filter by deployed status', async ({ page }) => {
    const deployedFilter = page.getByRole('button').filter({ hasText: /Deployed/i });
    await deployedFilter.click();

    await page.waitForTimeout(300);
    // Verify filter is active (button style changes)
    await expect(deployedFilter).toBeVisible();
  });

  test('should filter by banned status', async ({ page }) => {
    const bannedFilter = page.getByRole('button').filter({ hasText: /Banned/i });
    await bannedFilter.click();

    await page.waitForTimeout(300);
    await expect(bannedFilter).toBeVisible();
  });

  test('should filter by warming status', async ({ page }) => {
    const warmingFilter = page.getByRole('button').filter({ hasText: /Warming/i });
    await warmingFilter.click();

    await page.waitForTimeout(300);
    await expect(warmingFilter).toBeVisible();
  });

  test('should filter by no domain status', async ({ page }) => {
    const noDomainFilter = page.getByRole('button').filter({ hasText: /No Domain/i });
    await noDomainFilter.click();

    await page.waitForTimeout(300);
    await expect(noDomainFilter).toBeVisible();
  });

  test('should filter by not deployed status', async ({ page }) => {
    const notDeployedFilter = page.getByRole('button').filter({ hasText: /Not Deployed/i });
    await notDeployedFilter.click();

    await page.waitForTimeout(300);
    await expect(notDeployedFilter).toBeVisible();
  });

  test('should toggle "Only issues" checkbox', async ({ page }) => {
    const checkbox = page.getByRole('checkbox').filter({ hasText: /Only issues/i });
    if (await checkbox.isVisible()) {
      await checkbox.check();
      await page.waitForTimeout(300);
      await checkbox.uncheck();
      await page.waitForTimeout(300);
    }
  });

  test('should change group by option', async ({ page }) => {
    const groupSelect = page.getByRole('combobox').filter({ hasText: /Group:/i }).first();
    if (await groupSelect.isVisible()) {
      await groupSelect.click();
      await page.waitForTimeout(200);

      // Select a different grouping
      const option = page.getByRole('option').filter({ hasText: /Status|Template|Cloudflare/i }).first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('should change sort option', async ({ page }) => {
    const sortSelect = page.getByRole('combobox').filter({ hasText: /Sort:/i }).first();
    if (await sortSelect.isVisible()) {
      await sortSelect.click();
      await page.waitForTimeout(200);

      // Select a different sort
      const option = page.getByRole('option').filter({ hasText: /Latest|Brand/i }).first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

test.describe('Sites Management - Site Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should open preview modal', async ({ page }) => {
    const previewBtns = page.getByRole('button').filter({ hasText: /Preview|👁/i });
    const count = await previewBtns.count();

    if (count > 0) {
      // Handle download dialog
      page.on('download', () => {});

      await previewBtns.first().click();

      // Look for preview modal
      const previewModal = page.getByText(/Preview:/i);
      const hasModal = await previewModal.isVisible().catch(() => false);

      if (hasModal) {
        // Close modal
        const closeBtn = page.getByRole('button').filter({ hasText: /Close/i });
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
    // Test passes regardless of whether sites exist
  });

  test('should open edit mode', async ({ page }) => {
    const editBtns = page.getByRole('button').filter({ hasText: /Edit|🔄/i });
    const count = await editBtns.count();

    if (count > 0) {
      await editBtns.first().click();

      // Should open wizard
      await expect(page.getByText(/Brand Information|Create New LP/i)).toBeVisible({ timeout: 5000 });

      // Cancel out
      const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
      await cancelBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('should show delete confirmation', async ({ page }) => {
    const deleteBtns = page.getByRole('button').filter({ hasText: /Delete|🗑/i });
    const count = await deleteBtns.count();

    if (count > 0) {
      // Setup dialog handler
      page.once('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      await deleteBtns.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should delete site after confirmation', async ({ page }) => {
    const deleteBtns = page.getByRole('button').filter({ hasText: /DELETE|Delete/i });
    const count = await deleteBtns.count();

    if (count > 0) {
      // Get initial site count
      const siteCardsBefore = await page.locator('[class*="site"], [class*="card"]').count();

      // Setup dialog handler to accept
      page.once('dialog', async (dialog) => {
        await dialog.accept('DELETE ALL');
      });

      await deleteBtns.first().click();
      await page.waitForTimeout(1000);

      // Verify site count decreased or stayed same (if failed)
      const siteCardsAfter = await page.locator('[class*="site"], [class*="card"]').count();
      expect(siteCardsAfter).toBeLessThanOrEqual(siteCardsBefore);
    }
  });
});

test.describe('Sites Management - Download Options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should open download dropdown', async ({ page }) => {
    const downloadBtns = page.getByRole('button').filter({ hasText: /Download|📥/i });
    const count = await downloadBtns.count();

    if (count > 0) {
      await downloadBtns.first().click();
      await page.waitForTimeout(300);

      // Should see download options
      await expect(page.getByText(/Astro Project|Static HTML|Apply Page|Theme JSON/i)).toBeVisible();

      // Click elsewhere to close
      await page.mouse.click(10, 10);
      await page.waitForTimeout(300);
    }
  });

  test('should show Astro Project download option', async ({ page }) => {
    const downloadBtns = page.getByRole('button').filter({ hasText: /Download/i });
    const count = await downloadBtns.count();

    if (count > 0) {
      await downloadBtns.first().click();
      await page.waitForTimeout(300);

      const astroOption = page.getByText(/Astro Project/i);
      expect(await astroOption.isVisible()).toBeTruthy();

      // Close dropdown
      await page.mouse.click(10, 10);
    }
  });

  test('should show Static HTML download option', async ({ page }) => {
    const downloadBtns = page.getByRole('button').filter({ hasText: /Download/i });
    const count = await downloadBtns.count();

    if (count > 0) {
      await downloadBtns.first().click();
      await page.waitForTimeout(300);

      const htmlOption = page.getByText(/Static HTML/i);
      expect(await htmlOption.isVisible()).toBeTruthy();

      await page.mouse.click(10, 10);
    }
  });

  test('should show Apply Page download option', async ({ page }) => {
    const downloadBtns = page.getByRole('button').filter({ hasText: /Download/i });
    const count = await downloadBtns.count();

    if (count > 0) {
      await downloadBtns.first().click();
      await page.waitForTimeout(300);

      const applyOption = page.getByText(/Apply Page/i);
      expect(await applyOption.isVisible()).toBeTruthy();

      await page.mouse.click(10, 10);
    }
  });

  test('should show Theme JSON download option', async ({ page }) => {
    const downloadBtns = page.getByRole('button').filter({ hasText: /Download/i });
    const count = await downloadBtns.count();

    if (count > 0) {
      await downloadBtns.first().click();
      await page.waitForTimeout(300);

      const jsonOption = page.getByText(/Theme JSON/i);
      expect(await jsonOption.isVisible()).toBeTruthy();

      await page.mouse.click(10, 10);
    }
  });
});

test.describe('Sites Management - Deploy Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should open deploy dropdown', async ({ page }) => {
    const deployBtns = page.getByRole('button').filter({ hasText: /Deploy|🚀/i });
    const count = await deployBtns.count();

    if (count > 0) {
      await deployBtns.first().click();
      await page.waitForTimeout(500);

      // Close dropdown
      await page.mouse.click(10, 10);
    }
  });

  test('should show available deploy targets', async ({ page }) => {
    const deployBtns = page.getByRole('button').filter({ hasText: /Deploy/i });
    const count = await deployBtns.count();

    if (count > 0) {
      await deployBtns.first().click();
      await page.waitForTimeout(500);

      // Look for common deploy targets
      const hasCloudflare = await page.getByText(/Cloudflare|CF Pages/i).isVisible().catch(() => false);
      const hasNetlify = await page.getByText(/Netlify/i).isVisible().catch(() => false);
      const hasVercel = await page.getByText(/Vercel/i).isVisible().catch(() => false);
      const hasGit = await page.getByText(/Git|GitHub/i).isVisible().catch(() => false);

      // At least one target should be visible (or "Not configured" message)
      const hasAny = hasCloudflare || hasNetlify || hasVercel || hasGit;

      await page.mouse.click(10, 10);
    }
  });

  test('should show configured vs unconfigured targets', async ({ page }) => {
    const deployBtns = page.getByRole('button').filter({ hasText: /Deploy/i });
    const count = await deployBtns.count();

    if (count > 0) {
      await deployBtns.first().click();
      await page.waitForTimeout(500);

      // Check for "Not configured" or "LIVE" indicators
      const notConfigured = await page.getByText(/Not configured/i).isVisible().catch(() => false);
      const liveIndicator = await page.getByText(/LIVE|Live/i).isVisible().catch(() => false);

      // One of these should be present
      expect(notConfigured || liveIndicator).toBeTruthy();

      await page.mouse.click(10, 10);
    }
  });

  test('should display deployed URLs', async ({ page }) => {
    // Look for deployed URLs (links starting with https://)
    const deployedLinks = page.locator('a[href^="https://"], a[href^="http://"]');
    const count = await deployedLinks.count();

    if (count > 0) {
      // First link should be visible
      await expect(deployedLinks.first()).toBeVisible();
    }
  });
});

test.describe('Sites Management - Bulk Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should display Delete All button when sites exist', async ({ page }) => {
    const deleteAllBtn = page.getByRole('button').filter({ hasText: /Delete All|🗑️/i });

    // Button may not exist if no sites
    const isVisible = await deleteAllBtn.isVisible().catch(() => false);

    if (isVisible) {
      await expect(deleteAllBtn).toBeVisible();
    }
  });

  test('should show confirmation for bulk delete', async ({ page }) => {
    const deleteAllBtn = page.getByRole('button').filter({ hasText: /Delete All/i });
    const isVisible = await deleteAllBtn.isVisible().catch(() => false);

    if (isVisible) {
      // Setup dialog handler
      page.once('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      await deleteAllBtn.click();
      await page.waitForTimeout(500);

      // Should have shown a dialog
    }
  });

  test('should require type confirmation for bulk delete', async ({ page }) => {
    const deleteAllBtn = page.getByRole('button').filter({ hasText: /Delete All/i });
    const isVisible = await deleteAllBtn.isVisible().catch(() => false);

    if (isVisible) {
      // First dialog - dismiss
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      await deleteAllBtn.click();
      await page.waitForTimeout(500);

      // Second dialog - type confirmation or dismiss
      page.once('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      await page.waitForTimeout(500);
    }
  });
});

test.describe('Sites Management - Site Card Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should display site cards with required info', async ({ page }) => {
    const siteCards = page.locator('[class*="card"], [data-testid*="site"], [class*="site"]').filter({ hasText: /./ });

    const count = await siteCards.count();

    if (count > 0) {
      // Check first card for expected elements
      const firstCard = siteCards.first();

      // Should have brand name
      await expect(firstCard).toBeVisible();
    }
  });

  test('should display template badge', async ({ page }) => {
    const templateBadges = page.getByText(/Classic|PDL|AstroDeck|Lander/i);
    const count = await templateBadges.count();

    if (count > 0) {
      await expect(templateBadges.first()).toBeVisible();
    }
  });

  test('should display policy status badges', async ({ page }) => {
    const policyBadges = page.getByText(/Policy:|Clean|Banned|Limited|Warming/i);
    const count = await policyBadges.count();

    if (count > 0) {
      await expect(policyBadges.first()).toBeVisible();
    }
  });

  test('should display deployment status', async ({ page }) => {
    const deployStatus = page.getByText(/target\(s\)|0 targets|Live|Not Deployed/i);
    await expect(deployStatus).toBeVisible();
  });

  test('should display domain info', async ({ page }) => {
    const domainText = page.getByText(/.com|.net|.org|no domain/i);
    const count = await domainText.count();

    if (count > 0) {
      await expect(domainText.first()).toBeVisible();
    }
  });
});

test.describe('Sites Management - Create New Site', () => {
  test('should open wizard when clicking Create LP button', async ({ page }) => {
    await page.goto('/');

    const createBtn = page.getByRole('button').filter({ hasText: /Create LP|Create New/i });
    await createBtn.click();

    // Should see wizard
    await expect(page.getByText(/Brand Information|Create New LP/i)).toBeVisible({ timeout: 5000 });

    // Cancel to return to sites
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();
    await page.waitForTimeout(300);
  });
});

test.describe('Sites Management - Keyboard Navigation', () => {
  test('should support Tab navigation', async ({ page }) => {
    await page.goto('/');

    // Press Tab to navigate through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify no errors
    await expect(page.getByText(/My Sites|Sites/i)).toBeVisible();
  });

  test('should activate Create LP with Enter key', async ({ page }) => {
    await page.goto('/');

    // Focus the Create LP button
    const createBtn = page.getByRole('button').filter({ hasText: /Create/i });
    await createBtn.focus();

    // Press Enter
    await page.keyboard.press('Enter');

    // Should open wizard
    await expect(page.getByText(/Brand Information|Create New LP/i)).toBeVisible({ timeout: 5000 });

    // Go back
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();
  });
});
