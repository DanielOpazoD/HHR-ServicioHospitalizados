import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ClinicalDocumentFormattingToolbarProps } from '@/features/clinical-documents/components/ClinicalDocumentFormattingToolbar';
import { ClinicalDocumentFormattingToolbar } from '@/features/clinical-documents/components/ClinicalDocumentFormattingToolbar';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';

const selectedDocument = createClinicalDocumentDraft({
  templateId: 'epicrisis',
  hospitalId: 'hhr',
  actor: { uid: 'u1', email: 'a@b.cl', displayName: 'Test', role: 'admin' },
  episode: {
    patientRut: '11.111.111-1',
    patientName: 'Test',
    episodeKey: '11.111.111-1__2026-03-06',
    admissionDate: '2026-03-06',
    sourceDailyRecordDate: '2026-03-06',
    sourceBedId: 'R1',
    specialty: 'Medicina',
  },
  patientFieldValues: {},
  medico: 'Test',
  especialidad: 'Medicina',
});

/** Builds default props for the toolbar, allowing partial overrides. */
const buildProps = (
  overrides: Partial<ClinicalDocumentFormattingToolbarProps> = {}
): ClinicalDocumentFormattingToolbarProps => ({
  selectedDocument,
  canEdit: true,
  formattingDisabled: false,
  isFormattingOpen: false,
  canUndo: false,
  canRedo: false,
  onPrint: vi.fn(),
  onRestoreTemplate: vi.fn(),
  onToggleFormatting: vi.fn(),
  onApplyFormatting: vi.fn(),
  zoom: 100,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  ...overrides,
});

describe('ClinicalDocumentFormattingToolbar', () => {
  it('renders formatting actions and delegates commands when formatting is open', () => {
    const onPrint = vi.fn();
    const onRestoreTemplate = vi.fn();
    const onToggleFormatting = vi.fn();
    const onApplyFormatting = vi.fn();

    render(
      <ClinicalDocumentFormattingToolbar
        {...buildProps({
          isFormattingOpen: true,
          onPrint,
          onRestoreTemplate,
          onToggleFormatting,
          onApplyFormatting,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Formato' }));
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer plantilla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Negrita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar formato' }));

    expect(onToggleFormatting).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onRestoreTemplate).toHaveBeenCalledTimes(1);
    expect(onApplyFormatting).toHaveBeenCalledWith('bold');
    expect(onApplyFormatting).toHaveBeenCalledWith('removeFormat');
  });

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------

  it('dispatches undo/redo commands when buttons are clicked', () => {
    const onApplyFormatting = vi.fn();

    render(
      <ClinicalDocumentFormattingToolbar
        {...buildProps({ canUndo: true, canRedo: true, onApplyFormatting })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rehacer' }));

    expect(onApplyFormatting).toHaveBeenCalledWith('undo');
    expect(onApplyFormatting).toHaveBeenCalledWith('redo');
  });

  it('disables undo when canUndo is false', () => {
    render(
      <ClinicalDocumentFormattingToolbar {...buildProps({ canUndo: false, canRedo: true })} />
    );

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).not.toBeDisabled();
  });

  it('disables redo when canRedo is false', () => {
    render(
      <ClinicalDocumentFormattingToolbar {...buildProps({ canUndo: true, canRedo: false })} />
    );

    expect(screen.getByRole('button', { name: 'Deshacer' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
  });

  it('disables undo/redo when document is locked', () => {
    render(
      <ClinicalDocumentFormattingToolbar
        {...buildProps({
          selectedDocument: { ...selectedDocument, isLocked: true },
          canEdit: false,
          canUndo: true,
          canRedo: true,
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Zoom
  // -----------------------------------------------------------------------

  it('delegates zoom controls', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    render(<ClinicalDocumentFormattingToolbar {...buildProps({ onZoomIn, onZoomOut })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reducir zoom' }));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('disables zoom out at minimum and zoom in at maximum', () => {
    const { rerender } = render(
      <ClinicalDocumentFormattingToolbar {...buildProps({ zoom: 60 })} />
    );

    expect(screen.getByRole('button', { name: 'Reducir zoom' })).toBeDisabled();

    rerender(<ClinicalDocumentFormattingToolbar {...buildProps({ zoom: 150 })} />);

    expect(screen.getByRole('button', { name: 'Aumentar zoom' })).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------

  it('disables controls when editing is unavailable', () => {
    render(
      <ClinicalDocumentFormattingToolbar
        {...buildProps({
          selectedDocument: { ...selectedDocument, isLocked: true },
          canEdit: false,
          formattingDisabled: true,
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Restablecer plantilla' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Formato' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
  });
});
