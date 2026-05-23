import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * WizardPage - Page Object for the LP Creation Wizard
 *
 * Based on Wizard.jsx component with 6 steps:
 * 1. Brand (StepBrand.jsx)
 * 2. Product (StepProduct.jsx)
 * 3. Design + Template selection (StepDesign.jsx)
 * 4. Copy (StepCopy.jsx)
 * 5. Tracking (StepTracking.jsx)
 * 6. Review (StepReview.jsx)
 */
export class WizardPage extends BasePage {
  // Header
  readonly title: Locator;
  readonly stepIndicator: Locator;
  readonly progressBar: Locator;

  // Step labels
  readonly stepLabel: Locator;

  // Navigation buttons
  readonly cancelButton: Locator;
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly buildButton: Locator;

  // Validation
  readonly validationErrors: Locator;

  // Step 1: Brand
  readonly brandNameInput: Locator;
  readonly domainInput: Locator;
  readonly taglineInput: Locator;
  readonly emailInput: Locator;

  // Step 2: Product
  readonly loanTypeButtons: Locator;
  readonly amountPresetButtons: Locator;
  readonly amountMinInput: Locator;
  readonly amountMaxInput: Locator;
  readonly aprMinInput: Locator;
  readonly aprMaxInput: Locator;

  // Step 3: Template + Design
  readonly templateCards: Locator;
  readonly categoryButtons: Locator;
  readonly selectedTemplateSummary: Locator;

  // Step 3: Design controls
  readonly templateSelectorButtons: Locator;
  readonly colorSchemeButtons: Locator;
  readonly fontButtons: Locator;
  readonly layoutButtons: Locator;
  readonly radiusButtons: Locator;
  readonly trustBadgeButtons: Locator;
  readonly generateAssetsButton: Locator;

  // Step 4: Copy
  readonly copyTemplateButtons: Locator;
  readonly aiGenerateButton: Locator;
  readonly h1Input: Locator;
  readonly badgeInput: Locator;
  readonly ctaInput: Locator;
  readonly subInput: Locator;
  readonly metaTitleInput: Locator;
  readonly metaDescTextarea: Locator;
  readonly aiMetaButton: Locator;
  readonly languageButtons: Locator;

  // Step 5: Tracking
  readonly trackingModeMinimal: Locator;
  readonly trackingModeVoluum: Locator;
  readonly voluumCampaignSelect: Locator;
  readonly voluumRefreshButton: Locator;
  readonly voluumCreateButton: Locator;
  readonly googleAdsConversionInput: Locator;
  readonly formStartLabelInput: Locator;
  readonly formSubmitLabelInput: Locator;
  readonly affiliateNetworkButtons: Locator;
  readonly leadsGateAidInput: Locator;
  readonly redirectUrlInput: Locator;
  readonly formEmbedTextarea: Locator;

  // Step 6: Review
  readonly configurationSummary: Locator;
  readonly astroProjectButton: Locator;
  readonly astroFileTree: Locator;

  // Preview
  readonly mobilePreview: Locator;
  readonly previewFrame: Locator;

