import type { FirebaseStartupWarningCopy } from '@/services/auth/firebaseStartupUiPolicy';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { ClientBootstrapRecoveryResult } from '@/services/config/clientBootstrapRecovery';

export interface BootstrapRuntimeServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore | null;
}

export type AppBootstrapRuntimeResult =
  | {
      status: 'continue';
      stage: 'firebase_ready';
      clientRecovery: ClientBootstrapRecoveryResult;
      services: BootstrapRuntimeServices;
    }
  | {
      status: 'reload';
      stage: 'client_recovery' | 'firebase_ready';
      clientRecovery: ClientBootstrapRecoveryResult;
    }
  | {
      status: 'blocked';
      stage: 'firebase_ready';
      clientRecovery: ClientBootstrapRecoveryResult;
      error: unknown;
      message: string;
      warningCopy?: FirebaseStartupWarningCopy;
    };
