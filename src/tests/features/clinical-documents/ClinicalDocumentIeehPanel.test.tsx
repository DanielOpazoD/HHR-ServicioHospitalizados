import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentIeehPanel } from '@/features/clinical-documents/components/ClinicalDocumentIeehPanel';
import { createClinicalDocumentDraft } from '@/features/clinical-documents/domain/factories';
import { createEmptyIeehDraft } from '@/features/clinical-documents/controllers/clinicalDocumentIeehController';

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
      specialty: 'Cirugía',
    },
    patientFieldValues: {
      nombre: 'Paciente Test',
      rut: '11.111.111-1',
    },
    medico: 'Doctor Test',
    especialidad: 'Cirugía',
  });

describe('ClinicalDocumentIeehPanel', () => {
  it('starts collapsed even when a saved draft already exists', () => {
    const draft = {
      ...createEmptyIeehDraft(),
      cie10Code: 'A00',
      cie10Description: 'Cólera',
      diagnosticoPrincipal: 'Cólera',
    };

    render(
      <ClinicalDocumentIeehPanel
        document={buildDocument()}
        draft={draft}
        canEdit={true}
        onPatchDraft={vi.fn()}
        onClearDraft={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /egreso estadístico/i })).toBeInTheDocument();
    expect(screen.queryByText(/diagnóstico principal \(cie-10\)/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /egreso estadístico/i }));

    expect(screen.getByText(/diagnóstico principal \(cie-10\)/i)).toBeInTheDocument();
  });
});
