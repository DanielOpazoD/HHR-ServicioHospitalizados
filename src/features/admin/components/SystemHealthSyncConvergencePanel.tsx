import { useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, ShieldAlert } from 'lucide-react';
import type { SystemHealthSyncConvergencePanelModel } from './systemHealthSyncConvergenceModel';

const statusClassName: Record<SystemHealthSyncConvergencePanelModel['status'], string> = {
  healthy: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  recoverable: 'border-sky-100 bg-sky-50 text-sky-700',
  needs_review: 'border-amber-100 bg-amber-50 text-amber-700',
  unsafe: 'border-red-100 bg-red-50 text-red-700',
};

const StatusIcon = ({ status }: { status: SystemHealthSyncConvergencePanelModel['status'] }) => {
  if (status === 'healthy') return <CheckCircle2 size={17} />;
  if (status === 'recoverable') return <RefreshCw size={17} />;
  if (status === 'unsafe') return <ShieldAlert size={17} />;
  return <AlertTriangle size={17} />;
};

const formatDateTime = (timestamp: string | undefined): string => {
  if (!timestamp) return 'Sin convergencia registrada';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const SystemHealthSyncConvergencePanel = ({
  model,
}: {
  model: SystemHealthSyncConvergencePanelModel;
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const detailsId = 'system-health-sync-convergence-details';

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex h-8 w-8 items-center justify-center rounded-md border',
              statusClassName[model.status]
            )}
          >
            <StatusIcon status={model.status} />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900">Convergencia clinica</h3>
            <p className="text-[11px] font-medium text-slate-500">
              Autoridad, replay y seleccion de verdad
            </p>
          </div>
        </div>
        <span
          className={clsx(
            'rounded-md border px-2.5 py-1 text-[11px] font-black uppercase',
            statusClassName[model.status]
          )}
        >
          {model.statusLabel}
        </span>
      </div>

      <div className="grid gap-3 px-4 py-3 md:grid-cols-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Pendientes
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{model.pendingOperations}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Bloqueadas
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{model.blockedOperations}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Recuperables
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{model.recoverableDivergences}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Ultima OK
          </p>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {formatDateTime(model.lastConvergenceOkAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="max-w-3xl text-xs font-medium text-slate-600">{model.summary}</p>
        <button
          type="button"
          aria-expanded={showTechnicalDetails}
          aria-controls={detailsId}
          onClick={() => setShowTechnicalDetails(current => !current)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          Detalle tecnico
          <ChevronDown
            size={13}
            className={clsx('transition-transform', showTechnicalDetails && 'rotate-180')}
          />
        </button>
      </div>

      {showTechnicalDetails ? (
        <div id={detailsId} className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {model.technicalDetails.length === 0 ? (
            <p className="text-xs text-slate-500">Sin eventos tecnicos destacados.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-600">
              {model.technicalDetails.map(detail => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
};
