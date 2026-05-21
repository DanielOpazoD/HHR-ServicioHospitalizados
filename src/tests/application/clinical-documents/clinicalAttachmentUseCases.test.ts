import { describe, expect, it, vi } from 'vitest';

import {
  executeDeleteClinicalAttachment,
  executeListClinicalAttachmentsByEpisode,
  executeListClinicalAttachmentsByPatient,
  executeUploadClinicalAttachment,
} from '@/application/clinical-documents/clinicalAttachmentUseCases';

const actor = {
  uid: 'u1',
  email: 'doctor@example.com',
  displayName: 'Doctor',
  role: 'doctor_urgency',
};

const buildRepository = () => ({
  upload: vi.fn(),
  listByEpisode: vi.fn(),
  listByPatient: vi.fn(),
  delete: vi.fn(),
});

describe('clinicalAttachmentUseCases', () => {
  it('returns a success outcome for uploaded clinical attachments', async () => {
    const repository = buildRepository();
    repository.upload.mockResolvedValue({ id: 'att_1', status: 'active' });

    const outcome = await executeUploadClinicalAttachment(
      {
        hospitalId: 'hhr',
        patientRut: '13.545.665-9',
        episodeKey: 'episode-1',
        file: new File([new Uint8Array(8)], 'informe.pdf', { type: 'application/pdf' }),
        actor,
      },
      { repository, createId: () => 'att_1', getNow: () => '2026-05-21T10:00:00.000Z' }
    );

    expect(outcome.status).toBe('success');
    expect(outcome.data).toMatchObject({ id: 'att_1' });
    expect(repository.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'att_1',
        now: '2026-05-21T10:00:00.000Z',
      })
    );
  });

  it('returns failed outcome with user-safe message when upload fails', async () => {
    const repository = buildRepository();
    repository.upload.mockRejectedValue(new Error('permission-denied'));

    const outcome = await executeUploadClinicalAttachment(
      {
        hospitalId: 'hhr',
        patientRut: '13.545.665-9',
        episodeKey: 'episode-1',
        file: new File([new Uint8Array(8)], 'informe.pdf', { type: 'application/pdf' }),
        actor,
      },
      { repository, createId: () => 'att_1', getNow: () => '2026-05-21T10:00:00.000Z' }
    );

    expect(outcome.status).toBe('failed');
    expect(outcome.userSafeMessage).toContain('No se pudo subir');
  });

  it('wraps list and delete repository operations in outcomes', async () => {
    const repository = buildRepository();
    repository.listByEpisode.mockResolvedValue([{ id: 'att_1' }]);
    repository.listByPatient.mockResolvedValue([{ id: 'att_1' }, { id: 'att_2' }]);
    repository.delete.mockResolvedValue(undefined);

    await expect(
      executeListClinicalAttachmentsByEpisode(
        { episodeKey: 'episode-1', hospitalId: 'hhr' },
        { repository }
      )
    ).resolves.toMatchObject({ status: 'success', data: [{ id: 'att_1' }] });
    await expect(
      executeListClinicalAttachmentsByPatient(
        { patientRut: '13.545.665-9', hospitalId: 'hhr' },
        { repository }
      )
    ).resolves.toMatchObject({ status: 'success', data: [{ id: 'att_1' }, { id: 'att_2' }] });
    await expect(
      executeDeleteClinicalAttachment(
        {
          attachmentId: 'att_1',
          hospitalId: 'hhr',
          storagePath: 'clinical-attachments/hhr/rut/episode/att_1/informe.pdf',
          actor,
        },
        { repository, getNow: () => '2026-05-21T11:00:00.000Z' }
      )
    ).resolves.toMatchObject({ status: 'success' });
  });
});
