import type { MasterPatient } from '@/types/domain/patientMaster';
import type { PatientHistoryResult } from '@/services/patient/patientHistoryService';
import type { PatientEpisodeTimelineState } from '@/features/census/components/global-search/globalSearchContracts';
import {
  groupEpisodesAsBlocks,
  reconcileGroupedEpisodesWithHistory,
} from '@/features/census/components/global-search/episodeGroupingController';

/**
 * Builds the search timeline state from the two sources this feature uses:
 * Firestore `patientMaster` for the indexed episode list and daily-record
 * history for the concrete closing movement.
 */
export const buildPatientEpisodeTimelineState = (
  patient: MasterPatient,
  history: PatientHistoryResult | null
): PatientEpisodeTimelineState => {
  const groupedEpisodes = reconcileGroupedEpisodesWithHistory(
    groupEpisodesAsBlocks(patient.hospitalizations ?? []),
    history
  );

  return {
    groupedEpisodes,
    episodeCount: groupedEpisodes.length,
    hasEpisodes: groupedEpisodes.length > 0,
  };
};
