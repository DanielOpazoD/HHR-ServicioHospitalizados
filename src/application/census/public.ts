// Public census API for consumers outside the feature boundary.
// Heavy UI exports stay behind a loader so static imports of this module do not
// eagerly pull the census component tree into the authenticated shell chunk.

export * from '@/features/census/public';
export { searchMasterPatients } from './searchMasterPatientsUseCase';

export const loadCensusPublicComponents = () =>
  import(/* webpackPrefetch: true */ '@/features/census/public-components');
