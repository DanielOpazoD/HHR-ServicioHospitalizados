/**
 * Re-exports domain types used by the wound-care feature.
 */

export type {
  WoundCareAuditActor,
  WoundCareConsent,
  WoundCarePhoto,
  WoundCarePhotoSession,
  WoundCareTimeline,
  ConsentStatus,
} from '@/types/domain/woundCare';

export type { EpisodeContext } from '@/application/wound-care/woundCareUseCases';
