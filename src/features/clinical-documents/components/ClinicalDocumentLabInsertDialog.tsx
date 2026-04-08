/**
 * @module ClinicalDocumentLabInsertDialog
 * @description Dialog for selecting a lab exam to insert as summary text
 * into the clinical document.
 */

import React, { useState, useEffect } from 'react';
import { FlaskConical, Loader2, X } from 'lucide-react';
import { getLabResults } from '@/features/laboratory/services/labFirestoreService';
import { searchSyslabExams, fetchSyslabExamDetails } from '@/services/laboratory/syslabService';
import { buildLabSummaryText } from '@/features/laboratory/public';
import type { LabResultRow } from '@/types/domain/laboratory';
import type { StoredLabExam } from '@/features/laboratory/services/labFirestoreService';

interface ClinicalDocumentLabInsertDialogProps {
  patientRut: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}

interface ExamOption {
  id: string;
  date: string;
  time: string;
  label: string;
  findings?: LabResultRow[];
  needsFetch?: boolean;
  link?: string;
}

export const ClinicalDocumentLabInsertDialog: React.FC<ClinicalDocumentLabInsertDialogProps> = ({
  patientRut,
  onInsert,
  onClose,
}) => {
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInserting, setIsInserting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load exams: first from Firestore cache, then live from Syslab
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Try Firestore cache first
        const cached = await getLabResults(patientRut);
        if (cached && Object.keys(cached.exams).length > 0) {
          const opts: ExamOption[] = Object.entries(cached.exams)
            .map(([id, exam]) => ({
              id,
              date: exam.date,
              time: exam.time,
              label: `${exam.date} ${exam.time.substring(0, 5)}`,
              findings: exam.findings,
            }))
            .sort((a, b) => {
              const da = a.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
              const db = b.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
              return db.localeCompare(da); // newest first
            });

          if (!cancelled) setExams(opts);
        }

        // 2. Also try live Syslab (may have newer exams)
        const live = await searchSyslabExams(patientRut);
        if (!cancelled && live.success && live.data.length > 0) {
          const liveOpts: ExamOption[] = live.data
            .filter(e => e.link)
            .map(e => ({
              id: e.id,
              date: e.date,
              time: e.time,
              label: `${e.date} ${e.time.substring(0, 5)}`,
              // Check if we already have findings from cache
              findings: cached?.exams[e.id]?.findings,
              needsFetch: !cached?.exams[e.id],
              link: e.link || undefined,
            }))
            .sort((a, b) => {
              const da = a.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
              const db = b.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
              return db.localeCompare(da);
            });

          if (!cancelled) setExams(liveOpts);
        }
      } catch (err) {
        if (!cancelled) setError('No se pudieron cargar los exámenes.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [patientRut]);

  const handleSelect = async (exam: ExamOption) => {
    setIsInserting(exam.id);

    try {
      let findings = exam.findings;

      // If no cached findings, fetch from Syslab
      if (!findings && exam.link) {
        const details = await fetchSyslabExamDetails([exam.link]);
        if (details.success && details.data[0]?.findings) {
          findings = details.data[0].findings;
        }
      }

      if (!findings || findings.length === 0) {
        setError('No se encontraron resultados para este examen.');
        setIsInserting(null);
        return;
      }

      const text = buildLabSummaryText(findings, exam.date, exam.time);
      if (text) {
        onInsert(text);
      } else {
        setError('No se pudo generar el resumen.');
      }
    } catch {
      setError('Error al obtener los resultados del examen.');
    } finally {
      setIsInserting(null);
    }
  };

  return (
    <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-emerald-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-emerald-100 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <FlaskConical size={13} className="text-emerald-600" />
          <span className="text-[11px] font-bold text-slate-700">Insertar Laboratorio</span>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-emerald-500" />
            <span className="ml-2 text-[11px] text-slate-400">Cargando exámenes...</span>
          </div>
        )}

        {error && <p className="px-2 py-3 text-center text-[11px] text-red-600">{error}</p>}

        {!isLoading && exams.length === 0 && !error && (
          <p className="px-2 py-6 text-center text-[11px] text-slate-400">
            No hay exámenes disponibles para este paciente.
          </p>
        )}

        {exams.map(exam => (
          <button
            key={exam.id}
            type="button"
            disabled={isInserting !== null}
            onClick={() => handleSelect(exam)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-emerald-50 disabled:opacity-50"
          >
            <div>
              <span className="text-[12px] font-semibold text-slate-700">{exam.label}</span>
              <span className="ml-2 text-[9px] text-slate-400">#{exam.id}</span>
              {exam.needsFetch && (
                <span className="ml-1 text-[8px] text-amber-500">(requiere descarga)</span>
              )}
            </div>
            {isInserting === exam.id && (
              <Loader2 size={12} className="animate-spin text-emerald-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
