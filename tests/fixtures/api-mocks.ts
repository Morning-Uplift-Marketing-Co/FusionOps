/**
 * API mock fixtures for Ops Center E2E tests
 */

export const mockCfAccountData = {
  id: 'cf-mock-123',
  label: 'Test CF Account',
  email: 'test@example.com',
  account_id: 'abcdef1234567890abcdef1234567890',
  api_key: 'test-api-key-1234567890',
  createdAt: new Date().toISOString(),
};

export const mockRegistrarAccountData = {
  id: 'reg-mock-456',
  provider: 'internetbs',
  label: 'Test Registrar Account',
  api_key: 'test-registrar-api-key',
  secret_key: 'test-secret-key-123',
  createdAt: new Date().toISOString(),
};

export const mockDomainData = {
  id: 'dom-mock-789',
  domain: 'test-example.com',
  registrar: 'internetbs',
  status: 'active',
  createdAt: new Date().toISOString(),
};

export const mockApiResponse = {
  success: true,
  data: mockCfAccountData,
};

export const mockCfValidationResponse = {
  success: true,
  id: 'abcdef1234567890abcdef1234567890',
  name: 'Test Account',
};

export const mockRegistrarTestResponse = {
  status: 'SUCCESS',
  balance: '100.00',
};

/**
 * Route handler for mocking CF account API POST
 */
export function mockCfAccountApiPost(route: any) {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: mockCfAccountData }),
  });
}

/**
 * Route handler for mocking registrar account API POST
 */
export function mockRegistrarAccountApiPost(route: any) {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: mockRegistrarAccountData }),
  });
}

/**
 * Route handler for mocking Cloudflare API validation
 */
export function mockCfApiValidation(route: any) {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      result: {
        id: 'abcdef1234567890abcdef1234567890',
        name: 'Test Account',
      },
    }),
  });
}

/**
 * Route handler for mocking Internet.bs balance check
 */
export function mockRegistrarBalanceCheck(route: any) {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockRegistrarTestResponse),
  });
}

/**
 * Get all API routes to mock for Ops Center tests
 */
export const apiRoutesToMock = [
  '**/api/cf-accounts',
  '**/api/registrar-accounts',
  '**/api.cloudflare.com/**',
  '**/api.internet.bs/**',
];
