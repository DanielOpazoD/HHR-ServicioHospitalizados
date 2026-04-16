/**
 * Photo Gallery Controller
 *
 * Pure logic for sorting, grouping, and filtering wound care photos.
 */

import type { WoundCarePhoto, WoundCarePhotoSession } from '@/types/domain/woundCare';

/**
 * Group photos into sessions by date (most recent first).
 */
export const groupPhotosByDate = (photos: WoundCarePhoto[]): WoundCarePhotoSession[] => {
  const groups = new Map<string, WoundCarePhoto[]>();

  for (const photo of photos) {
    const date = (photo.takenAt || photo.uploadedAt).split('T')[0];
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
 * Format a date string for display in the gallery header.
 */
export const formatSessionDate = (dateStr: string): string => {
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

/**
 * Format an ISO timestamp to a short time string (HH:mm).
 */
export const formatPhotoTime = (isoTimestamp: string): string => {
  try {
    const date = new Date(isoTimestamp);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Get a summary string for a photo session.
 */
export const formatSessionSummary = (session: WoundCarePhotoSession): string => {
  const count = session.photos.length;
  return count === 1 ? '1 foto' : `${count} fotos`;
};
