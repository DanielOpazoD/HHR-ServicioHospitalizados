import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { describe, it } from 'vitest';

import type { FirestoreRulesHarness } from './firestoreRulesTestHarness';

export function registerFirestoreRulesIdentityGroups({
  unauth,
  authed,
  admin,
  bootstrapAdminWithoutClaim,
  firestoreForUser,
  NOW_MS,
  setupDoc,
}: FirestoreRulesHarness): void {
  describe('Role Config', () => {
    const roleConfigPath = 'config/roles';

    it('Bootstrap admins can recover role config access without an admin claim', async () => {
      await setupDoc(admin(), roleConfigPath, {
        'user@example.com': 'viewer',
      });

      await assertSucceeds(
        bootstrapAdminWithoutClaim().doc(roleConfigPath).set({
          'user@example.com': 'viewer',
          'doctor@example.com': 'doctor_urgency',
        })
      );
    });

    it('Regular authenticated users cannot read role config directly', async () => {
      await setupDoc(admin(), roleConfigPath, {
        'user@example.com': 'viewer',
      });

      await assertFails(authed().doc(roleConfigPath).get());
    });
  });

  describe('Allowed Users (legacy retired)', () => {
    it('Users cannot read legacy authorization docs', async () => {
      await assertFails(authed().doc('allowedUsers/user_basic').get());
    });

    it('Admins also cannot access legacy authorization docs directly', async () => {
      await assertFails(admin().doc('allowedUsers/user_other').get());
    });
  });

  describe('User Settings', () => {
    it('Users can read/write their own settings', async () => {
      await assertSucceeds(authed().doc('userSettings/user_basic').set({ theme: 'light' }));
      await assertSucceeds(authed().doc('userSettings/user_basic').get());
    });

    it('Users cannot write settings for other users', async () => {
      await assertFails(authed().doc('userSettings/user_other').set({ theme: 'dark' }));
    });
  });

  describe('System Health', () => {
    const validSystemHealthPayload = {
      uid: 'user_basic',
      email: 'user@example.com',
      displayName: 'User Basic',
      lastSeen: '2026-02-20T00:00:00.000Z',
      isOnline: true,
      isOutdated: false,
      pendingMutations: 0,
      pendingSyncTasks: 0,
      failedSyncTasks: 0,
      conflictSyncTasks: 0,
      retryingSyncTasks: 0,
      syncOrphanedTasks: 0,
      oldestPendingAgeMs: 0,
      remoteSyncReason: 'ready',
      versionUpdateReason: 'current',
      localErrorCount: 0,
      degradedLocalPersistence: false,
      repositoryWarningCount: 0,
      slowestRepositoryOperationMs: 0,
      operationalObservedCount: 0,
      operationalFailureCount: 0,
      operationalRetryableCount: 0,
      operationalRecoverableCount: 0,
      operationalDegradedCount: 0,
      operationalBlockedCount: 0,
      operationalUnauthorizedCount: 0,
      operationalLastHourObservedCount: 0,
      operationalSyncObservedCount: 0,
      operationalIndexedDbObservedCount: 0,
      operationalClinicalDocumentObservedCount: 0,
      operationalCreateDayObservedCount: 0,
      operationalHandoffObservedCount: 0,
      operationalExportBackupObservedCount: 0,
      operationalDailyRecordRecoveredRealtimeNullCount: 0,
      operationalDailyRecordConfirmedRealtimeNullCount: 0,
      operationalSyncReadUnavailableCount: 0,
      operationalIndexedDbFallbackModeCount: 0,
      operationalAuthBootstrapTimeoutCount: 0,
      operationalTopObservedCategory: 'sync',
      operationalTopObservedOperation: 'sync_queue_poll',
      latestOperationalOperation: 'sync_queue_poll',
      latestOperationalRuntimeState: 'recoverable',
      latestOperationalIssueAt: '2026-02-20T00:00:00.000Z',
      appVersion: 'v1',
      platform: 'MacIntel',
      userAgent: 'Vitest',
    };

    it('Users can write their own system health record', async () => {
      await assertSucceeds(
        authed().doc('stats/system_health/users/user_basic').set(validSystemHealthPayload)
      );
    });

    it('Users cannot write system health for other users', async () => {
      await assertFails(
        authed().doc('stats/system_health/users/user_other').set(validSystemHealthPayload)
      );
    });

    it('Users cannot forge uid field in own system health record', async () => {
      await assertFails(
        authed()
          .doc('stats/system_health/users/user_basic')
          .set({
            ...validSystemHealthPayload,
            uid: 'someone_else',
          })
      );
    });

    it('Users cannot write non-whitelisted fields in system health payload', async () => {
      await assertFails(
        authed()
          .doc('stats/system_health/users/user_basic')
          .set({
            ...validSystemHealthPayload,
            injected: true,
          })
      );
    });
  });

  describe('Census Access Invitations', () => {
    const invitationPath = 'census-access-invitations/inv-1';

    it('Unauthenticated users cannot read invitations', async () => {
      await setupDoc(admin(), invitationPath, {
        email: 'invited@example.com',
        status: 'pending',
      });
      await assertFails(unauth().doc(invitationPath).get());
    });

    it('Authenticated user can claim own pending invitation', async () => {
      const invitedUser = () => firestoreForUser('user_invited', { email: 'invited@example.com' });

      await setupDoc(admin(), invitationPath, {
        email: 'invited@example.com',
        status: 'pending',
        createdAt: NOW_MS,
        createdBy: 'admin',
        expiresAt: NOW_MS + 86_400_000,
      });

      await assertSucceeds(
        invitedUser()
          .doc(invitationPath)
          .update({
            status: 'used',
            usedBy: 'user_invited',
            usedAt: NOW_MS + 1000,
          })
      );
    });
  });

  describe('Census Access Users', () => {
    const accessUserPath = 'census-access-users/user_basic';

    it('Regular users cannot self-create census access user documents', async () => {
      await assertFails(
        authed().doc(accessUserPath).set({
          id: 'user_basic',
          email: 'user@example.com',
          role: 'viewer',
          isActive: true,
        })
      );
    });

    it('Editors/admins can create census access user documents', async () => {
      await assertSucceeds(
        admin().doc(accessUserPath).set({
          id: 'user_basic',
          email: 'user@example.com',
          role: 'viewer',
          isActive: true,
        })
      );
    });
  });

  describe('Census Access Logs', () => {
    const logPath = 'census-access-logs/log-1';

    it('Allows creating log only when userId/email match current caller', async () => {
      await assertSucceeds(
        authed().doc(logPath).set({
          userId: 'user_basic',
          email: 'user@example.com',
          action: 'list_files',
          timestamp: NOW_MS,
        })
      );
    });

    it('Rejects forged logs for other users', async () => {
      await assertFails(
        authed().doc(logPath).set({
          userId: 'user_other',
          email: 'user@example.com',
          action: 'list_files',
          timestamp: NOW_MS,
        })
      );
    });
  });

  describe('Bookmarks', () => {
    const bookmarkPath = 'hospitals/H1/bookmarks/shift';

    it('Unauthenticated users cannot read bookmarks', async () => {
      await setupDoc(admin(), bookmarkPath, { alignment: 'left' });
      await assertFails(unauth().doc(bookmarkPath).get());
    });

    it('Unauthenticated users cannot write bookmarks', async () => {
      await assertFails(unauth().doc(bookmarkPath).set({ alignment: 'right' }));
    });
  });
}
