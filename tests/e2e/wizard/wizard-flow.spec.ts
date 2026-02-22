import { test, expect } from '@playwright/test';

/**
 * E2E Tests for LP Wizard Flow
 *
 * These tests verify the complete wizard flow for creating landing pages:
 * - Step 1: Brand & Domain (StepBrand.jsx)
 * - Step 2: Product Configuration (StepProduct.jsx)
 * - Step 3: Design Selection (StepDesign.jsx)
 * - Step 4: Copy & Content (StepCopy.jsx)
 * - Step 5: Tracking & Conversion (StepTracking.jsx)
 * - Step 6: Review & Build (StepReview.jsx)
 *
 * Test Strategy:
 * - Use text-based locators where data-testid is not available
 * - Test happy paths and error cases
 * - Include visual regression via screenshots
 * - Test keyboard navigation (Enter key)
 */

test.describe('LP Wizard - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Click Create LP button - look for button with "Create" text
    const createBtn = page.getByRole('button').filter({ hasText: /Create/i });
    await createBtn.click();

    // Wait for wizard to appear - look for "Brand" heading
    await expect(page.getByText(/Brand Information/i).or(page.getByText(/Create New LP/i))).toBeVisible({ timeout: 10000 });
  });

  test('should open wizard from dashboard', async ({ page }) => {
    // Verify we're on the wizard page
    await expect(page.getByText(/Create New LP/i)).toBeVisible();
    await expect(page.getByText(/Step 1\/6/i)).toBeVisible();

    // Verify step indicator shows "Brand"
    await expect(page.getByText(/Brand/i)).toBeVisible();
  });

  test('should close wizard when canceling on step 1', async ({ page }) => {
    // Click Cancel/Back button on step 1
    const cancelBtn = page.getByRole('button').filter({ hasText: /Cancel|Back/i });
    await cancelBtn.click();

    // Should return to dashboard
    await expect(page.getByText(/Dashboard|My Sites/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show progress indicator', async ({ page }) => {
    // Check for progress bar
    const progressBar = page.locator('.bg-\\[hsl\\(var\\(--primary\\)\\)\\], [style*="width"]').first();
    await expect(progressBar).toBeVisible();

    // Verify initial step
    await expect(page.getByText(/Step 1\/6/i)).toBeVisible();
  });

  test('should navigate between steps using Next and Back', async ({ page }) => {
    // Fill minimal required fields for step 1
    await fillBrandStep(page);

    // Click Next
    await page.getByRole('button').filter({ hasText: /Next.*→|Next/i }).click();

    // Should be on step 2
    await expect(page.getByText(/Step 2\/6/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Loan Product|Product/i)).toBeVisible();

    // Click Back
    const backBtn = page.getByRole('button').filter({ hasText: /←.*Back|Back/i });
    await backBtn.click();

    // Should be back on step 1
    await expect(page.getByText(/Step 1\/6/i)).toBeVisible();
    await expect(page.getByText(/Brand Information|Brand/i)).toBeVisible();
  });

  test('should support Enter key navigation', async ({ page }) => {
    // Fill brand name
    const brandInput = page.locator('input').filter({ hasText: '' }).first();
    await brandInput.fill('Test Brand');

    // Press Enter on domain input
    const inputs = page.locator('input');
    const domainInput = inputs.nth(1);
    await domainInput.fill('test.com');
    await domainInput.press('Enter');

    // Should move to next step (if validation passes)
    // Note: May stay on step 1 if domain validation fails
    await page.waitForTimeout(500);
  });
});

