import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { attemptConflictAutoMergeRecovery } from '@/services/repositories/dailyRecordConflictAutoMergeController';

const {
  getRecordFromFirestoreMock,
  saveToIndexedDBMock,
  resolveConflictMock,
  buildConflictAuditSummaryMock,
  logRepositoryConflictAutoMergedMock,
  queueSyncTaskMock,
  loggerWarnMock,
} = vi.hoisted(() => ({
  getRecordFromFirestoreMock: vi.fn(),
  saveToIndexedDBMock: vi.fn(),
  resolveConflictMock: vi.fn(),
  buildConflictAuditSummaryMock: vi.fn(),
  logRepositoryConflictAutoMergedMock: vi.fn(),
  queueSyncTaskMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: getRecordFromFirestoreMock,
}));

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  saveRecord: saveToIndexedDBMock,
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
  queueSyncTask: queueSyncTaskMock,
}));

vi.mock('@/services/repositories/repositoryLoggers', () => ({
  dailyRecordWriteSupportLogger: {
    warn: loggerWarnMock,
  },
}));

const record = {
  date: '2026-04-15',
  schemaVersion: 1,
  beds: {},
} as unknown as DailyRecord;

describe('dailyRecordConflictAutoMergeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(saveToIndexedDBMock).toHaveBeenCalledWith(record);
    expect(logRepositoryConflictAutoMergedMock).toHaveBeenCalled();
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
