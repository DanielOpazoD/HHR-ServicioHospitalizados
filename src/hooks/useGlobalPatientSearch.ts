/**
 * useGlobalPatientSearch — Re-export from feature module.
 *
 * The canonical implementation lives in the census feature module:
 * @see {@link @/features/census/components/global-search/useGlobalPatientSearch}
 *
 * This file exists for backward compatibility. New consumers should
 * import from '@/features/census/components/global-search' directly.
 */

export { useGlobalPatientSearch } from '@/features/census/components/global-search/useGlobalPatientSearch';
export type {
  ClinicalDocSummary,
  SelectedPatientDetail,
  EpisodeDocuments,
  UseGlobalPatientSearchReturn,
} from '@/features/census/components/global-search/globalSearchContracts';
