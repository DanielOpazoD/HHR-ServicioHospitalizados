import { describe, it, expect } from 'vitest';
import { buildWoundCareTimeline } from '@/application/wound-care/woundCareTimelineBuilder';
import type {
  WoundCareConsent,
  WoundCarePhoto,
  WoundCareAuditActor,
} from '@/types/domain/woundCare';

const mockActor: WoundCareAuditActor = {
  uid: 'u1',
  email: 'e@e.cl',
  displayName: 'Test',
  role: 'editor',
};

const makePhoto = (id: string, uploadedAt: string): WoundCarePhoto => ({
  id,
  patientRut: '1-1',
  patientName: 'P',
  episodeKey: 'ep',
  consentId: 'c1',
  storagePath: 'p',
  thumbnailStoragePath: 't',
  downloadUrl: 'u',
  thumbnailDownloadUrl: 'u',
  mimeType: 'image/webp',
  originalFileSize: 5000,
  compressedFileSize: 1000,
  width: 800,
  height: 600,
  takenAt: uploadedAt,
  uploadedAt,
  uploadedBy: mockActor,
  isDeleted: false,
});

const episodeContext = { episodeKey: 'ep', patientRut: '1-1', patientName: 'P' };

describe('buildWoundCareTimeline', () => {
  it('returns empty timeline with no photos', () => {
    const timeline = buildWoundCareTimeline([], null, episodeContext);

    expect(timeline.totalPhotos).toBe(0);
    expect(timeline.sessions).toEqual([]);
    expect(timeline.consent).toBeNull();
    expect(timeline.episodeKey).toBe('ep');
  });

  it('groups photos by date with most recent first', () => {
    const photos = [
      makePhoto('p1', '2026-01-15T10:00:00Z'),
      makePhoto('p2', '2026-01-15T14:00:00Z'),
      makePhoto('p3', '2026-01-16T09:00:00Z'),
    ];

    const timeline = buildWoundCareTimeline(photos, null, episodeContext);

    expect(timeline.totalPhotos).toBe(3);
    expect(timeline.sessions).toHaveLength(2);
    expect(timeline.sessions[0].date).toBe('2026-01-16');
    expect(timeline.sessions[0].photos).toHaveLength(1);
    expect(timeline.sessions[1].date).toBe('2026-01-15');
    expect(timeline.sessions[1].photos).toHaveLength(2);
  });

  it('includes consent when provided', () => {
    const consent: WoundCareConsent = {
      id: 'c1',
      patientRut: '1-1',
      patientName: 'P',
      episodeKey: 'ep',
      status: 'signed',
      consentFileStoragePath: 'p',
      consentFileDownloadUrl: 'u',
      consentFileMimeType: 'application/pdf',
      consentFileSize: 100,
      signedAt: '2026-01-01T00:00:00Z',
      uploadedAt: '2026-01-01T00:00:00Z',
      uploadedBy: mockActor,
    };

    const timeline = buildWoundCareTimeline([], consent, episodeContext);
    expect(timeline.consent?.id).toBe('c1');
  });

  it('handles photos with takenAt different from uploadedAt', () => {
    const photo: WoundCarePhoto = {
      ...makePhoto('p1', '2026-02-10T12:00:00Z'),
      takenAt: '2026-02-08T09:30:00Z', // taken two days before upload
    };

    const timeline = buildWoundCareTimeline([photo], null, episodeContext);

    expect(timeline.sessions).toHaveLength(1);
    // Should group by takenAt, not uploadedAt
    expect(timeline.sessions[0].date).toBe('2026-02-08');
  });

  it('handles single photo correctly', () => {
    const timeline = buildWoundCareTimeline(
      [makePhoto('only', '2026-03-01T10:00:00Z')],
      null,
      episodeContext
    );

    expect(timeline.sessions).toHaveLength(1);
    expect(timeline.sessions[0].photos).toHaveLength(1);
    expect(timeline.sessions[0].photos[0].id).toBe('only');
  });

  it('sets correct totalPhotos count', () => {
    const photos = [
      makePhoto('a', '2026-01-10T10:00:00Z'),
      makePhoto('b', '2026-01-11T10:00:00Z'),
      makePhoto('c', '2026-01-12T10:00:00Z'),
      makePhoto('d', '2026-01-13T10:00:00Z'),
      makePhoto('e', '2026-01-14T10:00:00Z'),
    ];

    const timeline = buildWoundCareTimeline(photos, null, episodeContext);
    expect(timeline.totalPhotos).toBe(5);
  });

  it('sorts photos within a session chronologically', () => {
    const photos = [
      makePhoto('p2', '2026-01-15T14:00:00Z'),
      makePhoto('p1', '2026-01-15T10:00:00Z'),
      makePhoto('p3', '2026-01-15T18:00:00Z'),
    ];

    const timeline = buildWoundCareTimeline(photos, null, episodeContext);
    const session = timeline.sessions[0];
    expect(session.photos[0].id).toBe('p1');
    expect(session.photos[1].id).toBe('p2');
    expect(session.photos[2].id).toBe('p3');
  });
});
