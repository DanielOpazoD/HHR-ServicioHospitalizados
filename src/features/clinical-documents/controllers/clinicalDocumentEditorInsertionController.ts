const escapeClinicalDocumentHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const restoreSelectionAfterInsertion = (
  selection: Selection | null,
  range: Range,
  lastInsertedNode: ChildNode | null
) => {
  if (!selection || !lastInsertedNode) {
    return;
  }

  range.setStartAfter(lastInsertedNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

export const insertClinicalDocumentHtmlAtCursor = (editor: HTMLDivElement, html: string): void => {
  if (typeof document === 'undefined') {
    editor.innerHTML = `${editor.innerHTML}${html}`;
    return;
  }

  const selection = window.getSelection();
  const range =
    selection &&
    selection.rangeCount > 0 &&
    editor.contains(selection.anchorNode) &&
    editor.contains(selection.focusNode)
      ? selection.getRangeAt(0)
      : null;

  if (!range) {
    editor.innerHTML = `${editor.innerHTML}${html}`;
    return;
  }

  range.deleteContents();
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const lastInsertedNode = fragment.lastChild;
  range.insertNode(fragment);
  restoreSelectionAfterInsertion(selection, range, lastInsertedNode);
};

export const insertClinicalDocumentPlainTextAtCursor = (
  editor: HTMLDivElement,
  text: string
): void => {
  const html = escapeClinicalDocumentHtml(text).replace(/\n/g, '<br>');
  insertClinicalDocumentHtmlAtCursor(editor, html);
};

/**
 * Removes a trailing pattern (e.g. a typed `/lab ` slash command) that ends at
 * the collapsed caret, deleting it from the caret's own text node so the cursor
 * stays put. Returns `true` if it removed the match, `false` if the caret is not
 * a collapsed position inside a text node ending with the pattern (the caller
 * should then fall back to an innerHTML-level strip).
 *
 * Preserving the caret matters: a full `innerHTML` rewrite collapses the
 * selection, which makes a subsequent cursor insertion fall back to appending
 * at the end of the editor instead of where the user was typing.
 */
export const removeTrailingPatternAtCaret = (editor: HTMLDivElement, pattern: RegExp): boolean => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const node = range.endContainer;
  if (!range.collapsed || node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
    return false;
  }

  const textBeforeCaret = (node.textContent ?? '').slice(0, range.endOffset);
  const match = textBeforeCaret.match(pattern);
  if (!match || match[0].length === 0) {
    return false;
  }

  const removalStart = range.endOffset - match[0].length;
  const removalRange = document.createRange();
  removalRange.setStart(node, removalStart);
  removalRange.setEnd(node, range.endOffset);
  removalRange.deleteContents();

  const caretRange = document.createRange();
  caretRange.setStart(node, removalStart);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  return true;
};
