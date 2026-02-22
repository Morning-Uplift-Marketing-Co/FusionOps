# E2E Tests for LP Factory

End-to-end tests for the LP Factory web application using Playwright.

## Test Structure

```
tests/e2e/
├── wizard/                  # Wizard flow tests
│   └── wizard-flow.spec.ts  # Complete wizard journey tests
├── sites/                   # Sites management tests
│   └── sites-management.spec.ts
├── dashboard/               # Dashboard tests
│   └── dashboard.spec.ts
├── settings/                # Settings page tests
│   └── settings.spec.ts
├── deploy/                  # Deploy flow tests
│   └── deploy-flow.spec.ts
├── fixtures/                # Test fixtures
│   └── fixtures.ts
├── utils/                   # Test utilities
│   └── test-helpers.ts
└── global-setup.ts          # Global test setup
```

## Running Tests

### Run all tests
```bash
npx playwright test
```

### Run specific test file
```bash
npx playwright test tests/e2e/wizard/wizard-flow.spec.ts
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests with UI mode
```bash
npx playwright test --ui
```

### Show HTML report
```bash
npx playwright show-report test-artifacts/playwright-report
```

### Update snapshots
```bash
npx playwright test --update-snapshots
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run tests with trace
```bash
npx playwright test --trace on
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Base URL for tests | `http://localhost:4323` |
| `CI` | Set to 'true' in CI | `false` |
| `DEBUG` | Set to 'true' for debug mode | `false` |
| `UPDATE_SNAPSHOTS` | Update visual snapshots | `false` |

## Test Coverage

### Wizard Flow (`wizard/wizard-flow.spec.ts`)
- Step 1: Brand and Domain selection
- Step 2: Product Configuration
- Step 3: Design Selection (colors, fonts, layout)
- Step 4: Copy & Content
- Step 5: Tracking & Conversion
- Step 6: Review & Build
- Full wizard completion
- Validation error handling

### Sites Management (`sites/sites-management.spec.ts`)
- Sites list display
- Search and filter functionality
- Site creation
- Site editing
- Site deletion
- Deploy dropdown interaction
- Download options
- Preview modal
- Bulk actions

### Dashboard (`dashboard/dashboard.spec.ts`)
- Dashboard metrics display
- Quick actions
- Recent sites
- System health indicators
- Risk alerts
- Navigation

### Settings (`settings/settings.spec.ts`)
- Database configuration (Neon, D1)
- AI provider setup (Anthropic, Gemini)
- Deploy target configuration (CF, Netlify, Vercel, AWS, VPS, Git)
- External services (LeadingCards, Multilogin)
- Connection testing

### Deploy Flow (`deploy/deploy-flow.spec.ts`)
- Deploy dropdown interaction
- Target display and configuration status
- Deploy action initiation
- Deploy status checking
- Multiple target support
- Download options

## Test Helpers

### AppHelpers
General application navigation and interaction helpers.

```typescript
const app = new AppHelpers(page);
await app.navigateTo('dashboard');
await app.waitForAppReady();
await app.screenshot('dashboard');
```

### WizardHelpers
Wizard-specific flow helpers.

```typescript
const wizard = new WizardHelpers(page);
await wizard.completeWizard({
  brand: 'Test Brand',
  domain: 'test.com',
  redirectUrl: 'https://example.com/apply'
});
```

### SitesHelpers
Sites page helpers.

```typescript
const sites = new SitesHelpers(page);
const count = await sites.getSiteCount();
await sites.searchSites('test');
await sites.deleteSiteByBrand('TestBrand');
```

### TestDataGenerator
Generate test data.

```typescript
const data = TestDataGenerator.validWizardData();
const minimal = TestDataGenerator.minimalWizardData();
const brand = TestDataGenerator.randomBrand();
```

## Writing New Tests

1. Create a new test file in the appropriate directory
2. Import necessary fixtures and helpers
3. Use `test.describe()` to group related tests
4. Use `test.beforeEach()` for common setup
5. Use descriptive test names
6. Add assertions with `expect()`

Example:
```typescript
import { test, expect } from '@playwright/test';
import { AppHelpers, TestDataGenerator } from '../utils/test-helpers';

test.describe('New Feature', () => {
  test('should do something', async ({ page }) => {
    const app = new AppHelpers(page);
    await app.navigateTo('dashboard');
    await app.waitForAppReady();

    // Your test code here
    await expect(page.getByText('Expected Text')).toBeVisible();
  });
});
```

## Troubleshooting

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify `BASE_URL` is correct

### Tests fail to find elements
- Check if application structure has changed
- Update selectors to match current UI
- Use more robust selectors (text-based, data-testid)

### Flaky tests
- Increase wait times
- Use `waitForLoadState('networkidle')`
- Add explicit waits for dynamic content
- Consider using retry mechanism

## CI/CD Integration

Tests are configured to run in CI with:
- 2 retries per test
- Single worker for stability
- Screenshot/video on failure
- HTML report generation

Example GitHub Actions workflow:
```yaml
- name: Run E2E tests
  run: npx playwright test
  env:
    BASE_URL: https://staging.example.com

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-artifacts/playwright-report
```

## Visual Regression Tests

To enable visual regression testing:
1. Set `UPDATE_SNAPSHOTS=true` to capture baseline screenshots
2. Run tests without flag to compare against baseline
3. Review `test-artifacts/screenshots/` for diffs

## Test Reports

After test run, find reports in:
- HTML Report: `test-artifacts/playwright-report/index.html`
- JUnit XML: `test-artifacts/playwright-results.xml`
- JSON Results: `test-artifacts/playwright-results.json`
- Screenshots: `test-artifacts/screenshots/`
- Videos: `test-artifacts/videos/`
- Traces: `test-artifacts/traces/`
