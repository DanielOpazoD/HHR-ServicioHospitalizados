import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import type { ClipboardEvent, KeyboardEvent, MutableRefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClinicalDocumentRichTextEditorController } from '@/features/clinical-documents/hooks/useClinicalDocumentRichTextEditorController';
import { CLINICAL_DOCUMENT_MAX_INLINE_IMAGE_BYTES } from '@/features/clinical-documents/controllers/clinicalDocumentPasteController';

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

  it('does not overwrite a local edit with a stale external value on blur', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const editor = document.createElement('div');
    editor.innerHTML = 'Plan generado por IA';
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
      { initialProps: { value: 'Plan generado por IA' } }
    );

    activeElementSpy.mockReturnValue(editor);
    editor.innerHTML = 'Plan editado por medico';
    act(() => {
      result.current.handleInput();
    });

    rerender({ value: 'Plan generado por IA actualizado externamente' });

    activeElementSpy.mockReturnValue(document.body);
    act(() => {
      result.current.handleBlur();
    });

    expect(editor.innerHTML).toBe('Plan editado por medico');
    expect(onChange).toHaveBeenLastCalledWith('Plan editado por medico');

    activeElementSpy.mockRestore();
  });

  it('routes insertHtml through the editor activation api and commits a normalized change', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const editor = document.createElement('div');
    editor.innerHTML = 'Inicial';
    editorRef.current = editor;
    const onChange = vi.fn();
    const onActivate = vi.fn();

    Object.defineProperty(globalThis.document, 'execCommand', {
      value: vi.fn((command: string, _showUi: boolean, value?: string) => {
        if (command === 'insertHTML') {
          editor.innerHTML = `${editor.innerHTML}${value ?? ''}`;
        }
        return true;
      }),
      configurable: true,
    });

    const { result } = renderHook(() =>
      useClinicalDocumentRichTextEditorController({
        sectionId: 'section-1',
        value: 'Inicial',
        disabled: false,
        editorRef,
        onChange,
        onActivate,
      })
    );

    act(() => {
      result.current.handleActivateInteraction();
    });

    const activationApi = onActivate.mock.calls.at(-1)?.[1];
    expect(activationApi).toBeTruthy();

    act(() => {
      activationApi.insertHtml('<strong> Nuevo</strong>');
    });

    expect(editor.innerHTML).toBe('Inicial<strong> Nuevo</strong>');
    expect(onChange).toHaveBeenLastCalledWith('Inicial<strong> Nuevo</strong>');
  });

  it('commits direct editor DOM mutations through the shared normalization pipeline', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const editor = document.createElement('div');
    editor.innerHTML = 'Inicial';
    editorRef.current = editor;
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useClinicalDocumentRichTextEditorController({
        sectionId: 'section-1',
        value: 'Inicial',
        disabled: false,
        editorRef,
        onChange,
      })
    );

    editor.innerHTML = '  <img src="x"> Actualizado ';

    act(() => {
      result.current.commitEditorDomMutation();
    });

    expect(normalizeContentMock).toHaveBeenCalledWith('  <img src="x"> Actualizado ');
    expect(onChange).toHaveBeenLastCalledWith('<img src="x"> Actualizado');
  });

  it('notifies and skips insertion when a pasted image exceeds the inline limit', () => {
    const editorRef = createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>;
    const editor = document.createElement('div');
    editor.innerHTML = 'Inicial';
    editorRef.current = editor;
    const onChange = vi.fn();
    const onImagePasteRejected = vi.fn();
    const preventDefault = vi.fn();
    const file = new File(
      [new Uint8Array(CLINICAL_DOCUMENT_MAX_INLINE_IMAGE_BYTES + 1)],
      'large.png',
      { type: 'image/png' }
    );

    const { result } = renderHook(() =>
      useClinicalDocumentRichTextEditorController({
        sectionId: 'section-1',
        value: 'Inicial',
        disabled: false,
        editorRef,
        onChange,
        onImagePasteRejected,
      })
    );

    act(() => {
      result.current.handlePaste({
        preventDefault,
        clipboardData: {
          files: [file],
          getData: () => '',
        },
      } as unknown as ClipboardEvent<HTMLDivElement>);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(onImagePasteRejected).toHaveBeenCalledWith(expect.stringContaining('supera el limite'));
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.innerHTML).toBe('Inicial');
  });
});
