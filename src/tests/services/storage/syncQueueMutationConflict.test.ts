import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';

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
});
