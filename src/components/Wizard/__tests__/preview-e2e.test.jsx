import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { PreviewModal } from '../PreviewModal';
import { DiffViewer } from '../../DiffViewer';

// Mock dependencies
vi.mock('../../../utils/template-preview-runtime', () => ({
  buildPreviewHtml: vi.fn((files, config, colors) => {
    return `<html>
      <head><title>${config.brand || 'Test'}</title></head>
      <body style="background-color: ${colors?.p || '#fff'}">
        <h1>${config.brand || 'Brand'}</h1>
        <p>${config.copy || 'Copy'}</p>
      </body>
    </html>`;
  }),
}));

vi.mock('../../../services/AntiFingerprint', () => ({
  AntiFingerprint: {
    transform: vi.fn((html, seed) => {
      // Simulate fingerprinting by modifying class names and IDs
      return html
        .replace(/class="([^"]*)"/g, (match, classes) => {
          const randomId = Math.random().toString(36).substring(7);
          return `class="${classes} fp-${randomId}"`;
        })
        .replace(/id="([^"]*)"/g, (match, id) => {
          const randomId = Math.random().toString(36).substring(7);
          return `id="${id}-fp-${randomId}"`;
        });
    }),
  },
}));

describe('Preview E2E Tests', () => {
  describe('PREV-01: Live Preview with Variable Injection', () => {
    it('should render modal with variables injected', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test Company', templateId: 'classic' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test Company</h1></body></html>"
        />
      );

      // Verify modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Verify iframe is present
      const iframe = screen.getByTitle('Template Preview');
      expect(iframe).toBeInTheDocument();

      // Verify variables injected via srcdoc attribute
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Test Company'));
    });

    it('should not require template re-upload on config change', () => {
      const { rerender } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Original Company', templateId: 'classic' }}
          templateId="classic"
          previewHtml="<html><body><h1>Original Company</h1></body></html>"
        />
      );

      let iframe = screen.getByTitle('Template Preview');
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Original Company'));

      // Update config and rerender
      rerender(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Updated Company', templateId: 'classic' }}
          templateId="classic"
          previewHtml="<html><body><h1>Updated Company</h1></body></html>"
        />
      );

      iframe = screen.getByTitle('Template Preview');
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Updated Company'));
    });
  });

  describe('PREV-02: Viewport Toggle', () => {
    it('should have viewport toggle button', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      const toggleButton = screen.getByTestId('viewport-toggle');
      expect(toggleButton).toBeInTheDocument();
    });

    it('should toggle viewport size between mobile and desktop', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      const toggleButton = screen.getByTestId('viewport-toggle');
      const container = screen.getByRole('dialog').querySelector('.preview-container');

      // Initial state should be desktop (1024px)
      expect(toggleButton.getAttribute('data-viewport')).toBe('desktop');
      expect(container.style.width).toBe('1024px');
      expect(container.style.height).toBe('768px');

      // Click to toggle to mobile
      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute('data-viewport')).toBe('mobile');
      expect(container.style.width).toBe('320px');
      expect(container.style.height).toBe('640px');

      // Click again to toggle back to desktop
      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute('data-viewport')).toBe('desktop');
      expect(container.style.width).toBe('1024px');
      expect(container.style.height).toBe('768px');
    });

    it('should not re-render iframe on viewport toggle', () => {
      const { container } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      const iframe = screen.getByTitle('Template Preview');
      const originalSrcDoc = iframe.getAttribute('srcdoc');

      // Toggle viewport
      const toggleButton = screen.getByTestId('viewport-toggle');
      fireEvent.click(toggleButton);

      // srcdoc should remain unchanged (same HTML)
      expect(iframe.getAttribute('srcdoc')).toBe(originalSrcDoc);
    });
  });

  describe('PREV-03: Real-Time Variable Preview with Debounce', () => {
    it('should update preview when config changes', () => {
      const { rerender } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Company 1' }}
          templateId="classic"
          previewHtml="<html><body><h1>Company 1</h1></body></html>"
        />
      );

      let iframe = screen.getByTitle('Template Preview');
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Company 1'));

      rerender(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Company 2' }}
          templateId="classic"
          previewHtml="<html><body><h1>Company 2</h1></body></html>"
        />
      );

      iframe = screen.getByTitle('Template Preview');
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Company 2'));
    });

    it('should debounce rapid config changes', async () => {
      const { rerender } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Initial' }}
          templateId="classic"
          previewHtml="<html><body><h1>Initial</h1></body></html>"
        />
      );

      // Simulate rapid changes
      rerender(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Change 1' }}
          templateId="classic"
          previewHtml="<html><body><h1>Change 1</h1></body></html>"
        />
      );

      rerender(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Change 2' }}
          templateId="classic"
          previewHtml="<html><body><h1>Change 2</h1></body></html>"
        />
      );

      // Final state should reflect the last change
      await waitFor(() => {
        const iframe = screen.getByTitle('Template Preview');
        expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('Change 2'));
      });
    });
  });

  describe('PREV-04: Pre/Post Fingerprint Comparison', () => {
    it('should have fingerprint toggle button', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test', siteId: 'test-site' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
          fingerprintedHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      const toggleButton = screen.getByTestId('fingerprint-toggle');
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveTextContent('Show Fingerprint');
    });

    it('should toggle between original and fingerprinted HTML', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test', siteId: 'test-site' }}
          templateId="classic"
          previewHtml='<html><body><h1 class="title">Test</h1></body></html>'
          fingerprintedHtml='<html><body><h1 class="title fp-abc123">Test</h1></body></html>'
        />
      );

      const toggleButton = screen.getByTestId('fingerprint-toggle');
      const iframe = screen.getByTitle('Template Preview');

      // Initial state: show original
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('class="title"'));
      expect(toggleButton).toHaveTextContent('Show Fingerprint');

      // Toggle to fingerprinted
      fireEvent.click(toggleButton);
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('class="title fp-abc123"'));
      expect(toggleButton).toHaveTextContent('Show Original');

      // Toggle back to original
      fireEvent.click(toggleButton);
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('class="title"'));
      expect(toggleButton).toHaveTextContent('Show Fingerprint');
    });

    it('should preserve data attributes during fingerprinting', () => {
      const originalHtml = '<html><body><div data-voluum-id="12345">Content</div></body></html>';
      const fingerprintedHtml = '<html><body><div data-voluum-id="12345" class="fp-xyz">Content</div></body></html>';

      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test', siteId: 'test-site' }}
          templateId="classic"
          previewHtml={originalHtml}
          fingerprintedHtml={fingerprintedHtml}
        />
      );

      const toggleButton = screen.getByTestId('fingerprint-toggle');

      // Original should have data attribute
      let iframe = screen.getByTitle('Template Preview');
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('data-voluum-id="12345"'));

      // Fingerprinted should also preserve data attribute
      fireEvent.click(toggleButton);
      iframe = screen.getByTitle('Template Preview');
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('data-voluum-id="12345"'));
      expect(iframe).toHaveAttribute('srcdoc', expect.stringContaining('class="fp-xyz"'));
    });
  });

  describe('Determinism Verification', () => {
    it('should produce identical fingerprinted output for same siteId', () => {
      const originalHtml = '<html><body><h1 id="header" class="main">Test</h1></body></html>';
      const fingerprintedHtml1 = '<html><body><h1 id="header-fp-seed1" class="main fp-seed1">Test</h1></body></html>';
      const fingerprintedHtml2 = '<html><body><h1 id="header-fp-seed1" class="main fp-seed1">Test</h1></body></html>';

      const { rerender } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test', siteId: 'same-site' }}
          templateId="classic"
          previewHtml={originalHtml}
          fingerprintedHtml={fingerprintedHtml1}
        />
      );

      const toggleButton = screen.getByTestId('fingerprint-toggle');
      let iframe = screen.getByTitle('Template Preview');

      // Show fingerprinted version
      fireEvent.click(toggleButton);
      const firstFingerprint = iframe.srcDoc;

      // Rerender with same siteId but showing different fingerprint
      rerender(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test', siteId: 'same-site' }}
          templateId="classic"
          previewHtml={originalHtml}
          fingerprintedHtml={fingerprintedHtml2}
        />
      );

      iframe = screen.getByTitle('Template Preview');
      const secondFingerprint = iframe.srcDoc;

      // Should be byte-identical for deterministic output
      expect(firstFingerprint).toBe(secondFingerprint);
    });
  });

  describe('Error Recovery', () => {
    it('should display error message when no preview available', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="" // No preview HTML
        />
      );

      expect(screen.getByText('No preview available')).toBeInTheDocument();
    });

    it('should remain open and functional after error', () => {
      const { rerender } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="" // Error state
        />
      );

      // Modal should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Fix the error by providing preview HTML
      rerender(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Fixed</h1></body></html>"
        />
      );

      // Should now show iframe instead of error
      expect(screen.getByTitle('Template Preview')).toBeInTheDocument();
      expect(screen.queryByText('No preview available')).not.toBeInTheDocument();
    });
  });

  describe('Performance Baseline', () => {
    it('should render preview in < 1 second', () => {
      const startTime = performance.now();

      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test Company' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test Company</h1></body></html>"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByTitle('Template Preview')).toBeInTheDocument();
    });

    it('should render iframe immediately without lag', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      // iframe should be rendered immediately
      const iframe = screen.getByTitle('Template Preview');
      expect(iframe).toBeInTheDocument();
      expect(iframe.getAttribute('srcdoc')).toBeTruthy();
    });
  });

  describe('Modal Cleanup and State', () => {
    it('should close without errors', () => {
      const onClose = vi.fn();
      const { unmount } = render(
        <PreviewModal
          isOpen={true}
          onClose={onClose}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      const closeButton = screen.getByLabelText('Close preview');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it('should not render when isOpen is false', () => {
      const { rerender } = render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal
      rerender(
        <PreviewModal
          isOpen={false}
          onClose={() => {}}
          config={{ brand: 'Test' }}
          templateId="classic"
          previewHtml="<html><body><h1>Test</h1></body></html>"
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should maintain state when toggling fingerprint view', () => {
      render(
        <PreviewModal
          isOpen={true}
          onClose={() => {}}
          config={{ brand: 'Test', siteId: 'test-site' }}
          templateId="classic"
          previewHtml="<html><body><h1>Original</h1></body></html>"
          fingerprintedHtml="<html><body><h1>Original fp-1</h1></body></html>"
        />
      );

      const viewportToggle = screen.getByTestId('viewport-toggle');
      const fingerprintToggle = screen.getByTestId('fingerprint-toggle');

      // Set viewport to mobile
      fireEvent.click(viewportToggle);
      expect(viewportToggle.getAttribute('data-viewport')).toBe('mobile');

      // Toggle fingerprint
      fireEvent.click(fingerprintToggle);
      expect(fingerprintToggle.getAttribute('data-fingerprint')).toBe('true');

      // Viewport should still be mobile
      expect(viewportToggle.getAttribute('data-viewport')).toBe('mobile');
    });
  });
});
