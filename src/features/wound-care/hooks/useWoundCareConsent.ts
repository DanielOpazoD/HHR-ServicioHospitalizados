/**
 * Hook: Subscribe to wound care consent for an episode.
 *
 * Uses the standard subscription-in-effect pattern. The setIsLoading(true)
 * call triggers a React 19 lint warning (react-hooks/set-state-in-effect)
 * but is intentional — it resets loading state when the episodeKey changes
 * before the new subscription emits.
 */

import { useState, useEffect, useCallback } from 'react';
import type { WoundCareConsent } from '@/types/domain/woundCare';
import {
  defaultWoundCareConsentPort,
  type WoundCareConsentPort,
} from '@/application/ports/woundCarePort';

interface UseWoundCareConsentOptions {
  episodeKey: string | undefined;
  hospitalId?: string;
  consentPort?: WoundCareConsentPort;
}

interface UseWoundCareConsentReturn {
  consent: WoundCareConsent | null;
  isLoading: boolean;
}

/**
 * Subscribe to the wound care consent for a hospitalization episode.
 *
 * Sets up a Firestore real-time listener via the consent port and
 * exposes the current consent (or `null`) along with a loading flag.
 * Automatically unsubscribes on unmount or when `episodeKey` changes.
 *
 * @param options.episodeKey  - Episode to subscribe to; no-op if undefined.
 * @param options.hospitalId  - Optional hospital override.
 * @param options.consentPort - Injectable port for testing.
 * @returns consent (nullable) and isLoading state.
 */
export const useWoundCareConsent = ({
  episodeKey,
  hospitalId,
  consentPort = defaultWoundCareConsentPort,
}: UseWoundCareConsentOptions): UseWoundCareConsentReturn => {
  const [consent, setConsent] = useState<WoundCareConsent | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(episodeKey));

  const handleConsentUpdate = useCallback((updatedConsent: WoundCareConsent | null) => {
    setConsent(updatedConsent);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!episodeKey) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading on subscription change
    setIsLoading(true);
    return consentPort.subscribeByEpisode(episodeKey, handleConsentUpdate, hospitalId);
  }, [episodeKey, hospitalId, consentPort, handleConsentUpdate]);

  return {
    consent: episodeKey ? consent : null,
    isLoading: episodeKey ? isLoading : false,
  };
};
