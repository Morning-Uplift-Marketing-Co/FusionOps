import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * DashboardPage - Page Object for the main dashboard
 *
 * Locators are based on the text content and structure from App.jsx
 */
export class DashboardPage extends BasePage {
  // Page title
  readonly title: Locator;

  // Create LP button - navigation entry point to wizard
  readonly createLPButton: Locator;

  // Sites list
  readonly sitesList: Locator;
  readonly siteCard: Locator;

  // Stats
  readonly buildsCount: Locator;
  readonly spendAmount: Locator;

  // Sidebar navigation
  readonly sidebar: Locator;
  readonly sitesMenu: Locator;
  readonly opsCenterMenu: Locator;
  readonly settingsMenu: Locator;
  readonly voluumExplorerMenu: Locator;

  constructor(page: Page) {
    super(page);

    // Main create button - use exact text to avoid matching sidebar + Create LP button
    this.createLPButton = page.locator('button').filter({ hasText: /\+ Create New LP|\+ Create LP/i }).first();

    // Stats
    this.buildsCount = page.locator('text=/Builds/');
    this.spendAmount = page.locator('text=/\\$/');

    // Sites
    this.sitesList = page.locator('[class*="sites"], [class*="grid"]');
    this.siteCard = page.locator('[class*="card"], [class*="site"]').first();

    // Sidebar
    this.sidebar = page.locator('nav, [class*="sidebar"]');
    this.sitesMenu = page.locator('a, button').filter({ hasText: /Sites|My Sites/i });
    this.opsCenterMenu = page.locator('a, button').filter({ hasText: /Ops Center/i });
    this.settingsMenu = page.locator('a, button').filter({ hasText: /Settings/i });
    this.voluumExplorerMenu = page.locator('a, button').filter({ hasText: /Voluum/i });
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await super.goto('/');
    // Wait for the page to be loaded
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for sidebar to be loaded - look for the nav element
    await this.page.waitForSelector('nav', { timeout: 15000 }).catch(() => {
      // Fallback: wait for any button element to be visible
      return this.page.waitForSelector('button', { timeout: 15000 });
    });
  }

  /**
   * Click the LP Wizard link in the sidebar to start the wizard
   * The wizard is accessed via the sidebar with the lightning bolt icon and "LP Wizard" text
   */
  async startCreateLP() {
    // Prefer accessible name: sidebar may be collapsed (no visible "LP Wizard" text, only icon)
    const mainNav = this.page.getByRole('navigation', { name: /FusionOps main/i });
    const lpWizard = mainNav.getByRole('button', { name: /^LP Wizard$/i });
    await lpWizard.click();
  }

  /**
   * Navigate to Sites page
   */
  async goToSites() {
    await this.sitesMenu.click();
  }

  /**
   * Navigate to Ops Center
   */
  async goToOpsCenter() {
    await this.opsCenterMenu.click();
  }

  /**
   * Navigate to Settings
   */
  async goToSettings() {
    await this.settingsMenu.click();
  }

  /**
   * Navigate to Voluum Explorer
   */
  async goToVoluumExplorer() {
    await this.voluumExplorerMenu.click();
  }

  /**
   * Get the number of sites displayed
   */
  async getSiteCount(): Promise<number> {
    return await this.siteCard.count();
  }

  /**
   * Check if dashboard is loaded
   */
  async isLoaded(): Promise<boolean> {
    return await this.createLPButton.isVisible();
  }
}
