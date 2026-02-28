import { z } from 'zod';

export const RUT_REGEX = /^(\d{1,2}\.?\d{3}\.?\d{3}[-]?[\dkK])?$/; // Chilean RUT format (optional)
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD format

/**
 * Helper for fields that can be null in Firestore (empty) but should be undefined in the app
 */
export const nullableOptional = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .nullable()
    .optional()
    .transform(v => v ?? undefined);

export const resolveLegacyNameParts = (
  patientName: string
): {
  firstName: string;
  lastName: string;
  secondLastName: string;
} => {
  const normalizedName = patientName.trim().replace(/\s+/g, ' ');
  if (!normalizedName) {
    return { firstName: '', lastName: '', secondLastName: '' };
  }

  const segments = normalizedName.split(' ');
  if (segments.length === 1) {
    return { firstName: segments[0], lastName: '', secondLastName: '' };
  }
  if (segments.length === 2) {
    return { firstName: segments[0], lastName: segments[1], secondLastName: '' };
  }

  return {
    firstName: segments.slice(0, -2).join(' '),
    lastName: segments[segments.length - 2],
    secondLastName: segments[segments.length - 1],
  };
};
