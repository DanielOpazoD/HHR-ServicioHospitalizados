import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signIn,
  signInWithGoogle,
  onAuthChange,
  signInWithGoogleRedirect,
  handleSignInRedirectResult,
} from '@/services/auth/authService';
import * as firebaseAuth from 'firebase/auth';
import { getDocs } from 'firebase/firestore';
import { QuerySnapshot } from 'firebase/firestore';

vi.unmock('../../services/auth/authService');
vi.unmock('@/services/auth/authService');

const mockCheckSharedCensusAccessCallable = vi.fn();

// Mock setup for authService tests
vi.mock('firebase/auth', () => {
  const GoogleAuthProvider = vi.fn();
  (
    GoogleAuthProvider as unknown as { prototype: { setCustomParameters: () => void } }
  ).prototype.setCustomParameters = vi.fn();

  return {
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    GoogleAuthProvider,
    signInAnonymously: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithRedirect: vi.fn(),
    getRedirectResult: vi.fn(),
  };
});

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_functions: unknown, callableName: string) => {
    if (callableName === 'checkSharedCensusAccess') {
      return mockCheckSharedCensusAccessCallable;
    }
    return vi.fn().mockResolvedValue({ data: { role: 'unauthorized' } });
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

describe('authService', () => {
  const AUTH_BOOTSTRAP_PENDING_KEY = 'hhr_auth_bootstrap_pending_v1';
  const GOOGLE_LOGIN_LOCK_KEY = 'hhr_google_login_lock_v1';
  const originalLocation = window.location;
  const setPathname = (pathname: string) => {
    Reflect.deleteProperty(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(AUTH_BOOTSTRAP_PENDING_KEY);
    localStorage.removeItem(GOOGLE_LOGIN_LOCK_KEY);
    mockCheckSharedCensusAccessCallable.mockResolvedValue({
      data: { authorized: true, role: 'viewer' },
    });
    setPathname('/');
  });

  describe('signIn', () => {
    it('should allow access if user is in whitelist', async () => {
      const mockFirebaseUser = {
        user: {
          uid: '123',
          email: 'daniel.opazo@hospitalhangaroa.cl',
          displayName: 'Daniel',
        },
      };

      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockFirebaseUser as unknown as firebaseAuth.UserCredential
      );

      // Static role check should catch this before Firestore
      const result = await signIn('daniel.opazo@hospitalhangaroa.cl', 'password');

      expect(result.uid).toBe('123');
      expect(result.role).toBe('admin');
      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalled();
    });

    it('should deny access and sign out if user is not in whitelist', async () => {
      const mockFirebaseUser = {
        user: {
          uid: '456',
          email: 'unknown@gmail.com',
          displayName: 'Unknown',
        },
      };

      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockFirebaseUser as unknown as firebaseAuth.UserCredential
      );
      vi.mocked(getDocs).mockResolvedValue({ empty: true } as unknown as QuerySnapshot);

      await expect(signIn('unknown@gmail.com', 'password')).rejects.toThrow('Acceso no autorizado');
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    });

    it('should normalize emails during check', async () => {
      const mockFirebaseUser = {
        user: {
          uid: '123',
          email: 'DANIEL.OPAZO@HOSPITALHANGAROA.CL ', // With spaces and caps
          displayName: 'Daniel',
        },
      };

      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockFirebaseUser as unknown as firebaseAuth.UserCredential
      );

      const result = await signIn(' DANIEL.opazo@hospitalhangaroa.cl', 'password');

      expect(result.role).toBe('admin');
    });

    it('should reject partial matches against static whitelist emails', async () => {
      const mockFirebaseUser = {
        user: {
          uid: 'attacker-1',
          email: 'daniel.opazo@hospitalhangaroa.cl.attacker@evil.com',
          displayName: 'Attacker',
        },
      };

      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue(
        mockFirebaseUser as unknown as firebaseAuth.UserCredential
      );
      vi.mocked(getDocs).mockResolvedValue({ empty: true } as unknown as QuerySnapshot);

      await expect(
        signIn('daniel.opazo@hospitalhangaroa.cl.attacker@evil.com', 'password')
      ).rejects.toThrow('Acceso no autorizado');
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    });
  });

  describe('signInWithGoogle', () => {
    it('should succeed for authorized users', async () => {
      const mockResult = {
        user: {
          uid: 'google-123',
          email: 'd.opazo.damiani@gmail.com',
          displayName: 'Daniel Google',
        },
      };

      vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue(
        mockResult as unknown as firebaseAuth.UserCredential
      );

      const result = await signInWithGoogle();

      expect(result.uid).toBe('google-123');
      expect(result.role).toBe('doctor_urgency');
    });

    it('should reject shared-census login when callable denies access', async () => {
      setPathname('/censo-compartido');
      mockCheckSharedCensusAccessCallable.mockResolvedValue({
        data: { authorized: false, role: 'viewer' },
      });

      vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValue({
        user: {
          uid: 'google-denied',
          email: 'denied@external.com',
          displayName: 'Denied User',
        },
      } as unknown as firebaseAuth.UserCredential);

      await expect(signInWithGoogle()).rejects.toThrow('Acceso no autorizado');
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    });

    it('should fail with multi-tab guidance when another tab lock is active', async () => {
      localStorage.setItem(
        GOOGLE_LOGIN_LOCK_KEY,
        JSON.stringify({ owner: 'external-tab', timestamp: Date.now() })
      );

      await expect(signInWithGoogle()).rejects.toThrow(/otra pestaña.*\d+s/i);
      expect(firebaseAuth.signInWithPopup).not.toHaveBeenCalled();
    });

    it('should map INTERNAL ASSERTION popup failures to fallback auth error code', async () => {
      vi.mocked(firebaseAuth.signInWithPopup).mockRejectedValue(
        new Error('INTERNAL ASSERTION FAILED: Cross-Origin-Opener-Policy')
      );

      await expect(signInWithGoogle()).rejects.toMatchObject({
        code: 'auth/popup-coop-blocked',
      });
    });
  });

  describe('onAuthChange', () => {
    it('should handle anonymous users for signature mode', async () => {
      const mockCallback = vi.fn();

      onAuthChange(mockCallback);

      expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalled();
      const firebaseCallback = vi.mocked(firebaseAuth.onAuthStateChanged).mock.calls[0][1] as (
        user: firebaseAuth.User | null
      ) => Promise<void>;

      await firebaseCallback({
        uid: 'anon-123',
        isAnonymous: true,
      } as unknown as firebaseAuth.User);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'anon-123',
          displayName: 'Anonymous Doctor',
          role: 'viewer',
        })
      );
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const mockUser = {
        user: {
          uid: 'new-123',
          email: 'new@test.com',
          displayName: 'New User',
        },
      };
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue(
        mockUser as unknown as firebaseAuth.UserCredential
      );

      const result = await (
        await import('@/services/auth/authService')
      ).createUser('new@test.com', 'password');
      expect(result.uid).toBe('new-123');
    });

    it('should map Firebase error codes', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockRejectedValue({
        code: 'auth/email-already-in-use',
      });

      await expect(
        (await import('@/services/auth/authService')).createUser('used@test.com', 'password')
      ).rejects.toThrow('Este email ya está registrado');
    });
  });

  describe('signOut', () => {
    it('should sign out and clear cache', async () => {
      await (await import('@/services/auth/authService')).signOut();
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    });
  });

  describe('signInAnonymouslyForPassport', () => {
    it('should return uid if user already signed in', async () => {
      const auth = (await import('@/firebaseConfig')).auth;
      Object.defineProperty(auth, 'currentUser', {
        value: { uid: 'existing-123' },
        configurable: true,
      });

      const result = await (
        await import('@/services/auth/authService')
      ).signInAnonymouslyForPassport();
      expect(result).toBe('existing-123');
    });

    it('should sign in anonymously if not signed in', async () => {
      const auth = (await import('@/firebaseConfig')).auth;
      Object.defineProperty(auth, 'currentUser', { value: null, configurable: true });
      vi.mocked(firebaseAuth.signInAnonymously).mockResolvedValue({
        user: { uid: 'anon-456' },
      } as unknown as firebaseAuth.UserCredential);

      const result = await (
        await import('@/services/auth/authService')
      ).signInAnonymouslyForPassport();
      expect(result).toBe('anon-456');
    });
  });

  describe('handleSignInRedirectResult', () => {
    it('should return null if no result', async () => {
      vi.mocked(firebaseAuth.getRedirectResult).mockResolvedValue(null);
      const result = await (
        await import('@/services/auth/authService')
      ).handleSignInRedirectResult();
      expect(result).toBeNull();
    });

    it('should return user for shared census mode', async () => {
      // Mock window.location.pathname
      setPathname('/censo-compartido/test');
      mockCheckSharedCensusAccessCallable.mockResolvedValue({
        data: { authorized: true, role: 'viewer' },
      });

      vi.mocked(firebaseAuth.getRedirectResult).mockResolvedValue({
        user: { uid: 'shared-123', email: 'guest@test.com', displayName: 'Guest' },
      } as unknown as firebaseAuth.UserCredential);

      const result = await (
        await import('@/services/auth/authService')
      ).handleSignInRedirectResult();
      expect(result?.role).toBe('viewer_census');

      // Restore location
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('should clear pending bootstrap marker when redirect finishes without result', async () => {
      localStorage.setItem(
        AUTH_BOOTSTRAP_PENDING_KEY,
        JSON.stringify({ startedAt: Date.now(), mode: 'redirect' })
      );
      vi.mocked(firebaseAuth.getRedirectResult).mockResolvedValue(null);

      const result = await handleSignInRedirectResult();

      expect(result).toBeNull();
      expect(localStorage.getItem(AUTH_BOOTSTRAP_PENDING_KEY)).toBeNull();
    });
  });

  describe('signInWithGoogleRedirect', () => {
    it('should mark bootstrap as pending before redirect starts', async () => {
      await signInWithGoogleRedirect();

      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled();
      expect(localStorage.getItem(AUTH_BOOTSTRAP_PENDING_KEY)).not.toBeNull();
    });
  });
});
