/**
 * Pure position resolver for the UPC checklist popover.
 * Testable without React or DOM — just arithmetic on rects.
 */

const PANEL_WIDTH = 380;
const MIN_POPOVER_HEIGHT = 400;
const VIEWPORT_PADDING = 8;

export interface UpcPopoverPositionInput {
  buttonRect: DOMRect;
  viewportWidth: number;
  viewportHeight: number;
}

export interface UpcPopoverPosition {
  top: number;
  left: number;
}

export const resolveUpcChecklistPopoverPosition = ({
  buttonRect,
  viewportWidth,
  viewportHeight,
}: UpcPopoverPositionInput): UpcPopoverPosition => {
  const spaceBelow = viewportHeight - buttonRect.bottom;
  const top =
    spaceBelow > MIN_POPOVER_HEIGHT
      ? buttonRect.bottom + 4
      : Math.max(VIEWPORT_PADDING, buttonRect.top - MIN_POPOVER_HEIGHT);
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(buttonRect.left, viewportWidth - PANEL_WIDTH - VIEWPORT_PADDING)
  );
  return { top, left };
};
