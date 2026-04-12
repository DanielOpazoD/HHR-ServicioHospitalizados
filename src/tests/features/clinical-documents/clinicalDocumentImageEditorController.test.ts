/**
 * Tests for image editor controller (pure logic).
 *
 * Validates alignment style resolution and resize width calculation.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveImageAlignmentStyles,
  calculateResizedWidth,
  IMAGE_MIN_WIDTH_PX,
} from '@/features/clinical-documents/controllers/clinicalDocumentImageEditorController';

describe('resolveImageAlignmentStyles', () => {
  it('returns left-aligned styles', () => {
    const styles = resolveImageAlignmentStyles('left');
    expect(styles.marginLeft).toBe('0');
    expect(styles.marginRight).toBe('auto');
    expect(styles.display).toBe('block');
  });

  it('returns center-aligned styles', () => {
    const styles = resolveImageAlignmentStyles('center');
    expect(styles.marginLeft).toBe('auto');
    expect(styles.marginRight).toBe('auto');
  });

  it('returns right-aligned styles', () => {
    const styles = resolveImageAlignmentStyles('right');
    expect(styles.marginLeft).toBe('auto');
    expect(styles.marginRight).toBe('0');
  });

  it('returns full-width styles with explicit width', () => {
    const styles = resolveImageAlignmentStyles('full');
    expect(styles.width).toBe('100%');
    expect(styles.height).toBe('auto');
    expect(styles.marginLeft).toBe('0');
    expect(styles.marginRight).toBe('0');
  });

  it('clears float on all alignments', () => {
    expect(resolveImageAlignmentStyles('left').float).toBe('');
    expect(resolveImageAlignmentStyles('center').float).toBe('');
    expect(resolveImageAlignmentStyles('right').float).toBe('');
    expect(resolveImageAlignmentStyles('full').float).toBe('');
  });
});

describe('calculateResizedWidth', () => {
  it('adds deltaX to start width', () => {
    expect(calculateResizedWidth(200, 50)).toBe(250);
  });

  it('subtracts negative deltaX', () => {
    expect(calculateResizedWidth(200, -50)).toBe(150);
  });

  it('clamps to minimum width', () => {
    expect(calculateResizedWidth(200, -300)).toBe(IMAGE_MIN_WIDTH_PX);
  });

  it('returns minimum for zero start width and negative delta', () => {
    expect(calculateResizedWidth(0, -10)).toBe(IMAGE_MIN_WIDTH_PX);
  });
});
