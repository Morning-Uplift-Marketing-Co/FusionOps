/**
 * PreviewModal Component Tests (PREV-01, PREV-02, PREV-04)
 * =========================================================
 * Tests for live preview modal with viewport toggle and fingerprint comparison.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewModal } from './PreviewModal.jsx';

describe('PreviewModal component', () => {
  const mockConfig = {
    brand: 'TestBrand',
    primaryColor: '#FF0000',
    secondaryColor: '#00FF00',
    h1: 'Test Headline',
    cta: 'Click Me',
    domain: 'test.example.com',
  };

  const mockPreviewHtml = `
    <html>
      <body>
        <h1>Test Headline</h1>
        <button>Click Me</button>
      </body>
    </html>
  `;

  const mockFingerprintedHtml = `
    <html>
      <body>
        <h1 class="fp-xyz">Test Headline</h1>
        <button class="fp-abc">Click Me</button>
      </body>
    </html>
  `;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Component Mounting & Rendering (PREV-01) ───────────────────────────────

  it('should render modal when isOpen=true', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should not render modal when isOpen=false', () => {
    render(
      <PreviewModal
        isOpen={false}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render iframe with sandbox attribute', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    const iframe = screen.getByTestId('preview-iframe');
    expect(iframe).toHaveAttribute('sandbox');
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
  });

  it('should display viewport toggle and fingerprint toggle buttons', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    expect(screen.getByTestId('viewport-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('fingerprint-toggle')).toBeInTheDocument();
  });

  // ─── Viewport Toggle (PREV-02) ───────────────────────────────────────────────

  it('should default to desktop viewport (1024px)', () => {
    const { container } = render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    const viewportBtn = screen.getByTestId('viewport-toggle');
    expect(viewportBtn.getAttribute('data-viewport')).toBe('desktop');
  });

  it('should toggle to mobile viewport (320px) on button click', async () => {
    const { container, rerender } = render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    const viewportBtn = screen.getByTestId('viewport-toggle');

    // Click to toggle to mobile
    fireEvent.click(viewportBtn);
    expect(viewportBtn.getAttribute('data-viewport')).toBe('mobile');

    // Click to toggle back to desktop
    fireEvent.click(viewportBtn);
    expect(viewportBtn.getAttribute('data-viewport')).toBe('desktop');
  });

  it('should not re-render iframe srcdoc on viewport change', () => {
    const { rerender } = render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    const iframe = screen.getByTestId('preview-iframe');
    const originalSrcdoc = iframe.getAttribute('srcdoc');

    // Toggle viewport
    const viewportBtn = screen.getByTestId('viewport-toggle');
    fireEvent.click(viewportBtn);

    // srcdoc should remain unchanged
    expect(iframe.getAttribute('srcdoc')).toBe(originalSrcdoc);
  });

  // ─── Fingerprint Toggle (PREV-04) ────────────────────────────────────────────

  it('should default to showing previewHtml (not fingerprinted)', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
        fingerprintedHtml={mockFingerprintedHtml}
      />
    );

    const iframe = screen.getByTestId('preview-iframe');
    const srcdoc = iframe.getAttribute('srcdoc');
    // Default should show previewHtml which has "Test Headline" without class names
    expect(srcdoc).toContain('Test Headline');
    expect(srcdoc).not.toContain('fp-');
  });

  it('should toggle to fingerprinted HTML on button click', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
        fingerprintedHtml={mockFingerprintedHtml}
      />
    );

    const fingerprintBtn = screen.getByTestId('fingerprint-toggle');
    const iframe = screen.getByTestId('preview-iframe');

    // Initially shows original
    expect(fingerprintBtn.getAttribute('data-fingerprint')).toBe('false');

    // Click to toggle
    fireEvent.click(fingerprintBtn);
    expect(fingerprintBtn.getAttribute('data-fingerprint')).toBe('true');
  });

  it('should update iframe srcdoc when fingerprint toggle changes', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
        fingerprintedHtml={mockFingerprintedHtml}
      />
    );

    const iframe = screen.getByTestId('preview-iframe');
    const fingerprintBtn = screen.getByTestId('fingerprint-toggle');

    // Toggle to fingerprinted
    fireEvent.click(fingerprintBtn);

    // srcdoc should now contain fingerprinted HTML
    expect(iframe.getAttribute('srcdoc')).toContain('fp-');
  });

  // ─── Error States ────────────────────────────────────────────────────────────

  it('should show placeholder when previewHtml is empty', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml=""
      />
    );

    expect(screen.getByText('No preview available')).toBeInTheDocument();
  });

  it('should call onClose callback when close button clicked', async () => {
    const onCloseMock = vi.fn();
    render(
      <PreviewModal
        isOpen={true}
        onClose={onCloseMock}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    const closeBtn = screen.getByLabelText('Close preview');
    fireEvent.click(closeBtn);

    expect(onCloseMock).toHaveBeenCalled();
  });

  // ─── Props & State Management ────────────────────────────────────────────────

  it('should accept and display config.brand in modal title', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-123"
        previewHtml={mockPreviewHtml}
      />
    );

    expect(screen.getByText(/Preview: TestBrand/)).toBeInTheDocument();
  });

  it('should accept templateId prop', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={vi.fn()}
        config={mockConfig}
        templateId="tpl-456"
        previewHtml={mockPreviewHtml}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
