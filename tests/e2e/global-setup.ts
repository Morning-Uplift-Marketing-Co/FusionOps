import { FullConfig } from '@playwright/test';

/**
 * Global test setup
 *
 * Runs once before all tests. Use for:
 * - Setting up test databases
 * - Cleaning test artifacts
 * - Generating test data
 * - Configuring test environment
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test run...');
  console.log(`📁 Test directory: ${config.projects[0].use?.baseURL || 'default'}`);
  console.log(`🌐 Base URL: ${process.env.BASE_URL || 'http://localhost:4323'}`);

  // Clean up previous test artifacts if needed
  // Note: This is handled by the test runner's outputDir configuration

  // Set up any required test infrastructure
  // For example: test database, mock servers, etc.

  // You can also generate test data here
  // await setupTestData();

  console.log('✅ Global setup complete');
}

export default globalSetup;

/**
 * Optional: Global teardown can be added as a separate file
 * and referenced in playwright.config.ts if needed
 */
