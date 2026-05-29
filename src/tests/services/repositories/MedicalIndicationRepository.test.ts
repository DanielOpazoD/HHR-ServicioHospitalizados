import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MedicalIndicationRecordRepository } from '@/services/repositories/MedicalIndicationRecordRepository';
import { MedicalIndicationTemplateRepository } from '@/services/repositories/MedicalIndicationTemplateRepository';
import { firestoreDb } from '@/services/storage/firestore';

vi.mock('@/services/storage/firestore', () => ({
  firestoreDb: {
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
  },
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: () => true,
}));

describe('MedicalIndication repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only active personal templates from the owner collection', async () => {
    vi.mocked(firestoreDb.getDocs).mockResolvedValue([
      {
        id: 'tpl-active',
        userId: 'user_doctor',
        text: 'Control cada 6 horas',
        createdAt: '2026-05-29T10:00:00.000Z',
        updatedAt: '2026-05-29T10:00:00.000Z',
        createdByName: 'Dra. Test',
        useCount: 0,
        isArchived: false,
      },
      {
        id: 'tpl-archived',
        userId: 'user_doctor',
        text: 'Archivada',
        createdAt: '2026-05-29T10:00:00.000Z',
        updatedAt: '2026-05-29T10:00:00.000Z',
        createdByName: 'Dra. Test',
        useCount: 0,
        isArchived: true,
      },
    ]);

    const result = await MedicalIndicationTemplateRepository.listActiveByUser('user_doctor', 'hhr');

    expect(firestoreDb.getDocs).toHaveBeenCalledWith(
      'hospitals/hhr/medicalIndicationTemplates/user_doctor/items',
      { orderBy: [{ field: 'updatedAt', direction: 'desc' }] }
    );
    expect(result.map(item => item.id)).toEqual(['tpl-active']);
  });

  it('stores generated records in the shared hospital collection', async () => {
    await MedicalIndicationRecordRepository.create(
      {
        id: 'record-1',
        patientRut: '11.111.111-1',
        patientName: 'Ana Test',
        episodeId: 'ep_ana',
        bedId: 'R1',
        targetDate: '2026-05-31',
        generatedAt: '2026-05-29T10:42:00.000Z',
        generatedByUserId: 'user_doctor',
        generatedByName: 'Dra. Test',
        generatedByRole: 'doctor_specialist',
        generatedFromTemplateIds: [],
        admissionDate: '2026-05-27',
        daysOfStayForTargetDate: '5',
        treatingDoctor: 'Dra. Rapa Nui',
        reposo: 'Relativo',
        regimen: 'Liviano',
        kineType: 'motora',
        kineTimes: '2 veces/dia',
        pendingNotes: '',
        indications: ['Control'],
        pdfPrintedAt: null,
      },
      'hhr'
    );

    expect(firestoreDb.setDoc).toHaveBeenCalledWith(
      'hospitals/hhr/medicalIndicationRecords',
      'record-1',
      expect.objectContaining({ episodeId: 'ep_ana', targetDate: '2026-05-31' })
    );
  });
});
