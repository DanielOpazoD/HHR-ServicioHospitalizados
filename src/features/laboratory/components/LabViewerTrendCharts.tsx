/**
 * @module LabViewerTrendCharts
 * @description Trend line charts grouped by clinical category with scale-aware sub-charts.
 */

import React from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { LabChartErrorBoundary } from './LabChartErrorBoundary';
import type { LabAnalysisData } from '@/types/domain/laboratory';
import { LabTrendGroupCard } from './LabTrendGroupCard';
import { exportChartsAsPng } from './labTrendChartExport';

// === MAIN COMPONENT ===

export const LabViewerTrendCharts: React.FC<{ data: LabAnalysisData }> = ({ data }) => {
  const chartsRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  if (data.trendGroups.length === 0) {
    return (
      <div className="py-8 text-center">
        <TrendingUp size={28} className="mx-auto mb-2 text-slate-200" />
        <p className="text-[12px] text-slate-400">
          Se necesitan al menos 2 examenes con la misma variable para generar tendencias.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          disabled={isExporting}
          onClick={async () => {
            if (!chartsRef.current) return;
            setIsExporting(true);
            try {
              await exportChartsAsPng(chartsRef.current);
            } finally {
              setIsExporting(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
        >
          <Download size={12} />
          {isExporting ? 'Exportando...' : 'Descargar PNG'}
        </button>
      </div>
      <div ref={chartsRef} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.trendGroups.map(group => (
          <LabChartErrorBoundary key={group.label} chartLabel={group.label}>
            <LabTrendGroupCard group={group} />
          </LabChartErrorBoundary>
        ))}
      </div>
    </div>
  );
};
