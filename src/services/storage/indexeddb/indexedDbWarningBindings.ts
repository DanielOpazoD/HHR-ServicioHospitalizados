import { shouldLogIndexedDbRuntimeWarning } from './indexedDbRecoveryPolicy';

type IndexedDbEventSource = {
  on: (event: 'blocked' | 'close', callback: () => void) => void;
};

type IndexedDbRuntimeState = {
  isUsingMock: boolean;
  stickyFallbackMode: boolean;
};

export const attachIndexedDbWarningBindings = (
  database: IndexedDbEventSource,
  getRuntimeState: () => IndexedDbRuntimeState,
  emittedWarnings: Set<string>
): void => {
  database.on('blocked', () => {
    if (
      shouldLogIndexedDbRuntimeWarning(
        'blocked',
        getRuntimeState().stickyFallbackMode,
        emittedWarnings
      )
    ) {
      console.warn('[IndexedDB] ⏳ Database is blocked by another tab');
    }
  });

  database.on('close', () => {
    const runtimeState = getRuntimeState();
    if (
      !runtimeState.isUsingMock &&
      shouldLogIndexedDbRuntimeWarning(
        'unexpected-close',
        runtimeState.stickyFallbackMode,
        emittedWarnings
      )
    ) {
      console.warn('[IndexedDB] 🚪 Database connection closed unexpectedly.');
    }
  });
};
