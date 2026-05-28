import React from 'react';
import { Clock, MonitorCheck, ShieldCheck, UserRound } from 'lucide-react';
import { AuditLogEntry } from '@/types/auditLogTypes';
import { buildClinicalAuditTimelineGroups } from '@/services/admin/clinicalAuditTimeline';

interface AuditTimelineProps {
  logs: AuditLogEntry[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ logs }) => {
  const timelineGroups = buildClinicalAuditTimelineGroups(logs);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Clock className="text-violet-600" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Timeline clínico/legal</h3>
          <p className="text-xs text-slate-500">
            Eventos agrupados por paciente, episodio o registro afectado
          </p>
        </div>
      </div>

      {timelineGroups.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">
          Sin eventos de auditoría para construir línea de tiempo.
        </p>
      )}

      <div className="space-y-6">
        {timelineGroups.slice(0, 8).map(group => (
          <div key={group.subjectKey} className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-800">{group.subjectLabel}</p>
                <p className="text-[10px] text-slate-400">{group.subjectDetail}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-600">{group.eventCount} eventos</p>
                <p className="text-[10px] text-slate-400">{group.latestTimestamp}</p>
              </div>
            </div>

            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
              {group.events.slice(0, 12).map(event => (
                <div key={event.sourceLogId} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-4 w-3 h-3 rounded-full border-2 border-white shadow-sm bg-violet-500" />
                  <div className="rounded-lg bg-slate-50/70 border border-slate-100 p-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-violet-500" />
                          {event.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {event.narrative}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {event.timestamp}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <UserRound size={12} /> {event.responsible}
                      </span>
                      <span className="flex items-center gap-1">
                        <MonitorCheck size={12} /> {event.origin}
                      </span>
                      <span className="truncate">Afectado: {event.affected}</span>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2">
                      Cambios: {event.relevantChanges}
                    </p>
                  </div>
                </div>
              ))}
              {group.events.length > 12 && (
                <p className="text-[10px] text-slate-400 pl-4">
                  +{group.events.length - 12} eventos más...
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
