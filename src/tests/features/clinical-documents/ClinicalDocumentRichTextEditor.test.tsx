import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClinicalDocumentRichTextEditor } from '@/features/clinical-documents/components/ClinicalDocumentRichTextEditor';

vi.mock('@/features/clinical-documents/components/ClinicalDocumentImageEditor', () => ({
  ClinicalDocumentImageEditor: ({
    onUpdate,
    onClose,
  }: {
    onUpdate: () => void;
    onClose: () => void;
  }) => (
    <div>
      <button type="button" onClick={onUpdate}>
        aplicar imagen
      </button>
      <button type="button" onClick={onClose}>
        cerrar imagen
      </button>
    </div>
  ),
}));

describe('ClinicalDocumentRichTextEditor', () => {
  it('keeps the focused editor content stable until blur when an external value arrives', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ClinicalDocumentRichTextEditor
        sectionId="analisis"
        sectionTitle="Análisis"
        value="Inicial"
        onChange={onChange}
      />
    );

    const editor = screen.getByRole('textbox', { name: /contenido análisis/i });

    await waitFor(() => {
      expect(editor.innerHTML).toBe('Inicial');
    });

    editor.focus();
    expect(document.activeElement).toBe(editor);
    rerender(
      <ClinicalDocumentRichTextEditor
        sectionId="analisis"
        sectionTitle="Análisis"
        value="Actualizado externamente"
        onChange={onChange}
      />
    );

    expect(editor.innerHTML).toBe('Inicial');

    fireEvent.blur(editor);

    await waitFor(() => {
      expect(editor.innerHTML).toBe('Actualizado externamente');
    });
  });

  it('commits image edits through the same editor mutation pipeline', async () => {
    const onChange = vi.fn();
    render(
      <ClinicalDocumentRichTextEditor
        sectionId="analisis"
        sectionTitle="Análisis"
        value={'<img src="x" alt="grafico">'}
        onChange={onChange}
      />
    );

    const editor = screen.getByRole('textbox', { name: /contenido análisis/i });

    await waitFor(() => {
      expect(editor.querySelector('img')).not.toBeNull();
    });

    const image = editor.querySelector('img') as HTMLImageElement;
    fireEvent.click(image);
    image.style.marginLeft = '24px';

    fireEvent.click(screen.getByRole('button', { name: /aplicar imagen/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('margin-left: 24px'));
    });
  });
});
