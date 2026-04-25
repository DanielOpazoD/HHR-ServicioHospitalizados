import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createIndexedDbBackgroundRecoveryScheduler } from '@/services/storage/indexeddb/indexedDbBackgroundRecoveryScheduler';

const { recordIndexedDbRecoveryNotice } = vi.hoisted(() => ({
  recordIndexedDbRecoveryNotice: vi.fn(),
}));

vi.mock('@/services/storage/indexeddb/indexedDbRecoveryController', () => ({
  recordIndexedDbRecoveryNotice,
}));

describe('indexedDbBackgroundRecoveryScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules one recovery retry at a time and executes the retry callback', () => {
    const onRetry = vi.fn();
    const scheduler = createIndexedDbBackgroundRecoveryScheduler({
      getStickyFallbackMode: () => false,
      onRetry,
    });

    scheduler.schedule();
    scheduler.schedule();

    expect(scheduler.getAttempts()).toBe(1);
    expect(recordIndexedDbRecoveryNotice).toHaveBeenCalledTimes(1);
    expect(recordIndexedDbRecoveryNotice).toHaveBeenCalledWith(
      'indexeddb_recovery_retry_scheduled',
      expect.any(String),
      expect.objectContaining({ attempt: 1, scheduledDelayMs: 500 }),
      'retryable'
    );

    vi.advanceTimersByTime(500);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('emits a single blocked notice when sticky fallback disables recovery', () => {
    const scheduler = createIndexedDbBackgroundRecoveryScheduler({
      getStickyFallbackMode: () => true,
      onRetry: vi.fn(),
    });

    scheduler.schedule();
    scheduler.schedule();

    expect(scheduler.getAttempts()).toBe(0);
    expect(recordIndexedDbRecoveryNotice).toHaveBeenCalledTimes(1);
    expect(recordIndexedDbRecoveryNotice).toHaveBeenCalledWith(
      'indexeddb_recovery_disabled',
      expect.any(String),
      expect.objectContaining({ stickyFallbackMode: true, attempts: 0 }),
      'blocked'
    );
  });
});
