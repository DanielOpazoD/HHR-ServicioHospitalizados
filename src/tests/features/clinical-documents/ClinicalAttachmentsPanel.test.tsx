import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClinicalAttachmentsPanel } from '@/features/clinical-documents/components/ClinicalAttachmentsPanel';
import type { ClinicalAttachmentRecord } from '@/features/clinical-documents/domain/entities';

const actor = {
  uid: 'u1',
  email: 'doctor@example.com',
  displayName: 'Doctor',
  role: 'doctor_urgency',
};

const buildAttachment = (
  override: Partial<ClinicalAttachmentRecord> = {}
): ClinicalAttachmentRecord => ({
  id: 'att_1',
  hospitalId: 'hhr',
  patientRut: '13.545.665-9',
  patientRutKey: '13545665-9',
  patientName: 'Paciente Test',
  episodeKey: 'episode-1',
  storagePath: 'clinical-attachments/hhr/rut/episode/att_1/informe.pdf',
  downloadUrl: 'https://storage.test/informe.pdf',
  originalFileName: 'informe.pdf',
  displayName: 'Informe externo.pdf',
  contentType: 'application/pdf',
  fileKind: 'pdf',
  sizeBytes: 1024,
  status: 'active',
  createdAt: '2026-05-21T10:00:00.000Z',
  createdBy: actor,
  updatedAt: '2026-05-21T10:00:00.000Z',
  updatedBy: actor,
  ...override,
});

describe('ClinicalAttachmentsPanel', () => {
  it('separates current-document attachments from the episode clinical archive', async () => {
    const onUploadAttachment = vi.fn(async () => undefined);
    const onDeleteAttachment = vi.fn(async () => undefined);
    const onRenameAttachment = vi.fn(async () => undefined);
    const onSuggestAttachmentName = vi.fn(async () => null);

    render(
      <ClinicalAttachmentsPanel
        canEdit={true}
        currentDocumentId="doc-current"
        attachments={[
          buildAttachment({ documentId: 'doc-current' }),
          buildAttachment({
            id: 'att_2',
            displayName: 'Foto clínica.jpg',
            fileKind: 'image',
            contentType: 'image/jpeg',
            sizeBytes: 700 * 1024,
            documentId: 'doc-other',
          }),
        ]}
        patientAttachments={[]}
        isLoading={false}
        isLoadingPatientAttachments={false}
        isUploading={false}
        uploadStatusMessage={null}
        onUploadAttachment={onUploadAttachment}
        onDeleteAttachment={onDeleteAttachment}
        onRenameAttachment={onRenameAttachment}
        onSuggestAttachmentName={onSuggestAttachmentName}
      />
    );

    expect(
      screen.getByRole('heading', { name: /adjuntos de este documento/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /archivo clínico del episodio/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/respaldan solo el documento abierto/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no necesariamente pertenecen al documento abierto/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Informe externo.pdf')).toBeInTheDocument();
    expect(screen.getByText('Foto clínica.jpg')).toBeInTheDocument();
    expect(screen.getByText(/700 KB/i)).toBeInTheDocument();

    const file = new File([new Uint8Array(16)], 'nuevo.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/adjuntar archivo al documento/i), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onUploadAttachment).toHaveBeenCalledWith(file));

    fireEvent.click(screen.getByRole('button', { name: /eliminar informe externo.pdf/i }));
    expect(onDeleteAttachment).toHaveBeenCalledWith(buildAttachment({ documentId: 'doc-current' }));
  });

  it('allows manual renaming and AI name suggestion for an attachment', async () => {
    const onRenameAttachment = vi.fn(async () => undefined);
    const onSuggestAttachmentName = vi.fn(async () => 'Eco abdominal ingreso.pdf');

    render(
      <ClinicalAttachmentsPanel
        canEdit={true}
        currentDocumentId="doc-current"
        attachments={[buildAttachment({ documentId: 'doc-current' })]}
        patientAttachments={[]}
        isLoading={false}
        isLoadingPatientAttachments={false}
        isUploading={false}
        uploadStatusMessage={null}
        onUploadAttachment={vi.fn()}
        onDeleteAttachment={vi.fn()}
        onRenameAttachment={onRenameAttachment}
        onSuggestAttachmentName={onSuggestAttachmentName}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /renombrar informe externo.pdf/i }));
    fireEvent.change(screen.getByLabelText(/nombre visible del adjunto/i), {
      target: { value: 'Informe cardiologia.pdf' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar nombre/i }));

    await waitFor(() =>
      expect(onRenameAttachment).toHaveBeenCalledWith(
        buildAttachment({ documentId: 'doc-current' }),
        'Informe cardiologia.pdf'
      )
    );

    fireEvent.click(screen.getByRole('button', { name: /renombrar informe externo.pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /sugerir nombre con ia/i }));

    await waitFor(() =>
      expect(onSuggestAttachmentName).toHaveBeenCalledWith(
        buildAttachment({ documentId: 'doc-current' })
      )
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/nombre visible del adjunto/i)).toHaveValue(
        'Eco abdominal ingreso.pdf'
      )
    );
  });

  it('shows empty and uploading states', () => {
    render(
      <ClinicalAttachmentsPanel
        canEdit={true}
        currentDocumentId="doc-current"
        attachments={[]}
        patientAttachments={[]}
        isLoading={false}
        isLoadingPatientAttachments={false}
        isUploading={true}
        uploadStatusMessage="Comprimiendo imagen antes de subir..."
        onUploadAttachment={vi.fn()}
        onDeleteAttachment={vi.fn()}
        onRenameAttachment={vi.fn()}
        onSuggestAttachmentName={vi.fn()}
      />
    );

    expect(screen.getByText(/sin adjuntos de este documento/i)).toBeInTheDocument();
    expect(screen.getByText(/comprimiendo imagen/i)).toBeInTheDocument();
  });

  it('shows patient-wide attachments from other hospitalizations', () => {
    render(
      <ClinicalAttachmentsPanel
        canEdit={true}
        currentDocumentId="doc-current"
        attachments={[buildAttachment({ documentId: 'doc-current' })]}
        patientAttachments={[
          buildAttachment({ documentId: 'doc-current' }),
          buildAttachment({
            id: 'att_other',
            displayName: 'Informe hospitalización previa.pdf',
            episodeKey: 'episode-previous',
            createdAt: '2026-04-10T10:00:00.000Z',
          }),
        ]}
        isLoading={false}
        isLoadingPatientAttachments={false}
        isUploading={false}
        uploadStatusMessage={null}
        onUploadAttachment={vi.fn()}
        onDeleteAttachment={vi.fn()}
        onRenameAttachment={vi.fn()}
        onSuggestAttachmentName={vi.fn()}
      />
    );

    expect(screen.getByText(/archivo clínico del paciente/i)).toBeInTheDocument();
    expect(screen.getByText('Informe hospitalización previa.pdf')).toBeInTheDocument();
  });
});
