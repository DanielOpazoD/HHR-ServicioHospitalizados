/**
 * Clinical Document Mandatory List Shape Controller
 *
 * Restores the list wrapper (`<ol>` or `<ul>`) on editors whose section
 * canonically renders as a list (e.g. "Diagnósticos de egreso", "Indicaciones
 * al alta"). Without this, a user could backspace through the wrapper and
 * lose the auto-list behavior — typing a new line would no longer produce
 * a numbered or dashed marker.
 *
 * Pure DOM utilities; no React or controller coupling.
 */

import type { ClinicalDocumentMandatoryListType } from '@/features/clinical-documents/controllers/clinicalDocumentEmptySectionTemplateController';

/**
 * Returns true if the editor already complies with the mandatory list shape:
 * the first non-text child is the required list tag, contains at least one
 * `<li>`, and has no extra siblings outside it.
 */
export const editorMatchesMandatoryListShape = (
  editor: HTMLElement,
  listTag: ClinicalDocumentMandatoryListType
): boolean => {
  const firstElement = editor.firstElementChild;
  if (!firstElement) return false;
  if (firstElement.tagName.toLowerCase() !== listTag) return false;
  if (!firstElement.querySelector('li')) return false;
  if (firstElement.nextElementSibling) return false;
  return true;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const BLOCK_LEVEL_TAGS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE']);

/**
 * Walks the editor's DOM and produces one logical text line per block-level
 * descendant (divs, paragraphs, list items) and per `<br>`. Inline elements
 * contribute their text to the current line.
 *
 * Implemented manually because `Element.innerText` is not faithful in jsdom
 * (it concatenates without block-boundary newlines), and we need
 * deterministic behavior across runtimes.
 */
const collectEditorLines = (editor: HTMLElement): string[] => {
  const lines: string[] = [];

  const visit = (node: Node, currentLine: string[]): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      currentLine.push(node.textContent || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();

    if (tagName === 'BR') {
      lines.push(currentLine.join('').trim());
      currentLine.length = 0;
      return;
    }

    if (BLOCK_LEVEL_TAGS.has(tagName)) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join('').trim());
        currentLine.length = 0;
      }
      const blockLine: string[] = [];
      Array.from(element.childNodes).forEach(child => visit(child, blockLine));
      lines.push(blockLine.join('').trim());
      return;
    }

    Array.from(element.childNodes).forEach(child => visit(child, currentLine));
  };

  const tailLine: string[] = [];
  Array.from(editor.childNodes).forEach(child => visit(child, tailLine));
  if (tailLine.length > 0) {
    lines.push(tailLine.join('').trim());
  }

  return lines.filter(line => line.length > 0);
};

/**
 * Splits the editor's current visible text into list items, preserving the
 * user's logical line breaks. Empty lines are dropped.
 */
const splitEditorTextIntoListItemsHtml = (editor: HTMLElement): string => {
  const lines = collectEditorLines(editor);
  if (lines.length === 0) return '<li><br></li>';
  return lines.map(line => `<li>${escapeHtml(line)}</li>`).join('');
};

/**
 * Places the caret at the end of the last `<li>` inside the editor. Called
 * after rebuilding the list so the user's typing flow is not interrupted.
 */
const placeCaretAtEndOfLastListItem = (editor: HTMLElement): void => {
  const lastLi = editor.querySelector('li:last-child');
  if (!lastLi) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const range = document.createRange();
  range.selectNodeContents(lastLi);
  range.collapse(false);
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * Reconstructs the mandatory list shape if the user has destroyed the wrapper.
 * No-op when the editor is already in valid shape.
 *
 * Returns `true` if the DOM was mutated, `false` if no fix was needed.
 */
export const enforceMandatoryListShape = (
  editor: HTMLElement,
  listTag: ClinicalDocumentMandatoryListType
): boolean => {
  if (editorMatchesMandatoryListShape(editor, listTag)) {
    return false;
  }

  const itemsHtml = splitEditorTextIntoListItemsHtml(editor);
  editor.innerHTML = `<${listTag}>${itemsHtml}</${listTag}>`;
  placeCaretAtEndOfLastListItem(editor);
  return true;
};
