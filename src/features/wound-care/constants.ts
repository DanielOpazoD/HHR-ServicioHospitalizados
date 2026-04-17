/**
 * Wound Care Module Constants
 */

// ============================================================================
// Storage Paths
// ============================================================================

export const WOUND_CARE_STORAGE_ROOT = 'wound-care';
export const WOUND_CARE_CONSENTS_PATH = `${WOUND_CARE_STORAGE_ROOT}/consents`;
export const WOUND_CARE_PHOTOS_PATH = `${WOUND_CARE_STORAGE_ROOT}/photos`;
export const WOUND_CARE_THUMBNAILS_PATH = `${WOUND_CARE_STORAGE_ROOT}/thumbnails`;

// ============================================================================
// File Constraints
// ============================================================================

/** Max file size before compression (15 MB) */
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/** Max dimension for compressed photos (pixels) */
export const PHOTO_MAX_DIMENSION = 1920;

/** Max dimension for thumbnails (pixels) */
export const THUMBNAIL_MAX_DIMENSION = 200;

/** Compression quality for photos (0-1) */
export const PHOTO_QUALITY = 0.8;

/** Compression quality for thumbnails (0-1) */
export const THUMBNAIL_QUALITY = 0.6;

// ============================================================================
// Accepted MIME Types
// ============================================================================

/** Image types accepted for wound care photos (includes HEIC for iOS) */
export const ACCEPTED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/** File types accepted for consent documents (images + PDF) */
export const ACCEPTED_CONSENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

// ============================================================================
// PDF
// ============================================================================

export const HOSPITAL_LOGO_PATH = '/images/logos/logo_HHR.png';
export const HOSPITAL_NAME = 'HOSPITAL HANGA ROA';
export const HOSPITAL_SUBTITLE = 'Servicio de Salud Metropolitano Oriente';
export const HOSPITAL_LOCATION = 'Rapa Nui, Chile';
