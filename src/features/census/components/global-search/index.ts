/**
 * Global Patient Search — Public API
 *
 * This barrel export defines the public surface of the global search module.
 * External consumers should import from this index, not from internal files.
 */

// Components
export { GlobalPatientSearchModal } from '@/features/census/components/global-search/GlobalPatientSearchModal';

// Hook
export { useGlobalPatientSearch } from '@/features/census/components/global-search/useGlobalPatientSearch';

// Types
export type {
  ClinicalDocSummary,
  EpisodeDocuments,
  SelectedPatientDetail,
  GroupedEpisode,
  UseGlobalPatientSearchReturn,
} from '@/features/census/components/global-search/globalSearchContracts';

// Pure logic (for testing)
export { groupEpisodesAsBlocks } from '@/features/census/components/global-search/episodeGroupingController';
