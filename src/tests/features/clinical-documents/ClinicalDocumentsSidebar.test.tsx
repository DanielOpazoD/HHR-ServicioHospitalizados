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
        onDuplicateDocument={() => {}}
        onDeleteDocument={() => {}}
      />
    );

    expect(screen.getByText(/perfil en solo lectura/i)).toBeInTheDocument();
    expect(screen.queryByText(/^nuevo documento$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crear documento$/i })).toBeDisabled();
  });

  it('renders documents and delegates selection and deletion', () => {
    const document = buildDocument();
    const onSelectDocument = vi.fn();
    const onDuplicateDocument = vi.fn();
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
        onDuplicateDocument={onDuplicateDocument}
        onDeleteDocument={onDeleteDocument}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /epicrisis/i,
      })
    );
    expect(onSelectDocument).toHaveBeenCalledWith(document.id);

    fireEvent.click(screen.getByTitle(/duplicar documento/i));
    expect(onDuplicateDocument).toHaveBeenCalledWith(document);

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
        onDuplicateDocument={() => {}}
        onDeleteDocument={() => {}}
      />
    );

    expect(screen.getByText(/episodio cerrado por alta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crear documento$/i })).toBeDisabled();
    expect(screen.queryByTitle(/eliminar documento/i)).not.toBeInTheDocument();
  });

  it('groups clinical insert shortcuts inside an insert tray', () => {
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
        onDuplicateDocument={() => {}}
        onDeleteDocument={() => {}}
        onOpenLabDialog={onOpenLabDialog}
        onOpenMMRADDialog={onOpenMMRADDialog}
      />
    );

    expect(screen.queryByRole('button', { name: /laboratorio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /imagenología mmrad/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /insertar contenido/i }));

    fireEvent.click(screen.getByRole('button', { name: /laboratorio/i }));

    fireEvent.click(screen.getByRole('button', { name: /insertar contenido/i }));
    fireEvent.click(screen.getByRole('button', { name: /imagenología mmrad/i }));

    expect(onOpenLabDialog).toHaveBeenCalledTimes(1);
    expect(onOpenMMRADDialog).toHaveBeenCalledTimes(1);
  });

  it('keeps json import/export in an advanced tools group', () => {
    const document = buildDocument();
    const onExportJson = vi.fn();
    const onImportJson = vi.fn();

    render(
      <ClinicalDocumentsSidebar
        canEdit={true}
        canDelete={false}
        readOnlyMessage={null}
        patientName="Paciente Test"
        templates={[{ id: 'epicrisis', name: 'Epicrisis' }]}
        selectedTemplateId="epicrisis"
        onSelectTemplate={() => {}}
        onCreateDocument={() => {}}
        documents={[document]}
        selectedDocumentId={document.id}
        onSelectDocument={() => {}}
        onDuplicateDocument={() => {}}
        onDeleteDocument={() => {}}
        onExportJson={onExportJson}
        onImportJson={onImportJson}
      />
    );

    expect(screen.queryByRole('button', { name: /exportar json/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /herramientas avanzadas/i }));
    fireEvent.click(screen.getByRole('button', { name: /exportar json/i }));
    fireEvent.change(screen.getByLabelText(/archivo json de documento clínico/i), {
      target: {
        files: [
          new File([JSON.stringify({ ok: true })], 'documento.json', { type: 'application/json' }),
        ],
      },
    });

    expect(onExportJson).toHaveBeenCalledWith(document);
    expect(onImportJson).toHaveBeenCalledWith(expect.any(File));
  });
});
