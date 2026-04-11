import React from 'react';
import { useDateNavigation, useSignatureMode, useVersionCheck } from '@/hooks';
import { useStalenessGuard } from '@/hooks/useStalenessGuard';
import type { UseDateNavigationReturn } from '@/hooks/useDateNavigation';
import { useStorageMigration } from '@/hooks/useStorageMigration';
import { setFirestoreSyncState } from '@/services/repositories/repositoryConfig';
import { defaultFirebaseConfigRuntimeAdapter } from '@/services/firebase-runtime/firebaseConfigRuntimeAdapter';
import { createScopedLogger } from '@/services/utils/loggerScope';
import { useAuth, type AuthContextType } from '@/context';

export interface AppAuthenticatedDateNavigation extends UseDateNavigationReturn {
  isSignatureMode: boolean;
  currentDateString: string;
}

export type AppBootstrapState =
  | {
      status: 'loading';
      auth: AuthContextType;
    }
  | {
      status: 'signature_mode';
      auth: AuthContextType;
    }
  | {
      status: 'unauthenticated';
      auth: AuthContextType;
    }
  | {
      status: 'authenticated';
      auth: AuthContextType;
      dateNav: AppAuthenticatedDateNavigation;
    };

interface BuildAppBootstrapStateParams {
  auth: AuthContextType;
  dateNav: UseDateNavigationReturn;
  isSignatureMode: boolean;
  currentDateString: string;
}

const isIgnorableWorkerShutdownImportError = (error: unknown): boolean => {
  const message = String(error);
  return message.includes('[vitest-worker]: Closing rpc while "fetch" was pending');
};

const appLogger = createScopedLogger('App');

const FIRESTORE_RUNTIME_POLL_MS = 250;

const resolveSyncedFirestoreState = (
  remoteSyncState: AuthContextType['remoteSyncState'],
  isFirestoreReady: boolean
): AuthContextType['remoteSyncState'] => {
  if (remoteSyncState.mode !== 'enabled') {
    return remoteSyncState;
  }

  if (isFirestoreReady) {
    return {
      mode: 'enabled',
      reason: 'ready',
    };
  }

  return {
    mode: 'bootstrapping',
    reason: 'auth_connecting',
  };
};

const useSyncFirestoreStatus = (remoteSyncState: AuthContextType['remoteSyncState']) => {
  React.useEffect(() => {
    const syncState = () => {
      try {
        const nextState = resolveSyncedFirestoreState(
          remoteSyncState,
          defaultFirebaseConfigRuntimeAdapter.getOptionalDb() !== null
        );
        setFirestoreSyncState(nextState);
        return nextState.mode === 'enabled';
      } catch (error) {
        if (isIgnorableWorkerShutdownImportError(error)) {
          return true;
        }
        appLogger.error('Failed to sync Firestore status', error);
        return true;
      }
    };

    if (syncState()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (syncState()) {
        window.clearInterval(intervalId);
      }
    }, FIRESTORE_RUNTIME_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [remoteSyncState]);
};

export const buildAppBootstrapState = ({
  auth,
  dateNav,
  isSignatureMode,
  currentDateString,
}: BuildAppBootstrapStateParams): AppBootstrapState => {
  if (isSignatureMode) {
    return {
      status: 'signature_mode',
      auth,
    };
  }

  if (auth.isLoading) {
    return {
      status: 'loading',
      auth,
    };
  }

  if (!auth.isAuthenticated) {
    return {
      status: 'unauthenticated',
      auth,
    };
  }

  return {
    status: 'authenticated',
    auth,
    dateNav: {
      ...dateNav,
      isSignatureMode,
      currentDateString,
    },
  };
};

export const useAppBootstrapState = (): AppBootstrapState => {
  const auth = useAuth();

  useStorageMigration({ enabled: !auth.isLoading && auth.isAuthenticated });
  useVersionCheck();
  useStalenessGuard();
  useSyncFirestoreStatus(auth.remoteSyncState);

  const dateNav = useDateNavigation();
  const { isSignatureMode, currentDateString } = useSignatureMode(
    dateNav.currentDateString,
    auth.currentUser,
    auth.isLoading
  );

  return React.useMemo<AppBootstrapState>(
    () =>
      buildAppBootstrapState({
        auth,
        dateNav,
        isSignatureMode,
        currentDateString,
      }),
    [auth, currentDateString, dateNav, isSignatureMode]
  );
};
