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
