import React from 'react';
import {
  AlertTriangle,
  Bed,
  ChevronDown,
  ChevronRight,
  FileJson,
  History,
  MonitorCheck,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';

import type { ClinicalAuditPatientPackage } from '@/services/admin/clinicalAuditPatientPackages';
import { buildClinicalAuditPresentation } from '@/services/admin/clinicalAuditPresentation';
import { AUDIT_ACTION_LABELS } from '@/services/admin/auditConstants';
import { formatTimestamp } from './auditUIUtils';

interface PatientAuditPackageRowProps {
  auditPackage: ClinicalAuditPatientPackage;
  isExpanded: boolean;
  onToggle: () => void;
  compactView?: boolean;
}

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const displayTimestampParts = (timestamp: string): { date: string; time: string } => {
  const [date = '', time = ''] = formatTimestamp(timestamp).split(' ');
  return { date, time };
};

const getActorSummary = (auditPackage: ClinicalAuditPatientPackage): string =>
  auditPackage.actors.map(actor => actor.label).join(', ') || 'Usuario no identificado';

const getRawEventsJson = (auditPackage: ClinicalAuditPatientPackage): string =>
  JSON.stringify(
    auditPackage.rawLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      recordDate: log.recordDate,
      patientIdentifier: log.patientIdentifier,
      details: log.details,
    })),
    null,
    2
  );

export const PatientAuditPackageRow: React.FC<PatientAuditPackageRowProps> = ({
  auditPackage,
  isExpanded,
  onToggle,
  compactView,
}) => {
  const startedAt = displayTimestampParts(auditPackage.startedAt);
  const endedAt = displayTimestampParts(auditPackage.endedAt);
  const hasTimeRange = startedAt.time && endedAt.time && startedAt.time !== endedAt.time;
  const visibleChanges = auditPackage.changes.slice(0, compactView ? 2 : 4);
  const hiddenChangeCount = Math.max(0, auditPackage.changes.length - visibleChanges.length);
  const rawEventsJson = getRawEventsJson(auditPackage);

  return (
    <>
      <tr
        className={clsx(
          'group cursor-pointer transition-all hover:bg-slate-50/90',
          isExpanded ? 'bg-sky-50/30' : ''
        )}
        onClick={onToggle}
      >
        <td className="px-5 py-3 align-top">
          {isExpanded ? (
            <ChevronDown size={18} className="text-sky-600" />
          ) : (
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500" />
          )}
        </td>

        <td className="px-3 py-3 align-top whitespace-nowrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-slate-900">{auditPackage.recordDate}</span>
            <span className="text-[10px] font-mono text-slate-500">
              {hasTimeRange ? `${startedAt.time}-${endedAt.time}` : endedAt.time}
            </span>
          </div>
        </td>

        <td className="px-3 py-3 align-top min-w-[220px]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-black',
                  auditPackage.flags.risk
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                )}
              >
                {auditPackage.patientName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">
                  {auditPackage.patientName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                  {auditPackage.patientRut && <span>{auditPackage.patientRut}</span>}
                  {auditPackage.primaryBedLabel && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600">
                      <Bed size={10} />
                      {auditPackage.primaryBedLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {auditPackage.modules.slice(0, compactView ? 3 : 5).map(moduleName => (
                <span
                  key={moduleName}
                  className="rounded-md border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700"
                >
                  {moduleName}
                </span>
              ))}
              {auditPackage.flags.risk && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  <AlertTriangle size={10} />
                  Riesgo
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="px-3 py-3 align-top min-w-[300px]">
          {visibleChanges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {visibleChanges.map(change => (
                <div
                  key={`${change.sourceLogId}-${change.fieldLabel}`}
                  className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"
                >
                  <p className="text-[10px] font-black uppercase text-slate-500">
                    {change.fieldLabel}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-500">
                    <span className="text-rose-700">{formatValue(change.oldValue)}</span>
                    <span className="px-1 text-slate-300">-&gt;</span>
                    <span className="font-bold text-emerald-700">
                      {formatValue(change.newValue)}
                    </span>
                  </p>
                </div>
              ))}
              {hiddenChangeCount > 0 && (
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
                  +{hiddenChangeCount} cambios
                </span>
              )}
            </div>
          ) : (
            <p className="max-w-[420px] text-xs font-medium text-slate-700">
              {auditPackage.summary}
            </p>
          )}
        </td>

        {!compactView && (
          <td className="px-3 py-3 align-top">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <UserRound size={13} className="text-slate-400" />
                <span className="max-w-[180px] truncate" title={getActorSummary(auditPackage)}>
                  {getActorSummary(auditPackage)}
                </span>
              </div>
              {auditPackage.ipAddresses[0] && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <MonitorCheck size={12} className="text-slate-400" />
                  <span>IP {auditPackage.ipAddresses[0]}</span>
                </div>
              )}
            </div>
          </td>
        )}

        {!compactView && (
          <td className="px-3 py-3 align-top">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                <ShieldCheck size={12} />
                {auditPackage.eventCount} eventos
              </span>
              <span className="text-[10px] text-slate-400">
                {auditPackage.actions
                  .map(action => AUDIT_ACTION_LABELS[action] || action)
                  .slice(0, 2)
                  .join(' · ')}
              </span>
            </div>
          </td>
        )}
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={compactView ? 4 : 6} className="border-l-4 border-sky-500/40 px-10 py-4">
            <div className="space-y-3">
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <History size={14} className="text-sky-600" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Eventos crudos incluidos
                  </h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {auditPackage.rawLogs.map(log => {
                    const presentation = buildClinicalAuditPresentation(log);
                    const time = displayTimestampParts(log.timestamp).time;
                    return (
                      <div
                        key={log.id}
                        className="grid gap-2 px-3 py-2 md:grid-cols-[90px_1fr_1fr]"
                      >
                        <span className="font-mono text-[10px] text-slate-400">{time}</span>
                        <span className="text-xs font-bold text-slate-700">
                          {presentation.title}
                        </span>
                        <span className="text-xs text-slate-600">{presentation.narrative}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <FileJson size={14} className="text-sky-600" />
                  Detalle técnico avanzado
                </summary>
                <pre className="max-h-[360px] overflow-auto p-3 text-[10px] text-slate-500">
                  {rawEventsJson}
                </pre>
              </details>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
