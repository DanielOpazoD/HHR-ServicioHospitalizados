import type { AuditStats } from '@/types/audit';

export const buildDefaultAuditStats = (): AuditStats => ({
  todayCount: 0,
  thisWeekCount: 0,
  criticalCount: 0,
  activeUsersToday: [],
  activeUserCount: 0,
  avgSessionMinutes: 0,
  totalSessionsToday: 0,
  actionBreakdown: {},
  hourlyActivity: new Array(24).fill(0),
  topUsers: [],
  criticalActions: [],
});

export const resolveAuditLogsFallback = <T>(logs: T[], fallback: T[] = []): T[] =>
  Array.isArray(logs) ? logs : fallback;

export const shouldResetAuditPagination = (params: {
  searchTerm: string;
  filterAction: string;
  activeSection: string;
  startDate: string;
  endDate: string;
  groupedView: boolean;
}): boolean =>
  Boolean(
    params.searchTerm ||
    params.filterAction !== 'ALL' ||
    params.activeSection !== 'ALL' ||
    params.startDate ||
    params.endDate ||
    params.groupedView
  );