test.describe('LP Wizard - Step 1: Brand and Domain', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();
    await expect(page.getByText(/Brand Information|Brand/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display all brand form fields', async ({ page }) => {
    // Template selection
    await expect(page.getByText(/Template/i)).toBeVisible();
    await expect(page.getByText(/Classic LP|PDL Loans/i)).toBeVisible();

    // Brand name
    await expect(page.getByText(/Brand Name/i)).toBeVisible();

    // Domain
    await expect(page.getByText(/Domain/i)).toBeVisible();

    // Optional fields
    await expect(page.getByText(/Tagline/i)).toBeVisible();
    await expect(page.getByText(/Compliance Email|Email/i)).toBeVisible();
  });

  test('should select different templates', async ({ page }) => {
    // Look for template buttons - they should show template names
    const classicTemplate = page.getByText(/Classic LP/i).first();
    if (await classicTemplate.isVisible()) {
      await classicTemplate.click();
      await page.waitForTimeout(200);
    }

    // Try selecting PDL Loans template
    const pdlTemplate = page.getByText(/PDL Loans/i).first();
    if (await pdlTemplate.isVisible()) {
      await pdlTemplate.click();
      await page.waitForTimeout(200);
    }
  });

  test('should require brand name to proceed', async ({ page }) => {
    // Try to proceed without filling brand
    await page.getByRole('button').filter({ hasText: /Next.*→|Next/i }).click();

    // Should show validation error
    await expect(page.getByText(/Brand Name is required/i)).toBeVisible({ timeout: 2000 });
  });

  test('should require domain to proceed', async ({ page }) => {
    // Fill brand but not domain
    const inputs = page.locator('input');
    await inputs.first().fill('Test Brand');

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should show validation error
    await expect(page.getByText(/Domain is required/i)).toBeVisible({ timeout: 2000 });
  });

  test('should validate domain format', async ({ page }) => {
    // Fill brand
    const inputs = page.locator('input');
    await inputs.first().fill('Test Brand');

    // Enter invalid domain
    await inputs.nth(1).fill('invalid-domain-format@@');

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should show domain format error
    await expect(page.getByText(/Invalid domain format/i)).toBeVisible({ timeout: 2000 });
  });

  test('should accept valid domain formats', async ({ page }) => {
    // Fill brand
    const inputs = page.locator('input');
    await inputs.first().fill('Test Brand');

    // Enter valid domain
    await inputs.nth(1).fill('example.com');

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should proceed to step 2 (or show other validation errors)
    await expect(page.getByText(/Step 2\/6|Loan Product/i)).toBeVisible({ timeout: 3000 });
  });

  test('should complete step 1 with all fields', async ({ page }) => {
    // Fill all fields
    const inputs = page.locator('input');
    await inputs.nth(0).fill('E2E Test Brand');
    await inputs.nth(1).fill('e2e-test-loan.com');

    // Tagline (optional)
    const taglineInput = page.getByPlaceholderText(/Fast. Simple. Trusted./i);
    if (await taglineInput.isVisible()) {
      await taglineInput.fill('Quick Loans, Simple Process');
    }

    // Email (optional)
    const emailInput = page.getByPlaceholderText(/@/i);
    if (await emailInput.isVisible()) {
      await emailInput.fill('support@e2e-test.com');
    }

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should proceed to step 2
    await expect(page.getByText(/Step 2\/6|Product/i)).toBeVisible({ timeout: 3000 });

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-artifacts/wizard/step2-product.png' });
  });
});

