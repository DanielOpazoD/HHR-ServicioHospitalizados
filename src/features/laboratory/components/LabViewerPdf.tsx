/**
 * @module LabViewerPdf
 * @description Inline PDF viewer using iframe with loading overlay.
 */

import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { SyslabExamItem } from '@/types/domain/laboratory';
import { buildSyslabPdfUrl } from '@/services/laboratory/syslabService';

interface LabViewerPdfProps {
  exam: SyslabExamItem;
  onBack: () => void;
}

export const LabViewerPdf: React.FC<LabViewerPdfProps> = ({ exam, onBack }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const pdfUrl = exam.link ? `${buildSyslabPdfUrl(exam.link)}#navpanes=0&scrollbar=1&zoom=110` : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={14} />
          Volver a lista de examenes
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-600">
            {exam.date} {exam.time}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            #{exam.id}
          </span>
        </div>
      </div>

      <div className="relative rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <Loader2 size={24} className="animate-spin text-emerald-500 mb-2" />
            <p className="text-[12px] text-slate-400">Obteniendo PDF desde Syslab...</p>
            <p className="text-[10px] text-slate-300 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}
        <iframe
          src={pdfUrl}
          title={`PDF Examen ${exam.id}`}
          className="w-full border-0"
          style={{ height: '80vh' }}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};
