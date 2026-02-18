/**
 * @deprecated
 * Shared census authorization is now resolved server-side via Cloud Functions and Firestore rules.
 * Keep this module only for backward compatibility with legacy imports.
 */
export const CENSUS_AUTHORIZED_EMAILS: string[] = [];

/**
 * Checks if an email is authorized to view the shared census
 * @param email - The email to check (case-insensitive)
 * @returns true if the email is in the authorized list
 */
export function isEmailAuthorizedForCensus(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.toLowerCase().trim();
  return CENSUS_AUTHORIZED_EMAILS.some(authorized => authorized.toLowerCase() === normalizedEmail);
}

/**
 * Checks if an email domain is from Hospital Hanga Roa
 * (Useful for allowing all hospital staff in the future)
 */
export function isHospitalDomain(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@hospitalhangaroa.cl');
}
