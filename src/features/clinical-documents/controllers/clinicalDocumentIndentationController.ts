import { CLINICAL_DOCUMENT_INDENT_STEP_PX } from '@/features/clinical-documents/controllers/clinicalDocumentFormattingContract';

const INDENTABLE_BLOCK_TAGS = new Set(['DIV', 'P', 'BLOCKQUOTE']);
const LIST_CONTEXT_TAGS = new Set(['UL', 'OL', 'LI']);

const resolveAnchorElement = (selection: Selection): HTMLElement | null => {
  const anchorNode = selection.anchorNode;
  if (!anchorNode) {
    return null;
  }

  return anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as HTMLElement)
    : anchorNode.parentElement;
};

const resolveEditorRoot = (selection: Selection): HTMLElement | null =>
  resolveAnchorElement(selection)?.closest(
    '.clinical-document-rich-text-editor'
  ) as HTMLElement | null;

const isInsideListContext = (
  anchorElement: HTMLElement | null,
  editorRoot: HTMLElement
): boolean => {
  let current = anchorElement;
  while (current && current !== editorRoot) {
    if (LIST_CONTEXT_TAGS.has(current.tagName.toUpperCase())) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const resolveNearestIndentableBlock = (
  node: Node | null,
  editorRoot: HTMLElement
): HTMLElement | null => {
  let current =
    node == null
      ? null
      : node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;

  while (current && current !== editorRoot) {
    if (INDENTABLE_BLOCK_TAGS.has(current.tagName.toUpperCase())) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
};

const collectSelectedIndentableBlocks = (
  selection: Selection,
  editorRoot: HTMLElement
): HTMLElement[] => {
  const refreshedRange = selection.getRangeAt(0);
  const nearestBlock = resolveNearestIndentableBlock(selection.anchorNode, editorRoot);

  if (refreshedRange.collapsed) {
    return nearestBlock ? [nearestBlock] : [];
  }

  const blocks = new Set<HTMLElement>();
  const walker = document.createTreeWalker(editorRoot, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      return INDENTABLE_BLOCK_TAGS.has((node as HTMLElement).tagName.toUpperCase())
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let current = walker.nextNode();
  while (current) {
    const block = current as HTMLElement;
    const blockRange = document.createRange();
    blockRange.selectNodeContents(block);
    const intersects =
      refreshedRange.compareBoundaryPoints(Range.END_TO_START, blockRange) < 0 &&
      refreshedRange.compareBoundaryPoints(Range.START_TO_END, blockRange) > 0;
    if (intersects) {
      blocks.add(block);
    }
    current = walker.nextNode();
  }

  if (blocks.size === 0 && nearestBlock) {
    blocks.add(nearestBlock);
  }

  return Array.from(blocks);
};

export const applyClinicalDocumentIndentationCommand = (command: 'indent' | 'outdent'): boolean => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
  const editorRoot = selection ? resolveEditorRoot(selection) : null;
  const anchorElement = selection ? resolveAnchorElement(selection) : null;

  if (!selection || selection.rangeCount === 0 || !editorRoot) {
    return typeof document.execCommand === 'function'
      ? document.execCommand(command, false)
      : false;
  }

  if (isInsideListContext(anchorElement, editorRoot)) {
    return typeof document.execCommand === 'function'
      ? document.execCommand(command, false)
      : false;
  }

  if (!resolveNearestIndentableBlock(selection.anchorNode, editorRoot)) {
    if (typeof document.execCommand !== 'function') {
      return false;
    }
    document.execCommand('formatBlock', false, 'div');
  }

  const refreshedSelection = window.getSelection();
  if (!refreshedSelection || refreshedSelection.rangeCount === 0) {
    return false;
  }

  const blocks = collectSelectedIndentableBlocks(refreshedSelection, editorRoot);
  if (blocks.length === 0) {
    return false;
  }

  blocks.forEach(block => {
    const currentIndent = Number.parseInt(block.style.marginLeft || '0', 10);
    const safeCurrentIndent = Number.isFinite(currentIndent) ? Math.max(0, currentIndent) : 0;
    const nextIndent =
      command === 'indent'
        ? safeCurrentIndent + CLINICAL_DOCUMENT_INDENT_STEP_PX
        : Math.max(0, safeCurrentIndent - CLINICAL_DOCUMENT_INDENT_STEP_PX);

    if (nextIndent === 0) {
      block.style.removeProperty('margin-left');
      if (!block.getAttribute('style')) {
        block.removeAttribute('style');
      }
      return;
    }

    block.style.marginLeft = `${nextIndent}px`;
  });

  return true;
};
