import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { DataFactory } from '@/tests/factories/DataFactory';
import { createDailyRecordSubscription } from '@/hooks/controllers/dailyRecordQueryController';
import {
  getDailyRecordFreshnessStatus,
  markDailyRecordTabHidden,
  markDailyRecordTabVisible,
  resetDailyRecordFreshnessGateForTests,
} from '@/hooks/controllers/dailyRecordFreshnessGateController';

vi.mock('@/services/repositories/dailyRecordOperationalTelemetry', () => ({
  dailyRecordObservability: {
    recordEvent: vi.fn(),
    recordError: vi.fn(),
  },
}));

describe('dailyRecordQueryController subscription freshness', () => {
  afterEach(() => {
    resetDailyRecordFreshnessGateForTests();
  });

  it('confirms freshness when a realtime subscription receives a non-pending remote snapshot', () => {
    const queryClient = new QueryClient();
    const record = DataFactory.createMockDailyRecord('2025-01-08');
    let emit:
      | ((
          result: {
            date: string;
            outcome: 'clean';
            record: typeof record;
            consistencyState: 'remote_applied';
            sourceOfTruth: 'remote';
            retryability: 'not_applicable';
            recoveryAction: 'none';
            conflictSummary: null;
            observabilityTags: string[];
            repairApplied: false;
          },
          hasPendingWrites: boolean
        ) => void)
      | undefined;
    const subscribeDetailed = vi.fn((_date, callback) => {
      emit = callback;
      return vi.fn();
    });

    markDailyRecordTabHidden(0);
    markDailyRecordTabVisible(6 * 60 * 1000);
    expect(getDailyRecordFreshnessStatus('2025-01-08')).toBe('stale_due_to_inactivity');

    createDailyRecordSubscription(
      { getForDate: vi.fn(), subscribeDetailed },
      '2025-01-08',
      queryClient
    );

    emit?.(
      {
        date: '2025-01-08',
        outcome: 'clean',
        record,
        consistencyState: 'remote_applied',
        sourceOfTruth: 'remote',
        retryability: 'not_applicable',
        recoveryAction: 'none',
        conflictSummary: null,
        observabilityTags: ['daily_record', 'sync'],
        repairApplied: false,
      },
      false
    );

    expect(getDailyRecordFreshnessStatus('2025-01-08')).toBe('fresh_remote_confirmed');
  });
});
