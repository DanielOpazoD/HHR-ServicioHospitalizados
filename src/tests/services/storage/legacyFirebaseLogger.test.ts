import { describe, expect, it } from 'vitest';
import { isLegacyPermissionDeniedError } from '@/services/storage/legacyfirebase/legacyFirebaseLogger';

describe('legacyFirebaseLogger permission detection', () => {
  it('detects permission denied by Firestore code', () => {
    expect(isLegacyPermissionDeniedError({ code: 'permission-denied' })).toBe(true);
    expect(isLegacyPermissionDeniedError({ code: 'firestore/permission-denied' })).toBe(true);
  });

  it('detects permission denied by Firebase message text', () => {
    expect(
      isLegacyPermissionDeniedError({
        message: 'FirebaseError: Missing or insufficient permissions.',
      })
    ).toBe(true);
    expect(
      isLegacyPermissionDeniedError({
        message: 'The caller does not have permission denied rights for this path.',
      })
    ).toBe(true);
    expect(
      isLegacyPermissionDeniedError({
        details: {
          reason: 'insufficient permissions',
        },
      })
    ).toBe(true);
  });

  it('does not classify unrelated errors as permission denied', () => {
    expect(isLegacyPermissionDeniedError({ code: 'unavailable', message: 'Network down' })).toBe(
      false
    );
  });
});
