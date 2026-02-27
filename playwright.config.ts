import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * This configuration sets up:
 * - Test directory location
 * - Parallel execution settings
 * - Reporting (HTML, JUnit, JSON)
 * - Screenshot and video capture
 * - Trace collection
 * - Local dev server startup
 * - Browser and device configurations
 *
 * Environment Variables:
 * - BASE_URL: The base URL for tests (default: http://localhost:4323)
 * - CI: Set to 'true' in CI environment (affects retries and parallelism)
 * - UPDATE_SNAPSHOTS: Set to 'true' to update visual snapshots
 * - DEBUG: Set to 'true' to run tests in headed mode with debug logs
 */

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Fully parallel test execution
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers in CI for stable resource usage
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    // HTML report with screenshots and traces
    ['html', {
      outputFolder: 'test-artifacts/playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    // JUnit XML for CI integration
    ['junit', {
      outputFile: 'test-artifacts/playwright-results.xml',
      stripANSIControlSequences: true
    }],
    // JSON for custom reporting
    ['json', {
      outputFile: 'test-artifacts/playwright-results.json'
    }],
    // Console output
    ['list', { printSteps: true }]
  ],

  // Global setup and teardown
  // globalSetup: require.resolve('./tests/e2e/global-setup.ts'),

  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:4323',

    // Collect trace when retrying the test for the first time
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',

    // Screenshot settings
    screenshot: process.env.UPDATE_SNAPSHOTS ? 'only-on-failure' : 'only-on-failure',

    // Video recording
    video: process.env.CI ? 'retain-on-failure' : 'off',

    // Action timeout (how long to wait for an action to complete)
    actionTimeout: 15 * 1000,

    // Navigation timeout (how long to wait for page navigation)
    navigationTimeout: 30 * 1000,

    // Test timeout
    timeout: 60 * 1000,

    // Locale for tests
    locale: 'en-US',

    // Timezone for tests
    timezoneId: 'America/New_York',

    // Ignore HTTPS errors for local testing
    ignoreHTTPSErrors: !process.env.CI,

    // Capture console output
    // captureConsole: true, // Enable if needed for debugging
  },

  // Projects define different test configurations
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific settings
        launchOptions: {
          args: process.env.DEBUG ? ['--start-maximized'] : []
        },
        // Context options
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // Mobile tests
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },

    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
      },
    },

    // Tablet tests
    {
      name: 'Tablet',
      use: {
        ...devices['iPad Pro'],
      },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4323',
    reuseExistingServer: !process.env.CI,
    timeout: 240 * 1000, // 4 minutes
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Set environment variables for the dev server
      NODE_ENV: 'test',
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-artifacts/test-results',

  // Test timeout
  timeout: 60 * 1000,

  // Expect settings
  expect: {
    // Timeout for assertions
    timeout: 5 * 1000,

    // Take screenshot on failure
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },

    // Take screenshot on failure
    toMatchSnapshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
});
