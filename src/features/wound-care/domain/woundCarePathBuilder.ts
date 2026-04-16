/**
 * Firebase Storage path builders for wound care assets.
 */

export const buildConsentStoragePath = (
  hospitalId: string,
  patientRut: string,
  episodeKey: string,
  consentId: string,
  extension: string
): string =>
  `wound-care/consents/${hospitalId}/${patientRut}/${episodeKey}/${consentId}.${extension}`;

export const buildPhotoStoragePath = (
  hospitalId: string,
  patientRut: string,
  episodeKey: string,
  date: string,
  photoId: string
): string => `wound-care/photos/${hospitalId}/${patientRut}/${episodeKey}/${date}/${photoId}.webp`;

export const buildThumbnailStoragePath = (
  hospitalId: string,
  patientRut: string,
  episodeKey: string,
  date: string,
  photoId: string
): string =>
  `wound-care/thumbnails/${hospitalId}/${patientRut}/${episodeKey}/${date}/${photoId}_thumb.webp`;
