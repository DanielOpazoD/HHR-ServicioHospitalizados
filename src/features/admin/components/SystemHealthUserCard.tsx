import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Bug, Clock, Cloud, ShieldCheck, User, Wifi, WifiOff } from 'lucide-react';
import type { UserHealthStatus } from '@/services/admin/healthService';
import { evaluateSystemHealthState } from './systemHealthStatusPolicy';

const HealthMetric = ({
  title,
  value,
  icon,
  isAlert,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  isAlert: boolean;
}) => (
  <div className="space-y-1">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
    <div className="flex items-center gap-2">
      {icon}
      <span className={clsx('text-lg font-black', isAlert ? 'text-red-600' : 'text-slate-700')}>
        {value}
      </span>
    </div>
  </div>
);

export const SystemHealthUserCard = ({
  user,
  selected = false,
  compact = false,
  onSelect,
}: {
  user: UserHealthStatus;
  selected?: boolean;
  compact?: boolean;
  onSelect?: (user: UserHealthStatus) => void;
}) => {
  const health = evaluateSystemHealthState(user);
  const isOffline = !user.isOnline;
  const syncIssueCount = user.failedSyncTasks + (user.conflictSyncTasks || 0);
  const retryingSyncTasks = user.retryingSyncTasks || 0;
  const oldestPendingAgeMinutes = Math.floor((user.oldestPendingAgeMs || 0) / 60000);

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(user)}
      onKeyDown={event => {
        if (!onSelect) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(user);
        }
      }}
      className={clsx(
        'group relative overflow-hidden card bg-gradient-to-br p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        onSelect ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-medical-500/30' : '',
        selected ? 'ring-2 ring-medical-500 shadow-lg' : '',
        health.cardClassName
      )}
    >
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-1.5 text-[10px] font-black uppercase tracking-widest',
          health.badgeClassName
        )}
      >
        <span>{health.badgeLabel}</span>
        {user.isOutdated ? <span className="rounded bg-white/20 px-2">OBSOLETO</span> : null}
      </div>

      <div className={clsx('space-y-4', compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm">
              <User size={20} className="text-slate-400" />
            </div>
            <div>
              <h3 className="leading-none font-bold text-slate-900">{user.displayName}</h3>
              <p className="mt-1 max-w-[150px] truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-bold',
              isOffline
                ? 'border-red-100 bg-red-50 text-red-600'
                : 'border-emerald-100 bg-emerald-50 text-emerald-600'
            )}
          >
            {isOffline ? <WifiOff size={12} /> : <Wifi size={12} />}
            {isOffline ? 'OFFLINE' : 'ONLINE'}
          </div>
        </div>

        <div className="h-px bg-slate-200/50" />

        <div className="grid grid-cols-3 gap-4">
          <HealthMetric
            title="Pendientes"
            value={user.pendingMutations}
            isAlert={user.pendingMutations > 0}
            icon={
              <Cloud
                className={clsx(user.pendingMutations > 0 ? 'text-amber-500' : 'text-slate-300')}
                size={16}
              />
            }
          />
          <HealthMetric
            title="Sync Fallido"
            value={syncIssueCount}
            isAlert={syncIssueCount > 0}
            icon={
              <AlertTriangle
                className={clsx(syncIssueCount > 0 ? 'text-red-500' : 'text-slate-300')}
                size={16}
              />
            }
          />
          <HealthMetric
            title="Errores Locales"
            value={user.localErrorCount}
            isAlert={user.localErrorCount > 0}
            icon={
              <Bug
                className={clsx(user.localErrorCount > 0 ? 'text-red-500' : 'text-slate-300')}
                size={16}
              />
            }
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Reintentos: {retryingSyncTasks}</span>
          <span>Cola más antigua: {oldestPendingAgeMinutes} min</span>
        </div>

        {(user.syncOrphanedTasks || 0) > 0 ||
        user.versionUpdateReason === 'runtime_contract_mismatch' ||
        user.versionUpdateReason === 'schema_ahead_of_client' ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            {(user.syncOrphanedTasks || 0) > 0 ? (
              <span>Ownership drift {user.syncOrphanedTasks}</span>
            ) : null}
            {user.remoteSyncReason ? <span>Sync {user.remoteSyncReason}</span> : null}
            {user.versionUpdateReason &&
            user.versionUpdateReason !== 'current' &&
            user.versionUpdateReason !== 'new_build_available' ? (
              <span>Versión {user.versionUpdateReason}</span>
            ) : null}
          </div>
        ) : null}

        {!compact && user.operationalObservedCount > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span>12h {user.operationalObservedCount}</span>
            <span>1h {user.operationalLastHourObservedCount}</span>
            <span>Sync {user.operationalSyncObservedCount}</span>
            <span>Local {user.operationalIndexedDbObservedCount}</span>
            <span>Docs {user.operationalClinicalDocumentObservedCount}</span>
            <span>Día {user.operationalCreateDayObservedCount}</span>
            <span>Handoff {user.operationalHandoffObservedCount}</span>
            {(user.operationalDailyRecordRecoveredRealtimeNullCount || 0) > 0 ? (
              <span>Null recup. {user.operationalDailyRecordRecoveredRealtimeNullCount}</span>
            ) : null}
            {(user.operationalDailyRecordConfirmedRealtimeNullCount || 0) > 0 ? (
              <span>Null conf. {user.operationalDailyRecordConfirmedRealtimeNullCount}</span>
            ) : null}
            {(user.operationalSyncReadUnavailableCount || 0) > 0 ? (
              <span>Sync unreadable {user.operationalSyncReadUnavailableCount}</span>
            ) : null}
            {(user.operationalIndexedDbFallbackModeCount || 0) > 0 ? (
              <span>Fallback IDX {user.operationalIndexedDbFallbackModeCount}</span>
            ) : null}
            {(user.operationalAuthBootstrapTimeoutCount || 0) > 0 ? (
              <span>Auth timeout {user.operationalAuthBootstrapTimeoutCount}</span>
            ) : null}
            {user.operationalTopObservedCategory ? (
              <span>Tipo {user.operationalTopObservedCategory}</span>
            ) : null}
            {user.operationalTopObservedOperation ? (
              <span className="text-slate-400">Op. {user.operationalTopObservedOperation}</span>
            ) : null}
            {user.latestOperationalIssueAt ? (
              <span className="text-slate-400">
                Última obs.{' '}
                {user.latestOperationalOperation ? `${user.latestOperationalOperation} · ` : ''}
                {new Date(user.latestOperationalIssueAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={clsx(
            'rounded-md border px-2 py-1 text-[10px]',
            health.level === 'critical'
              ? 'border-red-200 bg-red-100 text-red-700'
              : health.level === 'warning'
                ? 'border-amber-200 bg-amber-100 text-amber-700'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          )}
        >
          {health.actionHint}
        </div>

        {!compact && health.level !== 'healthy' ? (
          <div className="space-y-1">
            <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Diagnostico
            </p>
            <ul className="space-y-1">
              {health.reasons.slice(0, 2).map(reason => (
                <li
                  key={reason}
                  className="rounded border border-slate-200 bg-white/70 px-2 py-1 text-[10px] text-slate-700"
                >
                  {reason}
                </li>
              ))}
            </ul>
            <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Siguiente accion
            </p>
            <ul className="space-y-1">
              {health.recommendedActions.slice(0, 2).map(action => (
                <li
                  key={action}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700"
                >
                  {action}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-2 text-[10px] font-medium italic text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck size={12} /> {user.appVersion}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} />{' '}
            {new Date(user.lastSeen).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {!compact && onSelect ? (
          <div className="flex justify-end text-[10px] font-bold text-slate-500">
            Seleccionar usuario
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 h-1 w-full bg-white/20" />
    </div>
  );
};
