/**
 * @module LabViewerControls
 * @description Patient selector dropdown, manual RUT input, and search button for the lab viewer.
 */

import React, { useCallback, useState } from 'react';
import { Loader2, Search, UserSearch } from 'lucide-react';
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
}) => {
  const [manualRut, setManualRut] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  const handleManualSearch = useCallback(() => {
    const trimmed = manualRut.trim();
    if (!trimmed) return;
    onPatientChange(trimmed);
    // Trigger search after setting the RUT
    setTimeout(() => onSearch(), 50);
  }, [manualRut, onPatientChange, onSearch]);

  const handleManualKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleManualSearch();
      }
    },
    [handleManualSearch]
  );

  return (
    <div className="mb-4 space-y-2">
      {/* Bed patient selector */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2">
          <label className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Paciente
          </label>
          <select
            value={selectedRut}
            onChange={e => {
              setIsManualMode(false);
              onPatientChange(e.target.value);
            }}
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

      {/* Manual RUT search */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsManualMode(prev => !prev)}
          className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          <UserSearch size={12} />
          {isManualMode ? 'Ocultar búsqueda manual' : 'Buscar por RUT externo'}
        </button>
      </div>

      {isManualMode && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <UserSearch
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={manualRut}
              onChange={e => setManualRut(e.target.value)}
              onKeyDown={handleManualKeyDown}
              placeholder="Ej: 12.345.678-9"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>
          <button
            onClick={handleManualSearch}
            disabled={!manualRut.trim() || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar RUT
          </button>
        </div>
      )}
    </div>
  );
};
