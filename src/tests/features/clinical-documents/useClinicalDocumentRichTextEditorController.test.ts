import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import type { KeyboardEvent, MutableRefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClinicalDocumentRichTextEditorController } from '@/features/clinical-documents/hooks/useClinicalDocumentRichTextEditorController';

const applyEditorCommandMock = vi.fn();
const normalizeContentMock = vi.fn((value: string) => value.trim());

vi.mock('@/features/clinical-documents/controllers/clinicalDocumentRichTextController', () => ({
  applyClinicalDocumentEditorCommand: (command: string, value?: string) =>
    applyEditorCommandMock(command, value),
  normalizeClinicalDocumentContentForStorage: (value: string) => normalizeContentMock(value),
}));

describe('useClinicalDocumentRichTextEditorController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies activation, input changes, and deactivation with editor history state', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const onChange = vi.fn();
    const onActivate = vi.fn();
    const onDeactivate = vi.fn();
    const editor = document.createElement('div');
    editor.innerHTML = 'Inicial';
    editorRef.current = editor;

    const { result } = renderHook(() =>
      useClinicalDocumentRichTextEditorController({
        sectionId: 'section-1',
        value: 'Inicial',
        disabled: false,
        editorRef,
        onChange,
        onActivate,
        onDeactivate,
      })
    );

    act(() => {
      result.current.handleActivateInteraction();
    });

    expect(onActivate).toHaveBeenCalledWith(
      'section-1',
      expect.objectContaining({ element: editor, canUndo: false, canRedo: false })
    );

    editor.innerHTML = 'Actualizado';
    act(() => {
      result.current.handleInput();
    });

    expect(onChange).toHaveBeenCalledWith('Actualizado');

    act(() => {
      result.current.handleBlur();
    });

    expect(onDeactivate).toHaveBeenCalledWith('section-1');
  });

  it('maps keyboard shortcuts to editor commands and ignores input when disabled', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const editor = document.createElement('div');
    editorRef.current = editor;
    const onChange = vi.fn();

    const { result, rerender } = renderHook(
      ({ disabled }) =>
        useClinicalDocumentRichTextEditorController({
          sectionId: 'section-1',
          value: 'Texto',
          disabled,
          editorRef,
          onChange,
        }),
      { initialProps: { disabled: false } }
    );

    act(() => {
      result.current.handleKeyDown({
        key: 'b',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLDivElement>);
      result.current.handleKeyDown({
        key: 'Tab',
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLDivElement>);
    });

    expect(applyEditorCommandMock).toHaveBeenCalledWith('bold', undefined);
    expect(applyEditorCommandMock).toHaveBeenCalledWith('outdent', undefined);

    rerender({ disabled: true });
    act(() => {
      result.current.handleKeyDown({
        key: 'i',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLDivElement>);
    });

    expect(applyEditorCommandMock).toHaveBeenCalledTimes(2);
  });

  it('defers external content sync while focused and applies it on blur', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const editor = document.createElement('div');
    editor.innerHTML = 'Inicial';
    editorRef.current = editor;
    const onChange = vi.fn();

    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get');

    const { result, rerender } = renderHook(
      ({ value }) =>
        useClinicalDocumentRichTextEditorController({
          sectionId: 'section-1',
          value,
          disabled: false,
          editorRef,
          onChange,
        }),
      { initialProps: { value: 'Inicial' } }
    );

    activeElementSpy.mockReturnValue(editor);
    rerender({ value: 'Actualizado externamente' });

    expect(editor.innerHTML).toBe('Inicial');

    activeElementSpy.mockReturnValue(document.body);
    act(() => {
      result.current.handleBlur();
    });

    expect(editor.innerHTML).toBe('Actualizado externamente');

    activeElementSpy.mockRestore();
  });
});
