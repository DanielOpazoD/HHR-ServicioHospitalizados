import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import {
  buildSystemHealthSummary,
  deleteUserHealthSnapshot,
  reopenSystemHealthIncident,
  resolveSystemHealthIncident,
  subscribeToSystemHealth,
  subscribeToSystemHealthIncidentResolutions,
  type SystemHealthIncidentResolutionState,
  type UserHealthStatus,
} from '@/services/admin/healthService';
import { useAuth } from '@/context/AuthContext';
import { useConfirmDialog, useNotification } from '@/context/UIContext';
import { DailyOpsChecklistCard } from './DailyOpsChecklistCard';
import { SystemHealthAlertsPanel } from './SystemHealthAlertsPanel';
import { SystemHealthIncidentDetailPanel } from './SystemHealthIncidentDetailPanel';
import { SystemHealthIncidentQueue } from './SystemHealthIncidentQueue';
import { SystemHealthSummaryGrid } from './SystemHealthSummaryGrid';
import { SystemHealthTriageToolbar } from './SystemHealthTriageToolbar';
import { SystemHealthUserCard } from './SystemHealthUserCard';
import {
  buildSystemHealthTriageModel,
  exportSystemHealthIncidentsCsv,
  shiftSystemHealthSelectedDate,
  type SystemHealthDateRange,
  type SystemHealthEventTypeFilter,
  type SystemHealthSeverityFilter,
} from './systemHealthIncidentUtils';

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export const SystemHealthDashboard = () => {
  const { currentUser } = useAuth();
  const { confirm } = useConfirmDialog();
  const { success, error } = useNotification();
  const [stats, setStats] = useState<UserHealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<SystemHealthDateRange>('last24h');
  const [selectedDate, setSelectedDate] = useState(todayInputValue);
  const [severity, setSeverity] = useState<SystemHealthSeverityFilter>('all');
  const [eventType, setEventType] = useState<SystemHealthEventTypeFilter>('all');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedResolutionKey, setSelectedResolutionKey] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [resolutionState, setResolutionState] = useState<SystemHealthIncidentResolutionState>({});

  useEffect(() => {
    const unsubscribe = subscribeToSystemHealth(data => {
      setStats(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSystemHealthIncidentResolutions(setResolutionState);
    return () => unsubscribe();
  }, []);

  const triageModel = useMemo(
    () =>
      buildSystemHealthTriageModel(stats, {
        selectedUid,
        resolutionState,
        filters: {
          searchTerm,
          dateRange,
          selectedDate,
          severity,
          eventType,
        },
      }),
    [dateRange, eventType, resolutionState, searchTerm, selectedDate, selectedUid, severity, stats]
  );
  const summary = buildSystemHealthSummary(stats);
  const { filteredUsers, selectedUser, selectedIncidents, incidentQueue, totals } = triageModel;

  const orderedSelectedIncidents = useMemo(() => {
    if (!selectedResolutionKey) return selectedIncidents;
    return [...selectedIncidents].sort((a, b) => {
      if (a.resolutionKey === selectedResolutionKey) return -1;
      if (b.resolutionKey === selectedResolutionKey) return 1;
      return 0;
    });
  }, [selectedIncidents, selectedResolutionKey]);

  useEffect(() => {
    if (!selectedUid && filteredUsers[0]) {
      setSelectedUid(filteredUsers[0].uid);
      return;
    }
    if (selectedUid && !filteredUsers.some(user => user.uid === selectedUid)) {
      setSelectedUid(filteredUsers[0]?.uid || null);
      setSelectedResolutionKey(null);
    }
  }, [filteredUsers, selectedUid]);

  useEffect(() => {
    if (!selectedResolutionKey && incidentQueue[0]) {
      setSelectedResolutionKey(incidentQueue[0].resolutionKey);
      setSelectedUid(incidentQueue[0].userUid);
      return;
    }
    if (
      selectedResolutionKey &&
      !incidentQueue.some(incident => incident.resolutionKey === selectedResolutionKey)
    ) {
      setSelectedResolutionKey(incidentQueue[0]?.resolutionKey || null);
      setSelectedUid(incidentQueue[0]?.userUid || filteredUsers[0]?.uid || null);
    }
  }, [filteredUsers, incidentQueue, selectedResolutionKey]);

  const handleDeleteSnapshot = async (user: UserHealthStatus) => {
    const confirmed = await confirm({
      title: 'Borrar registro de salud',
      message: `Se eliminara el snapshot operativo de ${user.displayName}. Si el usuario sigue activo, volvera a reportar en el proximo ciclo.`,
      confirmText: 'Borrar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (!confirmed) return;

    setDeletingUid(user.uid);
    try {
      await deleteUserHealthSnapshot(user.uid);
      success('Registro de salud borrado', user.email);
      if (selectedUid === user.uid) {
        setSelectedUid(null);
        setSelectedResolutionKey(null);
      }
    } catch (deleteError) {
      error('No se pudo borrar el registro de salud', String(deleteError));
    } finally {
      setDeletingUid(null);
    }
  };

  const buildResolutionActor = () => ({
    uid: currentUser?.uid,
    email: currentUser?.email,
    displayName: currentUser?.displayName,
  });

  const handleResolveIncident = async (resolutionKey: string, note?: string) => {
    const resolvedAt = new Date().toISOString();
    const actor = buildResolutionActor();
    setResolutionState(current => ({
      ...current,
      [resolutionKey]: {
        resolutionKey,
        status: 'resolved',
        updatedAt: resolvedAt,
        resolvedAt,
        resolvedByUid: actor.uid || 'unknown',
        resolvedByEmail: actor.email || 'unknown@local',
        resolvedByName: actor.displayName || actor.email || 'Usuario del sistema',
        note: note || '',
        history: [
          ...(current[resolutionKey]?.history || []),
          {
            action: 'resolved',
            at: resolvedAt,
            actorUid: actor.uid || 'unknown',
            actorEmail: actor.email || 'unknown@local',
            actorName: actor.displayName || actor.email || 'Usuario del sistema',
            note,
          },
        ],
      },
    }));

    try {
      await resolveSystemHealthIncident({
        resolutionKey,
        resolvedAt,
        actor,
        note,
      });
      success('Incidente marcado como resuelto', resolutionKey);
    } catch (resolveError) {
      error('No se pudo resolver el incidente', String(resolveError));
    }
  };

  const handleReopenIncident = async (resolutionKey: string) => {
    const reopenedAt = new Date().toISOString();
    const actor = buildResolutionActor();
    setResolutionState(current => ({
      ...current,
      [resolutionKey]: {
        ...(current[resolutionKey] || {
          resolutionKey,
          history: [],
        }),
        resolutionKey,
        status: 'open',
        updatedAt: reopenedAt,
        reopenedAt,
        reopenedByUid: actor.uid || 'unknown',
        reopenedByEmail: actor.email || 'unknown@local',
        reopenedByName: actor.displayName || actor.email || 'Usuario del sistema',
        history: [
          ...(current[resolutionKey]?.history || []),
          {
            action: 'reopened',
            at: reopenedAt,
            actorUid: actor.uid || 'unknown',
            actorEmail: actor.email || 'unknown@local',
            actorName: actor.displayName || actor.email || 'Usuario del sistema',
          },
        ],
      },
    }));

    try {
      await reopenSystemHealthIncident({
        resolutionKey,
        reopenedAt,
        actor,
      });
      success('Incidente reabierto', resolutionKey);
    } catch (reopenError) {
      error('No se pudo reabrir el incidente', String(reopenError));
    }
  };

  const handleExportCsv = () => {
    const csv = exportSystemHealthIncidentsCsv(incidentQueue);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salud-usuarios-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <DailyOpsChecklistCard />
      <SystemHealthAlertsPanel stats={stats} />

      <SystemHealthSummaryGrid summary={summary} />

      <SystemHealthTriageToolbar
        searchTerm={searchTerm}
        dateRange={dateRange}
        selectedDate={selectedDate}
        severity={severity}
        eventType={eventType}
        totals={totals}
        onSearchTermChange={setSearchTerm}
        onDateRangeChange={setDateRange}
        onSelectedDateChange={setSelectedDate}
        onSeverityChange={setSeverity}
        onEventTypeChange={setEventType}
        onShiftDate={deltaDays =>
          setSelectedDate(currentDate => shiftSystemHealthSelectedDate(currentDate, deltaDays))
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40">
          <RefreshCw className="animate-spin text-medical-500 mb-4" size={40} />
          <p className="text-slate-400 font-medium animate-pulse">
            Cargando telemetría de usuarios...
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card p-20 flex flex-col items-center justify-center text-slate-400">
          <Users size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No hay datos de salud disponibles.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <SystemHealthIncidentQueue
            incidents={incidentQueue}
            selectedResolutionKey={selectedResolutionKey}
            onSelectIncident={incident => {
              setSelectedUid(incident.userUid);
              setSelectedResolutionKey(incident.resolutionKey);
            }}
            onExportCsv={handleExportCsv}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-black text-slate-900">Usuarios afectados</h3>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                  {filteredUsers.length} usuario(s)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
                {filteredUsers.map(user => (
                  <SystemHealthUserCard
                    key={user.uid}
                    user={user}
                    selected={selectedUser?.uid === user.uid}
                    compact
                    onSelect={nextUser => {
                      setSelectedUid(nextUser.uid);
                      const firstIncident = incidentQueue.find(
                        incident => incident.userUid === nextUser.uid
                      );
                      setSelectedResolutionKey(firstIncident?.resolutionKey || null);
                    }}
                  />
                ))}
              </div>
            </section>

            <div className="xl:sticky xl:top-24 xl:self-start">
              <SystemHealthIncidentDetailPanel
                user={selectedUser}
                incidents={orderedSelectedIncidents}
                onDeleteSnapshot={handleDeleteSnapshot}
                onResolveIncident={handleResolveIncident}
                onReopenIncident={handleReopenIncident}
                deleting={deletingUid === selectedUser?.uid}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
