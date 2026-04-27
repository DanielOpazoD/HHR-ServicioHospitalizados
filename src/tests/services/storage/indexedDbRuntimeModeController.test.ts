import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import {
  buildLocalPersistenceRuntimeSnapshot,
  resolveLocalPersistenceRuntimeState,
  shouldAttemptMockRecovery,
  shouldSkipReadyCheckForMock,
} from '@/services/storage/indexeddb/indexedDbRuntimeModeController';

describe('indexedDbRuntimeModeController', () => {
  it('maps fallback and sticky modes to operational runtime states', () => {
    expect(
      resolveLocalPersistenceRuntimeState({ isUsingMock: false, stickyFallbackMode: false })
    ).toBe('ok');
    expect(
      resolveLocalPersistenceRuntimeState({ isUsingMock: true, stickyFallbackMode: false })
    ).toBe('recoverable');
    expect(
      resolveLocalPersistenceRuntimeState({ isUsingMock: true, stickyFallbackMode: true })
    ).toBe('blocked');
  });

  it('keeps mock recovery decisions explicit', () => {
    expect(shouldSkipReadyCheckForMock({ isUsingMock: true, allowRecoveryWhenMock: false })).toBe(
      true
    );
    expect(
      shouldAttemptMockRecovery({
        isUsingMock: true,
        allowRecoveryWhenMock: true,
        stickyFallbackMode: false,
      })
    ).toBe(true);
    expect(
      shouldAttemptMockRecovery({
        isUsingMock: true,
        allowRecoveryWhenMock: true,
        stickyFallbackMode: true,
      })
    ).toBe(false);
  });

  it('builds the local persistence snapshot without coupling callers to core state', () => {
    expect(
      buildLocalPersistenceRuntimeSnapshot({
        indexedDbAvailable: true,
        isUsingMock: true,
        stickyFallbackMode: false,
      })
    ).toEqual({
      indexedDbAvailable: true,
      fallbackMode: true,
      stickyFallbackMode: false,
      runtimeState: 'recoverable',
    });
  });
});
