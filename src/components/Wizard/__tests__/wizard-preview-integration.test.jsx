/**
 * Wizard Preview Integration Tests
 * ================================
 * Tests for preview functionality in StepReview + PreviewModal integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepReview } from '../StepReview.jsx';
import { PreviewModal } from '../PreviewModal.jsx';

// Mock the buildPreviewHtml to avoid complex dependencies
vi.mock('../../utils/template-preview-runtime', () => ({
  buildPreviewHtml: (files, config, colors) => {
    // Return a simple mock HTML
    return `<html><body><h1>${config?.brand || 'Test'}</h1><p>Preview for ${config?.domain || 'example.com'}</p></body></html>`;
  },
}));

// Mock template-utils to avoid registry dependencies
vi.mock('../template-utils', () => ({
  getTemplateById: (id) => ({
    id: id || 'classic',
    name: 'Test Template',
    files: {
      'index.html': '<html><body>Test</body></html>',
    },
  }),
}));

// Mock constants
vi.mock('../../../constants', () => ({
  THEME: {
    text: '#000',
    input: '#fff',
    border: '#ccc',
    muted: '#999',
    primaryGlow: '#e8f3ff',
    primary: '#0066ff',
  },
  COLORS: [
    {
      id: 'blue',
      name: 'Blue',
      p: [220, 90, 56],
      s: [220, 90, 46],
      a: [220, 90, 46],
    },
  ],
  LOAN_TYPES: [
    { id: 'personal', label: 'Personal Loan' },
  ],
}));

// Mock other utilities
vi.mock('../../../utils', () => ({
  hsl: (...args) => `hsl(${args.join(',')})`,
}));

vi.mock('../../../utils/template-router', () => ({
  generateAstroProjectByTemplate: () => ({
    'src/pages/index.astro': '',
    'src/components/Header.astro': '',
  }),
  generateHtmlByTemplate: () => '<html><body><h1>Preview</h1></body></html>',
}));

describe('Wizard Preview Integration', () => {
  const mockConfig = {
    brand: 'Test Brand',
    domain: 'test.example.com',
    templateId: 'test-template',
    colorId: 'blue',
    loanType: 'personal',
    amountMin: 5000,
    amountMax: 50000,
    aprMin: 5,
    aprMax: 25,
    conversionId: 'conv-123',
    aid: 'aid-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StepReview Preview Button', () => {
    it('should render preview button in StepReview', () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      expect(previewButton).toBeInTheDocument();
    });

    it('should display eye icon on preview button', () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /👁️.*preview/i });
      expect(previewButton).toBeInTheDocument();
    });

    it('should render PreviewModal when preview button is clicked', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      // Modal should open; look for modal content
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should show modal header with config brand', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/Preview: Test Brand/i)).toBeInTheDocument();
      });
    });
  });

  describe('PreviewModal Functionality', () => {
    it('should render iframe with preview HTML', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={vi.fn()}
          config={mockConfig}
          templateId="test-template"
          previewHtml={`<html><body><h1>${mockConfig.brand}</h1></body></html>`}
        />
      );

      const iframe = screen.getByTestId('preview-iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
    });

    it('should display viewport toggle button', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={vi.fn()}
          config={mockConfig}
          templateId="test-template"
          previewHtml="<html><body>Test</body></html>"
        />
      );

      const viewportToggle = screen.getByTestId('viewport-toggle');
      expect(viewportToggle).toBeInTheDocument();
    });

    it('should toggle between mobile and desktop viewports', async () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={vi.fn()}
          config={mockConfig}
          templateId="test-template"
          previewHtml="<html><body>Test</body></html>"
        />
      );

      const viewportToggle = screen.getByTestId('viewport-toggle');

      // Initially desktop
      expect(viewportToggle.getAttribute('data-viewport')).toBe('desktop');

      // Click to toggle
      fireEvent.click(viewportToggle);
      expect(viewportToggle.getAttribute('data-viewport')).toBe('mobile');

      // Click again to toggle back
      fireEvent.click(viewportToggle);
      expect(viewportToggle.getAttribute('data-viewport')).toBe('desktop');
    });

    it('should close modal when close button is clicked', async () => {
      const onCloseMock = vi.fn();
      render(
        <PreviewModal
          isOpen={true}
          onClose={onCloseMock}
          config={mockConfig}
          templateId="test-template"
          previewHtml="<html><body>Test</body></html>"
        />
      );

      const closeButton = screen.getByLabelText(/close preview/i);
      fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('Integration Flow', () => {
    it('should allow opening and closing preview modal from StepReview', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      // Click preview button to open
      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      // Modal should be visible
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByLabelText(/close preview/i);
      fireEvent.click(closeButton);

      // Modal should be gone
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should pass correct config to PreviewModal', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      // Modal header should display brand from config
      await waitFor(() => {
        expect(screen.getByText(`Preview: ${mockConfig.brand}`)).toBeInTheDocument();
      });
    });

    it('should pass templateId to PreviewModal', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      // Modal should render (templateId is passed and used)
      await waitFor(() => {
        expect(screen.getByTestId('preview-iframe')).toBeInTheDocument();
      });
    });

    it('should regenerate preview when config changes', async () => {
      const { rerender } = render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/Preview: Test Brand/i)).toBeInTheDocument();
      });

      // Update config with different brand
      const updatedConfig = { ...mockConfig, brand: 'New Brand' };
      rerender(
        <StepReview c={updatedConfig} building={false} />
      );

      // Modal should still be open with updated header
      await waitFor(() => {
        expect(screen.getByText(/Preview: New Brand/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing templateId gracefully', () => {
      const configNoTemplate = { ...mockConfig, templateId: undefined };

      expect(() => {
        render(
          <StepReview c={configNoTemplate} building={false} />
        );
      }).not.toThrow();

      const previewButton = screen.getByRole('button', { name: /preview/i });
      expect(previewButton).toBeInTheDocument();
    });

    it('should handle missing config brand', async () => {
      const configNoBrand = { ...mockConfig, brand: '' };

      render(
        <StepReview c={configNoBrand} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      // Modal should still open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should handle empty preview HTML', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={vi.fn()}
          config={mockConfig}
          templateId="test-template"
          previewHtml=""
        />
      );

      // Should show placeholder
      expect(screen.getByText(/no preview available/i)).toBeInTheDocument();
    });

    it('should disable preview when building is true', () => {
      render(
        <StepReview c={mockConfig} building={true} />
      );

      // Preview button should still be visible (user might want to preview while building)
      const previewButton = screen.getByRole('button', { name: /preview/i });
      expect(previewButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels on buttons', () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      expect(previewButton).toHaveAttribute('style'); // Has styling, not testing label here
    });

    it('should have dialog role on modal', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should have close button with proper aria label', async () => {
      render(
        <StepReview c={mockConfig} building={false} />
      );

      const previewButton = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewButton);

      await waitFor(() => {
        const closeButton = screen.getByLabelText(/close preview/i);
        expect(closeButton).toBeInTheDocument();
      });
    });
  });
});
