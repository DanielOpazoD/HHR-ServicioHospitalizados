import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: vi.fn(),
}));

vi.mock('@/services/storage/sync', () => ({
  isRetryableSyncError: vi.fn(),
  queueDailyRecordSyncTaskWithLocalRecord: vi.fn(),
}));

import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import {
  isRetryableSyncError,
  queueDailyRecordSyncTaskWithLocalRecord,
} from '@/services/storage/sync';
import {
  assertRemoteSaveCompatibility,
  resolveRemoteWriteRecovery,
} from '@/services/repositories/dailyRecordRemoteWriteController';

const buildRecord = (date: string, lastUpdated: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated,
    nurses: [],
    activeExtraBeds: [],
    schemaVersion: 1,
  }) as DailyRecord;

const occupiedBed = (patientName: string, clinicalCribName?: string) =>
  ({
    patientName,
    ...(clinicalCribName ? { clinicalCrib: { patientName: clinicalCribName } } : {}),
  }) as never;

// A census of N occupied filler beds so a single-bed erasure stays below the
// density-regression thresholds and reaches the per-bed erasure guard.
const fillerBeds = (count: number): Record<string, unknown> => {
  const beds: Record<string, unknown> = {};
  for (let index = 1; index <= count; index += 1) {
    beds[`F${index}`] = occupiedBed(`Filler ${index}`);
  }
  return beds;
};

const recordWith = (
  beds: Record<string, unknown>,
  movements: { discharges?: unknown[]; transfers?: unknown[]; cma?: unknown[] } = {}
): DailyRecord =>
  ({
    date: '2026-06-25',
    beds,
    discharges: movements.discharges ?? [],
    transfers: movements.transfers ?? [],
    cma: movements.cma ?? [],
    lastUpdated: '2026-06-25T12:00:00.000Z',
    nurses: [],
    activeExtraBeds: [],
    schemaVersion: 1,
  }) as DailyRecord;

describe('dailyRecordRemoteWriteController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks remote saves when Firestore already has a newer schema version', async () => {
    vi.mocked(getRecordFromFirestore).mockResolvedValueOnce({
      ...buildRecord('2026-04-16', '2026-04-16T12:00:00.000Z'),
      schemaVersion: 999,
    } as DailyRecord);

    await expect(
      assertRemoteSaveCompatibility(
        '2026-04-16',
        buildRecord('2026-04-16', '2026-04-16T12:00:00.000Z')
      )
    ).rejects.toThrow('Tu aplicación está desactualizada');
  });

  it('queues retry recovery with retry metadata when the remote error is retryable', async () => {
    vi.mocked(isRetryableSyncError).mockReturnValue(true);
    vi.mocked(queueDailyRecordSyncTaskWithLocalRecord).mockResolvedValueOnce({
      accepted: true,
      mode: 'created',
      pendingTasks: 1,
      maxPendingTasks: 192,
    });

    const result = await resolveRemoteWriteRecovery(
      '2026-04-16',
      buildRecord('2026-04-16', '2026-04-16T12:00:00.000Z'),
      ['beds.R1.patientName'],
      new Error('network down')
    );

    expect(result.status).toBe('queued_for_retry');
    expect(queueDailyRecordSyncTaskWithLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-04-16' }),
      expect.objectContaining({
        origin: 'partial_update_retry',
      })
    );
  });

  describe('patient-erasure guard', () => {
    it('blocks a full save that would erase a patient still present in the cloud', async () => {
      const remote = recordWith({ ...fillerBeds(5), H5C2: occupiedBed('Josué Villagra Tolloza') });
      const local = recordWith(fillerBeds(5)); // H5C2 dropped locally

      vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(remote);

      await expect(assertRemoteSaveCompatibility('2026-06-25', local)).rejects.toThrow(
        /H5C2 \(Josué Villagra Tolloza\) tiene un paciente en la nube/
      );
    });

    it('allows the save when the empty bed is explained by a discharge naming that patient', async () => {
      const remote = recordWith({ ...fillerBeds(5), H5C2: occupiedBed('Josué Villagra Tolloza') });
      const local = recordWith(fillerBeds(5), {
        discharges: [{ patientName: 'Josué Villagra Tolloza', bedId: 'H5C2' }],
      });

      vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(remote);

      await expect(assertRemoteSaveCompatibility('2026-06-25', local)).resolves.toBeUndefined();
    });

    it('allows the save when a discharge references the bed even if the name differs', async () => {
      const remote = recordWith({ ...fillerBeds(5), H1C1: occupiedBed('Juan Pérez') });
      const local = recordWith(fillerBeds(5), {
        discharges: [{ patientName: 'Otro Nombre', bedId: 'H1C1' }],
      });

      vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(remote);

      await expect(assertRemoteSaveCompatibility('2026-06-25', local)).resolves.toBeUndefined();
    });

    it('blocks erasure of a nested clinical-crib (cuna clínica) occupant', async () => {
      const remote = recordWith({
        ...fillerBeds(4),
        H4C1: occupiedBed('Madre Galaz', 'Recién Nacido Galaz'),
      });
      const local = recordWith({ ...fillerBeds(4), H4C1: occupiedBed('Madre Galaz') }); // crib emptied

      vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(remote);

      await expect(assertRemoteSaveCompatibility('2026-06-25', local)).rejects.toThrow(
        /H4C1 \(cuna clínica\) \(Recién Nacido Galaz\)/
      );
    });

    it('allows crib erasure when a discharge names the crib patient', async () => {
      const remote = recordWith({
        ...fillerBeds(4),
        H4C1: occupiedBed('Madre Galaz', 'Recién Nacido Galaz'),
      });
      const local = recordWith(
        { ...fillerBeds(4), H4C1: occupiedBed('Madre Galaz') },
        { discharges: [{ patientName: 'Recién Nacido Galaz', bedId: 'H4C1' }] }
      );

      vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(remote);

      await expect(assertRemoteSaveCompatibility('2026-06-25', local)).resolves.toBeUndefined();
    });

    it('does not let a bedId-only discharge mask an erased crib baby', async () => {
      const remote = recordWith({
        ...fillerBeds(4),
        H4C1: occupiedBed('Madre Galaz', 'Recién Nacido Galaz'),
      });
      // Main occupant still present; a discharge references the bed by id but NOT the baby.
      const local = recordWith(
        { ...fillerBeds(4), H4C1: occupiedBed('Madre Galaz') },
        { discharges: [{ patientName: 'Madre Galaz', bedId: 'H4C1' }] }
      );

      vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(remote);

      await expect(assertRemoteSaveCompatibility('2026-06-25', local)).rejects.toThrow(
        /cuna clínica/
      );
    });
  });
});
