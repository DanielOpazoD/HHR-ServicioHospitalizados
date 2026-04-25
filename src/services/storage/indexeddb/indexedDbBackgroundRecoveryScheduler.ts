import { shouldScheduleBackgroundIndexedDbRecovery } from './indexedDbRecoveryPolicy';
import { recordIndexedDbRecoveryNotice } from './indexedDbRecoveryController';
import { resolveIndexedDbRecoveryDelay } from './indexedDbCoreSupport';
import {
  INDEXED_DB_RECOVERY_RETRY_DELAYS_MS,
  MAX_BACKGROUND_RECOVERY_ATTEMPTS,
  getIndexedDbRecoveryBudgetSnapshot,
} from './indexedDbRecoveryBudgets';

interface IndexedDbBackgroundRecoverySchedulerDependencies {
  getStickyFallbackMode: () => boolean;
  onRetry: () => void;
}

export interface IndexedDbBackgroundRecoveryScheduler {
  getAttempts: () => number;
  reset: () => void;
  schedule: () => void;
}

export const createIndexedDbBackgroundRecoveryScheduler = ({
  getStickyFallbackMode,
  onRetry,
}: IndexedDbBackgroundRecoverySchedulerDependencies): IndexedDbBackgroundRecoveryScheduler => {
  let recoveryRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let backgroundRecoveryAttempts = 0;
  let stickyFallbackWarningShown = false;

  const reset = () => {
    backgroundRecoveryAttempts = 0;
    stickyFallbackWarningShown = false;
  };

  const schedule = () => {
    if (recoveryRetryTimer || typeof window === 'undefined') return;

    const stickyFallbackMode = getStickyFallbackMode();
    if (
      !shouldScheduleBackgroundIndexedDbRecovery(
        backgroundRecoveryAttempts,
        MAX_BACKGROUND_RECOVERY_ATTEMPTS,
        stickyFallbackMode
      )
    ) {
      if (stickyFallbackMode) {
        if (!stickyFallbackWarningShown) {
          stickyFallbackWarningShown = true;
          recordIndexedDbRecoveryNotice(
            'indexeddb_recovery_disabled',
            'La recuperacion de IndexedDB fue deshabilitada por esta sesion tras fallos persistentes.',
            {
              stickyFallbackMode: true,
              attempts: backgroundRecoveryAttempts,
              ...getIndexedDbRecoveryBudgetSnapshot(),
            },
            'blocked'
          );
        }
        return;
      }

      recordIndexedDbRecoveryNotice(
        'indexeddb_recovery_stopped',
        'Se detuvo la recuperacion en segundo plano de IndexedDB.',
        {
          attempts: MAX_BACKGROUND_RECOVERY_ATTEMPTS,
          ...getIndexedDbRecoveryBudgetSnapshot(),
        },
        'recoverable'
      );
      return;
    }

    backgroundRecoveryAttempts++;
    const scheduledDelayMs = resolveIndexedDbRecoveryDelay(
      backgroundRecoveryAttempts,
      INDEXED_DB_RECOVERY_RETRY_DELAYS_MS
    );
    recoveryRetryTimer = setTimeout(() => {
      recoveryRetryTimer = null;
      onRetry();
    }, scheduledDelayMs);
    recordIndexedDbRecoveryNotice(
      'indexeddb_recovery_retry_scheduled',
      'Se programo un nuevo intento de recuperacion de IndexedDB.',
      {
        attempt: backgroundRecoveryAttempts,
        scheduledDelayMs,
        ...getIndexedDbRecoveryBudgetSnapshot(),
      },
      'retryable'
    );
  };

  return {
    getAttempts: () => backgroundRecoveryAttempts,
    reset,
    schedule,
  };
};
