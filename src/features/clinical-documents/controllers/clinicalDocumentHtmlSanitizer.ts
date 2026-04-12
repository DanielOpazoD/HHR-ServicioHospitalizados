/**
 * Clinical Document HTML Sanitizer
 *
 * Centralized HTML tag and style whitelists used across all sanitization
 * functions (storage normalization, paste handling, PDF export).
 *
 * Single source of truth for allowed tags — eliminates duplication
 * between RICH_TEXT_TAGS and PASTE_ALLOWED_TAGS.
 */

// ---------------------------------------------------------------------------
// Allowed HTML tags
// ---------------------------------------------------------------------------

/** Tags preserved during HTML sanitization (both storage and paste). */
export const ALLOWED_TAGS = new Set([
  // Inline formatting
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'SPAN',
  // Block structure
  'P',
  'DIV',
  'BR',
  'BLOCKQUOTE',
  // Lists
  'UL',
  'OL',
  'LI',
  // Tables
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TD',
  'TH',
  'CAPTION',
  // Media
  'IMG',
]);

// ---------------------------------------------------------------------------
// Allowed CSS style properties
// ---------------------------------------------------------------------------

/** Style properties allowed on all elements. */
export const ALLOWED_STYLE_KEYS = new Set(['color', 'background-color']);

/**
 * Extended style properties allowed specifically on IMG elements.
 * Supports inline resize and alignment applied by the image editor.
 */
export const IMAGE_ALLOWED_STYLE_KEYS = new Set([
  ...ALLOWED_STYLE_KEYS,
  'width',
  'height',
  'max-width',
  'display',
  'margin-left',
  'margin-right',
  'float',
  'object-fit',
]);

// ---------------------------------------------------------------------------
// Style sanitization
// ---------------------------------------------------------------------------

/**
 * Filters an element's inline style to only allowed properties.
 * IMG elements get an extended set that supports resize/alignment.
 *
 * @param element - The HTML element to read styles from
 * @param tagName - Uppercase tag name (used to select the style whitelist)
 * @returns Sanitized style string, or empty string if none allowed
 */
export const sanitizeElementStyle = (element: HTMLElement, tagName?: string): string => {
  const rawStyle = element.getAttribute('style');
  if (!rawStyle) {
    return '';
  }

  const allowedKeys = tagName === 'IMG' ? IMAGE_ALLOWED_STYLE_KEYS : ALLOWED_STYLE_KEYS;

  return rawStyle
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex === -1) return null;
      const property = entry.slice(0, separatorIndex).trim().toLowerCase();
      const value = entry.slice(separatorIndex + 1).trim();
      if (!allowedKeys.has(property) || !value) return null;
      return `${property}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
};

// ---------------------------------------------------------------------------
// Element attribute preservation
// ---------------------------------------------------------------------------

/**
 * Copies essential attributes from a source element to a sanitized clone.
 * Preserves src/alt for images and colspan/rowspan for table cells.
 */
export const preserveElementAttributes = (
  source: HTMLElement,
  clone: HTMLElement,
  tagName: string
): void => {
  if (tagName === 'IMG') {
    const src = source.getAttribute('src');
    const alt = source.getAttribute('alt');
    if (src) clone.setAttribute('src', src);
    if (alt) clone.setAttribute('alt', alt);
  }
  if (tagName === 'TD' || tagName === 'TH') {
    const colspan = source.getAttribute('colspan');
    const rowspan = source.getAttribute('rowspan');
    if (colspan) clone.setAttribute('colspan', colspan);
    if (rowspan) clone.setAttribute('rowspan', rowspan);
  }
};
