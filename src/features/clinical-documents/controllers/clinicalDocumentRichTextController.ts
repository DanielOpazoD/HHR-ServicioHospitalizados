/**
 * Clinical Document Rich Text Controller
 *
 * HTML normalization, sanitization, paste handling, and command
 * execution for clinical document contentEditable editors.
 *
 * Tag and style whitelists are defined in clinicalDocumentHtmlSanitizer.ts.
 */

import {
  ALLOWED_TAGS,
  sanitizeElementStyle,
  preserveElementAttributes,
} from '@/features/clinical-documents/controllers/clinicalDocumentHtmlSanitizer';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const decodeHtmlEntities = (value: string): string => {
  if (!value) {
    return '';
  }

  if (typeof document === 'undefined') {
    return value
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&amp;', '&');
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizeWhitespaceHtml = (value: string): string =>
  value
    .replace(/<div><br><\/div>/gi, '<br>')
    .replace(/<p><br><\/p>/gi, '<br>')
    .replace(/(<br>\s*){3,}/gi, '<br><br>')
    .trim();

export const convertPlainTextToClinicalDocumentHtml = (value: string): string => {
  const normalized = decodeHtmlEntities(value).trim();
  if (!normalized) {
    return '';
  }

  return normalizeWhitespaceHtml(escapeHtml(normalized).replace(/\n/g, '<br>'));
};

export const sanitizeClinicalDocumentHtml = (value: string): string => {
  if (!value.trim()) {
    return '';
  }

  if (typeof document === 'undefined') {
    return value.replace(/<[^>]+>/g, '').trim();
  }

  const template = document.createElement('template');
  template.innerHTML = value;

  const sanitizeNode = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(node.textContent || '')];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();
    const sanitizedChildren = Array.from(element.childNodes).flatMap(child => sanitizeNode(child));

    if (!ALLOWED_TAGS.has(tagName)) {
      return sanitizedChildren;
    }

    const normalizedTagName = tagName === 'BLOCKQUOTE' ? 'div' : tagName.toLowerCase();
    const clone = document.createElement(normalizedTagName);
    const safeStyle = sanitizeElementStyle(element, tagName);
    if (safeStyle) {
      clone.setAttribute('style', safeStyle);
    }
    preserveElementAttributes(element, clone, tagName);
    sanitizedChildren.forEach(child => clone.appendChild(child));
    return [clone];
  };

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes)
    .flatMap(child => sanitizeNode(child))
    .forEach(child => fragment.appendChild(child));

  const container = document.createElement('div');
  container.appendChild(fragment);
  return normalizeWhitespaceHtml(container.innerHTML);
};

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

export const normalizeClinicalDocumentContentForStorage = (value: string): string => {
  if (!value.trim()) {
    return '';
  }

  return HTML_TAG_PATTERN.test(value)
    ? sanitizeClinicalDocumentHtml(value)
    : convertPlainTextToClinicalDocumentHtml(value);
};

export const stripClinicalDocumentHtml = (value: string): string => {
  const normalized = normalizeClinicalDocumentContentForStorage(value);
  if (!normalized) {
    return '';
  }

  const serializeNodesToText = (nodes: NodeListOf<ChildNode> | ChildNode[], depth = 0): string => {
    const chunks: string[] = [];

    Array.from(nodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        chunks.push(node.textContent || '');
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const element = node as HTMLElement;
      const tagName = element.tagName.toUpperCase();

      if (tagName === 'BR') {
        chunks.push('\n');
        return;
      }

      if (tagName === 'UL') {
        const listText = Array.from(element.children)
          .filter(child => child.tagName.toUpperCase() === 'LI')
          .map(child => serializeListItem(child as HTMLElement, depth, false, 0))
          .join('\n');
        chunks.push(listText, '\n');
        return;
      }

      if (tagName === 'OL') {
        const listText = Array.from(element.children)
          .filter(child => child.tagName.toUpperCase() === 'LI')
          .map((child, index) => serializeListItem(child as HTMLElement, depth, true, index + 1))
          .join('\n');
        chunks.push(listText, '\n');
        return;
      }

      const text = serializeNodesToText(element.childNodes, depth);
      chunks.push(text);
      if (['P', 'DIV', 'BLOCKQUOTE', 'LI'].includes(tagName)) {
        chunks.push('\n');
      }
    });

    return chunks.join('');
  };

  const serializeListItem = (
    element: HTMLElement,
    depth: number,
    ordered: boolean,
    orderedIndex: number
  ): string => {
    const indent = '  '.repeat(depth);
    const marker = ordered ? `${orderedIndex}. ` : '• ';
    const inlineChunks: string[] = [];
    const nestedChunks: string[] = [];

    Array.from(element.childNodes).forEach(child => {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        ['UL', 'OL'].includes((child as HTMLElement).tagName.toUpperCase())
      ) {
        nestedChunks.push(serializeNodesToText([child], depth + 1).trimEnd());
      } else {
        inlineChunks.push(serializeNodesToText([child], depth));
      }
    });

    const mainLine = `${indent}${marker}${inlineChunks.join('').trim()}`.trimEnd();
    return nestedChunks.length ? [mainLine, ...nestedChunks].join('\n') : mainLine;
  };

  if (typeof document === 'undefined') {
    return normalized
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|blockquote|li)>/gi, '\n')
      .replace(/<ol>/gi, '\n')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<ul>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const container = document.createElement('div');
  container.innerHTML = normalized;
  return serializeNodesToText(container.childNodes)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Sanitizes pasted HTML: strips all inline styles, classes, and
 * non-structural attributes while preserving images, tables, and
 * basic formatting tags. Falls back to plain text if no HTML is available.
 */
export const sanitizePastedHtml = (html: string): string => {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, '').trim();
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const sanitizeNode = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(node.textContent || '')];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();
    const children = Array.from(element.childNodes).flatMap(c => sanitizeNode(c));

    if (!ALLOWED_TAGS.has(tagName)) {
      return children;
    }

    const clone = document.createElement(tagName.toLowerCase());
    const safeStyle = sanitizeElementStyle(element, tagName);
    if (safeStyle) {
      clone.setAttribute('style', safeStyle);
    }
    preserveElementAttributes(element, clone, tagName);
    children.forEach(c => clone.appendChild(c));
    return [clone];
  };

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes)
    .flatMap(c => sanitizeNode(c))
    .forEach(c => fragment.appendChild(c));

  const container = document.createElement('div');
  container.appendChild(fragment);
  return normalizeWhitespaceHtml(container.innerHTML);
};

export const applyClinicalDocumentEditorCommand = (
  command:
    | 'bold'
    | 'italic'
    | 'underline'
    | 'foreColor'
    | 'hiliteColor'
    | 'insertUnorderedList'
    | 'insertOrderedList'
    | 'removeFormat'
    | 'undo'
    | 'redo'
    | 'indent'
    | 'outdent',
  value?: string
): boolean => {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }

  return document.execCommand(command, false, value);
};
