// Backward-compatible facade. New code should import dedicated modules.
export type { AuthUser, UserRole } from '@/types';
export * from '@/services/auth/authFlow';
export * from '@/services/auth/authPolicy';
export * from '@/services/auth/authSession';
export * from '@/services/auth/authFallback';
