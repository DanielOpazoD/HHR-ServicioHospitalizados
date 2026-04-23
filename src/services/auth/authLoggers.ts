import { createScopedLoggerMap } from '@/services/utils/loggerScope';

export const {
  authClaimSyncLogger,
  authRoleCacheLogger,
  sharedCensusAuthLogger,
  firebaseStartupWarningLogger,
} = createScopedLoggerMap({
  authClaimSyncLogger: 'AuthClaimSync',
  authRoleCacheLogger: 'AuthRoleCache',
  sharedCensusAuthLogger: 'SharedCensusAuth',
  firebaseStartupWarningLogger: 'FirebaseStartupWarningRenderer',
});
