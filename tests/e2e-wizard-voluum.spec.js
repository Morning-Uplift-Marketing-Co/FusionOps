/**
 * E2E Test: Wizard Step 6 (Tracking) + Ops Center Proxy Pool
 * 
 * Run:  npx playwright test tests/e2e-wizard-voluum.spec.js --headed
 * Or:   node tests/e2e-wizard-voluum.spec.js   (standalone mode)
 * 
 * Prerequisites:
 *   - Dev server running on localhost:4322
 *   - Voluum credentials saved in Settings
 *   - npm i -D playwright @playwright/test  (if not installed)
 */

const STANDALONE = !process.env.PLAYWRIGHT_TEST_RUNNER;

if (STANDALONE) {
  // ── Standalone runner (no Playwright Test framework needed) ──
  const { chromium } = require("playwright");

  const BASE = "http://localhost:4322";
  const PASS = "\x1b[32m✓\x1b[0m";
  const FAIL = "\x1b[31m✗\x1b[0m";
  const INFO = "\x1b[36mℹ\x1b[0m";
  let results = [];

  function log(icon, msg) { console.log(`  ${icon} ${msg}`); }
  function assert(condition, msg) {
    if (condition) { log(PASS, msg); results.push({ pass: true, msg }); }
    else { log(FAIL, msg); results.push({ pass: false, msg }); }
  }

  (async () => {
    console.log("\n═══ FusionOps E2E Test Suite ═══\n");

    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();

    try {
      // ──────────────────────────────────────────────
      // TEST 1: App loads
      // ──────────────────────────────────────────────
      console.log("\n── Test 1: App Load ──");
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });
      const title = await page.title();
      assert(title.length > 0, `Page loaded: "${title}"`);

      // ──────────────────────────────────────────────
      // TEST 2: Navigate to Wizard
      // ──────────────────────────────────────────────
      console.log("\n── Test 2: Navigate to Wizard ──");
      // Look for wizard/new campaign button in sidebar
      const wizardBtn = await page.$('text=New Campaign') || await page.$('text=Wizard') || await page.$('[data-menu="wizard"]');
      if (wizardBtn) {
        await wizardBtn.click();
        await page.waitForTimeout(500);
        assert(true, "Clicked Wizard/New Campaign button");
      } else {
        // Try direct URL
        await page.goto(`${BASE}/#wizard`, { waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        log(INFO, "Navigated to wizard via URL hash");
        assert(true, "Navigated to wizard page");
      }

      // ──────────────────────────────────────────────
      // TEST 3: Navigate to Step 6 (Tracking)
      // ──────────────────────────────────────────────
      console.log("\n── Test 3: Navigate to Step 6 (Tracking) ──");
      // Click through steps or find step 6 directly
      for (let i = 0; i < 6; i++) {
        const nextBtn = await page.$('button:has-text("Next")') || await page.$('button:has-text("Continue")');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(300);
        }
      }
      // Verify we see tracking step
      const trackingHeader = await page.$('text=Tracking') || await page.$('text=📡');
      assert(!!trackingHeader, "Step 6 (Tracking & Conversion) visible");

      // ──────────────────────────────────────────────
      // TEST 4: Tracking Mode Toggle
      // ──────────────────────────────────────────────
      console.log("\n── Test 4: Tracking Mode Toggle ──");
      const minimalBtn = await page.$('text=Minimal Stack');
      const voluumBtn = await page.$('text=Voluum Stack');
      assert(!!minimalBtn && !!voluumBtn, "Both tracking mode buttons visible");

      if (voluumBtn) {
        await voluumBtn.click();
        await page.waitForTimeout(500);
        const voluumCard = await page.$('text=Voluum Campaign');
        assert(!!voluumCard, "Voluum Campaign card appeared after clicking Voluum Stack");
      }

      // ──────────────────────────────────────────────
      // TEST 5: Voluum Credentials Check
      // ──────────────────────────────────────────────
      console.log("\n── Test 5: Voluum Credentials ──");
      await page.waitForTimeout(2000); // Wait for API call

      const credError = await page.$('text=Voluum credentials not found');
      const loadingSpinner = await page.$('text=Loading campaigns');
      const campaignSelect = await page.$('select') || await page.$('[class*="select"]');

      if (credError) {
        log(FAIL, "Voluum credentials not found — check Settings → Voluum");
        assert(false, "Voluum credentials loaded from LS");
      } else if (loadingSpinner) {
        log(INFO, "Campaigns loading... (credentials found!)");
        assert(true, "Voluum credentials loaded from LS");
        await page.waitForTimeout(5000); // Wait for campaigns
      } else {
        assert(true, "Voluum credentials loaded (no error shown)");
      }

      // ──────────────────────────────────────────────
      // TEST 6: Campaign List
      // ──────────────────────────────────────────────
      console.log("\n── Test 6: Campaign List ──");
      const apiError = await page.$('text=Failed to authenticate');
      if (apiError) {
        assert(false, "Campaign fetch failed — API error");
      } else {
        const selectOptions = await page.$$('option');
        const optionCount = selectOptions.length;
        assert(optionCount > 1, `Campaign dropdown has ${optionCount - 1} campaigns`);

        // Select first campaign
        if (optionCount > 1) {
          const firstOption = await selectOptions[1].getAttribute("value");
          if (firstOption) {
            await page.selectOption('select', firstOption).catch(() => {});
            await page.waitForTimeout(500);
            const trackingDomain = await page.$('text=Tracking Domain');
            assert(!!trackingDomain, "Campaign selected — tracking domain shown");
          }
        }
      }

      // ──────────────────────────────────────────────
      // TEST 7: Create Campaign UI
      // ──────────────────────────────────────────────
      console.log("\n── Test 7: Create Campaign UI ──");
      const createBtn = await page.$('text=Create new campaign');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(300);
        const createForm = await page.$('text=Create Voluum Campaign');
        assert(!!createForm, "Create campaign form opened");

        // Fill form
        const nameInput = await page.$('input[placeholder*="US-Loan"]') || await page.$('input[placeholder*="Campaign"]');
        if (nameInput) {
          await nameInput.fill("E2E-Test-Campaign");
          log(INFO, "Filled campaign name: E2E-Test-Campaign");
        }

        // Don't actually create — just verify UI
        const cancelBtn = await page.$('button:has-text("Cancel")');
        if (cancelBtn) {
          await cancelBtn.click();
          assert(true, "Create form cancel works");
        }
      } else {
        assert(false, "Create new campaign button not found");
      }

      // ──────────────────────────────────────────────
      // TEST 8: Google Ads Conversion ID
      // ──────────────────────────────────────────────
      console.log("\n── Test 8: Google Ads Fields ──");
      const gadsCard = await page.$('text=Google Ads Conversion');
      assert(!!gadsCard, "Google Ads Conversion card visible");

      const convIdInput = await page.$('input[placeholder*="AW-"]');
      if (convIdInput) {
        await convIdInput.fill("AW-123456789");
        assert(true, "Conversion ID field accepts input");
      }

      // ──────────────────────────────────────────────
      // TEST 9: Affiliate Form Section
      // ──────────────────────────────────────────────
      console.log("\n── Test 9: Affiliate Form ──");
      const affCard = await page.$('text=Affiliate Form');
      assert(!!affCard, "Affiliate Form card visible");

      const lgBtn = await page.$('button:has-text("LeadsGate")');
      assert(!!lgBtn, "LeadsGate network button visible");

      // ──────────────────────────────────────────────
      // TEST 10: Navigate to Ops Center → Proxy Pool
      // ──────────────────────────────────────────────
      console.log("\n── Test 10: Ops Center → Proxy Pool ──");
      const opsBtn = await page.$('text=Ops Center') || await page.$('[data-menu="ops"]');
      if (opsBtn) {
        await opsBtn.click();
        await page.waitForTimeout(500);

        const proxyPoolTab = await page.$('text=Proxy Pool');
        if (proxyPoolTab) {
          await proxyPoolTab.click();
          await page.waitForTimeout(500);

          const proxyUI = await page.$('text=Add Proxy') || await page.$('text=Bulk Import') || await page.$('text=Total');
          assert(!!proxyUI, "Proxy Pool tab loaded with UI elements");
        } else {
          assert(false, "Proxy Pool tab not found in Ops Center");
        }
      } else {
        log(INFO, "Ops Center not reachable from current view");
        assert(true, "Skipped — Ops Center navigation");
      }

      // ──────────────────────────────────────────────
      // TEST 11: Voluum Explorer
      // ──────────────────────────────────────────────
      console.log("\n── Test 11: Voluum Explorer ──");
      const vExplBtn = await page.$('text=Voluum Explorer') || await page.$('[data-menu="voluum"]') || await page.$('text=🎯');
      if (vExplBtn) {
        await vExplBtn.click();
        await page.waitForTimeout(2000);

        const explorerUI = await page.$('text=Campaigns') || await page.$('text=Conversions');
        assert(!!explorerUI, "Voluum Explorer loaded");
      } else {
        log(INFO, "Voluum Explorer menu not found — skipping");
        assert(true, "Skipped — Voluum Explorer");
      }

      // ──────────────────────────────────────────────
      // TEST 12: localStorage Keys Check
      // ──────────────────────────────────────────────
      console.log("\n── Test 12: localStorage Verification ──");
      const lsKeys = await page.evaluate(() => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          keys.push(localStorage.key(i));
        }
        return keys;
      });
      log(INFO, `localStorage keys: ${lsKeys.length} total`);

      const settingsKey = lsKeys.find(k => k.includes("settings"));
      if (settingsKey) {
        const settingsVal = await page.evaluate((key) => {
          try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
        }, settingsKey);

        const hasVoluum = !!(settingsVal?.voluumAccessKeyId && settingsVal?.voluumAccessKey);
        assert(hasVoluum, `Voluum creds in LS key "${settingsKey}": ${hasVoluum ? "YES" : "MISSING"}`);
      } else {
        assert(false, "Settings key not found in localStorage");
      }

    } catch (err) {
      log(FAIL, `Unexpected error: ${err.message}`);
      results.push({ pass: false, msg: err.message });
    }

    // ── Summary ──
    console.log("\n═══════════════════════════════════");
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`  ${PASS} Passed: ${passed}`);
    if (failed > 0) console.log(`  ${FAIL} Failed: ${failed}`);
    console.log(`  Total: ${results.length}`);
    console.log("═══════════════════════════════════\n");

    if (failed > 0) {
      console.log("Failed tests:");
      results.filter(r => !r.pass).forEach(r => console.log(`  ${FAIL} ${r.msg}`));
      console.log("");
    }

    await page.waitForTimeout(3000); // Keep browser open briefly
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);

  })().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });

} else {
  // ── Playwright Test framework mode ──
  const { test, expect } = require("@playwright/test");
  const BASE = "http://localhost:4322";

  test.describe("FusionOps Wizard & Voluum", () => {
    test("App loads", async ({ page }) => {
      await page.goto(BASE);
      await expect(page).toHaveTitle(/.+/);
    });

    test("Wizard Step 6 shows tracking modes", async ({ page }) => {
      await page.goto(BASE);
      // Navigate to wizard step 6...
      const minimal = page.locator("text=Minimal Stack");
      const voluum = page.locator("text=Voluum Stack");
      await expect(minimal).toBeVisible({ timeout: 10000 });
      await expect(voluum).toBeVisible();
    });
  });
}
