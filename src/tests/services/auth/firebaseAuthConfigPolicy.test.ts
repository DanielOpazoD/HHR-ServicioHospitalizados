import { describe, expect, it } from 'vitest';

import { getFirebaseAuthConfigStatus } from '@/services/auth/firebaseAuthConfigPolicy';

describe('firebaseAuthConfigPolicy', () => {
  it('blocks redirect auth when authDomain is missing', () => {
    const status = getFirebaseAuthConfigStatus('');

    expect(status.canAttemptRedirectAuth).toBe(false);
    expect(status.redirectBlockedReason).toContain('acceso alternativo');
    expect(status.supportSummary).toContain('dominio de autenticación');
    expect(status.supportAction).toContain('VITE_FIREBASE_AUTH_DOMAIN');
  });

  it('detects Firebase-hosted auth domains', () => {
    const status = getFirebaseAuthConfigStatus('hhr-pruebas.firebaseapp.com');

    expect(status.canAttemptRedirectAuth).toBe(true);
    expect(status.usesFirebaseHostedAuthDomain).toBe(true);
  });

  it('allows non-hosted auth domains but marks them as non-hosted', () => {
    const status = getFirebaseAuthConfigStatus('auth.hospital.cl');

    expect(status.canAttemptRedirectAuth).toBe(true);
    expect(status.usesFirebaseHostedAuthDomain).toBe(false);
    expect(status.supportSummary).toContain('no usa el hosting estándar');
    expect(status.supportAction).toContain('/__/auth/handler');
  });
});
