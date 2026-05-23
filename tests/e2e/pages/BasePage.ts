import type { Page, Locator } from '@playwright/test';

/**
 * BasePage - Abstract base class for all page objects
 * Provides common functionality like navigation, waiting, and screenshots
 */
export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL || 'http://localhost:4321';
  }

  /**
   * Navigate to a path relative to baseURL
   */
  async goto(path: string = '') {
    await this.page.goto(`${this.baseURL}${path}`, {
      // networkidle flakes on SPAs (WS, polling, parallel E2E workers)
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(timeout: number = 5000) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Take a screenshot with automatic timestamp
   */
  async screenshot(name: string, options: { fullPage?: boolean } = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `test-artifacts/screenshots/${name}-${timestamp}.png`;
    await this.page.screenshot({
      path,
      fullPage: options.fullPage || false,
    });
    return path;
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector: string, timeout: number = 10000) {
    await this.page.locator(selector).waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(selector: string, timeout: number = 10000) {
    await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isVisible();
  }

  /**
   * Get text content of element
   */
  async getText(selector: string): Promise<string> {
    return await this.page.locator(selector).textContent() || '';
  }

  /**
   * Fill an input field
   */
  async fill(selector: string, value: string) {
    await this.page.locator(selector).fill(value);
  }

  /**
   * Click an element
   */
  async click(selector: string) {
    await this.page.locator(selector).click();
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string) {
    await this.page.locator(selector).selectOption(value);
  }

  /**
   * Get attribute value
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return await this.page.locator(selector).getAttribute(attribute);
  }

  /**
   * Wait for API response
   */
  async waitForResponse(urlPattern: string | RegExp | ((response: any) => boolean), timeout: number = 30000) {
    return await this.page.waitForResponse(
      typeof urlPattern === 'string'
        ? res => res.url().includes(urlPattern)
        : urlPattern,
      { timeout }
    );
  }

  /**
   * Execute JavaScript in the page context
   */
  async evaluate<R>(fn: () => R): Promise<R> {
    return await this.page.evaluate(fn);
  }

  /**
   * Get localStorage value
   */
  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.evaluate(() => localStorage.getItem(key));
  }

  /**
   * Set localStorage value
   */
  async setLocalStorageItem(key: string, value: string) {
    await this.evaluate((k, v) => localStorage.setItem(k, v), key, value);
  }

  /**
   * Clear localStorage
   */
  async clearLocalStorage() {
    await this.evaluate(() => localStorage.clear());
  }
}
