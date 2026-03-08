import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import {
  applyClinicalDocumentEditorCommand,
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
    }
  ) => void;
}

export const ClinicalDocumentRichTextEditor: React.FC<ClinicalDocumentRichTextEditorProps> = ({
  sectionId,
  sectionTitle,
  value,
  disabled = false,
  onChange,
  onActivate,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const isActiveRef = useRef(false);
  const normalizedValue = useMemo(() => normalizeClinicalDocumentContentForStorage(value), [value]);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

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
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
    if (!isApplyingHistoryRef.current) {
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
        onChange(next);
        return;
      }

      editor.focus();
      applyClinicalDocumentEditorCommand(command, value);
      const html = editor.innerHTML;
      pushHistorySnapshot(html);
      onChange(html);
    },
    [disabled, onChange, pushHistorySnapshot, updateHistoryState]
  );

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    pushHistorySnapshot(html);
    onChange(html);
  }, [onChange, pushHistorySnapshot]);

  const notifyActive = useCallback(() => {
    isActiveRef.current = true;
    onActivate?.(sectionId, {
      element: editorRef.current,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      applyCommand: applyEditorCommand,
    });
  }, [applyEditorCommand, historyState.canRedo, historyState.canUndo, onActivate, sectionId]);

  useEffect(() => {
    if (isActiveRef.current) {
      notifyActive();
    }
  }, [notifyActive]);

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
        onFocus={notifyActive}
        onMouseUp={notifyActive}
        onBlur={() => {
          isActiveRef.current = false;
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