  constructor(page: Page) {
    super(page);

    // Header elements
    this.title = page.getByText(/Create New LP|Create New Campaign/i);
    this.stepIndicator = page.getByText(/Step \d\/6/i);
    this.progressBar = page.getByText(/Step \d\/6/i).locator('xpath=..');
    this.stepLabel = page.locator('.text-[hsl(var(--muted-foreground))], text=/Brand|Product|Design|Copy|Tracking|Review/i');

    // Navigation
    this.cancelButton = page.getByRole('button').filter({ hasText: /Cancel|Back/i }).first();
    this.backButton = page.getByRole('button').filter({ hasText: /Back|←/i });
    this.nextButton = page.getByRole('button').filter({ hasText: /Next|→/i });
    this.buildButton = page.getByRole('button').filter({ hasText: /Build|Save|Update/i });

    // Validation errors
    this.validationErrors = page.locator('[class*="destructive"]').or(page.getByText(/⚠️|Please fix|required/i));

    // Step 1: Brand
    this.brandNameInput = page.locator('input').filter({ hasText: '' }).nth(0);
    this.domainInput = page.locator('input').filter({ hasText: '' }).nth(1);
    this.taglineInput = page.locator('input').filter({ hasText: '' }).nth(2);
    this.emailInput = page.locator('input').filter({ hasText: '' }).nth(3);

    // Step 2: Product
    this.loanTypeButtons = page.locator('button').filter({ hasText: /Personal|Installment|PDL/i });
    this.amountPresetButtons = page.locator('button').filter({ hasText: /\\$[0-9]+[KM]?–\\$[0-9]+[KM]?/i });
    this.amountMinInput = page.locator('input[type="number"]').nth(0);
    this.amountMaxInput = page.locator('input[type="number"]').nth(1);
    this.aprMinInput = page.locator('input[type="number"]').nth(2);
    this.aprMaxInput = page.locator('input[type="number"]').nth(3);

    // Step 3: Template
    this.templateCards = page.locator('button').filter({ hasText: /Classic|PDL|Pet|Elastic/i });
    this.categoryButtons = page.locator('button').filter({ hasText: /All|Loan|Pet|Custom/i });
    this.selectedTemplateSummary = page.locator('text=/Selected/');

    // Step 4: Design
    this.colorSchemeButtons = page.locator('button').filter({ hasText: /Ocean|Forest|Midnight|Ruby|Slate|Rose/i });
    this.fontButtons = page.locator('button').filter({ hasText: /DM Sans|Inter|Outfit|Poppins/i });
    this.layoutButtons = page.locator('button').filter({ hasText: /Classic|Modern|Compact/i });
    this.radiusButtons = page.locator('button').filter({ hasText: /Sharp|Rounded|Pill/i });
    this.trustBadgeButtons = page.locator('button').filter({ hasText: /Cards|Compact|Minimal/i });
    this.generateAssetsButton = page.getByRole('button').filter({ hasText: /Generate.*Favicon|Generate.*OG/i });

    // Step 5: Copy
    this.copyTemplateButtons = page.locator('button').filter({ hasText: /QuickFund|LoanBridge|ElasticCredits/i });
    this.aiGenerateButton = page.getByRole('button').filter({ hasText: /Generate AI Copy|AI Copy/i });
    this.h1Input = page.locator('input[placeholder*="Get"], input[placeholder*="Cash"], input[placeholder*="Headline"]');
    this.badgeInput = page.locator('input').filter({ hasText: '' }).first();
    this.ctaInput = page.locator('input[placeholder*="Check"], input[placeholder*="Apply"], input[placeholder*="CTA"]');
    this.subInput = page.locator('input[placeholder*="approved"], input[placeholder*="Sub"]');
    this.metaTitleInput = page.locator('input[placeholder*="Meta Title"]');
    this.metaDescTextarea = page.locator('textarea[placeholder*="Meta Description"]');
    this.aiMetaButton = page.getByRole('button').filter({ hasText: /AI Gen Meta/i });
    this.languageButtons = page.locator('button').filter({ hasText: /English|Spanish|German|French|Italian/i });

    // Step 6: Tracking
    this.trackingModeMinimal = page.getByRole('button').filter({ hasText: /Minimal Stack/i });
    this.trackingModeVoluum = page.getByRole('button').filter({ hasText: /Voluum Stack/i });
    this.voluumCampaignSelect = page.locator('select, [role="combobox"]');
    this.voluumRefreshButton = page.getByRole('button').filter({ hasText: /Refresh campaigns/i });
    this.voluumCreateButton = page.getByRole('button').filter({ hasText: /Create new campaign/i });
    this.googleAdsConversionInput = page.locator('input[placeholder*="AW-"]');
    this.formStartLabelInput = page.locator('input[placeholder*="AbCdEfGhIjK"]');
    this.formSubmitLabelInput = page.locator('input[placeholder*="XyZaBcDeFgH"]');
    this.affiliateNetworkButtons = page.locator('button').filter({ hasText: /LeadsGate|ZeroParallel|LeadStack/i });
    this.leadsGateAidInput = page.locator('input[placeholder*="14881"]');
    this.redirectUrlInput = page.locator('input[placeholder*="https"], input[placeholder*="Offer"]');
    this.formEmbedTextarea = page.locator('textarea[placeholder*="embed"]');

    // Step 7: Review
    this.configurationSummary = page.locator('text=/Configuration/i');
    this.astroProjectButton = page.getByRole('button').filter({ hasText: /Astro Project/i });
    this.astroFileTree = page.getByText(/\.astro|\.css|package\.json/i).first();

    // Preview
    this.mobilePreview = page.locator('[class*="mock-phone"], [class*="preview"], iframe');
    this.previewFrame = page.locator('iframe[title*="preview"]');
  }

