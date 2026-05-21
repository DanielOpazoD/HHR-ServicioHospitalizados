import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClinicalAttachments } from '@/features/clinical-documents/hooks/useClinicalAttachments';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

vi.mock('@/application/clinical-documents/clinicalAttachmentUseCases', () => ({
  executeListClinicalAttachmentsByEpisode: vi.fn(),
  executeUploadClinicalAttachment: vi.fn(),
  executeDeleteClinicalAttachment: vi.fn(),
}));

import {
  executeDeleteClinicalAttachment,
  executeListClinicalAttachmentsByEpisode,
  executeUploadClinicalAttachment,
} from '@/application/clinical-documents/clinicalAttachmentUseCases';

const user = {
  uid: 'u1',
  email: 'doctor@example.com',
  displayName: 'Doctor Test',
};

const document = {
  id: 'doc_1',
  hospitalId: 'hhr',
  documentType: 'epicrisis',
  patientRut: '13.545.665-9',
  patientName: 'Paciente Test',
  episodeKey: 'episode-1',
  admissionDate: '2026-04-15',
  sourceDailyRecordDate: '2026-04-15',
  sourceBedId: 'R2',
} as ClinicalDocumentRecord;

describe('useClinicalAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(executeListClinicalAttachmentsByEpisode).mockResolvedValue({
      status: 'success',
      data: [],
      issues: [],
    });
  });

  it('loads attachments for the selected document episode', async () => {
    vi.mocked(executeListClinicalAttachmentsByEpisode).mockResolvedValue({
      status: 'success',
      data: [{ id: 'att_1', displayName: 'Informe.pdf' }] as never,
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalAttachments({
        selectedDocument: document,
        hospitalId: 'hhr',
        canEdit: true,
        user,
        role: 'doctor_urgency',
        notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
      })
    );

    await waitFor(() => expect(result.current.attachments).toHaveLength(1));
    expect(executeListClinicalAttachmentsByEpisode).toHaveBeenCalledWith({
      episodeKey: 'episode-1',
      hospitalId: 'hhr',
    });
  });

  it('uploads and deletes attachments with selected document context', async () => {
    const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.mocked(executeUploadClinicalAttachment).mockResolvedValue({
      status: 'success',
      data: { id: 'att_1', displayName: 'Nuevo.pdf' } as never,
      issues: [],
    });
    vi.mocked(executeDeleteClinicalAttachment).mockResolvedValue({
      status: 'success',
      data: undefined,
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalAttachments({
        selectedDocument: document,
        hospitalId: 'hhr',
        canEdit: true,
        user,
        role: 'doctor_urgency',
        notify,
      })
    );

    await act(async () => {
      await result.current.uploadAttachment(
        new File([new Uint8Array(8)], 'nuevo.pdf', { type: 'application/pdf' })
      );
    });

    expect(executeUploadClinicalAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        hospitalId: 'hhr',
        patientRut: '13.545.665-9',
        episodeKey: 'episode-1',
        documentId: 'doc_1',
        actor: expect.objectContaining({ uid: 'u1', role: 'doctor_urgency' }),
      })
    );
    expect(notify.success).toHaveBeenCalledWith(
      'Adjunto guardado',
      'El archivo quedó asociado a esta hospitalización.'
    );

    await act(async () => {
      await result.current.deleteAttachment({
        id: 'att_1',
        hospitalId: 'hhr',
        storagePath: 'clinical-attachments/hhr/rut/episode/att_1/nuevo.pdf',
      } as never);
    });

    expect(executeDeleteClinicalAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentId: 'att_1',
        hospitalId: 'hhr',
        storagePath: 'clinical-attachments/hhr/rut/episode/att_1/nuevo.pdf',
      })
    );
  });

  it('uploads pasted images and returns Storage image insertion metadata', async () => {
    const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.mocked(executeUploadClinicalAttachment).mockResolvedValue({
      status: 'success',
      data: {
        id: 'att_img',
        displayName: 'captura.png',
        downloadUrl: 'https://storage.test/captura.png',
        storagePath: 'clinical-attachments/hhr/rut/episode/att_img/captura.png',
      } as never,
      issues: [],
    });

    const { result } = renderHook(() =>
      useClinicalAttachments({
        selectedDocument: document,
        hospitalId: 'hhr',
        canEdit: true,
        user,
        role: 'doctor_urgency',
        notify,
      })
    );

    const pastedImage = new File([new Uint8Array(700 * 1024)], 'captura.png', {
      type: 'image/png',
    });
    let uploadResult: Awaited<ReturnType<typeof result.current.uploadPastedImage>> = null;
    await act(async () => {
      uploadResult = await result.current.uploadPastedImage(pastedImage);
    });

    expect(executeUploadClinicalAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        file: pastedImage,
        displayName: 'captura.png',
        image: { compressed: false },
      })
    );
    expect(uploadResult).toEqual({
      attachmentId: 'att_img',
      imageUrl: 'https://storage.test/captura.png',
      storagePath: 'clinical-attachments/hhr/rut/episode/att_img/captura.png',
    });
  });
});
