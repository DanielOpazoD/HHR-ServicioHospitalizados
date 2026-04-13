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
        readOnlyMessage="Perfil en solo lectura: puedes revisar e imprimir, pero no crear nuevos documentos."
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
    expect(screen.queryByText(/^nuevo documento$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crear$/i })).toBeDisabled();
  });

  it('renders documents and delegates selection and deletion', () => {
    const document = buildDocument();
    const onSelectDocument = vi.fn();
    const onDeleteDocument = vi.fn();

    render(
      <ClinicalDocumentsSidebar
        canEdit={true}
        canDelete={true}
        readOnlyMessage={null}
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
        name: /epicrisis/i,
      })
    );
    expect(onSelectDocument).toHaveBeenCalledWith(document.id);

    fireEvent.click(screen.getByTitle(/eliminar documento/i));
    expect(onDeleteDocument).toHaveBeenCalledWith(document);
    expect(screen.getAllByText(/epicrisis/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/doctor test/i)).toBeInTheDocument();
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument();
  });

  it('shows closed-episode notice while keeping the selected document visible', () => {
    const document = buildDocument();

    render(
      <ClinicalDocumentsSidebar
        canEdit={false}
        canDelete={false}
        readOnlyMessage="Episodio cerrado por alta: solo ADMIN puede crear, editar o eliminar documentos."
        patientName="Paciente Test"
        templates={[{ id: 'epicrisis', name: 'Epicrisis' }]}
        selectedTemplateId="epicrisis"
        onSelectTemplate={() => {}}
        onCreateDocument={() => {}}
        documents={[document]}
        selectedDocumentId={document.id}
        onSelectDocument={() => {}}
        onDeleteDocument={() => {}}
      />
    );

    expect(screen.getByText(/episodio cerrado por alta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crear$/i })).toBeDisabled();
    expect(screen.queryByTitle(/eliminar documento/i)).not.toBeInTheDocument();
  });

  it('renders LAB and MMRAD shortcuts when callbacks are provided', () => {
    const onOpenLabDialog = vi.fn();
    const onOpenMMRADDialog = vi.fn();

    render(
      <ClinicalDocumentsSidebar
        canEdit={true}
        canDelete={false}
        readOnlyMessage={null}
        patientName="Paciente Test"
        patientRut="11.111.111-1"
        templates={[{ id: 'epicrisis', name: 'Epicrisis' }]}
        selectedTemplateId="epicrisis"
        onSelectTemplate={() => {}}
        onCreateDocument={() => {}}
        documents={[]}
        selectedDocumentId={null}
        onSelectDocument={() => {}}
        onDeleteDocument={() => {}}
        onOpenLabDialog={onOpenLabDialog}
        onOpenMMRADDialog={onOpenMMRADDialog}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /lab/i }));
    fireEvent.click(screen.getByRole('button', { name: /abrir mmrad/i }));

    expect(onOpenLabDialog).toHaveBeenCalledTimes(1);
    expect(onOpenMMRADDialog).toHaveBeenCalledTimes(1);
  });
});