  /**
   * Navigate directly to wizard page
   */
  async goto() {
    await super.goto('/');
    // Wizard is a state, not a route - need to click create button
    const dashboard = await this.importDashboardPage();
    await dashboard.startCreateLP();
    await this.waitForWizardToLoad();
  }

  /**
   * Wait for wizard to be visible
   */
  async waitForWizardToLoad() {
    await expect(this.title).toBeVisible({ timeout: 15000 });
    await expect(this.stepIndicator).toBeVisible();
  }

  /**
   * Get current step number
   */
  async getCurrentStep(): Promise<number> {
    const text = await this.stepIndicator.textContent();
    const match = text?.match(/Step (\d)\/6/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Click Next button
   */
  async clickNext() {
    await this.nextButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click Back button
   */
  async clickBack() {
    // Handle confirm dialog that appears when wizard has unsaved changes
    this.page.once('dialog', dialog => dialog.accept());
    await this.backButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click Cancel button
   */
  async clickCancel() {
    await this.cancelButton.click();
  }

  /**
   * Click Build & Save button
   */
  async clickBuild() {
    await this.buildButton.click();
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errors: string[] = [];
    const count = await this.validationErrors.count();
    for (let i = 0; i < count; i++) {
      const text = await this.validationErrors.nth(i).textContent();
      if (text) errors.push(text);
    }
    return errors;
  }

  /**
   * Complete Step 1: Brand
   */
  async completeStepBrand(data: {
    brand: string;
    domain: string;
    tagline?: string;
    email?: string;
  }) {
    // Use triple-click to select all before filling to clear pre-existing values
    const inputs = this.page.locator('input');
    await inputs.nth(0).click({ clickCount: 3 });
    await inputs.nth(0).fill(data.brand);
    await inputs.nth(1).click({ clickCount: 3 });
    await inputs.nth(1).fill(data.domain);

    if (data.tagline) {
      await inputs.nth(2).click({ clickCount: 3 });
      await inputs.nth(2).fill(data.tagline);
    }
    if (data.email) {
      await inputs.nth(3).click({ clickCount: 3 });
      await inputs.nth(3).fill(data.email);
    }
  }

  /**
   * Complete Step 2: Product
   */
  async completeStepProduct(data: { loanType?: string } = {}) {
    if (data.loanType) {
      const loanButton = this.loanTypeButtons.filter({ hasText: data.loanType });
      if (await loanButton.isVisible()) {
        await loanButton.click();
      }
    } else {
      const firstLoan = this.loanTypeButtons.first();
      if (await firstLoan.isVisible()) {
        await firstLoan.click();
      }
    }
  }

  /**
   * Complete Step 3: Template selection within the combined design step
   */
  async completeStepTemplate(templateName?: string) {
    if (templateName) {
      const templateButton = this.templateCards.filter({ hasText: templateName });
      if (await templateButton.isVisible()) {
        await templateButton.click();
      }
    } else {
      // Click first template card (Classic LP)
      const firstTemplate = this.templateCards.first();
      if (await firstTemplate.isVisible()) {
        await firstTemplate.click();
      }
    }
  }

  /**
   * Complete Step 3: Design controls within the combined design step
   */
  async completeStepDesign(data: {
    colorScheme?: string;
    font?: string;
  } = {}) {
    if (data.colorScheme) {
      const colorButton = this.colorSchemeButtons.filter({ hasText: data.colorScheme });
      if (await colorButton.isVisible()) {
        await colorButton.click();
      }
    } else {
      // Select first color scheme (Ocean)
      const firstColor = this.colorSchemeButtons.first();
      if (await firstColor.isVisible()) {
        await firstColor.click();
      }
    }

    // Auto-generated assets happen automatically, no need to click
  }

  /**
   * Complete Step 4: Copy
   */
  async completeStepCopy(data: {
    h1?: string;
    badge?: string;
    cta?: string;
    sub?: string;
    useTemplate?: boolean;
  } = {}) {
    // Use a quick-start template for convenience
    if (data.useTemplate !== false) {
      const firstTemplate = this.copyTemplateButtons.first();
      if (await firstTemplate.isVisible()) {
        await firstTemplate.click();
        await this.page.waitForTimeout(300);
      }
    }

    // Optionally override specific fields
    const inputs = this.page.locator('input');
    const inputCount = await inputs.count();

    if (data.h1 && inputCount > 0) {
      await inputs.nth(0).fill(data.h1);
    }
    if (data.badge && inputCount > 1) {
      await inputs.nth(1).fill(data.badge);
    }
    if (data.cta && inputCount > 2) {
      await inputs.nth(2).fill(data.cta);
    }
    if (data.sub && inputCount > 3) {
      await inputs.nth(3).fill(data.sub);
    }
  }

  /**
   * Complete Step 5: Tracking
   */
  async completeStepTracking(data: {
    mode?: 'minimal' | 'voluum';
    conversionId?: string;
    formStartLabel?: string;
    formSubmitLabel?: string;
    aid?: string;
    redirectUrl?: string;
  } = {}) {
    // Set tracking mode (default minimal)
    const mode = data.mode || 'minimal';
    if (mode === 'minimal') {
      const minimalBtn = this.trackingModeMinimal;
      if (await minimalBtn.isVisible()) {
        await minimalBtn.click();
      }
    } else {
      const voluumBtn = this.trackingModeVoluum;
      if (await voluumBtn.isVisible()) {
        await voluumBtn.click();
      }
    }

    // Fill Google Ads Conversion ID
    if (data.conversionId) {
      const convInput = this.page.locator('input').filter({ hasText: '' }).first();
      if (await convInput.isVisible()) {
        await convInput.fill(data.conversionId);
      }
    }

    // Fill AID if provided
    if (data.aid) {
      const aidInput = this.page.locator('input[placeholder*="14881"], input[type="number"]');
      const aidCount = await aidInput.count();
      for (let i = 0; i < aidCount; i++) {
        await aidInput.nth(i).fill(data.aid);
        break; // Only fill first visible
      }
    }

    // Fill redirect URL if provided
    if (data.redirectUrl) {
      const redirectInput = this.redirectUrlInput;
      if (await redirectInput.isVisible()) {
        await redirectInput.fill(data.redirectUrl);
      }
    }
  }

  /**
   * Complete all wizard steps with minimal data
   */
  async completeMinimalWizard() {
    // Step 1: Brand
    await this.completeStepBrand({
      brand: 'Minimal Test LP',
      domain: 'minimaltestlp.com',
    });
    await this.clickNext();

    // Step 2: Product (loan type only; amounts use wizard defaults)
    await this.completeStepProduct();
    await this.clickNext();

    // Step 3: Combined template + design
    await this.completeStepTemplate();
    await this.completeStepDesign();
    await this.clickNext();

    // Step 4: Copy
    await this.completeStepCopy();
    await this.clickNext();

    // Step 5: Tracking
    await this.completeStepTracking({
      conversionId: 'AW-123456789',
    });
    await this.clickNext();

    // Step 6: Review
    await expect(this.configurationSummary).toBeVisible();
  }

  /**
   * Helper to import DashboardPage (avoid circular dependency)
   */
  private async importDashboardPage() {
    const { DashboardPage } = await import('./DashboardPage');
    return new DashboardPage(this.page);
  }
}
