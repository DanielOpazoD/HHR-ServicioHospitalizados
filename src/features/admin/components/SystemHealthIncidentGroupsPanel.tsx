import clsx from 'clsx';
import { GitBranch, UsersRound } from 'lucide-react';
import type { SystemHealthIncidentGroup } from './systemHealthIncidentUtils';

const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const severityClassName = {
  critical: 'border-red-100 bg-red-50 text-red-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

export const SystemHealthIncidentGroupsPanel = ({
  groups,
}: {
  groups: SystemHealthIncidentGroup[];
}) => (
  <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <GitBranch size={16} className="text-slate-500" />
        <h3 className="text-sm font-black text-slate-900">Causas agrupadas</h3>
      </div>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
        {groups.length} causas
      </span>
    </div>

    {groups.length === 0 ? (
      <div className="px-4 py-5 text-xs text-slate-500">Sin causas para los filtros actuales.</div>
    ) : (
      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.slice(0, 6).map(group => (
          <article
            key={group.id}
            className={clsx('rounded-lg border p-3 text-xs', severityClassName[group.severity])}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                    {group.statusLabel}
                  </span>
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                    {group.categoryLabel}
                  </span>
                </div>
                <h4 className="mt-2 line-clamp-2 font-black">{group.title}</h4>
              </div>
              <span className="shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                {group.occurrenceCount}x
              </span>
            </div>

            <div className="mt-3 space-y-1 text-[11px]">
              <p className="truncate">{group.originLabel}</p>
              <p className="truncate">{group.actionLabel}</p>
              <p className="flex items-center gap-1">
                <UsersRound size={12} /> {group.affectedUsers} usuario(s)
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold">
              <span>Inicio: {formatDateTime(group.firstSeenAt)}</span>
              <span>Ultimo: {formatDateTime(group.lastSeenAt)}</span>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);
