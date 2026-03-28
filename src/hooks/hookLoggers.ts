import { createScopedLogger } from '@/services/utils/loggerScope';

export const auditDataLogger = createScopedLogger('useAuditData');
export const authStateLogger = createScopedLogger('useAuthState');
export const dailyRecordSyncLogger = createScopedLogger('DailyRecordSync');
export const medicalHandoffHandlersLogger = createScopedLogger('useMedicalHandoffHandlers');
export const systemHealthReporterLogger = createScopedLogger('SystemHealthReporter');
export const versionCheckLogger = createScopedLogger('VersionCheck');
