import type { UserRole } from '@/types/auth';

/**
 * Functions telemetry is strictly admin-only.
 * Rationale: telemetry can contain error messages, request context, and
 * external service failure signatures. Exposing to non-admins leaks
 * operational detail.
 */
export const canAccessFunctionsTelemetryView = (role: UserRole | undefined): boolean =>
  role === 'admin';
