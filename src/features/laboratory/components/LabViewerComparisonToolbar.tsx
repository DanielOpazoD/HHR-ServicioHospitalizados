import React from 'react';
import { FileText, Search } from 'lucide-react';

interface LabViewerComparisonToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onToggleExportConfig: () => void;
}

export const LabViewerComparisonToolbar: React.FC<LabViewerComparisonToolbarProps> = ({
  searchQuery,
  onSearchChange,
  onToggleExportConfig,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-1.5">
    <div className="relative max-w-sm flex-1">
      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={event => onSearchChange(event.target.value)}
        placeholder="Buscar variable..."
        className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-7 pr-2 text-[10px] text-slate-700 placeholder:text-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
      />
    </div>
    <button
      type="button"
      onClick={onToggleExportConfig}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
    >
      <FileText size={11} />
      Exportar Excel
    </button>
  </div>
);
