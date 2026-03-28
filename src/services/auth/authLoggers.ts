import { createScopedLogger } from '@/services/utils/loggerScope';

export const authClaimSyncLogger = createScopedLogger('AuthClaimSync');
export const authRoleCacheLogger = createScopedLogger('AuthRoleCache');
export const firebaseStartupWarningLogger = createScopedLogger('FirebaseStartupWarningRenderer');
