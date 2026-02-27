import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Ops Center component
 */
export class OpsCenterPage {
  readonly page: Page;

  // Tab selectors
  readonly overviewTab: Locator;
  readonly domainsTab: Locator;
  readonly accountsTab: Locator;
  readonly deployTab: Locator;
  readonly cfAccountsTab: Locator;
  readonly profilesTab: Locator;
  readonly paymentsTab: Locator;
  readonly apiAccountsTab: Locator;
  readonly risksTab: Locator;
  readonly logsTab: Locator;

  // Common selectors
  readonly pageTitle: Locator;
  readonly modalOverlay: Locator;
  readonly modalTitle: Locator;
  readonly modalCancelButton: Locator;
  readonly modalSaveButton: Locator;

  // Cloudflare Account Modal
  readonly cfAccountLabelInput: Locator;
  readonly cfAccountIdInput: Locator;
  readonly cfAccountEmailInput: Locator;
  readonly cfAccountApiKeyInput: Locator;

  // Registrar Account Modal
  readonly registrarAccountLabelInput: Locator;
  readonly registrarAccountApiKeyInput: Locator;
  readonly registrarAccountSecretKeyInput: Locator;
  readonly registrarTestConnectionBtn: Locator;

  // Domain Modal
  readonly domainInput: Locator;
  readonly addExistingDomainBtn: Locator;

  // List items
  readonly cfAccountsList: Locator;
  readonly registrarAccountsList: Locator;
  readonly domainsList: Locator;

  constructor(page: Page) {
    this.page = page;

    // Tab selectors - using text content matching
    this.overviewTab = page.getByRole('button').filter({ hasText: 'Overview' });
    this.domainsTab = page.getByRole('button').filter({ hasText: 'Domains' });
    this.accountsTab = page.getByRole('button').filter({ hasText: 'Ads Accounts' });
    this.deployTab = page.getByRole('button').filter({ hasText: 'Deploy' });
    this.cfAccountsTab = page.getByRole('button').filter({ hasText: 'CF Accounts' });
    this.profilesTab = page.getByRole('button').filter({ hasText: 'Profiles' });
    this.paymentsTab = page.getByRole('button').filter({ hasText: 'Payment Methods' });
    this.apiAccountsTab = page.getByRole('button').filter({ hasText: 'API Accounts' });
    this.risksTab = page.getByRole('button').filter({ hasText: 'Risks' });
    this.logsTab = page.getByRole('button').filter({ hasText: 'Audit Logs' });

    // Common selectors
    this.pageTitle = page.getByRole('heading', { name: /Ops Center/ });
    this.modalOverlay = page.locator('div[style*="position: fixed"][style*="inset: 0"]');
    this.modalTitle = page.locator('div[style*="position: fixed"][style*="inset: 0"] h3');
    this.modalCancelButton = page.getByRole('button').filter({ hasText: 'Cancel' });
    this.modalSaveButton = page.getByRole('button').filter({ hasText: 'Save' });

    // Cloudflare Account Modal inputs
    this.cfAccountLabelInput = page.locator('input[placeholder*="CF Account"]');
    this.cfAccountIdInput = page.locator('input[placeholder*="32-character"]');
    this.cfAccountEmailInput = page.locator('input[placeholder*="cf@example.com"]');
    this.cfAccountApiKeyInput = page.locator('input[placeholder="****"]').nth(0);

    // Registrar Account Modal inputs
    this.registrarAccountLabelInput = page.locator('input[placeholder*="Registrar"]');
    this.registrarAccountApiKeyInput = page.locator('input[type="password"]').nth(0);
    this.registrarAccountSecretKeyInput = page.locator('input[type="password"]').nth(1);
    this.registrarTestConnectionBtn = page.getByRole('button').filter({ hasText: 'Test Connection' });

    // Domain Modal
    this.domainInput = page.locator('input[placeholder*="example.com"], input[placeholder*="loanbridge.com"]');
    this.addExistingDomainBtn = page.getByRole('button').filter({ hasText: 'Add Existing Domain' });

    // List items
    this.cfAccountsList = page.locator('div[style*="display: flex"][style*="align-items: center"]').filter({ hasText: /CF/ });
    this.registrarAccountsList = page.locator('div[style*="display: flex"][style*="align-items: center"]');
    this.domainsList = page.locator('div[style*="display: flex"][style*="align-items: center"]');
  }

