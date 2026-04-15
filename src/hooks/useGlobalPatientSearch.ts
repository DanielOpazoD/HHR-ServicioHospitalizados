/**
 * useGlobalPatientSearch — Re-export from feature module.
 *
 * The canonical implementation lives in the census feature application facade:
 * @see {@link @/application/census/public}
 *
 * This file exists for backward compatibility. New consumers should
 * import from '@/application/census/public' directly.
 */

export { useGlobalPatientSearch } from '@/application/census/public';
export type {
  ClinicalDocSummary,
  SelectedPatientDetail,
  EpisodeDocuments,
  UseGlobalPatientSearchReturn,
} from '@/application/census/public';
