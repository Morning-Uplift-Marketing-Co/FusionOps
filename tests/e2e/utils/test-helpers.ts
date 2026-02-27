/**
 * E2E Test Helper Functions
 *
 * Common utilities and helper functions for E2E tests.
 * Provides consistent ways to interact with the application.
 */

import { Page, Locator } from '@playwright/test';

/**
 * Application-specific locators and helpers
 */
export class AppHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific page/section
   */
  async navigateTo(section: 'dashboard' | 'sites' | 'create' | 'settings' | 'ops') {
    switch (section) {
      case 'dashboard':
        await this.page.goto('/');
        break;
      case 'sites':
        await this.page.goto('/#sites');
        // Or click the Sites navigation
        const sitesNav = this.page.getByRole('link', 'button').filter({ hasText: /Sites/i });
        if (await sitesNav.isVisible()) {
          await sitesNav.click();
        }
        break;
      case 'create':
        await this.page.goto('/');
        const createBtn = this.page.getByRole('button').filter({ hasText: /Create LP|Create/i });
        await createBtn.click();
        break;
      case 'settings':
        await this.page.goto('/');
        const settingsBtn = this.page.getByRole('button').filter({ hasText: /Settings/i });
        await settingsBtn.click();
        break;
      case 'ops':
        await this.page.goto('/');
        const opsBtn = this.page.getByRole('button').filter({ hasText: /Ops Center/i });
        if (await opsBtn.isVisible()) {
          await opsBtn.click();
        }
        break;
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Get current page/section based on URL or visible content
   */
  async getCurrentSection(): Promise<string> {
    const url = this.page.url();
    if (url.includes('#create') || await this.page.getByText(/Brand Information/i).isVisible()) {
      return 'create';
    }
    if (await this.page.getByText(/My Sites/i).isVisible()) {
      return 'sites';
    }
    if (await this.page.getByText(/Settings|API keys/i).isVisible()) {
      return 'settings';
    }
    if (await this.page.getByText(/Ops Center/i).isVisible()) {
      return 'ops';
    }
    return 'dashboard';
  }

  /**
   * Wait for application to be ready (loaded and stable)
   */
  async waitForAppReady(): Promise<void> {
    // Wait for either dashboard, sites, or settings to be visible
    await this.page.waitForLoadState('networkidle');

    // Check for app content
    await this.page.waitForSelector(
      'text=/Dashboard|My Sites|Settings|Brand Information/',
      { timeout: 15000 }
    );
  }

  /**
   * Dismiss any dialogs/prompts that might appear
   */
  async dismissDialogs(): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });
  }

  /**
   * Accept any dialogs/prompts that might appear
   */
  async acceptDialogs(): Promise<void> {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
  }

  /**
   * Clear localStorage
   */
  async clearStorage(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Get localStorage value
   */
  async getStorageItem(key: string): Promise<any> {
    return await this.page.evaluate((k) => {
      return JSON.parse(localStorage.getItem(k) || 'null');
    }, key);
  }

  /**
   * Set localStorage value
   */
  async setStorageItem(key: string, value: any): Promise<void> {
    await this.page.evaluate(({ k, v }) => {
      localStorage.setItem(k, JSON.stringify(v));
    }, { k: key, v: value });
  }

  /**
   * Take screenshot with automatic naming
   */
  async screenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-artifacts/screenshots/${name}-${timestamp}.png`
    });
  }

  /**
   * Wait for toast/notification to appear and return its text
   */
  async waitForToast(): Promise<string> {
    const toast = this.page.locator('[class*="toast"], [class*="notification"], [role="alert"]').first();
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    return await toast.textContent() || '';
  }

  /**
   * Check if element is in viewport
   */
  async isInViewport(locator: Locator): Promise<boolean> {
    const box = await locator.boundingBox();
    if (!box) return false;

    const viewportSize = this.page.viewportSize();
    if (!viewportSize) return false;

    return (
      box.y >= 0 &&
      box.x >= 0 &&
      box.y + box.height <= viewportSize.height &&
      box.x + box.width <= viewportSize.width
    );
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Get all text content of an element
   */
  async getTextContent(locator: Locator): Promise<string> {
    return await locator.evaluate((el) => el.textContent || '');
  }

  /**
   * Hover over an element and wait for any animations
   */
  async hoverAndWait(locator: Locator, waitTime: number = 300): Promise<void> {
    await locator.hover();
    await this.page.waitForTimeout(waitTime);
  }

  /**
   * Click and wait for navigation
   */
  async clickAndWaitForNavigation(locator: Locator): Promise<void> {
    await Promise.all([
      this.page.waitForLoadState('networkidle'),
      locator.click()
    ]);
  }

  /**
   * Fill input with clear and type
   */
  async fillInput(locator: Locator, value: string): Promise<void> {
    await locator.clear();
    await locator.fill(value);
    await locator.press('Tab'); // Trigger change event
  }

  /**
   * Select option from dropdown by text
   */
  async selectOption(dropdownLocator: Locator, optionText: string): Promise<void> {
    await dropdownLocator.click();
    const option = this.page.getByRole('option').filter({ hasText: optionText });
    await option.click();
  }

  /**
   * Wait for loading state to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    const loadingIndicators = this.page.locator(
      'text=/Loading|...|⏳|Processing/i'
    );

    // Wait for loading to appear (if it does)
    const hasLoading = await loadingIndicators.isVisible().catch(() => false);

    if (hasLoading) {
      await loadingIndicators.waitFor({ state: 'hidden', timeout: 30000 });
    }
  }

  /**
   * Retry an operation with exponential backoff
   */
  async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const delay = baseDelay * Math.pow(2, i);
        await this.page.waitForTimeout(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if element exists and is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector).first();
      return await element.isVisible({ timeout: 2000 });
    } catch {
      return false;
    }
  }

  /**
   * Get count of elements matching selector
   */
  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  /**
   * Execute JavaScript in page context
   */
  async executeScript<T>(script: string, ...args: any[]): Promise<T> {
    return await this.page.evaluate(script, ...args);
  }

  /**
   * Mock API response
   */
  async mockApiRoute(urlPattern: string, response: any): Promise<void> {
    await this.page.route(urlPattern, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Stub console methods to reduce noise in tests
   */
  async stubConsole(): Promise<void> {
    await this.page.evaluate(() => {
      // eslint-disable-next-line no-console
      console.log = () => {};
      // eslint-disable-next-line no-console
      console.debug = () => {};
    });
  }

  /**
   * Get console errors
   */
  async getConsoleErrors(): Promise<string[]> {
    return await this.page.evaluate(() => {
      return (window as any).__consoleErrors || [];
    });
  }

  /**
   * Setup console error listener
   */
  async listenForConsoleErrors(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__consoleErrors = [];
      // eslint-disable-next-line no-console
      const originalError = console.error;
      // eslint-disable-next-line no-console
      console.error = (...args) => {
        (window as any).__consoleErrors.push(args.join(' '));
        originalError.apply(console, args);
      };
    });
  }
}

/**
 * Wizard-specific helpers
 */
export class WizardHelpers {
  constructor(private page: Page) {}

  /**
   * Complete wizard Step 1: Brand and Domain
   */
  async completeStep1(data: { brand: string; domain: string; tagline?: string; email?: string }): Promise<void> {
    const inputs = this.page.locator('input');
    await inputs.nth(0).fill(data.brand);
    await inputs.nth(1).fill(data.domain);

    if (data.tagline) {
      const taglineInput = this.page.getByPlaceholderText(/Fast. Simple. Trusted./i);
      if (await taglineInput.isVisible()) {
        await taglineInput.fill(data.tagline);
      }
    }

    if (data.email) {
      const emailInput = this.page.getByPlaceholderText(/@/i);
      if (await emailInput.isVisible()) {
        await emailInput.fill(data.email);
      }
    }

    await this.page.getByRole('button').filter({ hasText: /Next/i }).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Complete wizard Step 2: Product Configuration
   */
  async completeStep2(data: {
    loanType?: string;
    amountMin: number;
    amountMax: number;
    aprMin: number;
    aprMax: number;
  }): Promise<void> {
    if (data.loanType) {
      const loanTypeBtn = this.page.locator('button').filter({ hasText: new RegExp(data.loanType, 'i') }).first();
      await loanTypeBtn.click();
    }

    const inputs = this.page.locator('input[type="number"], input');
    await inputs.nth(0).fill(String(data.amountMin));
    await inputs.nth(1).fill(String(data.amountMax));
    await inputs.nth(2).fill(String(data.aprMin));
    await inputs.nth(3).fill(String(data.aprMax));

    await this.page.getByRole('button').filter({ hasText: /Next/i }).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Complete wizard Step 3: Design Selection
   */
  async completeStep3(data: { colorId?: string; fontId?: string }): Promise<void> {
    if (data.colorId) {
      const colorBtn = this.page.locator('button').filter({ hasText: new RegExp(data.colorId, 'i') }).first();
      await colorBtn.click();
    }

    await this.page.getByRole('button').filter({ hasText: /Next/i }).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Complete wizard Step 4: Copy & Content
   */
  async completeStep4(data?: { template?: string }): Promise<void> {
    if (data?.template) {
      const template = this.page.getByText(new RegExp(data.template, 'i')).first();
      if (await template.isVisible()) {
        await template.click();
      }
    }

    await this.page.getByRole('button').filter({ hasText: /Next/i }).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Complete wizard Step 5: Tracking & Conversion
   */
  async completeStep5(data: { redirectUrl: string; aid?: string }): Promise<void> {
    const redirectInput = this.page.getByPlaceholderText(/https/i);
    if (await redirectInput.isVisible()) {
      await redirectInput.fill(data.redirectUrl);
    }

    if (data.aid) {
      const aidInput = this.page.getByPlaceholderText(/14881/i);
      if (await aidInput.isVisible()) {
        await aidInput.fill(data.aid);
      }
    }

    await this.page.getByRole('button').filter({ hasText: /Next/i }).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Complete wizard Step 6: Review & Build
   */
  async completeStep6(): Promise<void> {
    const buildBtn = this.page.getByRole('button').filter({ hasText: /Build.*Save|Save/i });
    await buildBtn.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Complete entire wizard flow with default data
   */
  async completeWizard(data: {
    brand: string;
    domain: string;
    amountMin?: number;
    amountMax?: number;
    redirectUrl: string;
  }): Promise<void> {
    await this.completeStep1({
      brand: data.brand,
      domain: data.domain
    });

    await this.completeStep2({
      amountMin: data.amountMin || 500,
      amountMax: data.amountMax || 10000,
      aprMin: 5.99,
      aprMax: 35.99
    });

    await this.completeStep3({ colorId: 'Ocean' });
    await this.completeStep4({ template: 'LoanBridge' });
    await this.completeStep5({ redirectUrl: data.redirectUrl });
    await this.completeStep6();
  }

  /**
   * Get current wizard step
   */
  async getCurrentStep(): Promise<number> {
    const stepText = await this.page.getByText(/Step \d\/6/).textContent();
    const match = stepText?.match(/Step (\d)\/6/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errorContainer = this.page.locator('text=/Please fix|⚠️/i').first();
    if (await errorContainer.isVisible()) {
      const errors = await this.page.locator('text=/•/').allTextContents();
      return errors;
    }
    return [];
  }
}

/**
 * Sites page helpers
 */
export class SitesHelpers {
  constructor(private page: Page) {}

  /**
   * Get number of displayed sites
   */
  async getSiteCount(): Promise<number> {
    const siteCards = this.page.locator('[class*="site"], [class*="card"]');
    return await siteCards.count();
  }

  /**
   * Search for sites
   */
  async searchSites(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholderText(/Search sites/i);
    await searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    const searchInput = this.page.getByPlaceholderText(/Search sites/i);
    await searchInput.fill('');
    await this.page.waitForTimeout(300);
  }

  /**
   * Apply quick filter
   */
  async applyFilter(filter: 'All' | 'Deployed' | 'Banned' | 'Warming' | 'No Domain' | 'Not Deployed'): Promise<void> {
    const filterBtn = this.page.getByRole('button').filter({ hasText: new RegExp(filter, 'i') });
    await filterBtn.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get site by brand name
   */
  async getSiteByBrand(brand: string): Promise<Locator | null> {
    const sites = this.page.locator('[class*="site"], [class*="card"]');
    const count = await sites.count();

    for (let i = 0; i < count; i++) {
      const site = sites.nth(i);
      const text = await site.textContent();
      if (text?.includes(brand)) {
        return site;
      }
    }

    return null;
  }

  /**
   * Delete site by brand name
   */
  async deleteSiteByBrand(brand: string): Promise<boolean> {
    const site = await this.getSiteByBrand(brand);
    if (!site) return false;

    const deleteBtn = site.getByRole('button').filter({ hasText: /Delete|🗑/i });
    if (!(await deleteBtn.isVisible())) return false;

    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await deleteBtn.click();
    await this.page.waitForTimeout(1000);

    return true;
  }

  /**
   * Click Deploy button for a site
   */
  async clickDeployForSite(brand: string): Promise<void> {
    const site = await this.getSiteByBrand(brand);
    if (!site) throw new Error(`Site "${brand}" not found`);

    const deployBtn = site.getByRole('button').filter({ hasText: /Deploy|🚀/i });
    await deployBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click Edit button for a site
   */
  async clickEditForSite(brand: string): Promise<void> {
    const site = await this.getSiteByBrand(brand);
    if (!site) throw new Error(`Site "${brand}" not found`);

    const editBtn = site.getByRole('button').filter({ hasText: /Edit|🔄/i });
    await editBtn.click();
    await this.page.waitForTimeout(500);
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  /**
   * Generate random brand name
   */
  static randomBrand(): string {
    const adjectives = ['Quick', 'Fast', 'Easy', 'Simple', 'Smart', 'Swift', 'Rapid', 'Speedy'];
    const nouns = ['Loans', 'Cash', 'Funds', 'Credit', 'Finance', 'Lending', 'Money', 'Capital'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const random = Math.floor(Math.random() * 1000);
    return `${adj}${noun}${random}`;
  }

  /**
   * Generate random domain
   */
  static randomDomain(): string {
    const brand = this.randomBrand().toLowerCase();
    const tlds = ['.com', '.net', '.org', '.io'];
    const tld = tlds[Math.floor(Math.random() * tlds.length)];
    return `${brand}${tld}`;
  }

  /**
   * Generate random email
   */
  static randomEmail(): string {
    const brand = this.randomBrand().toLowerCase();
    return `support@${brand}.com`;
  }

  /**
   * Generate valid wizard data
   */
  static validWizardData() {
    return {
      brand: this.randomBrand(),
      domain: this.randomDomain(),
      email: this.randomEmail(),
      amountMin: 500,
      amountMax: 10000,
      aprMin: 5.99,
      aprMax: 35.99,
      redirectUrl: 'https://example.com/apply'
    };
  }

  /**
   * Generate minimal wizard data (required fields only)
   */
  static minimalWizardData() {
    return {
      brand: this.randomBrand(),
      domain: this.randomDomain(),
      redirectUrl: 'https://example.com/apply'
    };
  }
}

/**
 * Retry wrapper for flaky tests
 */
export async function retryTest<T>(
  testFn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number; onRetry?: (error: Error, attempt: number) => void } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await testFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      onRetry?.(error as Error, attempt);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('retryTest: Unexpected exit');
}
