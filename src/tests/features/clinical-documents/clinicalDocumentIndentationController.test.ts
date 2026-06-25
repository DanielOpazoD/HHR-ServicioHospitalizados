import { afterEach, describe, expect, it } from 'vitest';

import { applyClinicalDocumentIndentationCommand } from '@/features/clinical-documents/controllers/clinicalDocumentIndentationController';

/**
 * Builds an editor root attached to <body> (so window.getSelection resolves)
 * with the supplied inner HTML, and returns the editor element.
 */
const mountEditor = (innerHtml: string): HTMLDivElement => {
  const editor = document.createElement('div');
  editor.className = 'clinical-document-rich-text-editor';
  editor.setAttribute('contenteditable', 'true');
  editor.innerHTML = innerHtml;
  document.body.appendChild(editor);
  return editor;
};

/** Collapses the caret at the start of the given block's text content. */
const placeCaretIn = (block: Element): void => {
  const selection = window.getSelection();
  if (!selection) throw new Error('no selection');
  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('applyClinicalDocumentIndentationCommand', () => {
  it('applies an incremental left margin to the caret block on indent', () => {
    const editor = mountEditor('<div>Linea uno</div><div>Linea dos</div>');
    const second = editor.children[1];
    placeCaretIn(second);

    expect(applyClinicalDocumentIndentationCommand('indent')).toBe(true);
    expect((second as HTMLElement).style.marginLeft).toBe('24px');

    placeCaretIn(second);
    applyClinicalDocumentIndentationCommand('indent');
    expect((second as HTMLElement).style.marginLeft).toBe('48px');
  });

  it('decreases the margin on outdent and removes the style at zero', () => {
    const editor = mountEditor('<div style="margin-left: 48px;">Indentada</div>');
    const block = editor.children[0] as HTMLElement;
    placeCaretIn(block);

    expect(applyClinicalDocumentIndentationCommand('outdent')).toBe(true);
    expect(block.style.marginLeft).toBe('24px');

    placeCaretIn(block);
    applyClinicalDocumentIndentationCommand('outdent');
    expect(block.style.marginLeft).toBe('');
    // The now-empty style attribute must not linger on the element.
    expect(block.getAttribute('style')).toBeNull();
  });

  it('never produces a negative margin on outdent of a non-indented block', () => {
    const editor = mountEditor('<div>Sin sangria</div>');
    const block = editor.children[0] as HTMLElement;
    placeCaretIn(block);

    applyClinicalDocumentIndentationCommand('outdent');
    expect(block.style.marginLeft).toBe('');
    expect(block.getAttribute('style')).toBeNull();
  });

  it('indents every block intersecting a multi-block selection', () => {
    const editor = mountEditor('<div>Uno</div><div>Dos</div><div>Tres</div>');
    const selection = window.getSelection();
    if (!selection) throw new Error('no selection');
    const range = document.createRange();
    range.setStart(editor.children[0], 0);
    range.setEnd(editor.children[1], (editor.children[1] as HTMLElement).childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(applyClinicalDocumentIndentationCommand('indent')).toBe(true);
    expect((editor.children[0] as HTMLElement).style.marginLeft).toBe('24px');
    expect((editor.children[1] as HTMLElement).style.marginLeft).toBe('24px');
    // The third block sits outside the selection and stays untouched.
    expect((editor.children[2] as HTMLElement).style.marginLeft).toBe('');
  });
});
