/**
 * Deprecated utility.
 *
 * Access control must be enforced by Firebase Auth + Firestore Rules.
 * Frontend-generated tokens are not a secure authorization mechanism.
 */

/**
 * @deprecated Use authenticated shared-census routes instead.
 */
export function generatePublicCensusToken(): string {
  // Generates opaque value only for backward compatibility with legacy callers.
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * @deprecated Always false by design (fail-closed).
 */
export function validatePublicCensusToken(_token: string): boolean {
  return false;
}

/**
 * @deprecated Shared census now relies on authenticated route only.
 */
export function generatePublicCensusUrl(): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/censo-compartido`;
}
