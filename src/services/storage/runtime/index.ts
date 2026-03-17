/**
 * Canonical storage runtime entrypoint.
 *
 * UI/runtime wiring should import from here instead of reaching into storage
 * internals for fallback UI or IndexedDB bootstrap bindings.
 */

export {
  clearStorageAutoRecoveryAttempt,
  getStorageAutoRecoveryKey,
  getStorageFallbackNotice,
  getStorageFallbackUiCopy,
  hasAttemptedStorageAutoRecovery,
  markStorageAutoRecoveryAttempted,
  shouldAttemptStorageAutoRecovery,
  shouldShowStorageFallbackUi,
} from '@/services/storage/storageFallbackUiPolicy';

export {
  attachIndexedDbEvents,
  initializeIndexedDbDatabase,
} from '@/services/storage/indexeddb/indexedDbBootstrap';
