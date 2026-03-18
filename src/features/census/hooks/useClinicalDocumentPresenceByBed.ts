import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import {
  buildActiveClinicalDocumentEpisodeKeys,
  buildBedEpisodeBindings,
  buildClinicalDocumentPresenceByBed,
} from '@/features/census/controllers/clinicalDocumentPresenceController';
import { executeListClinicalDocumentsByEpisodeKeys } from '@/application/clinical-documents/clinicalDocumentUseCases';
import { logger } from '@/services/utils/loggerService';

const clinicalDocumentPresenceLogger = logger.child('useClinicalDocumentPresenceByBed');

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
    queryFn: async () => {
      const outcome = await executeListClinicalDocumentsByEpisodeKeys(episodeKeys);
      if (outcome.status === 'failed') {
        clinicalDocumentPresenceLogger.warn(
          'Failed to resolve clinical document presence',
          outcome.userSafeMessage ||
            outcome.issues[0]?.userSafeMessage ||
            outcome.issues[0]?.message ||
            'No se pudo resolver presencia documental.'
        );
        return [];
      }
      return outcome.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 45 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (query.isError && enabled) {
      clinicalDocumentPresenceLogger.warn(
        'Clinical document presence query failed unexpectedly',
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
