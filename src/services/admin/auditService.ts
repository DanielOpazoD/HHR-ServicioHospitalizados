export {
  getAuditLogs,
  getAuditLogsForDate,
  logAuditEvent,
  logSystemError,
  logThrottledViewEvent,
  logUserLogin,
  logUserLogout,
  shouldExcludeFromViewAudit,
} from './auditCore';

export {
  logConflictAutoMerged,
  logCudyrModified,
  logDailyRecordCreated,
  logDailyRecordDeleted,
  logHandoffNovedadesModified,
  logMedicalHandoffModified,
  logNurseHandoffModified,
  logPatientAdmission,
  logPatientCleared,
  logPatientDischarge,
  logPatientTransfer,
  logPatientView,
} from './auditDomainLoggers';
