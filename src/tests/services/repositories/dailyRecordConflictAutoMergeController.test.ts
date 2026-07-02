import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { attemptConflictAutoMergeRecovery } from '@/services/repositories/dailyRecordConflictAutoMergeController';

const {
  getRecordFromFirestoreMock,
  resolveConflictMock,
  buildConflictAuditSummaryMock,
  logRepositoryConflictAutoMergedMock,
  queueSyncTaskMock,
  loggerWarnMock,
  recordTelemetryMock,
  buildConflictIdMock,
  saveConflictVersionSnapshotsMock,
} = vi.hoisted(() => ({
  getRecordFromFirestoreMock: vi.fn(),
  resolveConflictMock: vi.fn(),
  buildConflictAuditSummaryMock: vi.fn(),
  logRepositoryConflictAutoMergedMock: vi.fn(),
  queueSyncTaskMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  recordTelemetryMock: vi.fn(),
  buildConflictIdMock: vi.fn(() => 'conflict-1'),
  saveConflictVersionSnapshotsMock: vi.fn(),
}));

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: getRecordFromFirestoreMock,
}));

vi.mock('@/services/repositories/conflictResolutionMatrix', () => ({
  resolveDailyRecordConflictWithTrace: resolveConflictMock,
}));

vi.mock('@/services/repositories/conflictResolutionAuditSummary', () => ({
  buildConflictAuditSummary: buildConflictAuditSummaryMock,
}));

vi.mock('@/services/repositories/ports/repositoryAuditPort', () => ({
  logRepositoryConflictAutoMerged: logRepositoryConflictAutoMergedMock,
}));

vi.mock('@/services/storage/sync', () => ({
  queueDailyRecordSyncTaskWithLocalRecord: queueSyncTaskMock,
}));

vi.mock('@/services/repositories/repositoryLoggers', () => ({
  dailyRecordWriteSupportLogger: {
    warn: loggerWarnMock,
  },
}));

vi.mock('@/services/observability/operationalTelemetryOutcomeRecorder', () => ({
  recordOperationalErrorTelemetry: recordTelemetryMock,
}));

vi.mock('@/services/storage/firestore/dailyRecordConflictSnapshotService', () => ({
  buildConflictId: buildConflictIdMock,
  saveConflictVersionSnapshots: saveConflictVersionSnapshotsMock,
}));

const record = {
  date: '2026-04-15',
  schemaVersion: 1,
  beds: {},
} as unknown as DailyRecord;

describe('dailyRecordConflictAutoMergeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildConflictIdMock.mockReturnValue('conflict-1');
    saveConflictVersionSnapshotsMock.mockResolvedValue({
      status: 'saved',
      snapshotIds: ['conflict-1__remote_premerge', 'conflict-1__incoming_premerge'],
      origins: ['remote_premerge', 'incoming_premerge'],
      expiresAt: '2026-04-17T12:00:00.000Z',
    });
  });

  it('returns not_possible when no remote record exists', async () => {
    getRecordFromFirestoreMock.mockResolvedValue(null);

    await expect(
      attemptConflictAutoMergeRecovery('2026-04-15', record, ['beds.R1.patientName'])
    ).resolves.toEqual({ status: 'not_possible' });
  });

  it('queues and audits the auto-merged record when recovery succeeds', async () => {
    getRecordFromFirestoreMock.mockResolvedValue(record);
    resolveConflictMock.mockReturnValue({
      record,
      trace: { policyVersion: 'v1', entries: [] },
    });
    buildConflictAuditSummaryMock.mockReturnValue({ summary: 'ok' });
    queueSyncTaskMock.mockResolvedValue({ accepted: true });

    await expect(
      attemptConflictAutoMergeRecovery('2026-04-15', record, ['beds.R1.patientName'])
    ).resolves.toEqual({ status: 'auto_merged' });

    expect(queueSyncTaskMock).toHaveBeenCalledWith(
      record,
      expect.objectContaining({
        origin: 'conflict_auto_merge',
        syncContract: expect.objectContaining({
          changedPaths: ['beds.R1.patientName'],
        }),
      })
    );
    expect(logRepositoryConflictAutoMergedMock).toHaveBeenCalledWith(
      '2026-04-15',
      expect.objectContaining({
        conflictId: 'conflict-1',
        snapshotRecovery: {
          status: 'saved',
          snapshotIds: ['conflict-1__remote_premerge', 'conflict-1__incoming_premerge'],
          origins: ['remote_premerge', 'incoming_premerge'],
          expiresAt: '2026-04-17T12:00:00.000Z',
        },
      })
    );
  });

  it('stays best-effort but observable: telemeters when the audit fails, still auto_merged', async () => {
    getRecordFromFirestoreMock.mockResolvedValue(record);
    resolveConflictMock.mockReturnValue({ record, trace: { policyVersion: 'v1', entries: [] } });
    buildConflictAuditSummaryMock.mockReturnValue({ summary: 'ok' });
    queueSyncTaskMock.mockResolvedValue({ accepted: true });
    logRepositoryConflictAutoMergedMock.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      attemptConflictAutoMergeRecovery('2026-04-15', record, ['beds.R1.patientName'])
    ).resolves.toEqual({ status: 'auto_merged' });

    // The merge proceeds (system recovery), but the audit failure is no longer silent.
    expect(recordTelemetryMock).toHaveBeenCalledWith(
      'firestore',
      'conflict_auto_merge_audit',
      expect.any(Error),
      expect.objectContaining({ code: 'firestore_conflict_auto_merge_audit_failed' })
    );
  });

  it('returns not_possible when queuing the merged record is rejected', async () => {
    getRecordFromFirestoreMock.mockResolvedValue(record);
    resolveConflictMock.mockReturnValue({
      record,
      trace: { policyVersion: 'v1', entries: [] },
    });
    buildConflictAuditSummaryMock.mockReturnValue({ summary: 'ok' });
    queueSyncTaskMock.mockResolvedValue({ accepted: false });

    await expect(
      attemptConflictAutoMergeRecovery('2026-04-15', record, ['beds.R1.patientName'])
    ).resolves.toEqual({ status: 'not_possible' });
  });
});
