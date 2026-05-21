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
  it('renders episode attachments with upload and delete actions', async () => {
    const onUploadAttachment = vi.fn(async () => undefined);
    const onDeleteAttachment = vi.fn(async () => undefined);

    render(
      <ClinicalAttachmentsPanel
        canEdit={true}
        attachments={[
          buildAttachment(),
          buildAttachment({
            id: 'att_2',
            displayName: 'Foto clínica.jpg',
            fileKind: 'image',
            contentType: 'image/jpeg',
            sizeBytes: 700 * 1024,
          }),
        ]}
        isLoading={false}
        isUploading={false}
        onUploadAttachment={onUploadAttachment}
        onDeleteAttachment={onDeleteAttachment}
      />
    );

    expect(screen.getByRole('heading', { name: /anexos y archivos/i })).toBeInTheDocument();
    expect(screen.getByText('Informe externo.pdf')).toBeInTheDocument();
    expect(screen.getByText('Foto clínica.jpg')).toBeInTheDocument();
    expect(screen.getByText(/700 KB/i)).toBeInTheDocument();

    const file = new File([new Uint8Array(16)], 'nuevo.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/adjuntar archivo clinico/i), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onUploadAttachment).toHaveBeenCalledWith(file));

    fireEvent.click(screen.getByRole('button', { name: /eliminar informe externo.pdf/i }));
    expect(onDeleteAttachment).toHaveBeenCalledWith(buildAttachment());
  });

  it('shows empty and uploading states', () => {
    render(
      <ClinicalAttachmentsPanel
        canEdit={true}
        attachments={[]}
        isLoading={false}
        isUploading={true}
        onUploadAttachment={vi.fn()}
        onDeleteAttachment={vi.fn()}
      />
    );

    expect(screen.getByText(/sin adjuntos clinicos/i)).toBeInTheDocument();
    expect(screen.getByText(/subiendo adjunto/i)).toBeInTheDocument();
  });
});
