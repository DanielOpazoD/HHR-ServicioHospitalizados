import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyRecord, PatientData, PatientStatus, Specialty } from '@/types';

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    setDoc: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/storage/firestore', () => ({
  getRecordFromFirestore: vi.fn(),
  saveRecordToFirestore: vi.fn(),
  updateRecordPartial: vi.fn(),
}));

vi.mock('@/services/repositories/ports/repositoryAuditPort', () => ({
  logRepositoryConflictAutoMerged: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '@/services/infrastructure/db';
import {
  hospitalDB,
  clearAllRecords,
  saveRecord as saveRecordLocal,
} from '@/services/storage/indexedDBService';
import { getSyncQueueTelemetry, processSyncQueue, queueSyncTask } from '@/services/storage/sync';
import {
  getRecordFromFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestore';
import { updatePartial } from '@/services/repositories/dailyRecordRepositoryWriteService';

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente',
  rut: '11.111.111-1',
  age: '40a',
  pathology: 'Diagnostico',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-02-19',
  hasWristband: false,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  ...overrides,
});

const buildRecord = (date: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: '2026-02-19T10:00:00.000Z',
  nurses: ['', ''],
  nursesDayShift: ['', ''],
  nursesNightShift: ['', ''],
  tensDayShift: ['', '', ''],
  tensNightShift: ['', '', ''],
  activeExtraBeds: [],
  schemaVersion: 1,
  dateTimestamp: Date.parse(`${date}T00:00:00.000Z`),
  handoffDayChecklist: {},
  handoffNightChecklist: {},
});

describe('Sync resilience integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAllRecords();
    await hospitalDB.syncQueue.clear();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });

  it('queues while offline and flushes successfully when back online', async () => {
    const record = buildRecord('2026-02-19');
    record.beds.R1 = buildPatient('R1');

    await queueSyncTask('UPDATE_DAILY_RECORD', record);

    let telemetry = await getSyncQueueTelemetry();
    expect(telemetry.pending).toBe(1);
    expect(vi.mocked(db.setDoc)).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await processSyncQueue();

    telemetry = await getSyncQueueTelemetry();
    expect(vi.mocked(db.setDoc)).toHaveBeenCalledTimes(1);
    expect(telemetry.pending).toBe(0);
    expect(telemetry.failed).toBe(0);
  });

  it('marks permission-denied as FAILED without retry loop', async () => {
    vi.mocked(db.setDoc).mockRejectedValue({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions',
    });

    await queueSyncTask('UPDATE_DAILY_RECORD', buildRecord('2026-02-18'));
    await processSyncQueue();
    await processSyncQueue();

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('FAILED');
    expect(tasks[0].retryCount).toBe(0);
    expect(vi.mocked(db.setDoc)).toHaveBeenCalledTimes(1);
  });

  it('auto-merges on concurrency conflict and preserves clinical local fields', async () => {
    const date = '2026-02-17';

    const local = buildRecord(date);
    local.beds.R1 = buildPatient('R1', {
      pathology: 'Diagnostico local',
      bedMode: 'Cuna',
    });

    const remote = buildRecord(date);
    remote.beds.R1 = buildPatient('R1', {
      pathology: 'Diagnostico remoto',
      bedMode: 'Cama',
    });

    await saveRecordLocal(local);

    const conflictError = new Error('Concurrency conflict');
    conflictError.name = 'ConcurrencyError';

    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(conflictError);
    vi.mocked(getRecordFromFirestore).mockResolvedValue(remote);

    await updatePartial(date, {
      'beds.R1.pathology': 'Diagnostico local',
    });

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);

    const mergedPayload = tasks[0].payload as DailyRecord;
    expect(mergedPayload.beds.R1.pathology).toBe('Diagnostico local');
    expect(mergedPayload.beds.R1.bedMode).toBe('Cama');
    expect(tasks[0].contexts).toEqual(['clinical']);
    expect(tasks[0].origin).toBe('conflict_auto_merge');
  });
});
