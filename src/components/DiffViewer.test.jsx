/**
 * DiffViewer Component Tests (PREV-04)
 * ====================================
 * Tests for diff visualization component showing pre/post fingerprint HTML changes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from './DiffViewer.jsx';

describe('DiffViewer component', () => {
  const preHtml = '<div>Test</div>';
  const postHtml = '<div class="fp-abc">Test</div>';

  const mockDiffs = [
    [0, '<div'],
    [1, ' class="fp-abc"'],
    [0, '>Test</div>'],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Diff Rendering (PREV-04) ──────────────────────────────────────────────

  it('should render diff viewer when there are changes', () => {
    render(<DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('should accept preHtml and postHtml props', () => {
    render(<DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />);

    expect(screen.getByTestId('pre-html')).toBeInTheDocument();
    expect(screen.getByTestId('post-html')).toBeInTheDocument();
  });

  it('should render side-by-side layout by default', () => {
    const { container } = render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />
    );

    const diffViewer = screen.getByTestId('diff-viewer');
    expect(diffViewer.classList.contains('side-by-side')).toBe(true);
  });

  it('should render tabbed layout when specified', () => {
    const { container } = render(
      <DiffViewer
        preHtml={preHtml}
        postHtml={postHtml}
        diffs={mockDiffs}
        layout="tabbed"
      />
    );

    const diffViewer = screen.getByTestId('diff-viewer');
    expect(diffViewer.classList.contains('tabbed')).toBe(true);
  });

  it('should display both pre and post HTML in the viewer', () => {
    render(<DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />);

    const preElement = screen.getByTestId('pre-html');
    const postElement = screen.getByTestId('post-html');

    expect(preElement.textContent).toContain('Test');
    expect(postElement.textContent).toContain('fp-abc');
  });

  // ─── Visual Diff Highlighting (PREV-04) ────────────────────────────────────

  it('should highlight added text in green', () => {
    const { container } = render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />
    );

    const addedElements = container.querySelectorAll('.diff-added');
    expect(addedElements.length).toBeGreaterThan(0);
    expect(addedElements[0].textContent).toContain('class=');
  });

  it('should handle removed text highlighting in red', () => {
    const removedDiff = [
      [0, '<div '],
      [-1, 'old-class'],
      [0, '>'],
    ];

    const { container } = render(
      <DiffViewer
        preHtml="<div old-class>"
        postHtml="<div>"
        diffs={removedDiff}
      />
    );

    const removedElements = container.querySelectorAll('.diff-removed');
    expect(removedElements.length).toBeGreaterThan(0);
  });

  it('should keep unchanged text in default color', () => {
    const { container } = render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />
    );

    const unchangedElements = container.querySelectorAll('.diff-unchanged');
    expect(unchangedElements.length).toBeGreaterThan(0);
  });

  // ─── Empty State ───────────────────────────────────────────────────────────

  it('should show "No changes" message when preHtml === postHtml', () => {
    render(<DiffViewer preHtml={preHtml} postHtml={preHtml} diffs={[]} />);

    expect(screen.getByTestId('no-changes')).toBeInTheDocument();
    expect(screen.getByText('No changes')).toBeInTheDocument();
  });

  it('should show "No changes" when diffs array is empty', () => {
    render(<DiffViewer preHtml={preHtml} postHtml={preHtml} diffs={[]} />);

    expect(screen.getByTestId('no-changes')).toBeInTheDocument();
  });

  // ─── Large Diff Handling ───────────────────────────────────────────────────

  it('should truncate diffs longer than 100 lines', () => {
    // Create a large diff
    const largeDiff = Array.from({ length: 150 }, (_, i) => [0, `line ${i}\n`]);

    const { container } = render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={largeDiff} />
    );

    // Should only show first 50
    const diffHighlights = container.querySelector('.diff-highlights');
    const spans = diffHighlights?.querySelectorAll('span') || [];
    expect(spans.length).toBeLessThanOrEqual(50);
  });

  it('should show count of remaining changes when truncated', () => {
    // Create a large diff with 150 items
    const largeDiff = Array.from({ length: 150 }, (_, i) => [0, `line ${i}\n`]);

    render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={largeDiff} />
    );

    expect(screen.getByText('... 100 more changes')).toBeInTheDocument();
  });

  // ─── Props Validation ──────────────────────────────────────────────────────

  it('should accept preHtml as required prop', () => {
    // Should render without error
    render(<DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('should accept postHtml as required prop', () => {
    // Should render without error
    render(<DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('should use default empty array for diffs prop if not provided', () => {
    const { container } = render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} />
    );

    // Component should render without errors even with no diffs provided
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('should use side-by-side layout as default for layout prop', () => {
    const { container } = render(
      <DiffViewer preHtml={preHtml} postHtml={postHtml} diffs={mockDiffs} />
    );

    const diffViewer = screen.getByTestId('diff-viewer');
    expect(diffViewer.classList.contains('side-by-side')).toBe(true);
  });
});
