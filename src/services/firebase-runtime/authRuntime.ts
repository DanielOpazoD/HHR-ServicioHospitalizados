import type { Auth, User } from 'firebase/auth';
import * as firebaseConfig from '@/firebaseConfig';

export interface AuthRuntime {
  auth: Auth;
  ready: Promise<unknown>;
  getCurrentUser: () => User | null;
}

const resolveAuthInstance = (): Auth => {
  const auth = (firebaseConfig as { auth?: Auth }).auth;
  if (!auth) {
    throw new Error('Auth instance is not available yet.');
  }
  return auth;
};

export const defaultAuthRuntime: AuthRuntime = {
  get auth() {
    return resolveAuthInstance();
  },
  ready:
    'firebaseReady' in firebaseConfig
      ? (firebaseConfig as { firebaseReady: Promise<unknown> }).firebaseReady
      : Promise.resolve(),
  getCurrentUser: () => {
    const auth = (firebaseConfig as { auth?: Auth }).auth;
    return auth?.currentUser ?? null;
  },
};
