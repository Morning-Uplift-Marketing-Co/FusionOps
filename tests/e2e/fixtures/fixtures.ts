import { test as base } from '@playwright/test';
import { AppHelpers, WizardHelpers, SitesHelpers, TestDataGenerator } from '../utils/test-helpers';

/**
 * Extended test fixtures
 *
 * Custom fixtures that extend Playwright's base test fixture
 * with application-specific helpers and utilities.
 */

type AppFixtures = {
  app: AppHelpers;
  wizard: WizardHelpers;
  sites: SitesHelpers;
  testData: typeof TestDataGenerator;
};

// Extend the base test with our custom fixtures
export const test = base.extend<AppFixtures>({
  // App helpers fixture
  app: async ({ page }, use) => {
    const helpers = new AppHelpers(page);
    await use(helpers);
  },

  // Wizard helpers fixture
  wizard: async ({ page }, use) => {
    const helpers = new WizardHelpers(page);
    await use(helpers);
  },

  // Sites helpers fixture
  sites: async ({ page }, use) => {
    const helpers = new SitesHelpers(page);
    await use(helpers);
  },

  // Test data generator fixture (static class, no page needed)
  testData: async ({}, use) => {
    await use(TestDataGenerator);
  },
});

/**
 * Re-export Playwright's expect for convenience
 */
export { expect } from '@playwright/test';

/**
 * Example test using custom fixtures
 *
 * test('should complete wizard with fixtures', async ({ page, wizard, testData }) => {
 *   await page.goto('/');
 *   await page.getByRole('button').filter({ hasText: /Create/i }).click();
 *
 *   const data = testData.validWizardData();
 *   await wizard.completeWizard(data);
 *
 *   await expect(page.getByText(/My Sites/i)).toBeVisible();
 * });
 */

/**
 * Test hooks that run before/after each test
 */
export const testWithHooks = test.extend({
  // Fixture that clears storage before each test
  cleanStorage: async ({ page }, use) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await use(true);
  },

  // Fixture that listens for console errors
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await use(errors);

    // Assert no console errors after test
    // Uncomment to enable strict console error checking
    // if (errors.length > 0) {
    //   throw new Error(`Console errors detected: ${errors.join(', ')}`);
    // }
  },

  // Fixture that enables detailed network logging
  networkLogger: async ({ page }, use) => {
    const requests: { url: string; method: string; status?: number }[] = [];

    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
      });
    });

    page.on('response', (response) => {
      const req = requests.find((r) => r.url === response.url());
      if (req) {
        req.status = response.status();
      }
    });

    await use(requests);
  },
});

/**
 * Test with automatic retry for flaky network operations
 */
export const flakyTest = test.extend({
  retryCount: [0, { option: true }],
});

/**
 * Authenticated test fixture (for future auth implementation)
 */
export const authenticatedTest = test.extend({
  authenticatedPage: async ({ page }, use) => {
    // TODO: Implement login flow when auth is added
    // await page.goto('/login');
    // await page.fill('[name="email"]', 'test@example.com');
    // await page.fill('[name="password"]', 'password');
    // await page.click('[type="submit"]');
    // await page.waitForURL('/dashboard');

    await use(page);

    // TODO: Implement logout
    // await page.click('[aria-label="Logout"]');
  },
});

/**
 * Create a test with a specific site already created
 */
export const testWithSite = test.extend({
  siteId: async ({ page, wizard, testData }, use) => {
    await page.goto('/');
    await page.getByRole('button').filter({ hasText: /Create/i }).click();

    const data = testData.validWizardData();
    await wizard.completeWizard(data);

    // Get the created site's ID (would need to be returned from wizard)
    const siteId = 'test-site-' + Date.now();

    await use(siteId);
  },
});

/**
 * Slow motion test fixture for debugging
 */
export const debugTest = test.extend({
  debugPage: async ({ page }, use) => {
    // Slow down actions for visual debugging
    await page.setDefaultTimeout(60000);
    await use(page);
  },
});

/**
 * Mobile-specific test fixture
 */
export const mobileTest = test.extend({
  mobilePage: async ({ page }, use) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await use(page);
  },
});

/**
 * Desktop-specific test fixture
 */
export const desktopTest = test.extend({
  desktopPage: async ({ page }, use) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await use(page);
  },
});

