import React from 'react';
import { Loader2, Search } from 'lucide-react';
import type { LabPatient } from '@/types/domain/laboratory';

interface LabViewerControlsProps {
  uniquePatients: LabPatient[];
  selectedRut: string;
  isLoading: boolean;
  onPatientChange: (rut: string) => void;
  onSearch: () => void;
}

export const LabViewerControls: React.FC<LabViewerControlsProps> = ({
  uniquePatients,
  selectedRut,
  isLoading,
  onPatientChange,
  onSearch,
}) => (
  <div className="mb-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2">
        <label className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Paciente
        </label>
        <select
          value={selectedRut}
          onChange={e => onPatientChange(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        >
          {uniquePatients.map(patient => (
            <option key={patient.bedId} value={patient.rut}>
              {patient.label} ({patient.rut})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={onSearch}
        disabled={!selectedRut || isLoading}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Buscar
      </button>
    </div>
  </div>
);
