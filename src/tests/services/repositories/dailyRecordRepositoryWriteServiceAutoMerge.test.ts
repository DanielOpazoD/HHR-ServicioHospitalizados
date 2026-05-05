import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  getRecordForDate: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: vi.fn(),
}));

vi.mock('@/services/storage/firestore/firestoreRecordWrites', () => ({
  saveRecordToFirestore: vi.fn(),
  updateRecordPartial: vi.fn(),
}));

vi.mock('@/services/storage/sync', () => ({
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

import {
  save,
  updatePartial,
  updatePartialDetailed,
} from '@/services/repositories/dailyRecordRepositoryWriteService';
import { getRecordForDate as getRecordFromIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import {
  saveRecordToFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestore/firestoreRecordWrites';
import { queueSyncTask } from '@/services/storage/sync';
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

describe('dailyRecordRepositoryWriteService concurrency auto-merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queueSyncTask).mockResolvedValue({
      accepted: true,
      mode: 'created',
      pendingTasks: 1,
      maxPendingTasks: 192,
    });
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
      }),
      expect.objectContaining({
        contexts: ['clinical', 'staffing', 'movements', 'handoff', 'metadata'],
        origin: 'conflict_auto_merge',
      })
    );
    expect(logRepositoryConflictAutoMerged).toHaveBeenCalledWith(
      '2026-02-16',
      expect.objectContaining({
        policyVersion: '2026-03-v3',
        changedPaths: ['*'],
        impactedContexts: ['clinical', 'staffing', 'movements', 'handoff', 'metadata'],
        assessment: expect.objectContaining({
          riskLevel: 'high',
          reviewRecommended: true,
        }),
      })
    );
  });

  it('preserves remote movement entries when a stale full save is auto-merged', async () => {
    const local = buildRecord('2026-02-16');
    local.beds = { R1: buildPatient('R1', 'Nombre local') };
    local.beds.R1.pathology = 'Diagnostico editado localmente';

    const remote = buildRecord('2026-02-16');
    remote.beds = { R1: buildPatient('R1', 'Nombre remoto') };
    remote.cma = [
      {
        id: 'cma-remote',
        bedName: 'CMA',
        patientName: 'Paciente CMA remoto',
        rut: '22.222.222-2',
        age: '55a',
        diagnosis: 'Colelitiasis',
        specialty: 'Cirugia',
        interventionType: 'Cirugía Mayor Ambulatoria',
        timestamp: '2026-02-16T09:00:00.000Z',
      },
    ];
    remote.discharges = [
      {
        id: 'discharge-remote',
        patientName: 'Paciente Alta remoto',
        rut: '33.333.333-3',
        diagnosis: 'Neumonia',
        bedId: 'R2',
        bedName: 'R2',
        bedType: 'Cama',
        status: 'Vivo',
        time: '10:00',
      },
    ] as DailyRecord['discharges'];
    remote.transfers = [
      {
        id: 'transfer-remote',
        patientName: 'Paciente Traslado remoto',
        rut: '44.444.444-4',
        diagnosis: 'ACV',
        bedId: 'R3',
        bedName: 'R3',
        bedType: 'Cama',
        evacuationMethod: 'SAMU',
        receivingCenter: 'Hospital Regional',
        time: '11:00',
      },
    ] as DailyRecord['transfers'];

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(saveRecordToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValue(remote);

    await expect(save(local, '2026-02-16T00:00:00.000Z')).resolves.toBeUndefined();

    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({
        cma: expect.arrayContaining([expect.objectContaining({ id: 'cma-remote' })]),
        discharges: expect.arrayContaining([expect.objectContaining({ id: 'discharge-remote' })]),
        transfers: expect.arrayContaining([expect.objectContaining({ id: 'transfer-remote' })]),
        beds: expect.objectContaining({
          R1: expect.objectContaining({ pathology: 'Diagnostico editado localmente' }),
        }),
      }),
      expect.objectContaining({
        contexts: ['clinical', 'staffing', 'movements', 'handoff', 'metadata'],
        origin: 'conflict_auto_merge',
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
      }),
      expect.objectContaining({
        contexts: expect.arrayContaining(['clinical', 'metadata']),
        origin: 'conflict_auto_merge',
      })
    );
    expect(logRepositoryConflictAutoMerged).toHaveBeenCalledWith(
      '2026-02-15',
      expect.objectContaining({
        policyVersion: '2026-03-v3',
        changedPaths: expect.arrayContaining([
          'beds.R1.pathology',
          'beds.R1.fhir_resource',
          'dateTimestamp',
        ]),
        impactedContexts: ['clinical', 'metadata'],
        assessment: expect.objectContaining({
          riskLevel: 'low',
          reviewRecommended: false,
        }),
      })
    );
  });

  it('preserves concurrent medical handoff entries by id during partial-update auto-merge', async () => {
    const current = buildRecord('2026-02-15');
    current.beds = {
      R1: {
        ...buildPatient('R1', 'Paciente local'),
        medicalHandoffEntries: [
          {
            id: 'entry-local',
            specialty: 'medicina',
            note: 'Entrada agregada por Tab A',
          },
        ] as never,
      },
    };

    const remote = buildRecord('2026-02-15');
    remote.beds = {
      R1: {
        ...buildPatient('R1', 'Paciente remoto'),
        medicalHandoffEntries: [
          {
            id: 'entry-remote',
            specialty: 'cirugia',
            note: 'Entrada agregada por Tab B',
          },
        ] as never,
      },
    };

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);
    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValue(remote);

    await expect(
      updatePartial('2026-02-15', {
        'beds.R1.medicalHandoffEntries': current.beds.R1.medicalHandoffEntries as never,
      })
    ).resolves.toBeUndefined();

    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({
        date: '2026-02-15',
        beds: expect.objectContaining({
          R1: expect.objectContaining({
            medicalHandoffEntries: expect.arrayContaining([
              expect.objectContaining({ id: 'entry-local' }),
              expect.objectContaining({ id: 'entry-remote' }),
            ]),
          }),
        }),
      }),
      expect.objectContaining({
        contexts: expect.arrayContaining(['clinical', 'metadata']),
        origin: 'conflict_auto_merge',
      })
    );
  });

  it('auto-merges a bed move without resurrecting the cleared source bed', async () => {
    const current = buildRecord('2026-02-15');
    current.beds = {
      R1: buildPatient('R1', 'Paciente movido'),
      R2: {
        ...buildPatient('R2', ''),
        rut: '',
        pathology: '',
        admissionDate: '',
        status: PatientStatus.EMPTY,
      },
    };

    const movedPatient = {
      ...current.beds.R1,
      bedId: 'R2',
    };
    const clearedSource = {
      ...current.beds.R2,
      bedId: 'R1',
    };

    const remote = buildRecord('2026-02-15');
    remote.beds = {
      R1: buildPatient('R1', 'Paciente movido'),
      R2: {
        ...buildPatient('R2', ''),
        rut: '',
        pathology: '',
        admissionDate: '',
        status: PatientStatus.EMPTY,
      },
    };

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);
    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValue(remote);

    await expect(
      updatePartial('2026-02-15', {
        'beds.R2': movedPatient,
        'beds.R1': clearedSource,
      })
    ).resolves.toBeUndefined();

    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({
        date: '2026-02-15',
        beds: expect.objectContaining({
          R1: expect.objectContaining({
            patientName: '',
            rut: '',
            admissionDate: '',
            status: PatientStatus.EMPTY,
          }),
          R2: expect.objectContaining({
            patientName: 'Paciente movido',
            rut: '11.111.111-1',
            admissionDate: '2026-02-18',
          }),
        }),
      }),
      expect.objectContaining({
        contexts: expect.arrayContaining(['clinical']),
        origin: 'conflict_auto_merge',
      })
    );
  });

  it('keeps partial update locally when auto-merge recovery is not possible', async () => {
    const current = buildRecord('2026-02-14');
    current.beds = { R1: buildPatient('R1', 'Paciente local') };

    const concurrencyError = new Error('Concurrency conflict');
    concurrencyError.name = 'ConcurrencyError';

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);
    vi.mocked(updateRecordPartialToFirestore).mockRejectedValueOnce(concurrencyError);
    vi.mocked(getRecordFromFirestore).mockResolvedValueOnce(null);

    const result = await updatePartialDetailed('2026-02-14', {
      'beds.R1.patientName': 'Paciente actualizado',
    });

    expect(queueSyncTask).not.toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({ date: '2026-02-14' })
    );
    expect(logRepositoryConflictAutoMerged).not.toHaveBeenCalled();
    expect(result.consistencyState).toBe('unrecoverable');
  });
});
