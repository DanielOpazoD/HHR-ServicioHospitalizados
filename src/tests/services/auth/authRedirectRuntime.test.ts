import { afterEach, describe, expect, it } from 'vitest';

import { getAuthRedirectRuntimeSupport } from '@/services/auth/authRedirectRuntime';

describe('authRedirectRuntime', () => {
  const originalLocation = window.location;

  const setHostname = (hostname: string) => {
    Reflect.deleteProperty(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname },
    });
  };

  afterEach(() => {
    Reflect.deleteProperty(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('disables redirect auth on localhost by default', () => {
    setHostname('localhost');

    const support = getAuthRedirectRuntimeSupport();

    expect(support.canUseRedirectAuth).toBe(false);
    expect(support.redirectDisabledReason).toMatch(/localhost/i);
  });

  it('allows redirect auth on non-localhost runtimes when authDomain exists', () => {
    setHostname('app.hhr.test');

    const support = getAuthRedirectRuntimeSupport();

    expect(support.canUseRedirectAuth).toBe(true);
    expect(support.redirectDisabledReason).toBeNull();
  });

  it('exposes whether the authDomain is Firebase-hosted', () => {
    setHostname('app.hhr.test');

    const support = getAuthRedirectRuntimeSupport();

    expect(typeof support.authDomain).toBe('string');
    expect(typeof support.usesFirebaseHostedAuthDomain).toBe('boolean');
  });
});
