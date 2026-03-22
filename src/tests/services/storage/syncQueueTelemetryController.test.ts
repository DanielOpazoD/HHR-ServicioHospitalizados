import { describe, expect, it, vi } from 'vitest';
import {
  buildSyncQueueTelemetryFromRows,
  recordSyncQueueBudgetTelemetry,
} from '@/services/storage/sync/syncQueueTelemetryController';
import type { SyncTask } from '@/services/storage/syncQueueTypes';

const mockRecordOperationalTelemetry = vi.fn();

vi.mock('@/services/observability/operationalTelemetryService', () => ({
  recordOperationalTelemetry: (...args: unknown[]) => mockRecordOperationalTelemetry(...args),
}));

const baseTask = (overrides: Partial<SyncTask> = {}): SyncTask => ({
  opId: 'task-1',
  type: 'UPDATE_DAILY_RECORD',
  payload: { date: '2026-03-22' },
  timestamp: Date.parse('2026-03-22T10:00:00.000Z'),
  retryCount: 0,
  status: 'PENDING',
  ...overrides,
});

describe('syncQueueTelemetryController', () => {
  it('builds degraded telemetry when retrying reaches warning threshold', () => {
    const telemetry = buildSyncQueueTelemetryFromRows(
      [baseTask({ retryCount: 1 })],
      Date.parse('2026-03-22T10:01:00.000Z'),
      25
    );

    expect(telemetry.retryingBudgetState).toBe('warning');
    expect(telemetry.oldestPendingBudgetState).toBe('ok');
    expect(telemetry.runtimeState).toBe('degraded');
  });

  it('builds blocked telemetry when oldest pending age exceeds critical threshold', () => {
    const telemetry = buildSyncQueueTelemetryFromRows(
      [baseTask({ timestamp: Date.parse('2026-03-22T09:40:00.000Z') })],
      Date.parse('2026-03-22T10:00:00.000Z'),
      25
    );

    expect(telemetry.oldestPendingBudgetState).toBe('critical');
    expect(telemetry.runtimeState).toBe('blocked');
  });

  it('records budget telemetry only when queue exceeds operational thresholds', () => {
    recordSyncQueueBudgetTelemetry({
      pending: 1,
      failed: 0,
      conflict: 0,
      retrying: 1,
      oldestPendingAgeMs: 1000,
      batchSize: 25,
      oldestPendingBudgetState: 'ok',
      retryingBudgetState: 'warning',
      runtimeState: 'degraded',
    });

    expect(mockRecordOperationalTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'sync',
        operation: 'sync_queue_budget_threshold',
        status: 'degraded',
        runtimeState: 'degraded',
      })
    );
  });
});
