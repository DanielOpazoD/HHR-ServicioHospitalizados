/**
 * Hook: Subscribe to wound care photos for an episode.
 *
 * Uses the standard subscription-in-effect pattern. The setIsLoading(true)
 * call triggers a React 19 lint warning (react-hooks/set-state-in-effect)
 * but is intentional — it resets loading state when the episodeKey changes
 * before the new subscription emits.
 */

import { useState, useEffect, useCallback } from 'react';
import type { WoundCarePhoto } from '@/types/domain/woundCare';
import {
  defaultWoundCarePhotoPort,
  type WoundCarePhotoPort,
} from '@/application/ports/woundCarePort';

interface UseWoundCarePhotosOptions {
  episodeKey: string | undefined;
  hospitalId?: string;
  photoPort?: WoundCarePhotoPort;
}

interface UseWoundCarePhotosReturn {
  photos: WoundCarePhoto[];
  isLoading: boolean;
}

/**
 * Subscribe to wound care photos for a hospitalization episode.
 *
 * Sets up a Firestore real-time listener via the photo port and
 * exposes the current list of non-deleted photos along with a
 * loading flag. Automatically unsubscribes on unmount or when
 * `episodeKey` changes.
 *
 * @param options.episodeKey - Episode to subscribe to; no-op if undefined.
 * @param options.hospitalId - Optional hospital override.
 * @param options.photoPort  - Injectable port for testing.
 * @returns photos (array) and isLoading state.
 */
export const useWoundCarePhotos = ({
  episodeKey,
  hospitalId,
  photoPort = defaultWoundCarePhotoPort,
}: UseWoundCarePhotosOptions): UseWoundCarePhotosReturn => {
  const [photos, setPhotos] = useState<WoundCarePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(episodeKey));

  const handlePhotosUpdate = useCallback((updatedPhotos: WoundCarePhoto[]) => {
    setPhotos(updatedPhotos);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!episodeKey) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading on subscription change
    setIsLoading(true);
    return photoPort.subscribeByEpisode(episodeKey, handlePhotosUpdate, hospitalId);
  }, [episodeKey, hospitalId, photoPort, handlePhotosUpdate]);

  return {
    photos: episodeKey ? photos : [],
    isLoading: episodeKey ? isLoading : false,
  };
};
