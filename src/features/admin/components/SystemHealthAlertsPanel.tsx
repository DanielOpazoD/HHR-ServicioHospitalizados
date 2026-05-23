import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, History, Trash2 } from 'lucide-react';
import { UserHealthStatus } from '@/services/admin/healthService';
import {
  EMPTY_OPERATIONAL_ALERT_SNAPSHOT,
  applyOperationalAlertsSnapshot,
  buildOperationalAlerts,
  clearOperationalAlertsSnapshot,
  getVisibleOperationalAlerts,
  OperationalAlertSnapshotState,
} from '@/features/admin/components/systemHealthOperationalAlerts';

const SNAPSHOT_KEY = 'hhr_system_health_alert_snapshot_v1';

const parseSnapshot = (raw: string | null): OperationalAlertSnapshotState => {
  if (!raw) return EMPTY_OPERATIONAL_ALERT_SNAPSHOT;
  try {
    const parsed = JSON.parse(raw) as OperationalAlertSnapshotState;
    if (!parsed || typeof parsed !== 'object') return EMPTY_OPERATIONAL_ALERT_SNAPSHOT;
    return {
      active: parsed.active || {},
      dismissed:
        parsed.dismissed && typeof parsed.dismissed === 'object' && !Array.isArray(parsed.dismissed)
          ? parsed.dismissed
          : {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lastClearedAt: typeof parsed.lastClearedAt === 'string' ? parsed.lastClearedAt : undefined,
    };
  } catch {
    return EMPTY_OPERATIONAL_ALERT_SNAPSHOT;
  }
};

const readStoredSnapshot = (): OperationalAlertSnapshotState => {
  if (typeof window === 'undefined') return EMPTY_OPERATIONAL_ALERT_SNAPSHOT;
  return parseSnapshot(window.localStorage.getItem(SNAPSHOT_KEY));
};

const persistSnapshot = (snapshot: OperationalAlertSnapshotState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
};

const formatAlertTime = (timestamp: string | undefined): string => {
  if (!timestamp) return 'sin fecha';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const SystemHealthAlertsPanel = ({ stats }: { stats: UserHealthStatus[] }) => {
  const rawAlerts = useMemo(() => buildOperationalAlerts(stats), [stats]);
  const [, setSnapshotVersion] = useState(0);
  const snapshot = (() => {
    const previous = readStoredSnapshot();
    const nowIso = new Date().toISOString();
    const next = applyOperationalAlertsSnapshot(previous, rawAlerts, nowIso);
    persistSnapshot(next);
    return next;
  })();

  const alerts = useMemo(
    () => getVisibleOperationalAlerts(rawAlerts, snapshot),
    [rawAlerts, snapshot]
  );
  const history = snapshot.history.slice(-8).reverse();
  const hasResettableAlerts = rawAlerts.length > 0 || history.length > 0;
  const lastClearedLabel = snapshot.lastClearedAt
    ? new Date(snapshot.lastClearedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleClearAlerts = () => {
    const nowIso = new Date().toISOString();
    const next = clearOperationalAlertsSnapshot(snapshot, rawAlerts, nowIso);
    persistSnapshot(next);
    setSnapshotVersion(version => version + 1);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black tracking-wide text-slate-900">Alertas Operativas</h3>
          <p className="mt-1 text-xs text-slate-600">
            Eventos automaticos para triage tecnico en soporte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasResettableAlerts ? (
            <button
              type="button"
              onClick={handleClearAlerts}
              className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-100"
              title="Limpiar alertas operativas actuales e historial local"
            >
              <Trash2 size={12} /> Limpiar alertas
            </button>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
            {alerts.length} activas
          </span>
        </div>
      </div>
      {lastClearedLabel ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Alertas globales limpiadas desde {lastClearedLabel}. Se volveran a mostrar si cambia la
          condicion o el grupo de usuarios afectados.
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Sin alertas activas.
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.key}
              className={clsx(
                'rounded-lg border px-3 py-2 text-xs',
                alert.severity === 'critical'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              )}
            >
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={14} />
                <span>{alert.title}</span>
                <span className="ml-auto rounded bg-white/60 px-2 py-0.5 text-[10px]">
                  {alert.affectedCount} usuario(s)
                </span>
              </div>
              <p className="mt-1">{alert.description}</p>
              <div className="mt-2 grid gap-1 rounded bg-white/65 px-2 py-1.5 text-[11px] sm:grid-cols-2">
                <span>
                  <span className="font-semibold">Donde:</span>{' '}
                  {alert.originLabel || 'Cola de incidentes'}
                </span>
                <span>
                  <span className="font-semibold">Ultimo:</span> {formatAlertTime(alert.lastSeenAt)}
                </span>
                <span>
                  <span className="font-semibold">Accion:</span>{' '}
                  {alert.actionLabel || alert.recommendedAction}
                </span>
                <span>
                  <span className="font-semibold">Ruta:</span>{' '}
                  {alert.routeLabel || 'Salud de usuarios'}
                </span>
              </div>
              <div className="mt-2 rounded bg-white/60 px-2 py-1 text-[11px]">
                <span className="font-semibold">Usuarios:</span>{' '}
                {alert.affectedUserLabels.slice(0, 4).join(', ')}
                {alert.affectedUserLabels.length > 4 ? ' +' : ''}
                <span className="ml-2 font-semibold">SLA:</span> {alert.slaMinutes} min
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
          <History size={12} /> Historial reciente
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">Sin eventos historicos registrados.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map(event => (
              <li key={`${event.key}:${event.at}:${event.type}`} className="text-xs text-slate-700">
                <span
                  className={clsx(
                    'mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold',
                    event.type === 'opened'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  )}
                >
                  {event.type === 'opened' ? 'ABRE' : 'CIERRA'}
                </span>
                {event.title} ({event.affectedCount}) -{' '}
                {new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
