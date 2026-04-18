import React from 'react';
import { Users, Settings, Sun, Moon, ChevronDown, Clock3 } from 'lucide-react';
import { useStaffContext } from '@/context/StaffContext';
import type { ShiftIndicatorState } from '@/features/census/controllers/censusStaffHeaderController';
import {
  normalizeStaffSelectionValue,
  VACANCY_LABEL,
} from '@/services/staff/staffSelectionPresentation';

interface NurseSelectorProps {
  nursesDayShift: string[];
  nursesNightShift: string[];
  nursesList: string[];
  onUpdateNurse: (shift: 'day' | 'night', index: number, name: string) => void;
  shiftIndicators?: Record<'day' | 'night', ShiftIndicatorState>;
  onOpenShiftDetails?: (shift: 'day' | 'night') => void;
  className?: string;
}

const buildResolvedStaffOptions = (catalog: string[], selectedValues: string[]): string[] => {
  const uniqueOptions = new Set<string>([VACANCY_LABEL]);

  catalog.filter(Boolean).forEach(value => {
    uniqueOptions.add(normalizeStaffSelectionValue(value));
  });

  selectedValues.forEach(value => {
    uniqueOptions.add(normalizeStaffSelectionValue(value));
  });

  return Array.from(uniqueOptions);
};

export const NurseSelector: React.FC<NurseSelectorProps> = ({
  nursesDayShift,
  nursesNightShift,
  nursesList,
  onUpdateNurse,
  shiftIndicators,
  onOpenShiftDetails,
  className,
}) => {
  const { setShowNurseManager } = useStaffContext();
  const selectClassName =
    'py-0 pl-1 pr-4 border border-slate-200 rounded text-[10px] focus:ring-1 focus:outline-none bg-transparent text-slate-700 h-[20px] w-[75px] appearance-none';
  const resolvedNurseOptions = React.useMemo(
    () => buildResolvedStaffOptions(nursesList, [...nursesDayShift, ...nursesNightShift]),
    [nursesList, nursesDayShift, nursesNightShift]
  );

  return (
    <div
      className={`card px-2 py-1.5 flex flex-col gap-0.5 hover:border-slate-300 transition-colors w-fit !overflow-visible ${className || ''}`}
    >
      <div className="flex justify-between items-center pb-0.5 border-b border-slate-100">
        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
          <Users size={11} /> Enfermería
        </label>
        <button
          onClick={() => setShowNurseManager(true)}
          className="text-slate-300 hover:text-medical-600 transition-colors"
          aria-label="Abrir catálogo de Enfermería"
        >
          <Settings size={11} />
        </button>
      </div>

      {/* Day Shift Row */}
      <div className="flex items-center gap-1 mt-0.5">
        <Sun size={10} className="text-amber-500" />
        <span className="text-[9px] font-bold text-slate-500 uppercase w-[34px]">Largo</span>
        <div className="flex items-center gap-1">
          {shiftIndicators?.day?.hasSpecialSchedule && (
            <span
              aria-label="Horario especial en Enfermería turno Largo"
              className="h-2 w-2 rounded-full bg-amber-400"
            />
          )}
          {shiftIndicators?.day?.extraCount ? (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
              +{shiftIndicators.day.extraCount}
            </span>
          ) : null}
          {onOpenShiftDetails && (
            <button
              type="button"
              onClick={() => onOpenShiftDetails('day')}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-medical-600"
              aria-label="Configurar detalle de Enfermería turno Largo"
            >
              <Clock3 size={10} />
            </button>
          )}
        </div>
        {[0, 1].map(idx => (
          <div key={`day-${idx}`} className="relative">
            <select
              className={`${selectClassName} focus:ring-indigo-500 bg-indigo-50/50`}
              value={normalizeStaffSelectionValue(nursesDayShift[idx])}
              onChange={e => onUpdateNurse('day', idx, e.target.value)}
            >
              {resolvedNurseOptions.map(n => (
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
        <div className="flex items-center gap-1">
          {shiftIndicators?.night?.hasSpecialSchedule && (
            <span
              aria-label="Horario especial en Enfermería turno Noche"
              className="h-2 w-2 rounded-full bg-amber-400"
            />
          )}
          {shiftIndicators?.night?.extraCount ? (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
              +{shiftIndicators.night.extraCount}
            </span>
          ) : null}
          {onOpenShiftDetails && (
            <button
              type="button"
              onClick={() => onOpenShiftDetails('night')}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-medical-600"
              aria-label="Configurar detalle de Enfermería turno Noche"
            >
              <Clock3 size={10} />
            </button>
          )}
        </div>
        {[0, 1].map(idx => (
          <div key={`night-${idx}`} className="relative">
            <select
              className={`${selectClassName} focus:ring-slate-500 bg-slate-100/50`}
              value={normalizeStaffSelectionValue(nursesNightShift[idx])}
              onChange={e => onUpdateNurse('night', idx, e.target.value)}
            >
              {resolvedNurseOptions.map(n => (
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
