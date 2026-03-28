import { createScopedLogger } from '@/services/utils/loggerScope';

export const auditWorkerLogger = createScopedLogger('AuditWorker');
export const auditConsolidationLogger = createScopedLogger('AuditConsolidation');
export const auditCoreLogger = createScopedLogger('AuditCore');
export const dataMaintenanceLogger = createScopedLogger('DataMaintenanceService');
export const healthServiceLogger = createScopedLogger('HealthService');
export const roleServiceLogger = createScopedLogger('RoleService');
export const auditUtilsLogger = createScopedLogger('AuditUtils');
