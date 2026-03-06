import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import {
  buildActiveClinicalDocumentEpisodeKeys,
  buildBedEpisodeBindings,
  buildClinicalDocumentPresenceByBed,
} from '@/features/census/controllers/clinicalDocumentPresenceController';
import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';

interface UseClinicalDocumentPresenceByBedParams {
  occupiedRows: OccupiedBedRow[];
  currentDateString: string;
  enabled: boolean;
}

export const useClinicalDocumentPresenceByBed = ({
  occupiedRows,
  currentDateString,
  enabled,
}: UseClinicalDocumentPresenceByBedParams): Record<string, boolean> => {
  const bindings = useMemo(() => buildBedEpisodeBindings(occupiedRows), [occupiedRows]);
  const episodeKeys = useMemo(
    () => Array.from(new Set(bindings.map(binding => binding.episodeKey))).sort(),
    [bindings]
  );

  const query = useQuery({
    queryKey: ['clinicalDocuments', 'presenceByBed', currentDateString, ...episodeKeys],
    enabled: enabled && episodeKeys.length > 0,
    queryFn: async () => ClinicalDocumentRepository.listByEpisodeKeys(episodeKeys),
    staleTime: 30 * 1000,
    refetchInterval: 45 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (query.isError && enabled) {
      console.warn(
        '[useClinicalDocumentPresenceByBed] Failed to resolve clinical document presence:',
        query.error
      );
    }
  }, [enabled, query.error, query.isError]);

  return useMemo(() => {
    if (!enabled || bindings.length === 0 || query.isError) {
      return {};
    }

    const activeEpisodeKeys = buildActiveClinicalDocumentEpisodeKeys(query.data);

    return buildClinicalDocumentPresenceByBed(bindings, activeEpisodeKeys);
  }, [bindings, enabled, query.data, query.isError]);
};
