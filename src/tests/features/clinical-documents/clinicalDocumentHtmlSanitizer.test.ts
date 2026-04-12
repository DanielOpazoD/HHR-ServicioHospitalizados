/**
 * Tests for the centralized HTML sanitizer.
 *
 * Validates tag whitelist, style filtering, and attribute preservation.
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TAGS,
  ALLOWED_STYLE_KEYS,
  IMAGE_ALLOWED_STYLE_KEYS,
  sanitizeElementStyle,
  preserveElementAttributes,
} from '@/features/clinical-documents/controllers/clinicalDocumentHtmlSanitizer';

describe('ALLOWED_TAGS', () => {
  it('includes formatting tags', () => {
    expect(ALLOWED_TAGS.has('B')).toBe(true);
    expect(ALLOWED_TAGS.has('I')).toBe(true);
    expect(ALLOWED_TAGS.has('U')).toBe(true);
  });

  it('includes structural tags', () => {
    expect(ALLOWED_TAGS.has('P')).toBe(true);
    expect(ALLOWED_TAGS.has('DIV')).toBe(true);
    expect(ALLOWED_TAGS.has('BR')).toBe(true);
  });

  it('includes table tags', () => {
    expect(ALLOWED_TAGS.has('TABLE')).toBe(true);
    expect(ALLOWED_TAGS.has('TR')).toBe(true);
    expect(ALLOWED_TAGS.has('TD')).toBe(true);
    expect(ALLOWED_TAGS.has('TH')).toBe(true);
  });

  it('includes IMG', () => {
    expect(ALLOWED_TAGS.has('IMG')).toBe(true);
  });

  it('excludes script and iframe', () => {
    expect(ALLOWED_TAGS.has('SCRIPT')).toBe(false);
    expect(ALLOWED_TAGS.has('IFRAME')).toBe(false);
  });
});

describe('IMAGE_ALLOWED_STYLE_KEYS', () => {
  it('includes all base style keys', () => {
    for (const key of ALLOWED_STYLE_KEYS) {
      expect(IMAGE_ALLOWED_STYLE_KEYS.has(key)).toBe(true);
    }
  });

  it('includes sizing and alignment styles', () => {
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('width')).toBe(true);
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('height')).toBe(true);
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('max-width')).toBe(true);
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('display')).toBe(true);
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('margin-left')).toBe(true);
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('margin-right')).toBe(true);
  });

  it('excludes dangerous properties', () => {
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('position')).toBe(false);
    expect(IMAGE_ALLOWED_STYLE_KEYS.has('z-index')).toBe(false);
  });
});

describe('sanitizeElementStyle', () => {
  const createElement = (style: string): HTMLElement => {
    const el = document.createElement('div');
    el.setAttribute('style', style);
    return el;
  };

  it('preserves allowed styles for regular elements', () => {
    const el = createElement('color: red; font-size: 14px; background-color: blue');
    const result = sanitizeElementStyle(el);
    expect(result).toContain('color: red');
    expect(result).toContain('background-color: blue');
    expect(result).not.toContain('font-size');
  });

  it('preserves width/height for IMG elements', () => {
    const el = createElement('width: 300px; height: auto; font-family: Arial');
    const result = sanitizeElementStyle(el, 'IMG');
    expect(result).toContain('width: 300px');
    expect(result).toContain('height: auto');
    expect(result).not.toContain('font-family');
  });

  it('strips width/height for non-IMG elements', () => {
    const el = createElement('width: 300px; color: red');
    const result = sanitizeElementStyle(el, 'DIV');
    expect(result).not.toContain('width');
    expect(result).toContain('color: red');
  });

  it('returns empty string for elements without style', () => {
    const el = document.createElement('div');
    expect(sanitizeElementStyle(el)).toBe('');
  });
});

describe('preserveElementAttributes', () => {
  it('copies src and alt for IMG elements', () => {
    const source = document.createElement('img');
    source.setAttribute('src', 'data:image/png;base64,abc');
    source.setAttribute('alt', 'test');
    const clone = document.createElement('img');

    preserveElementAttributes(source, clone, 'IMG');

    expect(clone.getAttribute('src')).toBe('data:image/png;base64,abc');
    expect(clone.getAttribute('alt')).toBe('test');
  });

  it('copies colspan and rowspan for TD elements', () => {
    const source = document.createElement('td');
    source.setAttribute('colspan', '2');
    source.setAttribute('rowspan', '3');
    const clone = document.createElement('td');

    preserveElementAttributes(source, clone, 'TD');

    expect(clone.getAttribute('colspan')).toBe('2');
    expect(clone.getAttribute('rowspan')).toBe('3');
  });

  it('does nothing for other element types', () => {
    const source = document.createElement('div');
    source.setAttribute('data-custom', 'value');
    const clone = document.createElement('div');

    preserveElementAttributes(source, clone, 'DIV');

    expect(clone.getAttribute('data-custom')).toBeNull();
  });
});
