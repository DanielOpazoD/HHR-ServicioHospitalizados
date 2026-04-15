/**
 * useGlobalPatientSearch — Re-export from feature module.
 *
 * The canonical implementation lives in the census feature module:
 * @see {@link @/features/census}
 *
 * This file exists for backward compatibility. New consumers should
 * import from '@/features/census' directly.
 */

export { useGlobalPatientSearch } from '@/features/census';
export type {
  ClinicalDocSummary,
  SelectedPatientDetail,
  EpisodeDocuments,
  UseGlobalPatientSearchReturn,
} from '@/features/census';
