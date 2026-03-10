import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import {
  applyClinicalDocumentEditorCommand,
  convertPlainTextToClinicalDocumentHtml,
  normalizeClinicalDocumentContentForStorage,
} from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';

interface ClinicalDocumentRichTextEditorProps {
  sectionId: string;
  sectionTitle: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onActivate?: (
    sectionId: string,
    editor: {
      element: HTMLDivElement | null;
      canUndo: boolean;
      canRedo: boolean;
      applyCommand: (
        command:
          | 'bold'
          | 'italic'
          | 'underline'
          | 'foreColor'
          | 'hiliteColor'
          | 'insertUnorderedList'
          | 'insertOrderedList'
          | 'indent'
          | 'outdent'
          | 'removeFormat'
          | 'undo'
          | 'redo',
        value?: string
      ) => void;
      insertText: (text: string) => boolean;
    }
  ) => void;
  onDeactivate?: (sectionId: string) => void;
}

export const ClinicalDocumentRichTextEditor: React.FC<ClinicalDocumentRichTextEditorProps> = ({
  sectionId,
  sectionTitle,
  value,
  disabled = false,
  onChange,
  onActivate,
  onDeactivate,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const isActiveRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const pendingInsertBlockRef = useRef<HTMLElement | null>(null);
  const lastLocalNormalizedValueRef = useRef('');
  const onActivateRef = useRef(onActivate);
  const onDeactivateRef = useRef(onDeactivate);
  const applyEditorCommandRef = useRef<
    | ((
        command:
          | 'bold'
          | 'italic'
          | 'underline'
          | 'foreColor'
          | 'hiliteColor'
          | 'insertUnorderedList'
          | 'insertOrderedList'
          | 'indent'
          | 'outdent'
          | 'removeFormat'
          | 'undo'
          | 'redo',
        value?: string
      ) => void)
    | null
  >(null);
  const normalizedValue = useMemo(() => normalizeClinicalDocumentContentForStorage(value), [value]);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    onActivateRef.current = onActivate;
    onDeactivateRef.current = onDeactivate;
  }, [onActivate, onDeactivate]);

  const updateHistoryState = useCallback(
    (nextIndex = historyIndexRef.current, history = historyRef.current) => {
      setHistoryState({
        canUndo: nextIndex > 0,
        canRedo: nextIndex >= 0 && nextIndex < history.length - 1,
      });
    },
    []
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentNormalizedHtml = normalizeClinicalDocumentContentForStorage(editor.innerHTML);
    const isFocused = typeof document !== 'undefined' && document.activeElement === editor;
    const isLocalEcho = normalizedValue === lastLocalNormalizedValueRef.current;

    if (currentNormalizedHtml !== normalizedValue && (!isFocused || !isLocalEcho)) {
      editor.innerHTML = normalizedValue;
    }
    if (!isApplyingHistoryRef.current && (!isFocused || !isLocalEcho)) {
      historyRef.current = [normalizedValue];
      historyIndexRef.current = 0;
      updateHistoryState(0, historyRef.current);
    }
    isApplyingHistoryRef.current = false;
  }, [normalizedValue, updateHistoryState]);

  const pushHistorySnapshot = useCallback(
    (html: string) => {
      const normalizedHtml = normalizeClinicalDocumentContentForStorage(html);
      const current = historyRef.current[historyIndexRef.current];
      if (normalizedHtml === current) {
        return;
      }
      historyRef.current = [
        ...historyRef.current.slice(0, historyIndexRef.current + 1),
        normalizedHtml,
      ];
      historyIndexRef.current = historyRef.current.length - 1;
      updateHistoryState();
    },
    [updateHistoryState]
  );

  const saveSelectionRange = useCallback(() => {
    const editor = editorRef.current;
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    savedRangeRef.current = range.cloneRange();
  }, []);

  const resolveBlockFromRange = useCallback(
    (range: Range | null | undefined): HTMLElement | null => {
      const editor = editorRef.current;
      const startNode = range?.startContainer;
      if (!editor || !startNode) {
        return null;
      }

      let candidate: HTMLElement | null =
        startNode.nodeType === Node.ELEMENT_NODE
          ? (startNode as HTMLElement)
          : startNode.parentElement;

      while (candidate && candidate !== editor) {
        if (['DIV', 'P', 'LI', 'BLOCKQUOTE'].includes(candidate.tagName.toUpperCase())) {
          return candidate;
        }
        candidate = candidate.parentElement;
      }

      return null;
    },
    []
  );

  const normalizeInsertedHtml = useCallback((html: string): string => {
    const normalized = normalizeClinicalDocumentContentForStorage(html);
    return normalized
      .replace(/^(<br>\s*)+/i, '')
      .replace(/(<br>\s*)+$/i, '')
      .trim();
  }, []);

  const insertTextAtCursor = useCallback(
    (text: string): boolean => {
      const editor = editorRef.current;
      const normalizedText = text.trim();
      if (!editor || disabled || !normalizedText) {
        return false;
      }

      editor.focus();

      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      const savedRange = savedRangeRef.current;
      if (selection && savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }

      const html = convertPlainTextToClinicalDocumentHtml(normalizedText);
      const currentRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : savedRangeRef.current;
      const pendingInsertBlock =
        pendingInsertBlockRef.current && editor.contains(pendingInsertBlockRef.current)
          ? pendingInsertBlockRef.current
          : null;
      const blockElement = pendingInsertBlock || resolveBlockFromRange(currentRange);

      const normalizedBlockHtml =
        blockElement && blockElement !== editor
          ? normalizeClinicalDocumentContentForStorage(blockElement.innerHTML || '')
          : null;
      const blockIsEmpty =
        blockElement &&
        blockElement !== editor &&
        (normalizedBlockHtml === '' || normalizedBlockHtml === '<br>');

      const createLineBreakBlock = (tagName: string) => {
        const nextBlock = document.createElement(tagName.toLowerCase());
        nextBlock.innerHTML = '<br>';
        return nextBlock;
      };

      if (blockIsEmpty && blockElement) {
        const entryBlock = document.createElement(blockElement.tagName.toLowerCase());
        entryBlock.innerHTML = html;
        const spacerBlock = createLineBreakBlock(blockElement.tagName);

        blockElement.replaceWith(entryBlock);
        entryBlock.insertAdjacentElement('afterend', spacerBlock);

        const nextRange = document.createRange();
        nextRange.selectNodeContents(spacerBlock);
        nextRange.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(nextRange);
        pendingInsertBlockRef.current = spacerBlock;
        saveSelectionRange();
        const nextHtml = normalizeInsertedHtml(editor.innerHTML);
        lastLocalNormalizedValueRef.current = nextHtml;
        pushHistorySnapshot(nextHtml);
        onChange(nextHtml);
        requestAnimationFrame(() => {
          editor.focus();
          const activeSelection = window.getSelection();
          if (!activeSelection || !editor.contains(spacerBlock)) {
            return;
          }
          const restoredRange = document.createRange();
          restoredRange.selectNodeContents(spacerBlock);
          restoredRange.collapse(true);
          activeSelection.removeAllRanges();
          activeSelection.addRange(restoredRange);
          savedRangeRef.current = restoredRange.cloneRange();
        });
        return true;
      }

      if (blockElement && blockElement !== editor) {
        const entryBlock = document.createElement(blockElement.tagName.toLowerCase());
        entryBlock.innerHTML = html;
        const spacerBlock = createLineBreakBlock(blockElement.tagName);

        blockElement.insertAdjacentElement('afterend', spacerBlock);
        blockElement.insertAdjacentElement('afterend', entryBlock);

        const nextRange = document.createRange();
        nextRange.selectNodeContents(spacerBlock);
        nextRange.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(nextRange);
        pendingInsertBlockRef.current = spacerBlock;
      } else {
        const entryBlock = document.createElement('div');
        entryBlock.innerHTML = html;
        const spacerBlock = createLineBreakBlock('DIV');

        editor.appendChild(entryBlock);
        editor.appendChild(spacerBlock);

        const nextRange = document.createRange();
        nextRange.selectNodeContents(spacerBlock);
        nextRange.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(nextRange);
        pendingInsertBlockRef.current = spacerBlock;
      }

      saveSelectionRange();
      const nextHtml = normalizeInsertedHtml(editor.innerHTML);
      lastLocalNormalizedValueRef.current = nextHtml;
      pushHistorySnapshot(nextHtml);
      onChange(nextHtml);
      requestAnimationFrame(() => {
        editor.focus();
        const activeSelection = window.getSelection();
        const spacerBlock = pendingInsertBlockRef.current;
        if (!activeSelection || !spacerBlock || !editor.contains(spacerBlock)) {
          return;
        }
        const restoredRange = document.createRange();
        restoredRange.selectNodeContents(spacerBlock);
        restoredRange.collapse(true);
        activeSelection.removeAllRanges();
        activeSelection.addRange(restoredRange);
        savedRangeRef.current = restoredRange.cloneRange();
      });
      return true;
    },
    [
      disabled,
      normalizeInsertedHtml,
      onChange,
      pushHistorySnapshot,
      resolveBlockFromRange,
      saveSelectionRange,
    ]
  );

  const applyEditorCommand = useCallback(
    (
      command:
        | 'bold'
        | 'italic'
        | 'underline'
        | 'foreColor'
        | 'hiliteColor'
        | 'insertUnorderedList'
        | 'insertOrderedList'
        | 'indent'
        | 'outdent'
        | 'removeFormat'
        | 'undo'
        | 'redo',
      value?: string
    ) => {
      const editor = editorRef.current;
      if (!editor || disabled) return;

      if (command === 'undo') {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        const previous = historyRef.current[historyIndexRef.current] || '';
        isApplyingHistoryRef.current = true;
        editor.innerHTML = previous;
        updateHistoryState();
        lastLocalNormalizedValueRef.current = previous;
        onChange(previous);
        return;
      }

      if (command === 'redo') {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        const next = historyRef.current[historyIndexRef.current] || '';
        isApplyingHistoryRef.current = true;
        editor.innerHTML = next;
        updateHistoryState();
        lastLocalNormalizedValueRef.current = next;
        onChange(next);
        return;
      }

      editor.focus();
      applyClinicalDocumentEditorCommand(command, value);
      const html = normalizeClinicalDocumentContentForStorage(editor.innerHTML);
      lastLocalNormalizedValueRef.current = html;
      pushHistorySnapshot(html);
      onChange(html);
    },
    [disabled, onChange, pushHistorySnapshot, updateHistoryState]
  );

  useEffect(() => {
    applyEditorCommandRef.current = applyEditorCommand;
  }, [applyEditorCommand]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    pendingInsertBlockRef.current = null;
    const html = normalizeClinicalDocumentContentForStorage(editor.innerHTML);
    lastLocalNormalizedValueRef.current = html;
    pushHistorySnapshot(html);
    onChange(html);
  }, [onChange, pushHistorySnapshot]);

  const notifyActive = useCallback(
    (history = historyState) => {
      isActiveRef.current = true;
      onActivateRef.current?.(sectionId, {
        element: editorRef.current,
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        applyCommand: (command, value) => applyEditorCommandRef.current?.(command, value),
        insertText: text => insertTextAtCursor(text),
      });
    },
    [historyState, insertTextAtCursor, sectionId]
  );

  const handleActivateInteraction = useCallback(() => {
    notifyActive();
  }, [notifyActive]);

  useEffect(() => {
    if (!isActiveRef.current) return;
    onActivateRef.current?.(sectionId, {
      element: editorRef.current,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      applyCommand: (command, value) => applyEditorCommandRef.current?.(command, value),
      insertText: text => insertTextAtCursor(text),
    });
  }, [historyState.canRedo, historyState.canUndo, insertTextAtCursor, sectionId]);

  return (
    <div className="clinical-document-rich-text-wrap">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={`Contenido ${sectionTitle}`}
        data-section-editor={sectionId}
        className={clsx(
          'clinical-document-textarea clinical-document-rich-text-editor',
          disabled && 'is-readonly'
        )}
        onInput={handleInput}
        onFocus={handleActivateInteraction}
        onMouseUp={() => {
          pendingInsertBlockRef.current = null;
          saveSelectionRange();
          handleActivateInteraction();
        }}
        onKeyUp={saveSelectionRange}
        onBlur={() => {
          saveSelectionRange();
          isActiveRef.current = false;
          onDeactivateRef.current?.(sectionId);
        }}
        onKeyDown={event => {
          if (!editorRef.current || disabled) return;
          const isPrimaryModifier = event.metaKey || event.ctrlKey;

          if (isPrimaryModifier && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            applyEditorCommand('bold');
          }
          if (isPrimaryModifier && event.key.toLowerCase() === 'i') {
            event.preventDefault();
            applyEditorCommand('italic');
          }
          if (isPrimaryModifier && event.key.toLowerCase() === 'u') {
            event.preventDefault();
            applyEditorCommand('underline');
          }
          if (isPrimaryModifier && event.shiftKey && event.key.toLowerCase() === '7') {
            event.preventDefault();
            applyEditorCommand('insertOrderedList');
          }
          if (isPrimaryModifier && event.key.toLowerCase() === 'z' && event.shiftKey) {
            event.preventDefault();
            applyEditorCommand('redo');
          } else if (isPrimaryModifier && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            applyEditorCommand('undo');
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            applyEditorCommand(event.shiftKey ? 'outdent' : 'indent');
          }
        }}
      />
    </div>
  );
};
