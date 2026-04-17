/**
 * Wound Care Timeline Builder
 *
 * Pure function that groups photos into date-based sessions
 * for chronological display.
 */

import type {
  WoundCareConsent,
  WoundCarePhoto,
  WoundCarePhotoSession,
  WoundCareTimeline,
} from '@/types/domain/woundCare';

interface EpisodeContext {
  episodeKey: string;
  patientRut: string;
  patientName: string;
}

/**
 * Extract the date portion (YYYY-MM-DD) from an ISO timestamp.
 */
const extractDate = (isoTimestamp: string): string => isoTimestamp.split('T')[0];

/**
 * Group photos by date and sort sessions chronologically (most recent first).
 */
const groupPhotosByDate = (photos: WoundCarePhoto[]): WoundCarePhotoSession[] => {
  const groups = new Map<string, WoundCarePhoto[]>();

  for (const photo of photos) {
    const date = extractDate(photo.takenAt || photo.uploadedAt);
    const existing = groups.get(date) ?? [];
    existing.push(photo);
    groups.set(date, existing);
  }

  return Array.from(groups.entries())
    .map(([date, sessionPhotos]) => ({
      date,
      photos: sessionPhotos.sort((a, b) =>
        (a.takenAt || a.uploadedAt).localeCompare(b.takenAt || b.uploadedAt)
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Build a complete timeline for a patient's hospitalization episode.
 */
export const buildWoundCareTimeline = (
  photos: WoundCarePhoto[],
  consent: WoundCareConsent | null,
  episodeContext: EpisodeContext
): WoundCareTimeline => ({
  episodeKey: episodeContext.episodeKey,
  patientRut: episodeContext.patientRut,
  patientName: episodeContext.patientName,
  consent,
  sessions: groupPhotosByDate(photos),
  totalPhotos: photos.length,
});