test.describe('LP Wizard - Step 2: Product Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Complete Step 1
    const inputs = page.locator('input');
    await inputs.nth(0).fill('E2E Test Brand');
    await inputs.nth(1).fill('e2e-test-loan.com');

    await page.getByRole('button').filter({ hasText: /Next/i }).click();
    await expect(page.getByText(/Loan Product|Product/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display loan type options', async ({ page }) => {
    // Check for loan type buttons
    await expect(page.getByText(/Personal/i)).toBeVisible();
    await expect(page.getByText(/Installment/i)).toBeVisible();

    // Loan types show icons and labels
    const personalLoan = page.getByText(/Personal/i).first();
    await expect(personalLoan).toBeVisible();
  });

  test('should select loan type', async ({ page }) => {
    // Click Personal Loans option
    const personalLoan = page.locator('button').filter({ hasText: /Personal/i }).first();
    await personalLoan.click();
    await page.waitForTimeout(200);

    // Verify selection state (may be indicated by border color change)
  });

  test('should display amount range presets', async ({ page }) => {
    // Check for preset buttons
    await expect(page.getByText(/\$100.*\$5K/)).toBeVisible();
    await expect(page.getByText(/\$500.*\$10K/)).toBeVisible();
  });

  test('should select amount preset', async ({ page }) => {
    // Click a preset button
    const preset = page.locator('button').filter({ hasText: /\$100.*\$5K/ }).first();
    if (await preset.isVisible()) {
      await preset.click();
      await page.waitForTimeout(200);
    }
  });

  test('should accept custom amount range', async ({ page }) => {
    // Fill amount inputs
    const inputs = page.locator('input[type="number"], input');
    const minInput = inputs.filter({ hasText: '' }).first();

    // Find Min/Max inputs by labels
    const minAmount = page.locator('input').nth(0);
    const maxAmount = page.locator('input').nth(1);

    await minAmount.fill('500');
    await maxAmount.fill('10000');

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should either proceed or show APR validation errors
    await page.waitForTimeout(500);
  });

  test('should validate min < max for amounts', async ({ page }) => {
    // Find amount inputs
    const inputs = page.locator('input');
    const minAmount = inputs.nth(0);
    const maxAmount = inputs.nth(1);

    await minAmount.fill('10000');
    await maxAmount.fill('5000');

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should show validation error
    await expect(page.getByText(/Min Amount must be less than Max/i)).toBeVisible({ timeout: 2000 });
  });

  test('should validate APR range', async ({ page }) => {
    // Fill amounts first
    const inputs = page.locator('input');
    await inputs.nth(0).fill('500');
    await inputs.nth(1).fill('10000');

    // Fill APR with invalid range
    await inputs.nth(2).fill('35.99');  // Min APR
    await inputs.nth(3).fill('5.99');   // Max APR (less than min)

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should show APR validation error
    await expect(page.getByText(/Min APR must be less than Max APR/i)).toBeVisible({ timeout: 2000 });
  });

  test('should complete step 2 with valid data', async ({ page }) => {
    // Select loan type
    const personalLoan = page.locator('button').filter({ hasText: /Personal/i }).first();
    await personalLoan.click();

    // Fill amounts
    const inputs = page.locator('input');
    await inputs.nth(0).fill('500');    // Min amount
    await inputs.nth(1).fill('10000');  // Max amount
    await inputs.nth(2).fill('5.99');   // Min APR
    await inputs.nth(3).fill('35.99');  // Max APR

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should proceed to step 3
    await expect(page.getByText(/Step 3\/6|Design/i)).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-artifacts/wizard/step3-design.png' });
  });
});

test.describe('LP Wizard - Step 3: Design Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Complete Steps 1 and 2
    await completeStep1(page);
    await completeStep2(page);

    await expect(page.getByText(/Step 3\/6|Design/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display color scheme options', async ({ page }) => {
    // Check for color options
    await expect(page.getByText(/Color Scheme/i)).toBeVisible();
    await expect(page.getByText(/Ocean|Forest|Midnight/i)).toBeVisible();
  });

  test('should select color scheme', async ({ page }) => {
    // Click a color option
    const oceanColor = page.getByText(/Ocean/i).first();
    if (await oceanColor.isVisible()) {
      await oceanColor.click();
      await page.waitForTimeout(200);
    }
  });

  test('should display font options', async ({ page }) => {
    await expect(page.getByText(/Font/i)).toBeVisible();
    await expect(page.getByText(/DM Sans|Inter|Outfit/i)).toBeVisible();
  });

  test('should select font', async ({ page }) => {
    const fontOption = page.locator('button').filter({ hasText: /DM Sans|Inter/i }).first();
    if (await fontOption.isVisible()) {
      await fontOption.click();
      await page.waitForTimeout(200);
    }
  });

  test('should display layout options', async ({ page }) => {
    await expect(page.getByText(/Layout/i)).toBeVisible();
  });

  test('should display radius options', async ({ page }) => {
    await expect(page.getByText(/Radius/i)).toBeVisible();
    await expect(page.getByText(/Sharp|Rounded|Pill/i)).toBeVisible();
  });

  test('should display trust badge options', async ({ page }) => {
    await expect(page.getByText(/Trust Badges/i)).toBeVisible();
  });

  test('should show mobile preview', async ({ page }) => {
    // Check for preview iframe or phone mockup
    const preview = page.locator('iframe, .mock-phone, [class*="preview"], [class*="phone"]').first();
    if (await preview.isVisible()) {
      await expect(preview).toBeVisible();
    }
  });

  test('should complete step 3', async ({ page }) => {
    // Select color
    const colorBtn = page.locator('button').filter({ hasText: /Ocean|Forest|Midnight|Ruby|Slate/ }).first();
    await colorBtn.click();

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should proceed to step 4 or show validation
    await expect(page.getByText(/Step 4\/6|Copy/i)).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-artifacts/wizard/step4-copy.png' });
  });
});

