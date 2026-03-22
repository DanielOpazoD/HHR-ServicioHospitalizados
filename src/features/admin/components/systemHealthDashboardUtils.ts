import type { SystemHealthSummary, UserHealthStatus } from '@/services/admin/healthService';

export interface SystemHealthMetricCard {
  title: string;
  value: number | string;
  accentClassName: string;
  detail?: string;
}

const normalizeSearchTerm = (value: string) => value.trim().toLowerCase();

export const filterSystemHealthStats = (
  stats: UserHealthStatus[],
  searchTerm: string
): UserHealthStatus[] => {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedSearchTerm) {
    return stats;
  }

  return stats.filter(
    user =>
      user.email.toLowerCase().includes(normalizedSearchTerm) ||
      user.displayName.toLowerCase().includes(normalizedSearchTerm)
  );
};

export const formatLatestOperationalSummary = (latestOperationalIssueAt?: string) => {
  if (!latestOperationalIssueAt) {
    return 'Sin observaciones recientes';
  }

  return `Última observación ${new Date(latestOperationalIssueAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const buildSystemHealthMetricCards = (
  summary: SystemHealthSummary
): SystemHealthMetricCard[] => [
  {
    title: 'Usuarios',
    value: summary.totalUsers,
    accentClassName: 'text-slate-900',
  },
  {
    title: 'Offline',
    value: summary.offlineUsers,
    accentClassName: 'text-red-600',
  },
  {
    title: 'Persistencia degradada',
    value: summary.degradedLocalPersistenceUsers,
    accentClassName: 'text-amber-600',
  },
  {
    title: 'Sync fallido',
    value: summary.totalFailedSyncTasks + summary.totalConflictSyncTasks,
    accentClassName: 'text-red-600',
    detail: `${summary.usersWithSyncFailures} usuarios`,
  },
  {
    title: 'Errores locales',
    value: summary.totalLocalErrorCount,
    accentClassName: 'text-slate-900',
  },
  {
    title: 'Repo warnings',
    value: summary.totalRepositoryWarnings,
    accentClassName: 'text-slate-900',
    detail: `${summary.usersWithRepositoryWarnings} usuarios, max ${summary.maxSlowRepositoryOperationMs} ms`,
  },
  {
    title: 'Operaciones con observaciones (12h)',
    value: summary.totalOperationalObservedCount,
    accentClassName: 'text-amber-600',
    detail: `Bloqueadas: ${summary.totalOperationalBlockedCount} · Recuperables: ${summary.totalOperationalRecoverableCount} · No autorizadas: ${summary.totalOperationalUnauthorizedCount}`,
  },
  {
    title: 'Observaciones por tipo',
    value: `Sync ${summary.totalOperationalSyncObservedCount} · Local ${summary.totalOperationalIndexedDbObservedCount}`,
    accentClassName: 'text-slate-900',
    detail: `Docs ${summary.totalOperationalClinicalDocumentObservedCount} · Día ${summary.totalOperationalCreateDayObservedCount} · Handoff ${summary.totalOperationalHandoffObservedCount}`,
  },
  {
    title: 'Operación dominante',
    value: summary.topOperationalOperation || 'Sin patrón dominante',
    accentClassName: 'text-slate-900',
    detail: summary.topOperationalCategory
      ? `Tipo principal: ${summary.topOperationalCategory}${summary.topOperationalRuntimeState ? ` · Estado dominante: ${summary.topOperationalRuntimeState}` : ''}`
      : 'Sin categoría dominante reciente',
  },
  {
    title: 'Recencia operativa',
    value: `${summary.usersWithRecentOperationalIssues} usuarios recientes`,
    accentClassName: 'text-slate-900',
    detail: `12h ${summary.totalOperationalObservedCount} · 1h ${summary.totalOperationalLastHourObservedCount} · ${formatLatestOperationalSummary(summary.latestOperationalIssueAt)}`,
  },
];
