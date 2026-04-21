export { CudyrView } from '@/features/cudyr/components/CudyrView';
export { getCategorization } from '@/services/cudyr/CudyrScoreUtils';
export {
  CUDYR_NIGHT_REFERENCE_TIME_LABEL,
  isCudyrPatientEligible,
  resolveCudyrNightApplicationDate,
} from '@/domain/cudyr/cudyrEligibility';

export const loadCudyrPublicComponents = () =>
  import(/* webpackPrefetch: true */ '@/features/cudyr/components/CudyrView');
