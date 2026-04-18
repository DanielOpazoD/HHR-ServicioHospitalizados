import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { HospitalizationEvent } from '@/types/domain/patientMaster';

const { getAllRecords, getRecordsRangeFromFirestore, saveRecords, isFirestoreEnabled } = vi.hoisted(
  () => ({
    getAllRecords: vi.fn(),
    getRecordsRangeFromFirestore: vi.fn(),
    saveRecords: vi.fn(),
    isFirestoreEnabled: vi.fn(),
  })
);

vi.mock('@/services/storage/records', () => ({
  getAllRecords,
  saveRecords,
}));

vi.mock('@/services/storage/firestore', () => ({
  getRecordsRangeFromFirestore,
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled,
}));

import { getPatientMovementHistory } from '@/services/patient/patientHistoryService';

const buildRecord = (date: string, overrides: Partial<DailyRecord> = {}): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: `${date}T08:00:00.000Z`,
    nurses: [],
    activeExtraBeds: [],
    ...overrides,
  }) as DailyRecord;

describe('patientHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));
    isFirestoreEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates the latest hospitalization from Firestore when local history is missing the discharge', async () => {
    const hospitalizationHints: HospitalizationEvent[] = [
      {
        id: 'ing-1',
        type: 'Ingreso',
        date: '2026-04-07',
        diagnosis: 'Insuficiencia cardíaca',
        bedName: 'H1C1',
      },
    ];

    getAllRecords.mockResolvedValue({
      '2026-04-07': buildRecord('2026-04-07', {
        beds: {
          H1C1: {
            rut: '8.932.066-6',
            patientName: 'Ines Riroroko Leiva',
            admissionDate: '2026-04-07',
            admissionTime: '09:00',
            admissionOrigin: 'Urgencias',
          } as never,
        },
      }),
    });

    getRecordsRangeFromFirestore.mockResolvedValue([
      buildRecord('2026-04-15', {
        discharges: [
          {
            id: 'd-1',
            rut: '8.932.066-6',
            patientName: 'Ines Riroroko Leiva',
            bedId: 'H1C1',
            bedName: 'H1C1',
            bedType: 'MEDIA',
            diagnosis: 'Insuficiencia cardíaca',
            dischargeType: 'Domicilio (Habitual)',
            time: '11:30',
            status: 'Vivo',
          },
        ],
      }),
    ]);

    const history = await getPatientMovementHistory('8.932.066-6', {
      hospitalizationHints,
      lastAdmission: '2026-04-07',
    });

    expect(getRecordsRangeFromFirestore).toHaveBeenCalledWith('2026-04-07', '2026-04-18');
    expect(saveRecords).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ date: '2026-04-15' })])
    );
    expect(history).toEqual(
      expect.objectContaining({
        firstSeen: '2026-04-07',
        lastSeen: '2026-04-15',
      })
    );
    expect(history?.movements.map(movement => movement.type)).toEqual(['admission', 'discharge']);
    expect(history?.movements[1]).toEqual(
      expect.objectContaining({
        date: '2026-04-15',
        type: 'discharge',
        details: 'Domicilio (Habitual)',
      })
    );
  });
});
