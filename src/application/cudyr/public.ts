export * from '@/features/cudyr/public';

export const loadCudyrPublicComponents = () =>
  import(/* webpackPrefetch: true */ '@/features/cudyr/public');
