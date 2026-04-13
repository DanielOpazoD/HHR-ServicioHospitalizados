import React from 'react';
import { FileText, FlaskConical } from 'lucide-react';
import type { LabMicrobiologyEntry, SyslabExamItem } from '@/types/domain/laboratory';

export const LabViewerMicrobiologyPanel: React.FC<{
  entries: LabMicrobiologyEntry[];
  onOpenPdf: (exam: SyslabExamItem) => void;
}> = ({ entries, onOpenPdf }) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Microbiología / Cultivos
          </p>
          <h3 className="mt-1 text-[16px] font-bold text-slate-800">
            Resultados cualitativos relevantes
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          <FlaskConical size={12} />
          {entries.length} examenes
        </span>
      </div>

      <div className="space-y-3">
        {entries.map(entry => (
          <article
            key={`${entry.date}-${entry.examLabel}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold text-slate-800">{entry.examLabel}</span>
              <span className="text-[11px] text-slate-500">{entry.date}</span>
              <button
                type="button"
                onClick={() => onOpenPdf(entry.sourceExam)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                title="Ver PDF original"
                aria-label={`Ver PDF original de ${entry.examLabel}`}
              >
                <FileText size={11} />
                PDF
              </button>
            </div>
            {entry.findings.length > 0 ? (
              <ul className="space-y-1.5">
                {entry.findings.map(finding => (
                  <li
                    key={`${finding.analysis}-${finding.result}`}
                    className="text-[12px] text-slate-700"
                  >
                    <span className="font-semibold text-slate-800">{finding.analysis}:</span>{' '}
                    <span>{finding.result}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">Resultado disponible en PDF original.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};
