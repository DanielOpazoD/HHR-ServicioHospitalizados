import type { AuthUser } from './authRoleTypes';

export type AuthSessionStatus =
  | 'unauthenticated'
  | 'authenticating'
  | 'authorized'
  | 'anonymous_signature'
  | 'unauthorized'
  | 'auth_error';

export type AuthSessionSeverity = 'info' | 'warning' | 'error';

export interface AuthSessionError {
  message: string;
  code?: string;
  userSafeMessage?: string;
  retryable?: boolean;
  severity?: AuthSessionSeverity;
  technicalContext?: Record<string, unknown>;
  telemetryTags?: string[];
}

export type AuthSessionState =
  | {
      status: 'unauthenticated' | 'authenticating' | 'unauthorized';
      user: null;
      reason?: string;
      technicalContext?: Record<string, unknown>;
    }
  | {
      status: 'authorized' | 'anonymous_signature';
      user: AuthUser;
    }
  | {
      status: 'auth_error';
      user: null;
      error: AuthSessionError;
    };