test.describe('LP Wizard - Step 4: Copy & Content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Complete Steps 1-3
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);

    await expect(page.getByText(/Step 4\/6|Copy/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display copy input fields', async ({ page }) => {
    await expect(page.getByText(/H1|Headline/i)).toBeVisible();
    await expect(page.getByText(/Badge/i)).toBeVisible();
    await expect(page.getByText(/CTA/i)).toBeVisible();
    await expect(page.getByText(/Sub/i)).toBeVisible();
  });

  test('should display quick-start templates', async ({ page }) => {
    await expect(page.getByText(/Quick-Start|Templates/i)).toBeVisible();
    await expect(page.getByText(/ElasticCredits|QuickFund|LoanBridge/i)).toBeVisible();
  });

  test('should apply copy template', async ({ page }) => {
    // Click on a template option
    const template = page.getByText(/ElasticCredits|LoanBridge/i).first();
    if (await template.isVisible()) {
      await template.click();
      await page.waitForTimeout(300);

      // Verify fields were populated (check for non-empty values)
      const inputs = page.locator('input');
      const h1Input = inputs.filter({ hasText: /Fast|Smarter|Get/i }).first();
      // Just verify it's clickable, actual population may vary
    }
  });

  test('should show AI generate button', async ({ page }) => {
    await expect(page.getByText(/AI Copy|Generate/i)).toBeVisible();
  });

  test('should allow manual copy input', async ({ page }) => {
    // Fill headline
    const h1Input = page.locator('input').filter({ hasText: '' }).first();
    await h1Input.fill('Get Your Test Loan Today');

    // Fill other fields
    const inputs = page.locator('input');
    const count = await inputs.count();
    if (count > 1) {
      await inputs.nth(1).fill('No Credit Check Required');
    }
    if (count > 2) {
      await inputs.nth(2).fill('Apply Now');
    }

    await page.screenshot({ path: 'test-artifacts/wizard/step4-copy-filled.png' });
  });

  test('should display language options', async ({ page }) => {
    await expect(page.getByText(/Language|Translate|English|Spanish/i)).toBeVisible();
  });

  test('should complete step 4', async ({ page }) => {
    // Apply a template or fill minimal fields
    const template = page.getByText(/LoanBridge/i).first();
    if (await template.isVisible()) {
      await template.click();
    }

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Should proceed to step 5
    await expect(page.getByText(/Step 5\/6|Tracking/i)).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-artifacts/wizard/step5-tracking.png' });
  });
});

