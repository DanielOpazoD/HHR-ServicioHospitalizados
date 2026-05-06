/**
 * Prescription Runtime Contracts
 *
 * Zod schemas mirroring the domain types in `prescriptionTypes.ts`. Used at
 * Firestore read boundaries and inside Cloud Functions to reject malformed
 * documents instead of letting them flow into the visor unparsed.
 */

import { z } from 'zod';

import { PRESCRIPTION_TYPES, type PrescriptionRecord } from '@/types/prescriptionTypes';

const prescriptionTypeSchema = z.enum(
  PRESCRIPTION_TYPES as readonly [string, ...string[]] as readonly [
    'comun',
    'psicotropicos',
    'benzodiazepinas',
  ]
);

const prescriptionImageMetaSchema = z.object({
  storagePath: z.string().min(1),
  thumbnailStoragePath: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.literal('image/jpeg'),
});

const prescriptionUploaderRefSchema = z.object({
  uid: z.string().optional(),
  email: z.string().optional(),
  source: z.enum(['authenticated', 'qr_pin']),
  displayName: z.string().optional(),
});

export const prescriptionRecordSchema = z.object({
  id: z.string().min(1),
  hospitalId: z.string().min(1),
  prescriptionType: prescriptionTypeSchema,
  bedId: z.string().optional(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  notes: z.string().optional(),
  image: prescriptionImageMetaSchema,
  uploader: prescriptionUploaderRefSchema,
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
  patientReassignedAt: z.string().optional(),
  patientReassignedBy: z.string().optional(),
  typeUpdatedAt: z.string().optional(),
  typeUpdatedBy: z.string().optional(),
});

export type ParsedPrescriptionRecord = z.infer<typeof prescriptionRecordSchema>;

/**
 * Strict parse: throws on invalid input. Use only when the caller knows
 * the data should already be valid (e.g., after a write).
 */
export const parsePrescriptionRecord = (input: unknown): PrescriptionRecord =>
  prescriptionRecordSchema.parse(input) as PrescriptionRecord;

/**
 * Lenient parse: returns the parsed record on success or `null` when the
 * input fails validation. Used at the Firestore read boundary so a single
 * corrupt document doesn't blow up the listing for the rest.
 */
export const safeParsePrescriptionRecord = (input: unknown): PrescriptionRecord | null => {
  const result = prescriptionRecordSchema.safeParse(input);
  return result.success ? (result.data as PrescriptionRecord) : null;
};
