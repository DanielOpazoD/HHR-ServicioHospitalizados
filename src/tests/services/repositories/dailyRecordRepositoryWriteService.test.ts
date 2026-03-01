import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyRecord, PatientData, PatientStatus, Specialty } from '@/types';

vi.mock('@/services/storage/indexedDBService', () => ({
  getRecordForDate: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock('@/services/storage/firestoreService', () => ({
  getRecordFromFirestore: vi.fn(),
  saveRecordToFirestore: vi.fn(),
  updateRecordPartial: vi.fn(),
}));

vi.mock('@/services/storage/syncQueueService', () => ({
  isRetryableSyncError: vi.fn(),
  queueSyncTask: vi.fn(),
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));

vi.mock('@/utils/recordInvariants', () => ({
  normalizeDailyRecordInvariants: vi.fn((record: DailyRecord) => ({ record, patches: {} })),
}));

vi.mock('@/services/repositories/helpers/validationHelper', () => ({
  validateAndSalvageRecord: vi.fn((record: DailyRecord) => record),
}));

vi.mock('@/services/utils/fhirMappers', () => ({
  mapPatientToFhir: vi.fn(() => ({})),
}));

vi.mock('@/services/repositories/PatientMasterRepository', () => ({
  PatientMasterRepository: {
    upsertPatient: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/repositories/ports/repositoryAuditPort', () => ({
  logRepositoryConflictAutoMerged: vi.fn().mockResolvedValue(undefined),
}));

import { save, updatePartial } from '@/services/repositories/dailyRecordRepositoryWriteService';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexedDBService';
import {
  getRecordFromFirestore,
  saveRecordToFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestoreService';
import { isRetryableSyncError, queueSyncTask } from '@/services/storage/syncQueueService';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';

const buildRecord = (date: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: '2026-02-19T00:00:00.000Z',
  nurses: [],
  activeExtraBeds: [],
});

const buildPatient = (bedId: string, patientName: string): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName,
  rut: '11.111.111-1',
  age: '40a',
  pathology: 'Diagnostico',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-02-18',
  hasWristband: false,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
});

describe('dailyRecordRepositoryWriteService outbox fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues full record when save to Firestore fails with retryable error', async () => {
    vi.mocked(saveRecordToFirestore).mockRejectedValueOnce(new Error('Network timeout'));
    vi.mocked(isRetryableSyncError).mockReturnValue(true);

    const record = buildRecord('2026-02-19');
    await save(record);

    expect(saveToIndexedDB).toHaveBeenCalled();
    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({ date: '2026-02-19' })
    );
  });

  it('queues merged record when partial update fails with retryable error', async () => {
    const existing = buildRecord('2026-02-18');
    existing.beds = {
      R1: buildPatient('R1', 'Paciente Anterior'),
    };

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(existing);
    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(
      new Error('Network unavailable')
    );
    vi.mocked(isRetryableSyncError).mockReturnValue(true);

    await updatePartial('2026-02-18', {
      'beds.R1.patientName': 'Paciente Nuevo',
    });

    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({
        date: '2026-02-18',
        beds: expect.objectContaining({
          R1: expect.objectContaining({ patientName: 'Paciente Nuevo' }),
        }),
      })
    );
  });

  it('does not queue task when Firestore error is non-retryable', async () => {
    vi.mocked(saveRecordToFirestore).mockRejectedValueOnce({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions',
    });
    vi.mocked(isRetryableSyncError).mockReturnValue(false);

    await save(buildRecord('2026-02-17'));

    expect(queueSyncTask).not.toHaveBeenCalled();
  });

  it('auto-merges on concurrency conflict during full save and queues merged result', async () => {
    const local = buildRecord('2026-02-16');
    local.beds = { R1: buildPatient('R1', 'Nombre local') };

    const remote = buildRecord('2026-02-16');
    remote.beds = { R1: buildPatient('R1', 'Nombre remoto') };
    remote.beds.R1.pathology = 'Diag remoto';
    local.beds.R1.pathology = 'Diag local';

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(saveRecordToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValue(remote);

    await expect(save(local, '2026-02-16T00:00:00.000Z')).resolves.toBeUndefined();
    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({
        date: '2026-02-16',
        beds: expect.objectContaining({
          R1: expect.objectContaining({ pathology: 'Diag local' }),
        }),
      })
    );
    expect(logRepositoryConflictAutoMerged).toHaveBeenCalledWith(
      '2026-02-16',
      expect.objectContaining({
        policyVersion: '2026-02-v2',
        changedPaths: ['*'],
        assessment: expect.objectContaining({
          riskLevel: 'high',
          reviewRecommended: true,
        }),
      })
    );
  });

  it('auto-merges on concurrency conflict during partial update and queues merged result', async () => {
    const current = buildRecord('2026-02-15');
    current.beds = { R1: buildPatient('R1', 'Paciente local') };
    current.beds.R1.pathology = 'Diagnostico local';

    const remote = buildRecord('2026-02-15');
    remote.beds = { R1: buildPatient('R1', 'Paciente remoto') };
    remote.beds.R1.pathology = 'Diagnostico remoto';

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);
    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValue(remote);

    await expect(
      updatePartial('2026-02-15', {
        'beds.R1.pathology': 'Diagnostico local',
      })
    ).resolves.toBeUndefined();

    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({
        date: '2026-02-15',
        beds: expect.objectContaining({
          R1: expect.objectContaining({ pathology: 'Diagnostico local' }),
        }),
      })
    );
    expect(logRepositoryConflictAutoMerged).toHaveBeenCalledWith(
      '2026-02-15',
      expect.objectContaining({
        policyVersion: '2026-02-v2',
        changedPaths: expect.arrayContaining(['beds.R1.pathology']),
        assessment: expect.objectContaining({
          riskLevel: 'low',
          reviewRecommended: false,
        }),
      })
    );
  });

  it('throws partial update concurrency error when auto-merge recovery is not possible', async () => {
    const current = buildRecord('2026-02-14');
    current.beds = { R1: buildPatient('R1', 'Paciente local') };

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);
    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(null);

    await expect(
      updatePartial('2026-02-14', {
        'beds.R1.patientName': 'Paciente actualizado',
      })
    ).rejects.toBe(concurrencyError);

    expect(queueSyncTask).not.toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({ date: '2026-02-14' })
    );
    expect(logRepositoryConflictAutoMerged).not.toHaveBeenCalled();
  });

  it('passes local lastUpdated as concurrency base for partial remote update', async () => {
    const current = buildRecord('2026-02-13');
    current.lastUpdated = '2026-02-13T08:00:00.000Z';
    current.beds = { R1: buildPatient('R1', 'Paciente local') };

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);

    await updatePartial('2026-02-13', {
      'beds.R1.patientName': 'Paciente remoto seguro',
    });

    expect(updateRecordPartialToFirestore).toHaveBeenCalledWith(
      '2026-02-13',
      expect.any(Object),
      '2026-02-13T08:00:00.000Z'
    );
  });
});
