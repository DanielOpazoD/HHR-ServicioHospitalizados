import { clearAllRecords } from '@/services/storage/indexeddb/indexedDbRecordService';
import { clearSyncQueueForOwner, recordSyncQueueOwnershipTelemetry } from '@/services/storage/sync';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';

const SESSION_OWNER_KEY = 'hhr_session_owner_v1';

export const resolveSessionOwnerKey = (uid: string | null | undefined): string | null =>
  uid ? `user:${uid}` : null;

export const getStoredSessionOwnerKey = (): string | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(SESSION_OWNER_KEY);
};

const setStoredSessionOwnerKey = (ownerKey: string | null): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  if (!ownerKey) {
    localStorage.removeItem(SESSION_OWNER_KEY);
    return;
  }

  localStorage.setItem(SESSION_OWNER_KEY, ownerKey);
};

/**
 * localStorage keys that must survive logout because they hold
 * infrastructure state unrelated to the authenticated user.
 * Everything else prefixed with `hhr_` is cleared on session end.
 *
 * Whitelist approach: new keys are cleaned automatically unless
 * explicitly preserved here.
 */
const KEYS_SURVIVING_LOGOUT = new Set([
  'hhr_app_version',
  'hhr_firebase_config',
  'hhr_diagnosis_mode',
  'hhr_storage_auto_recovery_attempted_v1',
  'hhr_storage_persistent_fallback_count_v1',
  'hhr_feature_flags',
  'hhr_chunk_reload_count',
]);

/** sessionStorage keys that must survive logout (bootstrap coordination). */
const SESSION_KEYS_SURVIVING_LOGOUT = new Set([
  'hhr_bootstrap_recovery_v1',
  'hhr_bootstrap_storage_repair_v1',
  'hhr_recent_manual_logout_v1',
]);

const clearUserScopedLocalStorage = (): void => {
  if (typeof localStorage === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('hhr_') && !KEYS_SURVIVING_LOGOUT.has(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

const clearUserScopedSessionStorage = (): void => {
  if (typeof sessionStorage === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('hhr_') && !SESSION_KEYS_SURVIVING_LOGOUT.has(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
};

const clearSensitiveSessionState = async (ownerKey: string | null): Promise<void> => {
  await clearAllRecords();
  await clearSyncQueueForOwner(ownerKey);
  clearUserScopedLocalStorage();
  clearUserScopedSessionStorage();
};

export const reconcileAuthorizedSessionOwner = async (ownerKey: string): Promise<void> => {
  const previousOwnerKey = getStoredSessionOwnerKey();

  if (!previousOwnerKey) {
    setStoredSessionOwnerKey(ownerKey);
    return;
  }

  if (previousOwnerKey === ownerKey) {
    return;
  }

  await clearSensitiveSessionState(previousOwnerKey);
  setStoredSessionOwnerKey(ownerKey);
  recordSyncQueueOwnershipTelemetry('session_owner_changed', {
    previousOwnerKey,
    nextOwnerKey: ownerKey,
  });
  recordOperationalTelemetry({
    category: 'auth',
    operation: 'session_owner_changed_cleanup',
    status: 'degraded',
    runtimeState: 'recoverable',
    issues: [
      'Se limpió el estado local sensible al detectar un cambio de usuario en este navegador.',
    ],
    context: {
      previousOwnerKey,
      nextOwnerKey: ownerKey,
    },
  });
};

export const clearSessionScopedClientState = async (
  reason: 'manual' | 'automatic'
): Promise<void> => {
  const ownerKey = getStoredSessionOwnerKey();
  await clearSensitiveSessionState(ownerKey);
  setStoredSessionOwnerKey(null);
  recordSyncQueueOwnershipTelemetry('session_owner_cleared', {
    ownerKey,
    logoutReason: reason,
  });
  recordOperationalTelemetry({
    category: 'auth',
    operation: 'session_owner_cleared_cleanup',
    status: 'degraded',
    runtimeState: 'recoverable',
    issues: ['Se limpió el estado local sensible al cerrar sesión.'],
    context: {
      ownerKey,
      logoutReason: reason,
    },
  });
};
