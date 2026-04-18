import React from 'react';
import { Users, Settings, Sun, Moon, ChevronDown } from 'lucide-react';
import { useStaffContext } from '@/context/StaffContext';

interface TensSelectorProps {
  tensDayShift: string[];
  tensNightShift: string[];
  tensList: string[];
  onUpdateTens: (shift: 'day' | 'night', index: number, name: string) => void;
  className?: string;
}

const buildResolvedStaffOptions = (catalog: string[], selectedValues: string[]): string[] => {
  const uniqueOptions = new Set(catalog.filter(Boolean));

  selectedValues.filter(Boolean).forEach(value => {
    uniqueOptions.add(value);
  });

  return Array.from(uniqueOptions);
};

export const TensSelector: React.FC<TensSelectorProps> = ({
  tensDayShift,
  tensNightShift,
  tensList,
  onUpdateTens,
  className,
}) => {
  const { setShowTensManager } = useStaffContext();
  const selectClassName =
    'py-0 pl-1 pr-4 border border-slate-200 rounded text-[10px] focus:ring-1 focus:outline-none bg-transparent text-slate-700 h-[20px] w-[60px] appearance-none';
  const resolvedTensOptions = React.useMemo(
    () => buildResolvedStaffOptions(tensList, [...tensDayShift, ...tensNightShift]),
    [tensList, tensDayShift, tensNightShift]
  );

  return (
    <div
      className={`card px-2 py-1.5 flex flex-col gap-0.5 hover:border-slate-300 transition-colors w-fit !overflow-visible ${className || ''}`}
    >
      <div className="flex justify-between items-center pb-0.5 border-b border-slate-100">
        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
          <Users size={11} /> TENS
        </label>
        <button
          onClick={() => setShowTensManager(true)}
          className="text-slate-300 hover:text-medical-600 transition-colors"
        >
          <Settings size={11} />
        </button>
      </div>

      {/* Day Shift Row */}
      <div className="flex items-center gap-1 mt-0.5">
        <Sun size={10} className="text-amber-500" />
        <span className="text-[9px] font-bold text-slate-500 uppercase w-[34px]">Largo</span>
        {[0, 1, 2].map(idx => (
          <div key={`day-${idx}`} className="relative">
            <select
              className={`${selectClassName} focus:ring-teal-500 bg-teal-50/50`}
              value={tensDayShift[idx] || ''}
              onChange={e => onUpdateTens('day', idx, e.target.value)}
            >
              <option value="">--</option>
              {resolvedTensOptions.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        ))}
      </div>

      {/* Night Shift Row */}
      <div className="flex items-center gap-1">
        <Moon size={10} className="text-slate-500" />
        <span className="text-[9px] font-bold text-slate-500 uppercase w-[34px]">Noche</span>
        {[0, 1, 2].map(idx => (
          <div key={`night-${idx}`} className="relative">
            <select
              className={`${selectClassName} focus:ring-slate-500 bg-slate-100/50`}
              value={tensNightShift[idx] || ''}
              onChange={e => onUpdateTens('night', idx, e.target.value)}
            >
              <option value="">--</option>
              {resolvedTensOptions.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
