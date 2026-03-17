import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearStorageAutoRecoveryAttempt,
  getStorageAutoRecoveryKey,
  getStorageFallbackNotice,
  hasAttemptedStorageAutoRecovery,
  markStorageAutoRecoveryAttempted,
  shouldAttemptStorageAutoRecovery,
  shouldShowStorageFallbackUi,
} from '@/services/storage/storageFallbackUiPolicy';

describe('storageFallbackUiPolicy', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('attempts auto-recovery once when fallback starts', () => {
    expect(shouldAttemptStorageAutoRecovery(true)).toBe(true);

    markStorageAutoRecoveryAttempted();

    expect(hasAttemptedStorageAutoRecovery()).toBe(true);
    expect(shouldAttemptStorageAutoRecovery(true)).toBe(false);
  });

  it('shows fallback ui only after auto-recovery has already been attempted', () => {
    expect(shouldShowStorageFallbackUi(true)).toBe(false);

    window.sessionStorage.setItem(getStorageAutoRecoveryKey(), 'true');

    expect(shouldShowStorageFallbackUi(true)).toBe(true);
  });

  it('clears the auto-recovery marker when requested', () => {
    markStorageAutoRecoveryAttempted();

    clearStorageAutoRecoveryAttempt();

    expect(hasAttemptedStorageAutoRecovery()).toBe(false);
  });

  it('exposes a degraded operational notice for fallback mode', () => {
    expect(getStorageFallbackNotice()).toMatchObject({
      channel: 'warning',
      state: 'degraded',
      actionRequired: false,
      title: 'Guardado local limitado',
    });
  });
});
