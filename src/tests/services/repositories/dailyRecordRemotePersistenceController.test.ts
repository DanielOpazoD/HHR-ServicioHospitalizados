import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { createRemoteWriteState } from '@/services/repositories/dailyRecordWriteState';

const { saveToIndexedDBMock, isFirestoreEnabledMock, resolveRemoteWriteRecoveryMock } = vi.hoisted(
  () => ({
    saveToIndexedDBMock: vi.fn(),
    isFirestoreEnabledMock: vi.fn(),
    resolveRemoteWriteRecoveryMock: vi.fn(),
  })
);

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  saveRecord: saveToIndexedDBMock,
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: isFirestoreEnabledMock,
}));

vi.mock('@/services/repositories/dailyRecordRemoteWriteController', () => ({
  resolveRemoteWriteRecovery: resolveRemoteWriteRecoveryMock,
}));

import { persistLocalAndAttemptRemoteSync } from '@/services/repositories/dailyRecordRemotePersistenceController';

const buildRecord = (date: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: `${date}T10:00:00.000Z`,
    nurses: [],
    activeExtraBeds: [],
  }) as DailyRecord;

describe('dailyRecordRemotePersistenceController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFirestoreEnabledMock.mockReturnValue(true);
  });

  it('persists locally and skips remote write when Firestore is disabled', async () => {
    isFirestoreEnabledMock.mockReturnValue(false);
    const state = createRemoteWriteState();
    const remoteWrite = vi.fn();

    const result = await persistLocalAndAttemptRemoteSync({
      date: '2026-05-23',
      record: buildRecord('2026-05-23'),
      changedPaths: ['*'],
      remoteState: state,
      remoteWrite,
      onRemoteFailure: vi.fn(),
    });

    expect(result).toBe('continue');
    expect(saveToIndexedDBMock).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-05-23' })
    );
    expect(remoteWrite).not.toHaveBeenCalled();
    expect(state.savedRemotely).toBe(false);
    expect(state.consistencyState).toBe('persisted_local_only');
  });

  it('marks the remote state as synced after a successful remote write', async () => {
    const state = createRemoteWriteState();
    const remoteWrite = vi.fn().mockResolvedValue(undefined);

    const result = await persistLocalAndAttemptRemoteSync({
      date: '2026-05-23',
      record: buildRecord('2026-05-23'),
      changedPaths: ['*'],
      remoteState: state,
      remoteWrite,
      onRemoteFailure: vi.fn(),
      expectedVersion: '2026-05-23T10:00:00.000Z',
    });

    expect(result).toBe('continue');
    expect(remoteWrite).toHaveBeenCalledTimes(1);
    expect(state.savedRemotely).toBe(true);
    expect(state.consistencyState).toBe('persisted_and_synced');
    expect(state.recoveryAction).toBe('none');
    expect(state.observabilityTags).toEqual(['daily_record', 'write', 'persisted_and_synced']);
  });

  it('applies recovery and returns early when remote recovery asks to throw', async () => {
    const state = createRemoteWriteState();
    const remoteError = new Error('remote failed');
    const blockingError = new Error('manual review');
    const onRemoteFailure = vi.fn();
    resolveRemoteWriteRecoveryMock.mockResolvedValueOnce({
      status: 'throw',
      error: blockingError,
      decision: {
        consistencyState: 'unrecoverable',
        retryability: 'manual_review',
        recoveryAction: 'block_and_surface',
        conflictSummary: {
          kind: 'remote_unavailable',
          sourceOfTruth: 'none',
          message: 'remote failed',
        },
        observabilityTags: ['daily_record', 'write', 'unrecoverable'],
        userSafeMessage: 'Revisar manualmente.',
      },
    });

    const result = await persistLocalAndAttemptRemoteSync({
      date: '2026-05-23',
      record: buildRecord('2026-05-23'),
      changedPaths: ['beds.R1.patientName'],
      remoteState: state,
      remoteWrite: vi.fn().mockRejectedValue(remoteError),
      onRemoteFailure,
      expectedVersion: '2026-05-23T10:00:00.000Z',
    });

    expect(result).toBe('return');
    expect(onRemoteFailure).toHaveBeenCalledWith(remoteError);
    expect(resolveRemoteWriteRecoveryMock).toHaveBeenCalledWith(
      '2026-05-23',
      expect.objectContaining({ date: '2026-05-23' }),
      ['beds.R1.patientName'],
      remoteError,
      '2026-05-23T10:00:00.000Z'
    );
    expect(state.consistencyState).toBe('unrecoverable');
    expect(state.blockingError).toBe(blockingError);
  });
});
