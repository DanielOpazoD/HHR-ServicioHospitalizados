import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UnifiedBedRow } from '@/features/census/types/censusTableTypes';
import {
  buildActiveClinicalDocumentEpisodeKeys,
  buildBedEpisodeBindings,
  buildClinicalDocumentPresenceByBed,
} from '@/features/census/controllers/clinicalDocumentPresenceController';
import { resolveApplicationOutcomeMessage } from '@/shared/contracts/applicationOutcomeMessage';
import { clinicalDocumentPresenceLogger } from '@/features/census/hooks/censusHookLoggers';

interface UseClinicalDocumentPresenceByBedParams {
  unifiedRows: UnifiedBedRow[];
  currentDateString: string;
  enabled: boolean;
}

let clinicalDocumentUseCasesPromise: Promise<
  typeof import('@/application/clinical-documents/clinicalDocumentUseCases')
> | null = null;

const loadClinicalDocumentUseCases = async () => {
  if (!clinicalDocumentUseCasesPromise) {
    clinicalDocumentUseCasesPromise =
      import('@/application/clinical-documents/clinicalDocumentUseCases');
  }

  return clinicalDocumentUseCasesPromise;
};

export const useClinicalDocumentPresenceByBed = ({
  unifiedRows,
  currentDateString,
  enabled,
}: UseClinicalDocumentPresenceByBedParams): Record<string, boolean> => {
  const bindings = useMemo(() => buildBedEpisodeBindings(unifiedRows), [unifiedRows]);
  const episodeKeys = useMemo(
    () => Array.from(new Set(bindings.map(binding => binding.episodeKey))).sort(),
    [bindings]
  );

  const query = useQuery({
    queryKey: ['clinicalDocuments', 'presenceByBed', currentDateString, ...episodeKeys],
    enabled: enabled && episodeKeys.length > 0,
    queryFn: async () => {
      try {
        const { executeListClinicalDocumentsByEpisodeKeys } = await loadClinicalDocumentUseCases();
        const outcome = await executeListClinicalDocumentsByEpisodeKeys(episodeKeys);
        if (outcome.status === 'failed') {
          clinicalDocumentPresenceLogger.warn(
            'Failed to resolve clinical document presence',
            resolveApplicationOutcomeMessage(outcome, 'No se pudo resolver presencia documental.')
          );
          return [];
        }
        return outcome.data;
      } catch (error) {
        clinicalDocumentPresenceLogger.warn(
          'Failed to resolve clinical document presence',
          error instanceof Error ? error.message : 'No se pudo resolver presencia documental.'
        );
        return [];
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 45 * 1000,
    retry: false,
  });

  return useMemo(() => {
    if (!enabled || bindings.length === 0) {
      return {};
    }

    const activeEpisodeKeys = buildActiveClinicalDocumentEpisodeKeys(query.data);

    return buildClinicalDocumentPresenceByBed(bindings, activeEpisodeKeys);
  }, [bindings, enabled, query.data]);
};
