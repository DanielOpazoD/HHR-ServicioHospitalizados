import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ClinicalDocumentsSidebar } from '@/features/clinical-documents/components/ClinicalDocumentsSidebar';
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

describe('ClinicalDocumentsSidebar', () => {
  it('shows read-only notice and disables create without patient name', () => {
    render(
      <ClinicalDocumentsSidebar
        canEdit={false}
        canDelete={false}
        patientName=""
        templates={[{ id: 'epicrisis', name: 'Epicrisis' }]}
        selectedTemplateId="epicrisis"
        onSelectTemplate={() => {}}
        onCreateDocument={() => {}}
        documents={[]}
        selectedDocumentId={null}
        onSelectDocument={() => {}}
        onDeleteDocument={() => {}}
      />
    );

    expect(screen.getByText(/perfil en solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear documento/i })).toBeDisabled();
  });

  it('renders documents and delegates selection and deletion', () => {
    const document = buildDocument();
    const onSelectDocument = vi.fn();
    const onDeleteDocument = vi.fn();

    render(
      <ClinicalDocumentsSidebar
        canEdit={true}
        canDelete={true}
        patientName="Paciente Test"
        templates={[{ id: 'epicrisis', name: 'Epicrisis' }]}
        selectedTemplateId="epicrisis"
        onSelectTemplate={() => {}}
        onCreateDocument={() => {}}
        documents={[document]}
        selectedDocumentId={document.id}
        onSelectDocument={onSelectDocument}
        onDeleteDocument={onDeleteDocument}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`${document.title}.*Epicrisis`, 'i'),
      })
    );
    expect(onSelectDocument).toHaveBeenCalledWith(document.id);

    fireEvent.click(screen.getByTitle(/eliminar documento/i));
    expect(onDeleteDocument).toHaveBeenCalledWith(document);
  });
});
