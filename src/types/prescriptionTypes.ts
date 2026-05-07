/**
 * Prescription Types
 *
 * Canonical types for the prescription-photo backup module — a transient
 * (30-day) registry of prescriptions emitted by the Hospitalizados service.
 * The original prescription stays at pharmacy; this is operational backup
 * for disputing missing/wrong dispenses, not a legal medical record.
 */

/**
 * Categories of prescription tracked. Mirrors the chilean clinical
 * classification used by hospital pharmacy. The list is a constant for
 * Phase 1; future iterations may expose admin-configurable types.
 */
export type PrescriptionType = 'comun' | 'psicotropicos' | 'benzodiazepinas';

export const PRESCRIPTION_TYPES: readonly PrescriptionType[] = [
  'comun',
  'psicotropicos',
  'benzodiazepinas',
] as const;

export const PRESCRIPTION_TYPE_LABELS: Record<PrescriptionType, string> = {
  comun: 'Receta común',
  psicotropicos: 'Receta blanca de benzodiazepinas',
  benzodiazepinas: 'Receta verde de estupefacientes',
};

/**
 * Default number of days a prescription record (image + Firestore
 * metadata) is retained before scheduled hard-delete. Used as the
 * fallback when no per-type override applies.
 */
export const PRESCRIPTION_RETENTION_DAYS = 30;

/**
 * Per-type retention overrides. Phase 1: every type uses the global
 * default. The map exists so future iterations (admin-configurable
 * retention, longer hold per controlled-prescription type, etc.) can adjust values
 * without re-modeling the data layer or the cleanup function.
 */
export const PRESCRIPTION_RETENTION_DAYS_BY_TYPE: Record<PrescriptionType, number> = {
  comun: PRESCRIPTION_RETENTION_DAYS,
  psicotropicos: PRESCRIPTION_RETENTION_DAYS,
  benzodiazepinas: PRESCRIPTION_RETENTION_DAYS,
};

/** Resolves the retention window (in days) for a given prescription type. */
export const resolvePrescriptionRetentionDays = (type: PrescriptionType): number =>
  PRESCRIPTION_RETENTION_DAYS_BY_TYPE[type] ?? PRESCRIPTION_RETENTION_DAYS;

/**
 * Computes the ISO `expiresAt` timestamp for a record created at
 * `createdAtIso` and tagged with the given prescription type. The cleanup
 * Cloud Function deletes any record whose `expiresAt < now()`.
 */
export const computePrescriptionExpiresAt = (
  type: PrescriptionType,
  createdAtIso: string
): string => {
  const days = resolvePrescriptionRetentionDays(type);
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) {
    throw new Error(`Invalid createdAt ISO timestamp: ${createdAtIso}`);
  }
  const expiry = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
  return expiry.toISOString();
};

export interface PrescriptionUploaderRef {
  /** Firebase auth uid when the upload comes from a logged-in clinician. */
  uid?: string;
  /** Email of the logged-in clinician, when available. */
  email?: string;
  /**
   * Marker emitted by the QR + PIN flow (no auth uid). The Cloud Function
   * stamps this when access was validated by PIN instead of by Firebase auth.
   */
  source: 'authenticated' | 'qr_pin';
  /** Free-form display name to show in the visor (e.g., "Enfermería turno noche"). */
  displayName?: string;
}

export interface PrescriptionImageMeta {
  /** Storage path of the full-resolution compressed JPEG. */
  storagePath: string;
  /** Storage path of the thumbnail JPEG (used in the listing). */
  thumbnailStoragePath: string;
  /** Original-file size in bytes after compression (for audit). */
  byteSize: number;
  /** Pixel dimensions of the compressed full image. */
  width: number;
  height: number;
  /** Content type — currently always `image/jpeg` after compression. */
  contentType: 'image/jpeg';
}

/**
 * Represents one prescription photo upload. The record lives at
 * `hospitals/{hospitalId}/prescriptions/{id}` in Firestore; the image
 * binary lives at the path captured in `image.storagePath`.
 */
export interface PrescriptionRecord {
  id: string;
  hospitalId: string;
  prescriptionType: PrescriptionType;
  /**
   * Bed identifier (e.g., 'H5C1') the prescription was tied to at upload
   * time. Optional because the QR flow allows "sin paciente asignado".
   */
  bedId?: string;
  /** Snapshotted patient name to keep the visor readable when censuses change. */
  patientName?: string;
  /** Optional patient RUT, copied at upload time when bedId resolves to one. */
  patientRut?: string;
  /** Free-form note left by the uploader (optional). */
  notes?: string;
  image: PrescriptionImageMeta;
  uploader: PrescriptionUploaderRef;
  /** ISO timestamp when the upload was persisted. */
  createdAt: string;
  /** ISO timestamp at which the cleanup scheduler will hard-delete the record. */
  expiresAt: string;
  /** ISO timestamp when patient assignment was last changed via the visor. */
  patientReassignedAt?: string;
  /** Last actor that re-assigned (or cleared) the patient association. */
  patientReassignedBy?: string;
  /** ISO timestamp when the prescription type was last edited via the visor. */
  typeUpdatedAt?: string;
  /** Last actor that changed the prescription type. */
  typeUpdatedBy?: string;
}
