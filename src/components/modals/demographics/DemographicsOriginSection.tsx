import React from 'react';
import clsx from 'clsx';
import { ADMISSION_ORIGIN_OPTIONS } from '@/constants';
import { LocalDemographicsState, AdmissionOrigin, Origin, BiologicalSex } from './types';

interface DemographicsOriginSectionProps {
  localData: LocalDemographicsState;
  setLocalData: React.Dispatch<React.SetStateAction<LocalDemographicsState>>;
}

export const DemographicsOriginSection: React.FC<DemographicsOriginSectionProps> = ({
  localData,
  setLocalData,
}) => {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-[11px] font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Origen y Estadía
      </h4>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">
            Origen del Ingreso
          </label>
          <div className="space-y-1.5">
            <div className="relative">
              <select
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-transparent rounded-lg text-[13px] text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer shadow-sm transition-all"
                value={localData.admissionOrigin}
                onChange={e =>
                  setLocalData({
                    ...localData,
                    admissionOrigin: e.target.value as AdmissionOrigin,
                  })
                }
              >
                <option value="">-- Seleccionar --</option>
                {ADMISSION_ORIGIN_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {localData.admissionOrigin === 'Otro' && (
              <input
                type="text"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner"
                placeholder="Especifique origen..."
                value={localData.admissionOriginDetails}
                onChange={e =>
                  setLocalData({ ...localData, admissionOriginDetails: e.target.value })
                }
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">
            Condición
          </label>
          <div className="relative">
            <select
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-transparent rounded-lg text-[13px] text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer shadow-sm transition-all"
              value={localData.origin}
              onChange={e => setLocalData({ ...localData, origin: e.target.value as Origin })}
            >
              <option value="Residente">Residente</option>
              <option value="Turista Nacional">Turista Nacional</option>
              <option value="Turista Extranjero">Turista Extranjero</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <label
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all cursor-pointer select-none',
              localData.isRapanui
                ? 'bg-amber-50 border-amber-200 shadow-sm'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            )}
          >
            <div
              className={clsx(
                'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                localData.isRapanui ? 'bg-amber-500 border-amber-600' : 'bg-white border-slate-300'
              )}
            >
              {localData.isRapanui && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 text-white"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <input
                type="checkbox"
                className="sr-only"
                checked={localData.isRapanui}
                onChange={e => setLocalData({ ...localData, isRapanui: e.target.checked })}
              />
            </div>
            <div>
              <span
                className={clsx(
                  'text-[13px] font-bold block',
                  localData.isRapanui ? 'text-amber-900' : 'text-slate-700'
                )}
              >
                Pertenencia Rapanui
              </span>
            </div>
          </label>
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">
            Sexo Biológico
          </label>
          <div className="flex gap-2">
            {(['Masculino', 'Femenino', 'Indeterminado'] as const).map(sex => (
              <label
                key={sex}
                className={clsx(
                  'cursor-pointer px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border select-none flex-1 text-center',
                  localData.biologicalSex === sex
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <input
                  type="radio"
                  name="biologicalSex"
                  className="sr-only"
                  checked={localData.biologicalSex === sex}
                  onChange={() =>
                    setLocalData({ ...localData, biologicalSex: sex as BiologicalSex })
                  }
                />
                {sex === 'Masculino' ? 'M' : sex === 'Femenino' ? 'F' : '?'}
                <span className="hidden sm:inline sm:ml-1 text-[9px] font-normal opacity-80">
                  {sex === 'Indeterminado' ? '' : sex.slice(1)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
