import { CalendarRange, Download } from 'lucide-react';
import type { SystemHealthIncidentTimelineDay } from './systemHealthIncidentUtils';

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Sin hora';
  return new Intl.DateTimeFormat('es-CL', {
    timeStyle: 'short',
  }).format(date);
};

export const SystemHealthTimelinePanel = ({
  timeline,
  onExportCsv,
}: {
  timeline: SystemHealthIncidentTimelineDay[];
  onExportCsv: () => void;
}) => (
  <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <CalendarRange size={16} className="text-slate-500" />
        <h3 className="text-sm font-black text-slate-900">Linea temporal</h3>
      </div>
      <button
        type="button"
        onClick={onExportCsv}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
      >
        <Download size={13} /> Exportar CSV
      </button>
    </div>

    {timeline.length === 0 ? (
      <div className="px-4 py-5 text-xs text-slate-500">Sin eventos en el rango actual.</div>
    ) : (
      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
        {timeline.slice(0, 8).map(day => (
          <article key={day.date} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {day.date}
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">{day.totalIncidents}</p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                {day.affectedUsers} usuario(s)
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-600">
              <span>Criticos: {day.criticalIncidents}</span>
              <span>Alertas: {day.warningIncidents}</span>
              <span>Inicio: {formatTime(day.firstSeenAt)}</span>
              <span>Ultimo: {formatTime(day.lastSeenAt)}</span>
            </div>
            <div className="mt-2 rounded bg-white px-2 py-1 text-[10px] font-bold text-slate-500">
              Duracion: {day.durationMinutes} min
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);
