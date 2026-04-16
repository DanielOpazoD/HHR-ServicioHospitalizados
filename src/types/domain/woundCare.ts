/**
 * Wound Care Photo Documentation Domain Types
 *
 * Types for clinical wound care photography, including consent management
 * and chronological photo documentation per hospitalization episode.
 */

// ============================================================================
// Audit
// ============================================================================

export interface WoundCareAuditActor {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

// ============================================================================
// Consent
// ============================================================================

export type ConsentStatus = 'pending' | 'signed' | 'revoked';

/**
 * Informed consent record for clinical photography.
 * One consent per hospitalization episode. Must be signed before any
 * wound care photos can be uploaded.
 *
 * Explicitly authorizes photo/video capture for clinical record purposes ONLY,
 * NOT for academic or research use.
 */
export interface WoundCareConsent {
  id: string;
  patientRut: string;
  patientName: string;
  episodeKey: string;
  status: ConsentStatus;
  consentFileStoragePath: string;
  consentFileDownloadUrl: string;
  consentFileMimeType: string;
  consentFileSize: number;
  signedAt: string;
  uploadedAt: string;
  uploadedBy: WoundCareAuditActor;
  revokedAt?: string;
  revokedBy?: WoundCareAuditActor;
  revocationReason?: string;
}

// ============================================================================
// Photo
// ============================================================================

/**
 * Wound care photo metadata record stored in Firestore.
 * The actual image is stored in Firebase Storage at `storagePath`.
 */
export interface WoundCarePhoto {
  id: string;
  patientRut: string;
  patientName: string;
  episodeKey: string;
  consentId?: string;
  storagePath: string;
  thumbnailStoragePath: string;
  downloadUrl: string;
  thumbnailDownloadUrl: string;
  mimeType: string;
  originalFileSize: number;
  compressedFileSize: number;
  width: number;
  height: number;
  description?: string;
  bodyLocation?: string;
  takenAt: string;
  uploadedAt: string;
  uploadedBy: WoundCareAuditActor;
  deletedAt?: string;
  deletedBy?: WoundCareAuditActor;
  isDeleted: boolean;
}

// ============================================================================
// Timeline / Aggregates
// ============================================================================

/** Group of photos taken on the same date */
export interface WoundCarePhotoSession {
  date: string;
  photos: WoundCarePhoto[];
}

/** Full timeline for a patient's hospitalization episode */
export interface WoundCareTimeline {
  episodeKey: string;
  patientRut: string;
  patientName: string;
  consent: WoundCareConsent | null;
  sessions: WoundCarePhotoSession[];
  totalPhotos: number;
}