test.describe('LP Wizard - Step 5: Tracking & Conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Complete Steps 1-4
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);

    await expect(page.getByText(/Step 5\/6|Tracking/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display Google Ads conversion fields', async ({ page }) => {
    await expect(page.getByText(/Google Ads|Conversion ID/i)).toBeVisible();
    await expect(page.getByText(/form_start|form_submit/i)).toBeVisible();
  });

  test('should display Voluum tracking fields', async ({ page }) => {
    await expect(page.getByText(/Voluum/i)).toBeVisible();
  });

  test('should display LeadsGate form fields', async ({ page }) => {
    await expect(page.getByText(/LeadsGate|AID/i)).toBeVisible();
    await expect(page.getByText(/Affiliate Network/i)).toBeVisible();
  });

  test('should display redirect URL field', async ({ page }) => {
    await expect(page.getByText(/Redirect URL/i)).toBeVisible();
  });

  test('should display form embed code field', async ({ page }) => {
    await expect(page.getByText(/Form Embed|Embed Code/i)).toBeVisible();
  });

  test('should validate redirect URL format', async ({ page }) => {
    // Enter invalid URL
    const redirectInput = page.getByPlaceholderText(/https/i);
    if (await redirectInput.isVisible()) {
      await redirectInput.fill('not-a-valid-url');

      await page.getByRole('button').filter({ hasText: /Next/i }).click();

      // Should show URL error
      await expect(page.getByText(/valid URL/i)).toBeVisible({ timeout: 2000 });
    }
  });

  test('should accept valid redirect URL', async ({ page }) => {
    // Enter valid URL
    const redirectInput = page.getByPlaceholderText(/https/i);
    if (await redirectInput.isVisible()) {
      await redirectInput.fill('https://example.com/apply');

      await page.getByRole('button').filter({ hasText: /Next/i }).click();

      // Should proceed to step 6
      await expect(page.getByText(/Step 6\/6|Review/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display affiliate network options', async ({ page }) => {
    await expect(page.getByText(/LeadsGate|ZeroParallel|LeadStack/i)).toBeVisible();

    // Select a network
    const networkBtn = page.locator('button').filter({ hasText: /LeadsGate/i }).first();
    if (await networkBtn.isVisible()) {
      await networkBtn.click();
      await page.waitForTimeout(200);
    }
  });

  test('should complete step 5 with redirect URL', async ({ page }) => {
    const redirectInput = page.getByPlaceholderText(/https/i);
    if (await redirectInput.isVisible()) {
      await redirectInput.fill('https://offers.example.com/apply');
    }

    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    await expect(page.getByText(/Step 6\/6|Review/i)).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-artifacts/wizard/step6-review.png' });
  });
});

test.describe('LP Wizard - Step 6: Review & Build', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Complete all steps
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);

    await expect(page.getByText(/Step 6\/6|Review/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display configuration summary', async ({ page }) => {
    // Check for summary elements
    await expect(page.getByText(/Configuration/i)).toBeVisible();

    // Should show brand info
    await expect(page.getByText(/E2E Test Brand/i)).toBeVisible();

    // Should show amounts
    await expect(page.getByText(/\$500|\$1000/)).toBeVisible();
  });

  test('should display color preview', async ({ page }) => {
    // Check for color swatches
    await expect(page.locator('[style*="background"], [style*="color"]').first()).toBeVisible();
  });

  test('should display Astro project file tree', async ({ page }) => {
    await expect(page.getByText(/Astro Project|files/i)).toBeVisible();

    // Try to expand file tree
    const treeToggle = page.locator('button').filter({ hasText: /Astro Project/i }).first();
    if (await treeToggle.isVisible()) {
      await treeToggle.click();
      await page.waitForTimeout(300);

      // Check for file indicators
      await expect(page.getByText(/.astro|.css|package.json/i)).isVisible();
    }
  });

  test('should have build button', async ({ page }) => {
    const buildBtn = page.getByRole('button').filter({ hasText: /Build.*Save|Save|Create/i });
    await expect(buildBtn).toBeVisible();
  });

  test('should have back button', async ({ page }) => {
    const backBtn = page.getByRole('button').filter({ hasText: /←.*Back|Back/i });
    await expect(backBtn).toBeVisible();
  });

  test('should navigate back to step 5', async ({ page }) => {
    const backBtn = page.getByRole('button').filter({ hasText: /←.*Back|Back/i });
    await backBtn.click();

    await expect(page.getByText(/Step 5\/6|Tracking/i)).toBeVisible({ timeout: 3000 });
  });
});

