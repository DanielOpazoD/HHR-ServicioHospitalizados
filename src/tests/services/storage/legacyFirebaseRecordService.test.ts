import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLegacyReadBlock,
  isLegacyReadBlocked,
  registerLegacyPermissionDeniedBlock,
} from '@/services/storage/legacyfirebase/legacyFirebaseRecordService';

const LEGACY_READ_BLOCK_KEY = 'hhr_legacy_read_block_v1';

describe('legacyFirebaseRecordService block persistence', () => {
  beforeEach(() => {
    clearLegacyReadBlock();
    localStorage.removeItem(LEGACY_READ_BLOCK_KEY);
  });

  it('starts unblocked by default', () => {
    expect(isLegacyReadBlocked()).toBe(false);
  });

  it('registers persistent block when permission denied is detected', () => {
    registerLegacyPermissionDeniedBlock();
    expect(isLegacyReadBlocked()).toBe(true);
    expect(localStorage.getItem(LEGACY_READ_BLOCK_KEY)).not.toBeNull();
  });

  it('can clear persistent block explicitly', () => {
    registerLegacyPermissionDeniedBlock();
    clearLegacyReadBlock();
    expect(isLegacyReadBlocked()).toBe(false);
    expect(localStorage.getItem(LEGACY_READ_BLOCK_KEY)).toBeNull();
  });
});
