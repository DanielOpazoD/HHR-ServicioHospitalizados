/**
 * useAuditStats Hook
 * Calculates statistics and metrics from audit logs.
 */

import { useMemo } from 'react';
import { AuditLogEntry, AuditStats } from '@/types/audit';
import {
  buildAuditStats,
  formatDuration,
  getActionCriticality,
} from '@/services/admin/auditMetrics';

export const useAuditStats = (logs: AuditLogEntry[]): AuditStats => {
  return useMemo(() => buildAuditStats(logs), [logs]);
};
export { formatDuration, getActionCriticality } from '@/services/admin/auditMetrics';
