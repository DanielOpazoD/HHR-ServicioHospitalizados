import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { DataFactory } from '@/tests/factories/DataFactory';
import {
  applyOptimisticDailyRecordPatch,
  buildPreviousDayDate,
  createDailyRecordQueryFn,
  createDailyRecordSubscription,
  getDailyRecordQueryKey,
  invalidateDailyRecordQuery,
  setDailyRecordQueryData,
  shouldUseDailyRecordRealtimeSync,
} from '@/hooks/controllers/dailyRecordQueryController';

vi.mock('@/services/repositories/dailyRecordOperationalTelemetry', () => ({
  dailyRecordObservability: {
    recordEvent: vi.fn(),
    recordError: vi.fn(),
  },
}));

describe('dailyRecordQueryController', () => {
  it('builds query functions and cache keys consistently', async () => {
    const record = DataFactory.createMockDailyRecord('2025-01-08');
    const repository = { getForDate: vi.fn().mockResolvedValue(record) };

    await expect(createDailyRecordQueryFn(repository, '2025-01-08')()).resolves.toMatchObject({
      record,
      runtime: {
        availabilityState: 'resolved',
        consistencyState: 'local_only',
      },
    });
    expect(repository.getForDate).toHaveBeenCalledWith('2025-01-08');
    expect(getDailyRecordQueryKey('2025-01-08')).toEqual(['dailyRecord', '2025-01-08']);
  });

  it('applies optimistic patches and stamps lastUpdated', () => {
    const previous = DataFactory.createMockDailyRecord('2025-01-08');
    const updated = applyOptimisticDailyRecordPatch(previous, {
      'beds.R1.patientName': 'Paciente Demo',
    });

    expect(updated.beds.R1.patientName).toBe('Paciente Demo');
    expect(updated.lastUpdated).not.toBe(previous.lastUpdated);
  });

  it('creates subscriptions that ignore local echoes', () => {
    const queryClient = new QueryClient();
    const record = DataFactory.createMockDailyRecord('2025-01-08');
    const subscribe = vi.fn((_date, callback) => {
      callback(record, true);
      callback(record, false);
      return vi.fn();
    });

    const unsubscribe = createDailyRecordSubscription(
      { getForDate: vi.fn(), subscribe },
      '2025-01-08',
      queryClient
    );

    expect(unsubscribe).toBeTypeOf('function');
    expect(queryClient.getQueryData(getDailyRecordQueryKey('2025-01-08'))).toMatchObject({
      record,
      runtime: {
        availabilityState: 'resolved',
      },
    });
  });

  it('reconciles null realtime payloads against the repository before clearing cache', async () => {
    const queryClient = new QueryClient();
    const previousRecord = DataFactory.createMockDailyRecord('2025-01-08');
    const recoveredRecord = {
      ...previousRecord,
      lastUpdated: '2025-01-08T10:10:00.000Z',
    };
    queryClient.setQueryData(getDailyRecordQueryKey('2025-01-08'), {
      record: previousRecord,
      runtime: {
        date: '2025-01-08',
        availabilityState: 'resolved',
        consistencyState: 'local_only',
        sourceOfTruth: 'local',
        retryability: 'not_applicable',
        recoveryAction: 'none',
        conflictSummary: null,
        observabilityTags: ['daily_record', 'read'],
        repairApplied: false,
      },
    });

    const subscribe = vi.fn((_date, callback) => {
      void callback(null, false);
      return vi.fn();
    });

    const unsubscribe = createDailyRecordSubscription(
      { getForDate: vi.fn().mockResolvedValue(recoveredRecord), subscribe },
      '2025-01-08',
      queryClient
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(unsubscribe).toBeTypeOf('function');
    expect(queryClient.getQueryData(getDailyRecordQueryKey('2025-01-08'))).toMatchObject({
      record: recoveredRecord,
      runtime: {
        availabilityState: 'recoverable_local',
      },
    });
  });

  it('manages query cache helpers and realtime gating', async () => {
    const queryClient = new QueryClient();
    const record = DataFactory.createMockDailyRecord('2025-01-08');

    setDailyRecordQueryData(queryClient, '2025-01-08', record);
    expect(queryClient.getQueryData(getDailyRecordQueryKey('2025-01-08'))).toMatchObject({
      record,
      runtime: {
        availabilityState: 'resolved',
      },
    });

    invalidateDailyRecordQuery(queryClient, '2025-01-08');
    expect(shouldUseDailyRecordRealtimeSync('2025-01-08', false, true)).toBe(true);
    expect(shouldUseDailyRecordRealtimeSync('', false, true)).toBe(false);
    expect(buildPreviousDayDate('2025-01-08')).toBe('2025-01-07');
  });
});
