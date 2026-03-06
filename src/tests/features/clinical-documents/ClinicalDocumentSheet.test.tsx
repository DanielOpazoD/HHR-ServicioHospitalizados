import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';

const buildDocument = () =>
  createClinicalDocumentDraft({
    templateId: 'epicrisis',
    hospitalId: 'hhr',
    actor: {
      uid: 'u1',
      email: 'doctor@test.com',
      displayName: 'Doctor Test',
      role: 'doctor_urgency',
    },
    episode: {
      patientRut: '11.111.111-1',
      patientName: 'Paciente Test',
      episodeKey: '11.111.111-1__2026-03-06',
      admissionDate: '2026-03-06',
      sourceDailyRecordDate: '2026-03-06',
      sourceBedId: 'R1',
      specialty: 'Medicina',
    },
    patientFieldValues: {
      nombre: 'Paciente Test',
      rut: '11.111.111-1',
      edad: '40a',
      fecnac: '1986-01-01',
      fing: '2026-03-06',
      finf: '2026-03-06',
      hinf: '10:30',
    },
    medico: 'Doctor Test',
    especialidad: 'Medicina',
  });

const defaultHandlers = {
  onSave: vi.fn(),
  onSign: vi.fn(),
  onUnsign: vi.fn(),
  onPrint: vi.fn(),
  onUploadPdf: vi.fn(),
  patchDocumentTitle: vi.fn(),
  patchPatientInfoTitle: vi.fn(),
  patchPatientField: vi.fn(),
  patchSectionTitle: vi.fn(),
  patchSection: vi.fn(),
  patchFooterLabel: vi.fn(),
  patchDocumentMeta: vi.fn(),
};

describe('ClinicalDocumentSheet', () => {
  it('shows empty state when there is no selected document', () => {
    render(
      <ClinicalDocumentSheet
        selectedDocument={null}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[]}
        {...defaultHandlers}
      />
    );

    expect(
      screen.getByText(/selecciona o crea un documento clínico para comenzar/i)
    ).toBeInTheDocument();
  });

  it('renders editor and delegates toolbar actions', () => {
    const document = buildDocument();
    render(
      <ClinicalDocumentSheet
        selectedDocument={document}
        canEdit={true}
        canUnsignSelectedDocument={false}
        role="doctor_urgency"
        isSaving={false}
        isUploadingPdf={false}
        validationIssues={[{ message: 'Falta completar diagnóstico.' }]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByDisplayValue(document.medico)).toBeInTheDocument();
    expect(screen.getByText(/falta completar diagnóstico/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));

    expect(defaultHandlers.onSave).toHaveBeenCalled();
    expect(defaultHandlers.onPrint).toHaveBeenCalled();
  });
});
