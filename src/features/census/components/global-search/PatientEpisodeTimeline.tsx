/**
 * PatientEpisodeTimeline
 *
 * Detail view shown after selecting a patient in the global search.
 * Displays demographics, hospitalization episodes grouped as blocks
 * (admission → discharge), and clinical documents per episode.
 */

import React, { useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  CalendarDays,
  BedDouble,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
  ArrowRightLeft,
  Clock,
  Download,
} from 'lucide-react';
import type { MasterPatient, HospitalizationEvent } from '@/types/domain/patientMaster';
import type {
  PatientHistoryResult,
  PatientMovement,
} from '@/services/patient/patientHistoryService';
import type { EpisodeDocuments } from '@/hooks/useGlobalPatientSearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupedEpisode {
  id: string;
  admission: HospitalizationEvent;
  discharge: HospitalizationEvent | null;
  diagnosis: string;
  bedName: string;
  daysOfStay: number | null;
}

interface PatientEpisodeTimelineProps {
  patient: MasterPatient;
  history: PatientHistoryResult | null;
  isLoadingHistory: boolean;
  episodeDocuments: Record<string, EpisodeDocuments>;
  onLoadDocuments: (episodeKey: string) => void;
  onDownloadPdf: (docId: string, docType: string) => Promise<void>;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (iso: string | undefined): string => {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/**
 * Build episode lookup key preserving original RUT format.
 * The canonical episodeKey format is `RUT__admissionDate` where
 * the RUT keeps dots (e.g., "8.258.248-7__2026-03-17").
 */
const buildEpisodeKey = (rut: string, admissionDate: string): string =>
  `${rut || 'sin-rut'}__${admissionDate || 'sin-ingreso'}`;

const calculateDaysBetween = (start: string, end: string): number => {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const diff = e.getTime() - s.getTime();
  const days = Math.round(diff / (1000 * 3600 * 24));
  return Math.max(days, 0);
};

const dischargeTypeIcon = (type: string) => {
  switch (type) {
    case 'Egreso':
      return <LogOut size={12} className="text-blue-500" />;
    case 'Traslado':
      return <ArrowRightLeft size={12} className="text-amber-500" />;
    case 'Fallecimiento':
      return <LogOut size={12} className="text-red-500" />;
    default:
      return <LogOut size={12} className="text-slate-400" />;
  }
};

const dischargeLabel = (event: HospitalizationEvent): string => {
  if (event.type === 'Traslado' && event.receivingCenter) {
    return `Traslado a ${event.receivingCenter}`;
  }
  return event.type;
};

/**
 * Groups sequential Ingreso/Egreso/Traslado/Fallecimiento events into episode blocks.
 * Each block starts with an Ingreso and ends with the next Egreso/Traslado/Fallecimiento.
 */
const groupEpisodesAsBlocks = (events: HospitalizationEvent[]): GroupedEpisode[] => {
  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const grouped: GroupedEpisode[] = [];
  let currentAdmission: HospitalizationEvent | null = null;

  for (const event of sorted) {
    if (event.type === 'Ingreso') {
      // If there was an unfinished admission, push it without discharge
      if (currentAdmission) {
        grouped.push({
          id: currentAdmission.id,
          admission: currentAdmission,
          discharge: null,
          diagnosis: currentAdmission.diagnosis || '',
          bedName: currentAdmission.bedName || '',
          daysOfStay: null,
        });
      }
      currentAdmission = event;
    } else if (currentAdmission) {
      // This is an Egreso/Traslado/Fallecimiento closing the current admission
      grouped.push({
        id: currentAdmission.id,
        admission: currentAdmission,
        discharge: event,
        diagnosis: currentAdmission.diagnosis || event.diagnosis || '',
        bedName: currentAdmission.bedName || event.bedName || '',
        daysOfStay: calculateDaysBetween(currentAdmission.date, event.date),
      });
      currentAdmission = null;
    } else {
      // Discharge without a matching admission — show as standalone
      grouped.push({
        id: event.id,
        admission: event,
        discharge: null,
        diagnosis: event.diagnosis || '',
        bedName: event.bedName || '',
        daysOfStay: null,
      });
    }
  }

  // If there's an open admission (currently hospitalized)
  if (currentAdmission) {
    const today = new Date().toISOString().slice(0, 10);
    grouped.push({
      id: currentAdmission.id,
      admission: currentAdmission,
      discharge: null,
      diagnosis: currentAdmission.diagnosis || '',
      bedName: currentAdmission.bedName || '',
      daysOfStay: calculateDaysBetween(currentAdmission.date, today),
    });
  }

  // Most recent first
  return grouped.reverse();
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const DemographicsCard: React.FC<{ patient: MasterPatient }> = ({ patient }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-medical-100 flex items-center justify-center">
        <User size={20} className="text-medical-600" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">{patient.fullName}</h3>
        <span className="text-xs font-mono text-slate-500">{patient.rut}</span>
      </div>
      {patient.vitalStatus === 'Fallecido' && (
        <span className="ml-auto text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
          Fallecido
        </span>
      )}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      {patient.birthDate && (
        <div>
          <span className="text-slate-400 block">Nacimiento</span>
          <span className="text-slate-700 font-medium">{formatDate(patient.birthDate)}</span>
        </div>
      )}
      {patient.gender && (
        <div>
          <span className="text-slate-400 block">Sexo</span>
          <span className="text-slate-700 font-medium">{patient.gender}</span>
        </div>
      )}
      {patient.forecast && (
        <div>
          <span className="text-slate-400 block">Prevision</span>
          <span className="text-slate-700 font-medium">{patient.forecast}</span>
        </div>
      )}
      {patient.commune && (
        <div>
          <span className="text-slate-400 block">Comuna</span>
          <span className="text-slate-700 font-medium">{patient.commune}</span>
        </div>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Document Row with PDF download
// ---------------------------------------------------------------------------

const DocRow: React.FC<{
  doc: { id: string; documentType: string; status: string; updatedAt: string; createdBy: string };
  onDownloadPdf: (docId: string, docType: string) => Promise<void>;
}> = ({ doc, onDownloadPdf }) => {
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownloadPdf(doc.id, doc.documentType);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <FileText size={12} className="text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-700 block truncate">
          {doc.documentType}
        </span>
        <span className="text-[10px] text-slate-400">
          {formatDate(doc.updatedAt?.split('T')[0])} &middot; {doc.createdBy}
        </span>
      </div>
      <span
        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
          doc.status === 'published'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-amber-50 text-amber-600'
        }`}
      >
        {doc.status === 'published' ? 'Publicado' : 'Borrador'}
      </span>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="shrink-0 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        title="Descargar PDF"
      >
        {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Episode Block Card
// ---------------------------------------------------------------------------

const EpisodeBlockCard: React.FC<{
  episode: GroupedEpisode;
  rut: string;
  episodeDocuments: Record<string, EpisodeDocuments>;
  onLoadDocuments: (key: string) => void;
  onDownloadPdf: (docId: string, docType: string) => Promise<void>;
}> = ({ episode, rut, episodeDocuments, onLoadDocuments, onDownloadPdf }) => {
  const [isDocsExpanded, setIsDocsExpanded] = React.useState(false);

  const episodeKey =
    episode.admission.type === 'Ingreso' ? buildEpisodeKey(rut, episode.admission.date) : null;

  const docsState = episodeKey ? episodeDocuments[episodeKey] : undefined;
  const isCurrentlyAdmitted = episode.admission.type === 'Ingreso' && !episode.discharge;

  const handleToggleDocs = useCallback(() => {
    if (!episodeKey) return;
    if (!docsState) {
      onLoadDocuments(episodeKey);
    }
    setIsDocsExpanded(prev => !prev);
  }, [episodeKey, docsState, onLoadDocuments]);

  return (
    <div className="relative pl-6 pb-4">
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-3 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
          isCurrentlyAdmitted ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-medical-400'
        }`}
      />

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Header: date range + status */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50/80 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <LogIn size={13} className="text-emerald-600" />
            <span className="text-xs font-semibold text-slate-700">
              {formatDate(episode.admission.date)}
            </span>
            <span className="text-slate-300">→</span>
            {episode.discharge ? (
              <>
                {dischargeTypeIcon(episode.discharge.type)}
                <span className="text-xs font-semibold text-slate-700">
                  {formatDate(episode.discharge.date)}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                Hospitalizado
              </span>
            )}
          </div>

          {episode.daysOfStay !== null && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
              <Clock size={10} />
              {episode.daysOfStay} dia{episode.daysOfStay !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Body: diagnosis, bed, discharge info */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {episode.bedName && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <BedDouble size={11} />
                {episode.bedName}
              </span>
            )}
            {episode.discharge && episode.discharge.type !== 'Egreso' && (
              <span className="text-[10px] text-slate-400">
                {dischargeLabel(episode.discharge)}
              </span>
            )}
          </div>

          {episode.diagnosis && (
            <p className="text-xs text-slate-600 mt-1.5">{episode.diagnosis}</p>
          )}

          {/* Clinical documents toggle */}
          {episodeKey && (
            <button
              type="button"
              onClick={handleToggleDocs}
              className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-medical-600 hover:text-medical-800 transition-colors"
            >
              <FileText size={12} />
              Documentos clinicos
              {isDocsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {docsState?.docs.length ? (
                <span className="ml-1 text-[10px] bg-medical-100 text-medical-700 rounded-full px-1.5">
                  {docsState.docs.length}
                </span>
              ) : null}
            </button>
          )}

          {isDocsExpanded && episodeKey && (
            <div className="mt-2 pl-4 border-l-2 border-medical-100">
              {docsState?.isLoading && (
                <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" />
                  Cargando documentos...
                </div>
              )}
              {docsState && !docsState.isLoading && docsState.docs.length === 0 && (
                <p className="text-xs text-slate-400 py-2">Sin documentos clinicos</p>
              )}
              {docsState?.docs.map(doc => (
                <DocRow key={doc.id} doc={doc} onDownloadPdf={onDownloadPdf} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Movement Timeline (from patientHistoryService)
// ---------------------------------------------------------------------------

const MovementTimeline: React.FC<{ movements: PatientMovement[] }> = ({ movements }) => {
  if (movements.length === 0) return null;

  const movementIcon = (type: string) => {
    switch (type) {
      case 'admission':
        return <LogIn size={12} className="text-emerald-600" />;
      case 'discharge':
        return <LogOut size={12} className="text-rose-600" />;
      case 'transfer':
        return <ArrowRightLeft size={12} className="text-amber-600" />;
      case 'internal_move':
        return <BedDouble size={12} className="text-blue-600" />;
      default:
        return <CalendarDays size={12} className="text-slate-400" />;
    }
  };

  const movementLabel = (type: string): string => {
    switch (type) {
      case 'admission':
        return 'Ingreso';
      case 'discharge':
        return 'Egreso';
      case 'transfer':
        return 'Traslado';
      case 'internal_move':
        return 'Cambio de cama';
      default:
        return 'Estadia';
    }
  };

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Movimientos recientes
      </h4>
      <div className="space-y-1">
        {movements.slice(-10).map((m, i) => (
          <div key={`${m.date}-${m.bedId}-${i}`} className="flex items-center gap-2 text-xs">
            {movementIcon(m.type)}
            <span className="text-slate-500 font-mono text-[10px] w-20 shrink-0">
              {formatDate(m.date)}
            </span>
            <span className="font-medium text-slate-700">{movementLabel(m.type)}</span>
            <span className="text-slate-400 truncate">
              {m.bedName}
              {m.details ? ` — ${m.details}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const PatientEpisodeTimeline: React.FC<PatientEpisodeTimelineProps> = ({
  patient,
  history,
  isLoadingHistory,
  episodeDocuments,
  onLoadDocuments,
  onDownloadPdf,
  onBack,
}) => {
  const groupedEpisodes = useMemo(
    () => groupEpisodesAsBlocks(patient.hospitalizations ?? []),
    [patient.hospitalizations]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-3 self-start"
      >
        <ArrowLeft size={14} />
        Volver a resultados
      </button>

      {/* Demographics */}
      <DemographicsCard patient={patient} />

      {/* Movement timeline from history service */}
      {isLoadingHistory && (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Cargando historial...
        </div>
      )}

      {history && <MovementTimeline movements={history.movements} />}

      {/* Hospitalizations grouped as blocks */}
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Episodios de hospitalizacion ({groupedEpisodes.length})
      </h4>

      {groupedEpisodes.length === 0 && (
        <p className="text-xs text-slate-400 py-4 text-center">Sin episodios registrados</p>
      )}

      <div className="relative border-l-2 border-medical-200 ml-1.5 overflow-y-auto flex-1">
        {groupedEpisodes.map(episode => (
          <EpisodeBlockCard
            key={episode.id}
            episode={episode}
            rut={patient.rut}
            episodeDocuments={episodeDocuments}
            onLoadDocuments={onLoadDocuments}
            onDownloadPdf={onDownloadPdf}
          />
        ))}
      </div>
    </div>
  );
};
