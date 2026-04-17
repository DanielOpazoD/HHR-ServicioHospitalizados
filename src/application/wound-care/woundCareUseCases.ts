/**
 * Wound Care Use Cases
 *
 * Business logic for wound care consent and photo management.
 * Each use case returns an {@link ApplicationOutcome} so callers
 * get a uniform success/failure contract with structured issues.
 */

import {
  createApplicationSuccess,
  createApplicationFailed,
  type ApplicationOutcome,
} from '@/shared/contracts/applicationOutcome';
import {
  defaultWoundCareConsentPort,
  defaultWoundCarePhotoPort,
  defaultWoundCareStoragePort,
  type WoundCareConsentPort,
  type WoundCarePhotoPort,
  type WoundCareStoragePort,
} from '@/application/ports/woundCarePort';
import type {
  WoundCareAuditActor,
  WoundCareConsent,
  WoundCarePhoto,
} from '@/types/domain/woundCare';
import { compressImage, generateThumbnail } from '@/utils/imageCompression';

// ============================================================================
// Types
// ============================================================================

export interface EpisodeContext {
  episodeKey: string;
  patientRut: string;
  patientName: string;
}

interface ConsentUploadInput {
  file: File;
  episodeContext: EpisodeContext;
  actor: WoundCareAuditActor;
  hospitalId: string;
}

interface PhotoUploadInput {
  file: File;
  episodeContext: EpisodeContext;
  description?: string;
  bodyLocation?: string;
  takenAt?: string;
  actor: WoundCareAuditActor;
  hospitalId: string;
}

interface WoundCareConsentDeps {
  consentPort?: WoundCareConsentPort;
  storagePort?: WoundCareStoragePort;
}

interface WoundCarePhotoDeps {
  photoPort?: WoundCarePhotoPort;
  consentPort?: WoundCareConsentPort;
  storagePort?: WoundCareStoragePort;
}

// ============================================================================
// Helpers
// ============================================================================

const generateId = (): string => crypto.randomUUID();

const buildConsentStoragePath = (
  hospitalId: string,
  patientRut: string,
  episodeKey: string,
  consentId: string,
  extension: string
): string =>
  `wound-care/consents/${hospitalId}/${patientRut}/${episodeKey}/${consentId}.${extension}`;

const buildPhotoStoragePath = (
  hospitalId: string,
  patientRut: string,
  episodeKey: string,
  date: string,
  photoId: string
): string => `wound-care/photos/${hospitalId}/${patientRut}/${episodeKey}/${date}/${photoId}.webp`;

const buildThumbnailStoragePath = (
  hospitalId: string,
  patientRut: string,
  episodeKey: string,
  date: string,
  photoId: string
): string =>
  `wound-care/thumbnails/${hospitalId}/${patientRut}/${episodeKey}/${date}/${photoId}_thumb.webp`;

const extractFileExtension = (file: File): string => {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
};

const todayDateString = (): string => new Date().toISOString().split('T')[0];

// ============================================================================
// Consent Use Cases
// ============================================================================

/**
 * Upload signed informed consent for clinical photography.
 *
 * Stores the consent document (PDF or image) in Firebase Storage
 * and creates a Firestore record linking it to the hospitalization episode.
 * One consent per episode is expected.
 *
 * @param input - Episode context, file, actor, and hospital identifier.
 * @param deps  - Injectable ports for testing; defaults to production implementations.
 * @returns Success with the persisted {@link WoundCareConsent}, or failure with issues.
 */
export const executeUploadWoundCareConsent = async (
  input: ConsentUploadInput,
  deps: WoundCareConsentDeps = {}
): Promise<ApplicationOutcome<WoundCareConsent | null>> => {
  const consentPort = deps.consentPort ?? defaultWoundCareConsentPort;
  const storagePort = deps.storagePort ?? defaultWoundCareStoragePort;

  try {
    const consentId = generateId();
    const extension = extractFileExtension(input.file);
    const storagePath = buildConsentStoragePath(
      input.hospitalId,
      input.episodeContext.patientRut,
      input.episodeContext.episodeKey,
      consentId,
      extension
    );

    const uploadResult = await storagePort.uploadConsent(input.file, storagePath, {
      contentType: input.file.type || 'application/pdf',
    });

    if (uploadResult.status !== 'success') {
      return createApplicationFailed(null, [
        { kind: 'unknown', message: 'Error al subir el consentimiento informado.' },
      ]);
    }

    const now = new Date().toISOString();
    const consent: WoundCareConsent = {
      id: consentId,
      patientRut: input.episodeContext.patientRut,
      patientName: input.episodeContext.patientName,
      episodeKey: input.episodeContext.episodeKey,
      status: 'signed',
      consentFileStoragePath: storagePath,
      consentFileDownloadUrl: uploadResult.data as string,
      consentFileMimeType: input.file.type || 'application/pdf',
      consentFileSize: input.file.size,
      signedAt: now,
      uploadedAt: now,
      uploadedBy: input.actor,
    };

    const saved = await consentPort.create(consent, input.hospitalId);
    return createApplicationSuccess(saved);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error ? error.message : 'Error inesperado al subir el consentimiento.',
      },
    ]);
  }
};

