import type { AuthSessionState } from '@/types/authSessionTypes';
import type { FirestoreSyncState } from '@/services/repositories/repositoryConfig';
import { isE2ELocalOnlySyncForced } from '@/shared/runtime/e2eRuntime';

interface BuildAuthRemoteSyncStateInput {
  sessionState: AuthSessionState;
  authLoading: boolean;
  isFirebaseConnected: boolean;
  isOnline: boolean;
}

export const buildAuthRemoteSyncState = ({
  sessionState,
  authLoading,
  isFirebaseConnected,
  isOnline,
}: BuildAuthRemoteSyncStateInput): FirestoreSyncState => {
  if (isE2ELocalOnlySyncForced()) {
    return {
      mode: 'local_only',
      reason: 'manual_override',
    };
  }

  if (authLoading) {
    return {
      mode: 'bootstrapping',
      reason: 'auth_loading',
    };
  }

  if (sessionState.status === 'authorized' || sessionState.status === 'anonymous_signature') {
    if (!isOnline) {
      return {
        mode: 'local_only',
        reason: 'offline',
      };
    }

    if (isFirebaseConnected) {
      return {
        mode: 'enabled',
        reason: 'ready',
      };
    }

    return {
      mode: 'bootstrapping',
      reason: 'auth_connecting',
    };
  }

  if (sessionState.status === 'auth_error') {
    return {
      mode: 'local_only',
      reason: 'runtime_unavailable',
    };
  }

  return {
    mode: 'local_only',
    reason: 'auth_unavailable',
  };
};
