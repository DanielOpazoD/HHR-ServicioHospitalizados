export const INDEXED_DB_OPEN_TIMEOUT_MS = 7_000;
export const INDEXED_DB_DELETE_TIMEOUT_MS = 5_000;
export const INDEXED_DB_RECOVERY_RETRY_DELAYS_MS = [300, 1_000, 3_000] as const;
export const MAX_BACKGROUND_RECOVERY_ATTEMPTS = 3;

export interface IndexedDbRecoveryBudgetSnapshot {
  openTimeoutMs: number;
  deleteTimeoutMs: number;
  retryDelaysMs: readonly number[];
  maxBackgroundRecoveryAttempts: number;
}

export const getIndexedDbRecoveryBudgetSnapshot = (): IndexedDbRecoveryBudgetSnapshot => ({
  openTimeoutMs: INDEXED_DB_OPEN_TIMEOUT_MS,
  deleteTimeoutMs: INDEXED_DB_DELETE_TIMEOUT_MS,
  retryDelaysMs: INDEXED_DB_RECOVERY_RETRY_DELAYS_MS,
  maxBackgroundRecoveryAttempts: MAX_BACKGROUND_RECOVERY_ATTEMPTS,
});
