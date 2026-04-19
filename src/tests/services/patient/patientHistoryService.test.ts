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

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
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

  it('uses closing hospitalization hints to cap the remote range without requiring lastDischarge', async () => {
    const hospitalizationHints: HospitalizationEvent[] = [
      {
        id: 'ing-1',
        type: 'Ingreso',
        date: '2026-04-07',
        diagnosis: 'Insuficiencia cardíaca',
        bedName: 'H1C1',
      },
      {
        id: 'eg-1',
        type: 'Egreso',
        date: '2026-04-15',
        diagnosis: 'Insuficiencia cardíaca',
        bedName: 'H1C1',
      },
    ];

    getAllRecords.mockResolvedValue({});
    getRecordsRangeFromFirestore.mockResolvedValue([]);

    await getPatientMovementHistory('8.932.066-6', {
      hospitalizationHints,
      lastAdmission: '2026-04-07',
    });

    expect(getRecordsRangeFromFirestore).toHaveBeenCalledWith('2026-04-07', '2026-04-15');
  });

  it('returns null for invalid identifiers and skips all storage lookups', async () => {
    await expect(getPatientMovementHistory('')).resolves.toBeNull();
    await expect(getPatientMovementHistory('12')).resolves.toBeNull();

    expect(getAllRecords).not.toHaveBeenCalled();
    expect(getRecordsRangeFromFirestore).not.toHaveBeenCalled();
  });

  it('uses only local history when firestore sync is disabled', async () => {
    isFirestoreEnabled.mockReturnValue(false);
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
      '2026-04-08': buildRecord('2026-04-08', {
        transfers: [
          {
            id: 't-1',
            rut: '8.932.066-6',
            patientName: 'Ines Riroroko Leiva',
            bedId: 'H1C1',
            bedName: 'H1C1',
            bedType: 'MEDIA',
            diagnosis: 'Insuficiencia cardíaca',
            evacuationMethod: 'SAMU',
            receivingCenter: 'Hospital Base',
            time: '15:20',
          },
        ],
      }),
    });

    const history = await getPatientMovementHistory('8.932.066-6');

    expect(getRecordsRangeFromFirestore).not.toHaveBeenCalled();
    expect(history?.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'admission', bedId: 'H1C1' }),
        expect.objectContaining({
          type: 'transfer',
          details: 'SAMU → Hospital Base',
        }),
      ])
    );
  });

  it('falls back to local records when the remote range lookup fails', async () => {
    getAllRecords.mockResolvedValue({
      '2026-04-07': buildRecord('2026-04-07', {
        beds: {
          H1C1: {
            rut: '8.932.066-6',
            patientName: 'Ines Riroroko Leiva',
            admissionDate: '2026-04-07',
            admissionTime: '09:00',
          } as never,
        },
      }),
    });
    getRecordsRangeFromFirestore.mockRejectedValue(new Error('offline'));

    const history = await getPatientMovementHistory('8.932.066-6', {
      hospitalizationHints: [
        {
          id: 'ing-1',
          type: 'Ingreso',
          date: '2026-04-07',
          diagnosis: 'Insuficiencia cardíaca',
        },
      ],
    });

    expect(history?.movements).toEqual([expect.objectContaining({ type: 'admission' })]);
    expect(saveRecords).not.toHaveBeenCalled();
  });

  it('tracks crib admissions and crib moves as part of the current hospitalization', async () => {
    getAllRecords.mockResolvedValue({
      '2026-04-07': buildRecord('2026-04-07', {
        beds: {
          H1C1: {
            rut: 'madre-1',
            clinicalCrib: {
              rut: '12.345.678-9',
              patientName: 'Recien Nacido',
              admissionDate: '2026-04-07',
            },
          } as never,
        },
      }),
      '2026-04-08': buildRecord('2026-04-08', {
        beds: {
          H2C1: {
            rut: 'madre-1',
            clinicalCrib: {
              rut: '12.345.678-9',
              patientName: 'Recien Nacido',
              admissionDate: '2026-04-07',
            },
          } as never,
        },
      }),
      '2026-04-09': buildRecord('2026-04-09', {
        discharges: [
          {
            id: 'd-crib-1',
            rut: '12.345.678-9',
            patientName: 'Recien Nacido',
            bedId: 'H2C1-cuna',
            bedName: 'Cuna (H2C1)',
            bedType: 'CUNA',
            dischargeType: 'Domicilio',
            status: 'Fallecido',
            time: '10:15',
          } as never,
        ],
      }),
    });

    const history = await getPatientMovementHistory('12.345.678-9');

    expect(history?.movements).toEqual([
      expect.objectContaining({
        type: 'admission',
        bedId: 'H1C1-cuna',
        bedType: 'CUNA',
      }),
      expect.objectContaining({
        type: 'internal_move',
        bedId: 'H2C1-cuna',
        details: 'Desde cama Cuna (H1C1)',
      }),
      expect.objectContaining({
        type: 'discharge',
        details: 'Fallecimiento',
      }),
    ]);
  });
});