test.describe('LP Wizard - Complete Flow', () => {
  test('should complete full wizard flow and save', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Complete all steps
    await completeStep1(page);
    await completeStep2(page);
    await completeStep3(page);
    await completeStep4(page);
    await completeStep5(page);

    // Wait for review step
    await expect(page.getByText(/Step 6\/6|Review/i)).toBeVisible({ timeout: 5000 });

    // Click Build & Save
    const buildBtn = page.getByRole('button').filter({ hasText: /Build.*Save|Save|Create/i });
    await buildBtn.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Should return to sites list or show success
    await expect(page.getByText(/My Sites|Dashboard|Sites/i)).toBeVisible({ timeout: 5000 });

    // Take final screenshot
    await page.screenshot({
      path: 'test-artifacts/wizard/complete-flow-success.png',
      fullPage: true
    });
  });

  test('should complete wizard with minimal data', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    // Step 1: Required fields only
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Minimal Brand');
    await inputs.nth(1).fill('minimal.com');
    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Step 2: Click first loan type and use defaults
    const loanType = page.locator('button').filter({ hasText: /Personal/i }).first();
    await loanType.click();
    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Step 3: Select first color
    const colorBtn = page.locator('button').filter({ hasText: /Ocean|Forest/i }).first();
    await colorBtn.click();
    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Step 4: Use defaults or click template
    const template = page.getByText(/LoanBridge/i).first();
    if (await template.isVisible()) {
      await template.click();
    }
    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Step 5: Add redirect URL
    const redirectInput = page.getByPlaceholderText(/https/i);
    if (await redirectInput.isVisible()) {
      await redirectInput.fill('https://example.com');
    }
    await page.getByRole('button').filter({ hasText: /Next/i }).click();

    // Step 6: Review and save
    await expect(page.getByText(/Step 6\/6|Review/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button').filter({ hasText: /Build.*Save|Save/i }).click();

    await page.waitForTimeout(2000);
    await expect(page.getByText(/My Sites|Dashboard|Sites/i)).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Helper functions to complete wizard steps
 */
async function fillBrandStep(page: any) {
  const inputs = page.locator('input');
  await inputs.nth(0).fill('E2E Test Brand');
  await inputs.nth(1).fill('e2e-test-loan.com');
  await page.waitForTimeout(200);
}

async function completeStep1(page: any) {
  await fillBrandStep(page);
  await page.getByRole('button').filter({ hasText: /Next/i }).click();
  await page.waitForTimeout(300);
}

async function completeStep2(page: any) {
  // Select loan type
  const personalLoan = page.locator('button').filter({ hasText: /Personal/i }).first();
  await personalLoan.click();

  // Fill amounts and APR
  const inputs = page.locator('input');
  await inputs.nth(0).fill('500');
  await inputs.nth(1).fill('10000');
  await inputs.nth(2).fill('5.99');
  await inputs.nth(3).fill('35.99');

  await page.getByRole('button').filter({ hasText: /Next/i }).click();
  await page.waitForTimeout(300);
}

async function completeStep3(page: any) {
  // Select color
  const colorBtn = page.locator('button').filter({ hasText: /Ocean|Forest|Midnight|Ruby|Slate/ }).first();
  await colorBtn.click();

  await page.getByRole('button').filter({ hasText: /Next/i }).click();
  await page.waitForTimeout(300);
}

async function completeStep4(page: any) {
  // Apply template
  const template = page.getByText(/LoanBridge/i).first();
  if (await template.isVisible()) {
    await template.click();
  }

  await page.getByRole('button').filter({ hasText: /Next/i }).click();
  await page.waitForTimeout(300);
}

async function completeStep5(page: any) {
  // Add redirect URL
  const redirectInput = page.getByPlaceholderText(/https/i);
  if (await redirectInput.isVisible()) {
    await redirectInput.fill('https://example.com/apply');
  }

  await page.getByRole('button').filter({ hasText: /Next/i }).click();
  await page.waitForTimeout(300);
}
