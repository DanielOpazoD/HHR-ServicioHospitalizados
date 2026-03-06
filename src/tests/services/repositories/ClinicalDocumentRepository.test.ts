import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    subscribeQuery: vi.fn(),
  },
}));

import { db } from '@/services/infrastructure/db';
import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';

const buildDoc = (
  id: string,
  episodeKey: string,
  updatedAt: string,
  status: ClinicalDocumentRecord['status'] = 'draft'
): ClinicalDocumentRecord =>
  ({
    id,
    hospitalId: 'hhr',
    documentType: 'epicrisis',
    templateId: 'epicrisis',
    templateVersion: 1,
    title: 'Epicrisis médica',
    patientInfoTitle: 'Información del Paciente',
    footerMedicoLabel: 'Médico',
    footerEspecialidadLabel: 'Especialidad',
    patientRut: '1-9',
    patientName: 'Paciente Test',
    episodeKey,
    admissionDate: '2026-03-05',
    sourceDailyRecordDate: '2026-03-05',
    sourceBedId: 'R1',
    patientFields: [],
    sections: [],
    medico: 'Dr. Test',
    especialidad: 'Medicina Interna',
    status,
    isLocked: false,
    isActiveEpisodeDocument: true,
    currentVersion: 1,
    versionHistory: [],
    audit: {
      createdAt: updatedAt,
      createdBy: {
        uid: 'u1',
        email: 'test@hospital.cl',
        displayName: 'Test',
        role: 'doctor_urgency',
      },
      updatedAt,
      updatedBy: {
        uid: 'u1',
        email: 'test@hospital.cl',
        displayName: 'Test',
        role: 'doctor_urgency',
      },
      signatureRevocations: [],
    },
    renderedText: 'texto',
    integrityHash: 'hash',
  }) as ClinicalDocumentRecord;

describe('ClinicalDocumentRepository.listByEpisodeKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty and avoids querying when no episode keys are provided', async () => {
    const result = await ClinicalDocumentRepository.listByEpisodeKeys([], 'hhr');
    expect(result).toEqual([]);
    expect(db.getDocs).not.toHaveBeenCalled();
  });

  it('trims, deduplicates and ignores blank episode keys before querying', async () => {
    vi.mocked(db.getDocs).mockResolvedValueOnce([
      buildDoc('d-1', 'rut-1__2026-03-01', '2026-03-05T10:00:00.000Z'),
    ]);

    await ClinicalDocumentRepository.listByEpisodeKeys(
      ['  ', 'rut-1__2026-03-01', ' rut-1__2026-03-01 ', '\n'],
      'hhr'
    );

    expect(db.getDocs).toHaveBeenCalledTimes(1);
    expect(db.getDocs).toHaveBeenCalledWith(
      'hospitals/hhr/clinicalDocuments',
      expect.objectContaining({
        where: [
          expect.objectContaining({
            field: 'episodeKey',
            operator: 'in',
            value: ['rut-1__2026-03-01'],
          }),
        ],
      })
    );
  });

  it('chunks by 10, queries each chunk, and deduplicates by document id', async () => {
    vi.mocked(db.getDocs)
      .mockResolvedValueOnce([
        buildDoc('d-1', 'rut-1__2026-03-01', '2026-03-05T10:00:00.000Z'),
        buildDoc('d-2', 'rut-2__2026-03-01', '2026-03-05T11:00:00.000Z'),
      ])
      .mockResolvedValueOnce([
        buildDoc('d-2', 'rut-2__2026-03-01', '2026-03-05T11:00:00.000Z'),
        buildDoc('d-3', 'rut-11__2026-03-01', '2026-03-05T12:00:00.000Z'),
      ]);

    const result = await ClinicalDocumentRepository.listByEpisodeKeys(
      [
        'rut-1__2026-03-01',
        'rut-2__2026-03-01',
        'rut-3__2026-03-01',
        'rut-4__2026-03-01',
        'rut-5__2026-03-01',
        'rut-6__2026-03-01',
        'rut-7__2026-03-01',
        'rut-8__2026-03-01',
        'rut-9__2026-03-01',
        'rut-10__2026-03-01',
        'rut-11__2026-03-01',
      ],
      'hhr'
    );

    expect(db.getDocs).toHaveBeenCalledTimes(2);
    expect(db.getDocs).toHaveBeenNthCalledWith(
      1,
      'hospitals/hhr/clinicalDocuments',
      expect.objectContaining({
        where: [expect.objectContaining({ field: 'episodeKey', operator: 'in' })],
      })
    );
    expect(db.getDocs).toHaveBeenNthCalledWith(
      2,
      'hospitals/hhr/clinicalDocuments',
      expect.objectContaining({
        where: [expect.objectContaining({ field: 'episodeKey', operator: 'in' })],
      })
    );

    const firstChunk = (
      vi.mocked(db.getDocs).mock.calls[0][1] as { where: Array<{ value: string[] }> }
    ).where[0].value;
    const secondChunk = (
      vi.mocked(db.getDocs).mock.calls[1][1] as { where: Array<{ value: string[] }> }
    ).where[0].value;
    expect(firstChunk).toHaveLength(10);
    expect(secondChunk).toHaveLength(1);

    expect(result.map(document => document.id)).toEqual(['d-3', 'd-2', 'd-1']);
  });
});
