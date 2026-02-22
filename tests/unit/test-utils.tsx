import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { DefaultTheme } from '../src/constants';

// Custom render function with providers
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => <div data-theme="light">{children}</div>,
  });
}

// Re-export everything from testing-library
export { render, screen, waitFor, fireEvent, userEvent } from '@testing-library/react';
export { customRender as renderWithProviders };
export { expect } from 'vitest';

// Mock utilities
export const mockWorkerApi = () => ({
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
  put: vi.fn().mockResolvedValue({}),
  del: vi.fn().mockResolvedValue({}),
});

export const createMockSite = (overrides = {}) => ({
  id: 'test-site-1',
  brand: 'TestBrand',
  domain: 'testbrand.com',
  templateId: 'classic',
  loanType: 'personal',
  amountMin: 100,
  amountMax: 5000,
  aprMin: 5.99,
  aprMax: 35.99,
  colorId: 'ocean',
  fontId: 'dm-sans',
  layout: 'hero-left',
  radius: 'rounded',
  status: 'draft',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockSettings = (overrides = {}) => ({
  apiKey: '',
  neonUrl: '',
  cfApiToken: '',
  cfAccountId: '',
  netlifyToken: '',
  vercelToken: '',
  ...overrides,
});
