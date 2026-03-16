import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStorageMigration } from '@/hooks/useStorageMigration';
import * as storageCore from '@/services/storage/core';
import { restoreConsole, suppressConsole } from '@/tests/utils/consoleTestUtils';

vi.mock('@/services/storage/core', () => ({
  migrateFromLocalStorage: vi.fn(),
  isIndexedDBAvailable: vi.fn(),
}));

describe('useStorageMigration', () => {
  let consoleSpies: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpies = suppressConsole(['warn', 'error']);
  });

  afterEach(() => {
    restoreConsole(consoleSpies);
  });

  it('should complete startup migration when enabled', async () => {
    vi.mocked(storageCore.isIndexedDBAvailable).mockReturnValue(true);
    vi.mocked(storageCore.migrateFromLocalStorage).mockResolvedValue(false);

    const { result } = renderHook(() => useStorageMigration());

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    expect(result.current.isMigrating).toBe(false);
  });

  it('should stay idle when disabled', async () => {
    vi.mocked(storageCore.isIndexedDBAvailable).mockReturnValue(true);

    const { result } = renderHook(() => useStorageMigration({ enabled: false }));

    expect(result.current.isComplete).toBe(true);
    expect(result.current.isMigrating).toBe(false);
    expect(result.current.didMigrate).toBe(false);
    expect(storageCore.migrateFromLocalStorage).not.toHaveBeenCalled();
  });

  it('should complete migration successfully when IndexedDB is available', async () => {
    vi.mocked(storageCore.isIndexedDBAvailable).mockReturnValue(true);
    vi.mocked(storageCore.migrateFromLocalStorage).mockResolvedValue(true);

    const { result } = renderHook(() => useStorageMigration());

    await waitFor(() => {
      expect(result.current.didMigrate).toBe(true);
    });

    expect(result.current.isMigrating).toBe(false);
    expect(result.current.didMigrate).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should skip migration when IndexedDB is not available', async () => {
    vi.mocked(storageCore.isIndexedDBAvailable).mockReturnValue(false);

    const { result } = renderHook(() => useStorageMigration());

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    expect(result.current.isMigrating).toBe(false);
    expect(result.current.didMigrate).toBe(false);
    expect(storageCore.migrateFromLocalStorage).not.toHaveBeenCalled();
  });

  it('should handle migration errors gracefully', async () => {
    vi.mocked(storageCore.isIndexedDBAvailable).mockReturnValue(true);
    vi.mocked(storageCore.migrateFromLocalStorage).mockRejectedValue(new Error('Migration failed'));

    const { result } = renderHook(() => useStorageMigration());

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    expect(result.current.isMigrating).toBe(false);
    expect(result.current.didMigrate).toBe(false);
    expect(result.current.error).toBe('Migration failed');
  });

  it('should handle non-Error exceptions', async () => {
    vi.mocked(storageCore.isIndexedDBAvailable).mockReturnValue(true);
    vi.mocked(storageCore.migrateFromLocalStorage).mockRejectedValue('String error');

    const { result } = renderHook(() => useStorageMigration());

    await waitFor(() => {
      expect(result.current.error).toBe('Unknown error');
    });

    expect(result.current.error).toBe('Unknown error');
  });
});
