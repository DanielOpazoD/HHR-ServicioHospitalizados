import { describe, it, expect } from 'vitest';
import { resolveUpcChecklistPopoverPosition } from '@/features/census/controllers/upcChecklistPopoverController';

const makeRect = (top: number, left: number, width: number, height: number): DOMRect =>
  ({
    top,
    left,
    bottom: top + height,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

describe('resolveUpcChecklistPopoverPosition', () => {
  it('places popover below the button when there is enough space', () => {
    const pos = resolveUpcChecklistPopoverPosition({
      buttonRect: makeRect(100, 200, 50, 20),
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.top).toBe(124); // bottom (120) + 4
    expect(pos.left).toBe(200);
  });

  it('places popover above when not enough space below', () => {
    const pos = resolveUpcChecklistPopoverPosition({
      buttonRect: makeRect(600, 200, 50, 20),
      viewportWidth: 1280,
      viewportHeight: 700,
    });
    expect(pos.top).toBe(200); // top (600) - 400
  });

  it('clamps left to viewport edge when button is too far right', () => {
    const pos = resolveUpcChecklistPopoverPosition({
      buttonRect: makeRect(100, 1100, 50, 20),
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    // 1280 - 380 - 8 = 892
    expect(pos.left).toBe(892);
  });

  it('clamps top to viewport padding when button is near top', () => {
    const pos = resolveUpcChecklistPopoverPosition({
      buttonRect: makeRect(10, 200, 50, 20),
      viewportWidth: 1280,
      viewportHeight: 100, // very small viewport
    });
    expect(pos.top).toBe(8); // VIEWPORT_PADDING
  });

  it('clamps left to viewport padding when button is at left edge', () => {
    const pos = resolveUpcChecklistPopoverPosition({
      buttonRect: makeRect(100, 2, 50, 20),
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.left).toBe(8); // VIEWPORT_PADDING
  });
});
