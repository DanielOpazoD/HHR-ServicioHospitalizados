import { describe, expect, it } from 'vitest';

import {
  shouldScheduleBackgroundIndexedDbRecovery,
  shouldLogIndexedDbRuntimeWarning,
  shouldUseStickyIndexedDbFallback,
} from '@/services/storage/indexeddb/indexedDbRecoveryPolicy';

describe('indexedDbRecoveryPolicy', () => {
  it('uses sticky fallback for backing-store UnknownError failures', () => {
    expect(
      shouldUseStickyIndexedDbFallback({
        name: 'UnknownError',
        message: 'Internal error opening backing store for indexedDB.open.',
      })
    ).toBe(true);
  });

  it('does not use sticky fallback for transient non-backing-store failures', () => {
    expect(
      shouldUseStickyIndexedDbFallback({
        name: 'UnknownError',
        message: 'Temporary open failure',
      })
    ).toBe(false);
  });

  it('skips background recovery when sticky fallback mode is active', () => {
    expect(shouldScheduleBackgroundIndexedDbRecovery(0, 3, true)).toBe(false);
  });

  it('stops background recovery when the retry budget is exhausted', () => {
    expect(shouldScheduleBackgroundIndexedDbRecovery(3, 3, false)).toBe(false);
  });

  it('deduplicates runtime warnings after the first emission', () => {
    const emittedWarnings = new Set<string>();

    expect(shouldLogIndexedDbRuntimeWarning('blocked', false, emittedWarnings)).toBe(true);
    expect(shouldLogIndexedDbRuntimeWarning('blocked', false, emittedWarnings)).toBe(false);
  });

  it('suppresses unexpected-close warnings while sticky fallback is active', () => {
    const emittedWarnings = new Set<string>();

    expect(shouldLogIndexedDbRuntimeWarning('unexpected-close', true, emittedWarnings)).toBe(false);
  });
});
