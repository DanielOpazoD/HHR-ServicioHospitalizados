import React from 'react';
import clsx from 'clsx';
import { ArrowLeft, BarChart3, TrendingUp } from 'lucide-react';
import type { LabAnalysisData, AnalysisViewTab } from '@/types/domain/laboratory';
import { LabViewerTrendCharts } from './LabViewerTrendCharts';
import { LabViewerComparisonTable } from './LabViewerComparisonTable';

interface LabViewerAnalysisProps {
  data: LabAnalysisData;
  activeTab: AnalysisViewTab;
  onTabChange: (tab: AnalysisViewTab) => void;
  onBack: () => void;
}

const TAB_CONFIG: { key: AnalysisViewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'trends', label: 'Tendencias', icon: <TrendingUp size={13} /> },
  { key: 'comparison', label: 'Comparacion', icon: <BarChart3 size={13} /> },
];

export const LabViewerAnalysis: React.FC<LabViewerAnalysisProps> = ({
  data,
  activeTab,
  onTabChange,
  onBack,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
      >
        <ArrowLeft size={14} />
        Volver a lista de examenes
      </button>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {data.examDates.length} examenes analizados
      </span>
    </div>

    <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
      {TAB_CONFIG.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-all border-b-2 -mb-px',
            activeTab === tab.key
              ? 'border-emerald-500 text-emerald-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>

    {activeTab === 'trends' && <LabViewerTrendCharts data={data} />}
    {activeTab === 'comparison' && <LabViewerComparisonTable data={data} />}
  </div>
);
