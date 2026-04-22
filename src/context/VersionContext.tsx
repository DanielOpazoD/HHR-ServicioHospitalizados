import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntimeCore';
import { createScopedLogger } from '@/services/utils/loggerScope';
import {
  assessRemoteRuntimeContract,
  fetchRemoteRuntimeContract,
  type RemoteRuntimeContract,
} from '@/services/config/runtimeContractClient';

type VersionUpdateReason =
  | 'current'
  | 'new_build_available'
  | 'runtime_contract_mismatch'
  | 'schema_ahead_of_client';

const RUNTIME_CONTRACT_CHECK_INTERVAL_MS = 5 * 60 * 1000;

interface VersionContextType {
  isOutdated: boolean;
  appVersion: number;
  remoteVersion: number | null;
  updateReason: VersionUpdateReason;
  runtimeContract: RemoteRuntimeContract | null;
  checkVersion: (remoteVersion: number) => void;
  checkRuntimeContract: () => Promise<void>;
  forceUpdate: () => void;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);
const versionLogger = createScopedLogger('VersionContext');

export const VersionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOutdated, setIsOutdated] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<number | null>(null);
  const [runtimeContract, setRuntimeContract] = useState<RemoteRuntimeContract | null>(null);
  const [updateReason, setUpdateReason] = useState<VersionUpdateReason>('current');

  const checkVersion = useCallback((remoteVersionValue: number) => {
    if (remoteVersionValue > CURRENT_SCHEMA_VERSION) {
      versionLogger.error('App version mismatch detected', {
        localVersion: CURRENT_SCHEMA_VERSION,
        remoteVersion: remoteVersionValue,
      });
      setIsOutdated(true);
      setRemoteVersion(remoteVersionValue);
      setUpdateReason('schema_ahead_of_client');
    }
  }, []);

  const checkRuntimeContract = useCallback(async () => {
    try {
      const contract = await fetchRemoteRuntimeContract();
      if (!contract) {
        return;
      }

      setRuntimeContract(contract);
      const assessment = assessRemoteRuntimeContract(contract);
      if (!assessment.ok) {
        setIsOutdated(true);
        setUpdateReason(
          assessment.disposition === 'runtime_contract_mismatch'
            ? 'runtime_contract_mismatch'
            : 'schema_ahead_of_client'
        );
        if (assessment.disposition === 'schema_ahead_of_client') {
          setRemoteVersion(contract.supportedSchemaVersion);
        }
        versionLogger.error('Runtime contract mismatch detected', {
          localVersion: CURRENT_SCHEMA_VERSION,
          contract,
          disposition: assessment.disposition,
        });
        return;
      }

      setRuntimeContract(contract);
      setIsOutdated(prev => (updateReason === 'schema_ahead_of_client' ? prev : false));
      setUpdateReason(prev => (prev === 'schema_ahead_of_client' ? prev : 'current'));
    } catch (error) {
      versionLogger.warn('Runtime contract check failed', error);
    }
  }, [updateReason]);

  const forceUpdate = useCallback(() => {
    defaultBrowserWindowRuntime.reload();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runCheck = async () => {
      if (cancelled) {
        return;
      }

      await checkRuntimeContract();
    };

    void runCheck();
    const interval = window.setInterval(() => {
      void runCheck();
    }, RUNTIME_CONTRACT_CHECK_INTERVAL_MS);

    const handleFocus = () => {
      void runCheck();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkRuntimeContract]);

  return (
    <VersionContext.Provider
      value={{
        isOutdated,
        appVersion: CURRENT_SCHEMA_VERSION,
        remoteVersion,
        updateReason,
        runtimeContract,
        checkVersion,
        checkRuntimeContract,
        forceUpdate,
      }}
    >
      {children}
    </VersionContext.Provider>
  );
};

export const useVersion = () => {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
};
