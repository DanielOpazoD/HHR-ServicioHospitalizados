const RICH_TEXT_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'BR',
  'P',
  'DIV',
  'BLOCKQUOTE',
  'SPAN',
]);

const ALLOWED_STYLE_KEYS = new Set(['color', 'background-color']);

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const normalizeWhitespaceHtml = (value: string): string =>
  value
    .replace(/<div><br><\/div>/gi, '<br>')
    .replace(/<p><br><\/p>/gi, '<br>')
    .replace(/(<br>\s*){3,}/gi, '<br><br>')
    .trim();

export const convertPlainTextToClinicalDocumentHtml = (value: string): string => {
  const normalized = value.trim();
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

    if (!RICH_TEXT_TAGS.has(tagName)) {
      return sanitizedChildren;
    }

    const clone = document.createElement(tagName.toLowerCase());
    const safeStyle = sanitizeElementStyle(element);
    if (safeStyle) {
      clone.setAttribute('style', safeStyle);
    }
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
const sanitizeElementStyle = (element: HTMLElement): string => {
  const rawStyle = element.getAttribute('style');
  if (!rawStyle) {
    return '';
  }

  return rawStyle
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex === -1) return null;
      const property = entry.slice(0, separatorIndex).trim().toLowerCase();
      const value = entry.slice(separatorIndex + 1).trim();
      if (!ALLOWED_STYLE_KEYS.has(property) || !value) return null;
      return `${property}: ${value}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join('; ');
};
