import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';

const { mockAuthorityCallable } = vi.hoisted(() => ({
  mockAuthorityCallable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
  };
});

vi.mock('@/services/storage/firestore/firestoreShared', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/services/storage/firestore/firestoreShared')>();
  return {
    ...actual,
    getRecordDocRef: vi.fn(() => ({ id: 'sync-test-doc-ref' })),
    sanitizeForFirestore: vi.fn(value => value),
  };
});

vi.mock('@/services/storage/firestore/dailyRecordAuthorityCallableClient', () => ({
  saveDailyRecordWithClinicalAuthorityCallable: (...args: unknown[]) =>
    mockAuthorityCallable(...args),
}));

import { getDoc, setDoc } from 'firebase/firestore';
import { processSyncQueue, queueSyncTask } from '@/services/storage/sync';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (date: string, marker: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: marker,
  nurses: [],
  activeExtraBeds: [],
});

describe('sync queue mutation conflicts', () => {
  beforeEach(async () => {
    await hospitalDB.syncQueue.clear();
    vi.clearAllMocks();
    mockAuthorityCallable.mockClear();
    delete (import.meta.env as Record<string, string | undefined>).VITE_DAILY_RECORD_AUTHORITY_MODE;
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    } as Awaited<ReturnType<typeof getDoc>>);
    vi.mocked(setDoc).mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });

  it('keeps stale tasks in conflict when the remote mutation changed the same path', async () => {
    const local = makeRecord('2025-01-22', '2025-01-22T10:10:00.000Z');
    local.beds.R1 = {
      bedId: 'R1',
      patientName: 'Paciente Sync',
      rut: '11.111.111-1',
      age: '40a',
      pathology: 'Diagnostico local same-path',
      specialty: 'Medicina',
      status: 'Estable',
      admissionDate: '2025-01-22',
      isBlocked: false,
      bedMode: 'Cama',
      hasCompanionCrib: false,
      hasWristband: true,
      devices: [],
      surgicalComplication: false,
      isUPC: false,
    } as DailyRecord['beds'][string];

    const remote = makeRecord('2025-01-22', '2025-01-22T10:20:00.000Z');
    remote.beds.R1 = {
      ...local.beds.R1,
      pathology: 'Diagnostico remoto same-path',
    };
    (remote as DailyRecord & { meta: Record<string, unknown> }).meta = {
      revision: 5,
      lastMutationId: 'remote-mutation',
      lastChangedPaths: ['beds.R1.pathology'],
    };

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => remote as unknown as Record<string, unknown>,
    } as Awaited<ReturnType<typeof getDoc>>);

    await queueSyncTask('UPDATE_DAILY_RECORD', local, {
      contexts: ['clinical'],
      origin: 'partial_update_retry',
      syncContract: {
        expectedVersion: '2025-01-22T10:00:00.000Z',
        changedPaths: ['beds.R1.pathology'],
        mutationId: 'local-mutation',
      },
    });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await processSyncQueue();

    expect(setDoc).not.toHaveBeenCalled();
    const [task] = await hospitalDB.syncQueue.toArray();
    expect(task.status).toBe('CONFLICT');
    expect(task.lastErrorCategory).toBe('conflict');
    expect(task.error).toContain('same changed path');
  });

  it('revalidates overlapping movement arrays by id and publishes the merged record through authority', async () => {
    const local = makeRecord('2025-01-23', '2025-01-23T10:10:00.000Z');
    local.discharges = [
      { id: 'discharge-local', bedId: 'R1', patientName: 'Alta local' },
    ] as unknown as DailyRecord['discharges'];
    local.transfers = [
      { id: 'transfer-local', bedId: 'R2', patientName: 'Traslado local' },
    ] as unknown as DailyRecord['transfers'];
    local.cma = [
      { id: 'cma-local', bedName: 'R3', originalBedId: 'R3', patientName: 'CMA local' },
    ] as unknown as DailyRecord['cma'];

    const remote = makeRecord('2025-01-23', '2025-01-23T10:20:00.000Z');
    remote.discharges = [
      { id: 'discharge-remote', bedId: 'R4', patientName: 'Alta remota' },
    ] as unknown as DailyRecord['discharges'];
    remote.transfers = [
      { id: 'transfer-remote', bedId: 'R5', patientName: 'Traslado remoto' },
    ] as unknown as DailyRecord['transfers'];
    remote.cma = [
      { id: 'cma-remote', bedName: 'R6', originalBedId: 'R6', patientName: 'CMA remoto' },
    ] as unknown as DailyRecord['cma'];
    (remote as DailyRecord & { meta: Record<string, unknown> }).meta = {
      revision: 5,
      lastMutationId: 'remote-movement-mutation',
      lastChangedPaths: ['discharges', 'transfers', 'cma'],
    };

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => remote as unknown as Record<string, unknown>,
    } as Awaited<ReturnType<typeof getDoc>>);

    (import.meta.env as Record<string, string | undefined>).VITE_DAILY_RECORD_AUTHORITY_MODE =
      'enforced';
    await queueSyncTask('UPDATE_DAILY_RECORD', local, {
      contexts: ['movements', 'clinical'],
      origin: 'partial_update_retry',
      syncContract: {
        expectedVersion: '2025-01-23T10:00:00.000Z',
        changedPaths: ['discharges', 'transfers', 'cma'],
        mutationId: 'local-movement-mutation',
      },
    });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await processSyncQueue();

    expect(setDoc).not.toHaveBeenCalled();
    expect(mockAuthorityCallable).toHaveBeenCalledTimes(1);
    const authorityPayload = mockAuthorityCallable.mock.calls[0]?.[0] as {
      record: DailyRecord;
      mode: string;
    };
    expect(authorityPayload.mode).toBe('enforced');
    expect(authorityPayload.record.discharges.map(item => item.id)).toEqual([
      'discharge-remote',
      'discharge-local',
    ]);
    expect(authorityPayload.record.transfers.map(item => item.id)).toEqual([
      'transfer-remote',
      'transfer-local',
    ]);
    expect(authorityPayload.record.cma.map(item => item.id)).toEqual(['cma-remote', 'cma-local']);
    const [task] = await hospitalDB.syncQueue.toArray();
    expect(task).toBeUndefined();
  });
});
