/**
 * Hook: Build wound care timeline from photos and consent.
 */

import { useMemo } from 'react';
import type { WoundCareConsent, WoundCarePhoto, WoundCareTimeline } from '@/types/domain/woundCare';
import { buildWoundCareTimeline } from '@/application/wound-care/woundCareTimelineBuilder';
import type { EpisodeContext } from '@/application/wound-care/woundCareUseCases';

interface UseWoundCareTimelineOptions {
  photos: WoundCarePhoto[];
  consent: WoundCareConsent | null;
  episodeContext: EpisodeContext;
}

export const useWoundCareTimeline = ({
  photos,
  consent,
  episodeContext,
}: UseWoundCareTimelineOptions): WoundCareTimeline =>
  useMemo(
    () => buildWoundCareTimeline(photos, consent, episodeContext),
    [photos, consent, episodeContext]
  );
