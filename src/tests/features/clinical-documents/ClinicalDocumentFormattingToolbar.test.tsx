import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

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

describe('ClinicalDocumentFormattingToolbar', () => {
  it('renders formatting actions and delegates commands when formatting is open', () => {
    const onPrint = vi.fn();
    const onRestoreTemplate = vi.fn();
    const onToggleFormatting = vi.fn();
    const onApplyFormatting = vi.fn();

    render(
      <ClinicalDocumentFormattingToolbar
        selectedDocument={selectedDocument}
        canEdit={true}
        formattingDisabled={false}
        isFormattingOpen={true}
        onPrint={onPrint}
        onRestoreTemplate={onRestoreTemplate}
        onToggleFormatting={onToggleFormatting}
        onApplyFormatting={onApplyFormatting}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Formato' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer plantilla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Negrita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar formato' }));

    expect(onToggleFormatting).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onRestoreTemplate).toHaveBeenCalledTimes(1);
    expect(onApplyFormatting).toHaveBeenCalledWith('bold');
    expect(onApplyFormatting).toHaveBeenCalledWith('removeFormat');
  });

  it('disables controls when editing is unavailable', () => {
    render(
      <ClinicalDocumentFormattingToolbar
        selectedDocument={{ ...selectedDocument, isLocked: true }}
        canEdit={false}
        formattingDisabled={true}
        isFormattingOpen={false}
        onPrint={vi.fn()}
        onRestoreTemplate={vi.fn()}
        onToggleFormatting={vi.fn()}
        onApplyFormatting={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Restablecer plantilla' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Formato' })).toBeDisabled();
  });
});