/**
 * Retrieve the current consent record for a hospitalization episode.
 *
 * Delegates to {@link WoundCareConsentPort.getAnyByEpisode} which
 * prefers a signed consent over revoked if both exist.
 *
 * @param episodeKey - Composite key identifying the hospitalization episode.
 * @param hospitalId - Optional hospital override; defaults to the active hospital.
 * @param deps       - Injectable port for testing.
 * @returns Success with the consent (or `null` if none exists), or failure with issues.
 */
export const executeGetWoundCareConsent = async (
  episodeKey: string,
  hospitalId?: string,
  deps: Pick<WoundCareConsentDeps, 'consentPort'> = {}
): Promise<ApplicationOutcome<WoundCareConsent | null>> => {
  const consentPort = deps.consentPort ?? defaultWoundCareConsentPort;

  try {
    const consent = await consentPort.getAnyByEpisode(episodeKey, hospitalId);
    return createApplicationSuccess(consent);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al obtener el consentimiento.',
      },
    ]);
  }
};

/**
 * Revoke a previously signed informed consent.
 *
 * Sets the consent status to `'revoked'` and records an audit trail
 * with the revoking actor, timestamp, and free-text reason.
 * Revocation does **not** delete existing photos taken under the consent.
 *
 * @param consentId  - Firestore document ID of the consent to revoke.
 * @param reason     - Free-text explanation for the revocation.
 * @param actor      - The user performing the revocation (audit trail).
 * @param hospitalId - Optional hospital override; defaults to the active hospital.
 * @param deps       - Injectable port for testing.
 * @returns Success (null payload) or failure with issues.
 */
export const executeRevokeWoundCareConsent = async (
  consentId: string,
  reason: string,
  actor: WoundCareAuditActor,
  hospitalId?: string,
  deps: Pick<WoundCareConsentDeps, 'consentPort'> = {}
): Promise<ApplicationOutcome<null>> => {
  const consentPort = deps.consentPort ?? defaultWoundCareConsentPort;

  try {
    await consentPort.revoke(
      consentId,
      {
        revokedAt: new Date().toISOString(),
        revokedBy: actor,
        revocationReason: reason,
      },
      hospitalId
    );
    return createApplicationSuccess(null);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al revocar el consentimiento.',
      },
    ]);
  }
};

// ============================================================================
// Photo Use Cases
// ============================================================================

/**
 * Upload a wound care photo with client-side compression and thumbnail generation.
 *
 * Pipeline: compress original to WebP + generate thumbnail (parallel),
 * upload both blobs to Firebase Storage (parallel), then persist
 * photo metadata (URLs, dimensions, audit fields) to Firestore.
 *
 * Consent is **not** a blocking requirement -- photos can be uploaded
 * before or without a signed consent.
 *
 * @param input - Photo file, episode context, optional description/body location, actor.
 * @param deps  - Injectable ports for testing; defaults to production implementations.
 * @returns Success with the persisted {@link WoundCarePhoto}, or failure with issues.
 */
export const executeUploadWoundCarePhoto = async (
  input: PhotoUploadInput,
  deps: WoundCarePhotoDeps = {}
): Promise<ApplicationOutcome<WoundCarePhoto | null>> => {
  const photoPort = deps.photoPort ?? defaultWoundCarePhotoPort;
  const storagePort = deps.storagePort ?? defaultWoundCareStoragePort;

  try {
    // --- Compress ---
    const [compressed, thumbnail] = await Promise.all([
      compressImage(input.file),
      generateThumbnail(input.file),
    ]);

    // --- Build paths ---
    const photoId = generateId();
    const dateStr = todayDateString();
    const photoPath = buildPhotoStoragePath(
      input.hospitalId,
      input.episodeContext.patientRut,
      input.episodeContext.episodeKey,
      dateStr,
      photoId
    );
    const thumbPath = buildThumbnailStoragePath(
      input.hospitalId,
      input.episodeContext.patientRut,
      input.episodeContext.episodeKey,
      dateStr,
      photoId
    );

    // --- Upload both to Storage ---
    const [photoUpload, thumbUpload] = await Promise.all([
      storagePort.uploadPhoto(compressed.blob, photoPath, {
        episodeKey: input.episodeContext.episodeKey,
        patientRut: input.episodeContext.patientRut,
      }),
      storagePort.uploadThumbnail(thumbnail.blob, thumbPath),
    ]);

    if (photoUpload.status !== 'success') {
      return createApplicationFailed(null, [
        { kind: 'unknown', message: 'Error al subir la fotografía.' },
      ]);
    }

    if (thumbUpload.status !== 'success') {
      return createApplicationFailed(null, [
        { kind: 'unknown', message: 'Error al subir la miniatura.' },
      ]);
    }

    // --- Persist metadata ---
    const now = new Date().toISOString();
    const photo: WoundCarePhoto = {
      id: photoId,
      patientRut: input.episodeContext.patientRut,
      patientName: input.episodeContext.patientName,
      episodeKey: input.episodeContext.episodeKey,
      consentId: undefined,
      storagePath: photoPath,
      thumbnailStoragePath: thumbPath,
      downloadUrl: photoUpload.data as string,
      thumbnailDownloadUrl: thumbUpload.data as string,
      mimeType: compressed.blob.type,
      originalFileSize: compressed.originalSize,
      compressedFileSize: compressed.compressedSize,
      width: compressed.width,
      height: compressed.height,
      description: input.description,
      bodyLocation: input.bodyLocation,
      takenAt: input.takenAt || now,
      uploadedAt: now,
      uploadedBy: input.actor,
      isDeleted: false,
    };

    const saved = await photoPort.create(photo, input.hospitalId);
    return createApplicationSuccess(saved);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error ? error.message : 'Error inesperado al subir la fotografía.',
      },
    ]);
  }
};