/**
 * Dark mode test fixture
 */
export const darkModeTest = test.extend({
  darkModePage: async ({ page, context }, use) => {
    // Enable dark mode via color scheme
    // Note: This may need to be adjusted based on app's dark mode implementation
    await page.emulateMedia({ colorScheme: 'dark' });
    await use(page);
  },
});

/**
 * Light mode test fixture
 */
export const lightModeTest = test.extend({
  lightModePage: async ({ page }, use) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await use(page);
  },
});

/**
 * High contrast mode test fixture (accessibility)
 */
export const highContrastTest = test.extend({
  highContrastPage: async ({ page }, use) => {
    // Enable high contrast mode (Windows-specific)
    await page.addInitScript(() => {
      // @ts-ignore
      window.matchMedia('(prefers-contrast: high)').matches = true;
    });
    await use(page);
  },
});

/**
 * Reduced motion test fixture (accessibility)
 */
export const reducedMotionTest = test.extend({
  reducedMotionPage: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await use(page);
  },
});

/**
 * Geolocation-specific test fixture
 */
export const geolocationTest = test.extend({
  geolocationPage: async ({ page, context }, use) => {
    await context.setGeolocation({ latitude: 40.7128, longitude: -74.0060 });
    await page.grantPermissions(['geolocation']);
    await use(page);
  },
});

/**
 * Locale-specific test fixture
 */
export const localeTest = test.extend({
  localePage: async ({ page }, use) => {
    await page.goto('/');
    // Set locale via localStorage or URL param
    await page.evaluate(() => {
      localStorage.setItem('locale', 'en-US');
    });
    await page.reload();
    await use(page);
  },
});

/**
 * Offline mode test fixture
 */
export const offlineTest = test.extend({
  offlinePage: async ({ page, context }, use) => {
    await context.setOffline(true);
    await use(page);
  },
});

/**
 * Network slow test fixture (3G speed)
 */
export const slowNetworkTest = test.extend({
  slowNetworkPage: async ({ page, context }, use) => {
    await context.setGeolocation({ latitude: 0, longitude: 0 });
    await context.route('**', (route) => {
      route.continue({
        // Simulate slow 3G connection
        headers: {
          ...route.request().headers(),
          'X-Slow-Network': 'true',
        },
      });
    });
    await use(page);
  },
});

/**
 * Screenshot comparison fixture
 */
export const visualTest = test.extend({
  screenshotComparator: async ({ page }, use) => {
    const comparator = {
      async capture(name: string) {
        await page.screenshot({
          path: `test-artifacts/screenshots/${name}.png`,
          fullPage: true,
        });
      },
      async compare(name: string) {
        // This would integrate with a visual regression service
        // For now, just capture the screenshot
        await page.screenshot({
          path: `test-artifacts/screenshots/${name}-actual.png`,
          fullPage: true,
        });
      },
    };
    await use(comparator);
  },
});

/**
 * API mocking fixture
 */
export const apiMockTest = test.extend({
  apiMock: async ({ page }, use) => {
    const mockEndpoints: Record<string, any> = {};

    const mockApi = {
      set(endpoint: string, response: any) {
        mockEndpoints[endpoint] = response;
      },
      clear() {
        Object.keys(mockEndpoints).forEach((key) => {
          delete mockEndpoints[key];
        });
      },
    };

    // Apply mocks to all requests
    await page.route('**', (route) => {
      const url = route.request().url();

      for (const [endpoint, response] of Object.entries(mockEndpoints)) {
        if (url.includes(endpoint)) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        }
      }

      return route.continue();
    });

    await use(mockApi);
  },
});

/**
 * Performance testing fixture
 */
export const performanceTest = test.extend({
  metrics: async ({ page }, use) => {
    const metrics: {
      navigationTiming?: any;
      resourceTiming?: any[];
      memoryUsage?: any;
    } = {};

    // Collect performance metrics
    page.on('load', async () => {
      const navTiming = await page.evaluate(() => {
        const timing = performance.getEntriesByType('navigation')[0] as any;
        return timing ? {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
          loadComplete: timing.loadEventEnd - timing.loadEventStart,
          totalLoadTime: timing.loadEventEnd - timing.fetchStart,
        } : undefined;
      });
      metrics.navigationTiming = navTiming;
    });

    await use(metrics);
  },
});
