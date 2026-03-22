import { describe, expect, it, vi } from 'vitest';
import { executeSyncDailyRecord } from '@/application/daily-record/syncDailyRecordUseCase';
import { DataFactory } from '@/tests/factories/DataFactory';

describe('syncDailyRecordUseCase', () => {
  it('returns success for clean sync', async () => {
    const record = DataFactory.createMockDailyRecord('2026-03-05');
    const repository = {
      syncWithFirestoreDetailed: vi.fn().mockResolvedValue({
        date: '2026-03-05',
        consistencyState: 'clean',
        record,
      }),
    };

    const outcome = await executeSyncDailyRecord({
      date: '2026-03-05',
      repository,
    });

    expect(outcome.status).toBe('success');
    expect(outcome.data.record).toBe(record);
  });

  it('returns degraded for blocked sync', async () => {
    const record = DataFactory.createMockDailyRecord('2026-03-05');
    const repository = {
      syncWithFirestoreDetailed: vi.fn().mockResolvedValue({
        date: '2026-03-05',
        consistencyState: 'blocked',
        record,
      }),
    };

    const outcome = await executeSyncDailyRecord({
      date: '2026-03-05',
      repository,
    });

    expect(outcome.status).toBe('degraded');
    expect(outcome.data.degradationReason).toBe('remote_blocked');
    expect(outcome.data.conflict).toEqual(
      expect.objectContaining({
        kind: 'remote_blocked',
        retryStrategy: 'manual_review',
        recommendedAction: 'continue_with_local_copy',
      })
    );
    expect(outcome.reason).toBe('remote_blocked');
    expect(outcome.retryable).toBe(true);
  });

  it('returns partial for missing remote data', async () => {
    const repository = {
      syncWithFirestoreDetailed: vi.fn().mockResolvedValue({
        date: '2026-03-05',
        consistencyState: 'missing_remote',
        record: null,
      }),
    };

    const outcome = await executeSyncDailyRecord({
      date: '2026-03-05',
      repository,
    });

    expect(outcome.status).toBe('partial');
    expect(outcome.data.degradationReason).toBe('missing_remote_record');
    expect(outcome.data.conflict).toEqual(
      expect.objectContaining({
        kind: 'missing_remote_record',
        recommendedAction: 'review_remote_record',
      })
    );
    expect(outcome.reason).toBe('missing_remote_record');
    expect(outcome.userSafeMessage).toContain('registro remoto');
  });
});