/**
 * List all non-deleted wound care photos for a hospitalization episode.
 *
 * Returns photos sorted by upload date descending (most recent first).
 * Soft-deleted photos are excluded by the repository layer.
 *
 * @param episodeKey - Composite key identifying the hospitalization episode.
 * @param hospitalId - Optional hospital override; defaults to the active hospital.
 * @param deps       - Injectable port for testing.
 * @returns Success with the photo array (empty if none), or failure with issues.
 */
export const executeListWoundCarePhotos = async (
  episodeKey: string,
  hospitalId?: string,
  deps: Pick<WoundCarePhotoDeps, 'photoPort'> = {}
): Promise<ApplicationOutcome<WoundCarePhoto[]>> => {
  const photoPort = deps.photoPort ?? defaultWoundCarePhotoPort;

  try {
    const photos = await photoPort.listByEpisode(episodeKey, hospitalId);
    return createApplicationSuccess(photos);
  } catch (error) {
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message: error instanceof Error ? error.message : 'Error al listar fotografías.',
        },
      ]
    );
  }
};

/**
 * Update the description of an existing wound care photo.
 *
 * @param photoId     - Firestore document ID of the photo.
 * @param description - New description text.
 * @param hospitalId  - Optional hospital override.
 * @param deps        - Injectable port for testing.
 * @returns Success (null payload) or failure with issues.
 */
export const executeUpdatePhotoDescription = async (
  photoId: string,
  description: string,
  hospitalId?: string,
  deps: Pick<WoundCarePhotoDeps, 'photoPort'> = {}
): Promise<ApplicationOutcome<null>> => {
  const photoPort = deps.photoPort ?? defaultWoundCarePhotoPort;

  try {
    await photoPort.updateDescription(photoId, description, hospitalId);
    return createApplicationSuccess(null);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al actualizar la descripción.',
      },
    ]);
  }
};

/**
 * Soft-delete a wound care photo with best-effort storage cleanup.
 *
 * Marks the Firestore metadata as deleted (audit trail with actor and
 * timestamp) first, then attempts to remove the photo and thumbnail
 * blobs from Firebase Storage. Storage failures are silently settled
 * so the metadata deletion is never rolled back.
 *
 * @param photoId               - Firestore document ID of the photo.
 * @param storagePath            - Full Firebase Storage path to the photo blob.
 * @param thumbnailStoragePath   - Full Firebase Storage path to the thumbnail blob.
 * @param actor                  - The user performing the deletion (audit trail).
 * @param hospitalId             - Optional hospital override; defaults to the active hospital.
 * @param deps                   - Injectable ports for testing.
 * @returns Success (null payload) or failure with issues.
 */
export const executeDeleteWoundCarePhoto = async (
  photoId: string,
  storagePath: string,
  thumbnailStoragePath: string,
  actor: WoundCareAuditActor,
  hospitalId?: string,
  deps: Pick<WoundCarePhotoDeps, 'photoPort' | 'storagePort'> = {}
): Promise<ApplicationOutcome<null>> => {
  const photoPort = deps.photoPort ?? defaultWoundCarePhotoPort;
  const storagePort = deps.storagePort ?? defaultWoundCareStoragePort;

  try {
    // Soft-delete metadata first (audit trail)
    await photoPort.softDelete(photoId, actor, hospitalId);

    // Best-effort storage cleanup — don't fail if storage delete fails
    await Promise.allSettled([
      storagePort.deleteFile(storagePath),
      storagePort.deleteFile(thumbnailStoragePath),
    ]);

    return createApplicationSuccess(null);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al eliminar la fotografía.',
      },
    ]);
  }
};
