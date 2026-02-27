import { Page, Locator } from '@playwright/test';
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

    // Main create button
    this.createLPButton = page.getByRole('button').filter({ hasText: /Create|New LP/i });

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
    // The sidebar has a button with the text "LP Wizard"
    const lpWizardLink = this.page.locator('nav button').filter({ hasText: /LP Wizard/i });

    // Also try by icon if text doesn't work
    if (!(await lpWizardLink.isVisible())) {
      const sidebarButtons = this.page.locator('nav button, nav a');
      const count = await sidebarButtons.count();

      for (let i = 0; i < count; i++) {
        const text = await sidebarButtons.nth(i).textContent();
        if (text?.includes('LP Wizard') || text?.includes('Create')) {
          await sidebarButtons.nth(i).click();
          return;
        }
      }
    }

    await lpWizardLink.click();
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