  /**
   * Navigate to Ops Center page
   * The app uses client-side routing, so we need to click the sidebar button
   */
  async goto() {
    // Navigate to root
    await this.page.goto('/');

    // Wait for page to load - use domcontentloaded instead of networkidle
    // since networkidle can timeout with long-lived connections
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(500);

    // Click on Ops Center in sidebar (use first() to get sidebar button)
    const opsCenterBtn = this.page.getByRole('button').filter({ hasText: /Ops Center/ }).first();
    await opsCenterBtn.click();

    // Wait for Ops Center to load
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for Ops Center to be visible
   */
  async waitForReady() {
    await this.pageTitle.waitFor({ state: 'visible' });
    await expect(this.pageTitle).toContainText('Ops Center');
  }

  /**
   * Click on a specific tab
   */
  async clickTab(tabName: string) {
    const tab = this.page.getByRole('button').filter({ hasText: tabName });
    await tab.click();
    await this.page.waitForTimeout(300); // Brief wait for tab transition
  }

  /**
   * Open Cloudflare Account modal
   * Assumes CF Accounts tab is active or accessible
   */
  async openCfAccountModal() {
    // First navigate to CF Accounts tab
    await this.clickTab('CF Accounts');
    // Look for the add button (we need to find it dynamically)
    const addBtn = this.page.getByRole('button').filter({ hasText: /Add|Cloudflare/ });
    await addBtn.first().click();
  }

  /**
   * Open Registrar Account modal
   */
  async openRegistrarAccountModal() {
    await this.clickTab('API Accounts');
    const addBtn = this.page.getByRole('button').filter({ hasText: /Registrar/ });
    await addBtn.first().click();
  }

  /**
   * Fill and submit Cloudflare Account form
   */
  async fillCfAccountForm(data: { label: string; accountId: string; apiKey: string; email?: string }) {
    await this.cfAccountLabelInput.fill(data.label);
    await this.cfAccountIdInput.fill(data.accountId);
    if (data.email) {
      await this.cfAccountEmailInput.fill(data.email);
    }
    await this.cfAccountApiKeyInput.fill(data.apiKey);
  }

  /**
   * Fill and submit Registrar Account form
   */
  async fillRegistrarAccountForm(data: { label: string; apiKey: string; secretKey: string }) {
    await this.registrarAccountLabelInput.fill(data.label);
    await this.registrarAccountApiKeyInput.fill(data.apiKey);
    await this.registrarAccountSecretKeyInput.fill(data.secretKey);
  }

  /**
   * Click Save button in modal
   */
  async clickSave() {
    await this.modalSaveButton.click();
  }

  /**
   * Click Cancel button in modal
   */
  async clickCancel() {
    await this.modalCancelButton.click();
  }

  /**
   * Wait for modal to close
   */
  async waitForModalClosed() {
    await this.modalOverlay.waitFor({ state: 'hidden' }).catch(() => {});
  }

  /**
   * Get count of displayed CF accounts
   */
  async getCfAccountCount(): Promise<number> {
    await this.clickTab('CF Accounts');
    // Count rows that look like account rows
    const rows = this.page.locator('div[style*="display: flex"][style*="gap: 10px"]');
    return await rows.count();
  }

  /**
   * Get count of displayed domains
   */
  async getDomainCount(): Promise<number> {
    await this.clickTab('Domains');
    const rows = this.page.locator('div[style*="display: flex"][style*="gap: 10px"]');
    return await rows.count();
  }

  /**
   * Take screenshot
   */
  async screenshot(path: string) {
    await this.page.screenshot({ path, fullPage: true, timeout: 10000 }).catch(() => {
      // If screenshot fails, try without fullPage
      this.page.screenshot({ path, timeout: 5000 });
    });
  }

  /**
   * Check if modal is visible
   */
  async isModalVisible(): Promise<boolean> {
    return await this.modalOverlay.isVisible().catch(() => false);
  }

  /**
   * Get modal title text
   */
  async getModalTitle(): Promise<string> {
    return await this.modalTitle.textContent() || '';
  }

  /**
   * Wait for success/error message
   */
  async waitForStatusMessage(timeout = 5000): Promise<string | null> {
    const msgLocator = this.page.locator('div[style*="animation: fadeIn"]');
    try {
      await msgLocator.waitFor({ state: 'visible', timeout });
      return await msgLocator.textContent();
    } catch {
      return null;
    }
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';
