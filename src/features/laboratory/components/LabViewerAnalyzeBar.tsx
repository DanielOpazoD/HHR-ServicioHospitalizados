/**
 * @module LabViewerAnalyzeBar
 * @description Sticky bottom bar showing selected exam count with Analyze/Clear buttons.
 */

import React from 'react';
import { BarChart3, Loader2 } from 'lucide-react';

interface LabViewerAnalyzeBarProps {
  selectedCount: number;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onClear: () => void;
}

export const LabViewerAnalyzeBar: React.FC<LabViewerAnalyzeBarProps> = ({
  selectedCount,
  isAnalyzing,
  onAnalyze,
  onClear,
}) =>
  selectedCount > 0 ? (
    <div className="sticky bottom-0 z-20 -mx-5 mt-2 border-t border-emerald-200 bg-emerald-50/95 px-5 py-2 shadow-[0_-8px_24px_rgba(16,185,129,0.08)] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-emerald-700">
          {selectedCount} examen{selectedCount > 1 ? 'es' : ''} seleccionado
          {selectedCount > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
          >
            Limpiar
          </button>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-[12px] font-semibold text-white shadow-md shadow-emerald-700/25 transition-all hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            Analizar ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  ) : null;
