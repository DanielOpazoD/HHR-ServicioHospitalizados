/**
 * Clinical Document Image Editor Controller
 *
 * Pure logic for image alignment and resize operations.
 * No React or DOM dependencies — operates on style objects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageAlignment = 'left' | 'center' | 'right' | 'full';

export interface ImageAlignmentStyles {
  display: string;
  marginLeft: string;
  marginRight: string;
  float: string;
  width?: string;
  height?: string;
}

// ---------------------------------------------------------------------------
// Alignment resolution
// ---------------------------------------------------------------------------

/**
 * Resolves inline styles for a given image alignment.
 *
 * @param alignment - Target alignment ('left', 'center', 'right', 'full')
 * @returns Style properties to apply to the IMG element
 */
export const resolveImageAlignmentStyles = (alignment: ImageAlignment): ImageAlignmentStyles => {
  switch (alignment) {
    case 'left':
      return { display: 'block', marginLeft: '0', marginRight: 'auto', float: '' };
    case 'center':
      return { display: 'block', marginLeft: 'auto', marginRight: 'auto', float: '' };
    case 'right':
      return { display: 'block', marginLeft: 'auto', marginRight: '0', float: '' };
    case 'full':
      return {
        display: 'block',
        marginLeft: '0',
        marginRight: '0',
        width: '100%',
        height: 'auto',
        float: '',
      };
  }
};

// ---------------------------------------------------------------------------
// Toolbar positioning
// ---------------------------------------------------------------------------

/** Height of the toolbar including padding/border (~36px). */
const TOOLBAR_HEIGHT_PX = 40;
/** Minimum gap from viewport edge. */
const VIEWPORT_PADDING_PX = 8;

export interface ImageToolbarPosition {
  /** CSS `left` value in px (center of toolbar). */
  left: number;
  /** CSS `top` value in px. */
  top: number;
  /** Whether the toolbar is rendered below the image instead of above. */
  isBelow: boolean;
}

/**
 * Calculates the optimal toolbar position relative to the viewport.
 *
 * Prefers placing the toolbar above the image. Falls back to below
 * if there isn't enough space above (image near top of viewport).
 *
 * @param imageRect - The image's current bounding client rect.
 * @returns Position and placement direction.
 */
export const resolveImageToolbarPosition = (imageRect: DOMRect): ImageToolbarPosition => {
  const centerX = imageRect.left + imageRect.width / 2;
  const spaceAbove = imageRect.top;
  const isBelow = spaceAbove < TOOLBAR_HEIGHT_PX + VIEWPORT_PADDING_PX;

  return {
    left: centerX,
    top: isBelow ? imageRect.bottom + VIEWPORT_PADDING_PX : imageRect.top - TOOLBAR_HEIGHT_PX,
    isBelow,
  };
};

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

/** Minimum image width in pixels. */
export const IMAGE_MIN_WIDTH_PX = 40;

/**
 * Calculates the new width after a drag resize operation.
 *
 * @param startWidth - Width at the start of the drag (px)
 * @param deltaX - Horizontal distance dragged (px, positive = wider)
 * @returns Clamped width in pixels
 */
export const calculateResizedWidth = (startWidth: number, deltaX: number): number =>
  Math.max(IMAGE_MIN_WIDTH_PX, startWidth + deltaX);
