import type { SyncRuntimePort } from '@/services/storage/sync/syncQueuePorts';
import { getStoredSessionOwnerKey } from '@/services/storage/sessionScopedStorageService';

export const createBrowserSyncRuntime = (): SyncRuntimePort => {
  let onlineListenerRegistered = false;

  return {
    isOnline: () => typeof navigator !== 'undefined' && navigator.onLine,
    onOnline: callback => {
      if (onlineListenerRegistered) return;
      if (typeof window === 'undefined') return;

      window.addEventListener('online', callback);
      onlineListenerRegistered = true;
    },
    getOwnerKey: () => getStoredSessionOwnerKey(),
  };
};
