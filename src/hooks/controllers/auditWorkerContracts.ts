import type { AuditLogEntry, GroupedAuditLogEntry, AuditStats } from '@/types/auditLogTypes';

export interface AuditWorkerResults {
  filteredLogs: AuditLogEntry[];
  displayLogs: (AuditLogEntry | GroupedAuditLogEntry)[];
  stats: AuditStats | null;
}
