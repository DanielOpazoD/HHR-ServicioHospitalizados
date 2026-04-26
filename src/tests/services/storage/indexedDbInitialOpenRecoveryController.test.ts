import { describe, expect, it, vi } from 'vitest';
import { recoverIndexedDbInitialOpenFailure } from '@/services/storage/indexeddb/indexedDbInitialOpenRecoveryController';

interface FakeDatabase {
  id: string;
}

const createBaseOptions = (error: unknown, database: FakeDatabase) => ({
  error,
  database,
  closeDatabase: vi.fn(),
  deleteDatabase: vi.fn().mockResolvedValue(undefined),
  createDatabase: vi.fn(() => ({ id: 'recreated' })),
  attachDatabaseEvents: vi.fn(),
  openDatabase: vi.fn().mockResolvedValue(undefined),
  activateMockFallback: vi.fn(() => database),
  recordRecoveryNotice: vi.fn(),
  recordRecoveryFailure: vi.fn(),
  recordFallbackMode: vi.fn(),
  getBudgetSnapshot: vi.fn(() => ({ maxAttempts: 6 })),
});

describe('indexedDbInitialOpenRecoveryController', () => {
  it('recreates the database for recoverable unknown open failures', async () => {
    const originalDatabase = { id: 'original' };
    const options = createBaseOptions(
      { name: 'UnknownError', message: 'Temporary open failure' },
      originalDatabase
    );

    const outcome = await recoverIndexedDbInitialOpenFailure(options);

    expect(options.recordRecoveryNotice).toHaveBeenCalledWith(
      'indexeddb_initial_open_failed',
      expect.any(String),
      expect.objectContaining({
        errorName: 'UnknownError',
        errorMessage: 'Temporary open failure',
        maxAttempts: 6,
      })
    );
    expect(options.closeDatabase).toHaveBeenCalledWith(originalDatabase);
    expect(options.deleteDatabase).toHaveBeenCalledTimes(1);
    expect(options.createDatabase).toHaveBeenCalledTimes(1);
    expect(options.attachDatabaseEvents).toHaveBeenCalledWith({ id: 'recreated' });
    expect(options.openDatabase).toHaveBeenCalledWith({ id: 'recreated' });
    expect(outcome).toEqual({
      database: { id: 'recreated' },
      fallbackMode: false,
      stickyFallbackMode: false,
      shouldNotifyDatabaseRecreated: true,
      shouldResetRecoveryTracking: true,
      shouldScheduleBackgroundRecovery: false,
    });
  });

  it('falls back to mock tables and schedules background recovery when recreation fails', async () => {
    const originalDatabase = { id: 'original' };
    const options = createBaseOptions(
      { name: 'VersionError', message: 'Version mismatch' },
      originalDatabase
    );
    const recoveryError = { name: 'AbortError', message: 'delete failed' };
    options.deleteDatabase.mockRejectedValue(recoveryError);

    const outcome = await recoverIndexedDbInitialOpenFailure({
      ...options,
      shouldUseStickyFallback: () => true,
    });

    expect(options.recordRecoveryFailure).toHaveBeenCalledWith(recoveryError);
    expect(options.recordFallbackMode).toHaveBeenCalledWith(
      'VersionError',
      'Version mismatch',
      expect.objectContaining({ maxAttempts: 6 })
    );
    expect(options.activateMockFallback).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      database: originalDatabase,
      fallbackMode: true,
      stickyFallbackMode: true,
      shouldNotifyDatabaseRecreated: false,
      shouldResetRecoveryTracking: false,
      shouldScheduleBackgroundRecovery: true,
    });
  });

  it('does not delete backing-store failures before entering recoverable fallback', async () => {
    const originalDatabase = { id: 'original' };
    const options = createBaseOptions(
      {
        name: 'UnknownError',
        message: 'Internal error opening backing store for indexedDB.open.',
      },
      originalDatabase
    );

    const outcome = await recoverIndexedDbInitialOpenFailure(options);

    expect(options.deleteDatabase).not.toHaveBeenCalled();
    expect(options.activateMockFallback).toHaveBeenCalledTimes(1);
    expect(outcome.fallbackMode).toBe(true);
    expect(outcome.shouldScheduleBackgroundRecovery).toBe(true);
  });
});
