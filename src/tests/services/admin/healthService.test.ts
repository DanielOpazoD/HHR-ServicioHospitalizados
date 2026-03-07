import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportUserHealth,
  subscribeToSystemHealth,
  getSystemHealthSnapshot,
  normalizeUserHealthStatus,
  buildSystemHealthSummary,
  UserHealthStatus,
} from '@/services/admin/healthService';

// Mock the db abstraction layer
vi.mock('@/services/infrastructure/db', () => ({
  db: {
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn().mockResolvedValue([]),
    subscribeQuery: vi.fn().mockImplementation((_path, _options, _callback) => {
      // Return an unsubscribe function
      return vi.fn();
    }),
  },
}));

// Import the mocked db after mocking
import { db } from '@/services/infrastructure/db';

describe('healthService', () => {
  const mockStatus: UserHealthStatus = {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User',
    lastSeen: '2025-01-01T10:00:00Z',
    isOnline: true,
    isOutdated: false,
    pendingMutations: 0,
    pendingSyncTasks: 0,
    failedSyncTasks: 0,
    conflictSyncTasks: 0,
    retryingSyncTasks: 0,
    oldestPendingAgeMs: 0,
    localErrorCount: 0,
    degradedLocalPersistence: false,
    repositoryWarningCount: 0,
    slowestRepositoryOperationMs: 0,
    operationalObservedCount: 0,
    operationalFailureCount: 0,
    operationalSyncObservedCount: 0,
    operationalIndexedDbObservedCount: 0,
    operationalClinicalDocumentObservedCount: 0,
    operationalCreateDayObservedCount: 0,
    operationalExportBackupObservedCount: 0,
    appVersion: '1.0.0',
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reportUserHealth', () => {
    it('should silence permission errors', async () => {
      vi.mocked(db.setDoc).mockRejectedValueOnce(
        new Error('FirebaseError: Missing or insufficient permissions.')
      );
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await reportUserHealth(mockStatus);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should call db.setDoc with correct arguments', async () => {
      await reportUserHealth(mockStatus);
      expect(db.setDoc).toHaveBeenCalledWith(
        expect.stringContaining('users'),
        'user123',
        expect.objectContaining({ uid: 'user123', email: 'test@example.com' })
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(db.setDoc).mockRejectedValueOnce(new Error('Firebase Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await reportUserHealth(mockStatus);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getSystemHealthSnapshot', () => {
    it('should fetch user health docs from db', async () => {
      const mockUsers: UserHealthStatus[] = [
        { ...mockStatus, uid: 'user1' },
        { ...mockStatus, uid: 'user2' },
      ];
      vi.mocked(db.getDocs).mockResolvedValueOnce(mockUsers);

      const results = await getSystemHealthSnapshot();
      expect(results).toHaveLength(2);
      expect(results[0].uid).toBe('user1');
    });

    it('should handle fetch errors and return empty array', async () => {
      vi.mocked(db.getDocs).mockRejectedValueOnce(new Error('Fetch Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await getSystemHealthSnapshot();
      expect(results).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('normalizes partial docs when fetching snapshot', async () => {
      vi.mocked(db.getDocs).mockResolvedValueOnce([
        { uid: 'u1', email: '', pendingMutations: '3' as unknown as number },
      ]);

      const results = await getSystemHealthSnapshot();
      expect(results[0].uid).toBe('u1');
      expect(results[0].email).toBe('unknown@local');
      expect(results[0].pendingMutations).toBe(3);
      expect(results[0].displayName).toBe('Usuario sin nombre');
    });
  });

  describe('subscribeToSystemHealth', () => {
    it('should call db.subscribeQuery and return unsubscribe function', () => {
      const onUpdate = vi.fn();
      const unsubscribeMock = vi.fn();
      vi.mocked(db.subscribeQuery).mockReturnValueOnce(unsubscribeMock);

      const result = subscribeToSystemHealth(onUpdate);
      expect(db.subscribeQuery).toHaveBeenCalled();
      expect(result).toBe(unsubscribeMock);
    });

    it('should trigger onUpdate when db provides data', () => {
      const onUpdate = vi.fn();
      let capturedCallback: ((data: unknown[]) => void) | undefined;

      vi.mocked(db.subscribeQuery).mockImplementation((path, options, callback) => {
        capturedCallback = callback as unknown as (data: unknown[]) => void;
        return vi.fn();
      });

      subscribeToSystemHealth(onUpdate);

      // Simulate data update
      const mockData: Partial<UserHealthStatus>[] = [{ uid: 'u1' }];
      capturedCallback?.(mockData);

      expect(onUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          uid: 'u1',
          email: 'unknown@local',
        }),
      ]);
    });
  });

  describe('normalizeUserHealthStatus', () => {
    it('fills defaults for empty/invalid payloads', () => {
      const normalized = normalizeUserHealthStatus({
        uid: '',
        email: '',
        pendingMutations: Number.NaN,
      });

      expect(normalized.uid).toBe('unknown');
      expect(normalized.email).toBe('unknown@local');
      expect(normalized.pendingMutations).toBe(0);
      expect(normalized.isOnline).toBe(false);
      expect(normalized.operationalObservedCount).toBe(0);
      expect(normalized.operationalSyncObservedCount).toBe(0);
    });
  });

  describe('buildSystemHealthSummary', () => {
    it('aggregates operational health totals', () => {
      const summary = buildSystemHealthSummary([
        mockStatus,
        {
          ...mockStatus,
          uid: 'u2',
          isOnline: false,
          degradedLocalPersistence: true,
          failedSyncTasks: 2,
          conflictSyncTasks: 1,
          localErrorCount: 3,
          repositoryWarningCount: 4,
          slowestRepositoryOperationMs: 280,
          operationalObservedCount: 5,
          operationalFailureCount: 2,
          operationalSyncObservedCount: 2,
          operationalIndexedDbObservedCount: 1,
          operationalClinicalDocumentObservedCount: 1,
          operationalCreateDayObservedCount: 1,
          operationalExportBackupObservedCount: 3,
        },
      ]);

      expect(summary.totalUsers).toBe(2);
      expect(summary.offlineUsers).toBe(1);
      expect(summary.degradedLocalPersistenceUsers).toBe(1);
      expect(summary.usersWithSyncFailures).toBe(1);
      expect(summary.usersWithRepositoryWarnings).toBe(1);
      expect(summary.totalFailedSyncTasks).toBe(2);
      expect(summary.totalConflictSyncTasks).toBe(1);
      expect(summary.totalRepositoryWarnings).toBe(4);
      expect(summary.maxSlowRepositoryOperationMs).toBe(280);
      expect(summary.oldestObservedPendingAgeMs).toBe(0);
      expect(summary.totalOperationalObservedCount).toBe(5);
      expect(summary.totalOperationalFailureCount).toBe(2);
      expect(summary.totalOperationalSyncObservedCount).toBe(2);
      expect(summary.totalOperationalIndexedDbObservedCount).toBe(1);
      expect(summary.totalOperationalClinicalDocumentObservedCount).toBe(1);
      expect(summary.totalOperationalCreateDayObservedCount).toBe(1);
      expect(summary.totalOperationalExportBackupObservedCount).toBe(3);
      expect(summary.usersWithRecentOperationalIssues).toBe(0);
      expect(summary.latestOperationalIssueAt).toBeUndefined();
    });

    it('tracks recent operational issue metadata', () => {
      const summary = buildSystemHealthSummary([
        {
          ...mockStatus,
          latestOperationalIssueAt: '2026-02-19T08:00:00.000Z',
        },
        {
          ...mockStatus,
          uid: 'u2',
          latestOperationalIssueAt: '2026-02-19T10:15:00.000Z',
        },
      ]);

      expect(summary.usersWithRecentOperationalIssues).toBe(2);
      expect(summary.latestOperationalIssueAt).toBe('2026-02-19T10:15:00.000Z');
    });
  });
});
