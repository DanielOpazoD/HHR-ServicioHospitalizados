import { describe, expect, it } from 'vitest';
import {
  describeDailyRecordBootstrapPhase,
  isDailyRecordBootstrapPending,
  resolveCensusEmptyStatePolicy,
  resolveDailyRecordBootstrapPhase,
  shouldAttemptTodayEmptyRecovery,
} from '@/hooks/controllers/dailyRecordBootstrapController';

describe('dailyRecordBootstrapController', () => {
  it('classifies bootstrap phases with a single policy', () => {
    expect(
      resolveDailyRecordBootstrapPhase({
        remoteSyncStatus: 'bootstrapping',
        record: null,
        runtime: null,
        gracePeriodExpired: false,
      })
    ).toBe('remote_runtime_bootstrapping');

    expect(
      resolveDailyRecordBootstrapPhase({
        remoteSyncStatus: 'ready',
        record: null,
        runtime: null,
        gracePeriodExpired: false,
      })
    ).toBe('remote_record_bootstrapping');

    expect(
      resolveDailyRecordBootstrapPhase({
        remoteSyncStatus: 'ready',
        record: null,
        runtime: null,
        gracePeriodExpired: true,
      })
    ).toBe('remote_record_timeout');

    expect(
      resolveDailyRecordBootstrapPhase({
        remoteSyncStatus: 'ready',
        record: null,
        runtime: {
          date: '2025-01-08',
          availabilityState: 'confirmed_missing',
          consistencyState: 'missing',
          sourceOfTruth: 'none',
          retryability: 'not_applicable',
          recoveryAction: 'none',
          conflictSummary: null,
          observabilityTags: ['daily_record'],
          repairApplied: false,
        },
        gracePeriodExpired: false,
      })
    ).toBe('confirmed_empty');
  });

  it('deferes the empty state only while bootstrap remains pending', () => {
    expect(
      resolveCensusEmptyStatePolicy({
        branch: 'empty',
        currentDateString: '2025-01-02',
        todayDateString: '2025-01-01',
        isAuthenticated: true,
        bootstrapPhase: 'remote_record_bootstrapping',
      })
    ).toEqual({
      shouldDeferEmptyState: true,
      deferMs: 15_000,
    });

    expect(
      resolveCensusEmptyStatePolicy({
        branch: 'empty',
        currentDateString: '2025-01-02',
        todayDateString: '2025-01-01',
        isAuthenticated: true,
        bootstrapPhase: 'remote_record_timeout',
      })
    ).toEqual({
      shouldDeferEmptyState: true,
      deferMs: 800,
    });
  });

  it('marks only pending phases as recoverable bootstrap states', () => {
    expect(isDailyRecordBootstrapPending('remote_runtime_bootstrapping')).toBe(true);
    expect(isDailyRecordBootstrapPending('remote_record_bootstrapping')).toBe(true);
    expect(isDailyRecordBootstrapPending('remote_record_timeout')).toBe(false);
    expect(
      shouldAttemptTodayEmptyRecovery({
        currentDateString: '2025-01-01',
        todayDateString: '2025-01-01',
        bootstrapPhase: 'remote_record_timeout',
      })
    ).toBe(true);
    expect(describeDailyRecordBootstrapPhase('remote_record_timeout')).toContain(
      'ventana de gracia'
    );
  });
});
