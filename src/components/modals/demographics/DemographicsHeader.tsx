import React from 'react';
import clsx from 'clsx';
import { LocalDemographicsState } from './types';

interface DemographicsHeaderProps {
  displayName: string;
  displayRut: string;
  age?: string;
  isClinicalCribPatient: boolean;
  localData: LocalDemographicsState;
  setLocalData: React.Dispatch<React.SetStateAction<LocalDemographicsState>>;
}

export const DemographicsHeader: React.FC<DemographicsHeaderProps> = ({
  displayName,
  displayRut,
  age,
  isClinicalCribPatient,
  localData,
  setLocalData,
}) => {
  return (
    <>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100/80">
        <div>
          <p className="text-base font-display font-black text-slate-900 leading-tight tracking-tight">
            {displayName}
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            {displayRut}
          </p>
        </div>
        {age && (
          <div className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-blue-100">
            {age}
          </div>
        )}
      </div>

      {isClinicalCribPatient && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={clsx(
              'px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
              localData.identityStatus === 'provisional'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
            onClick={() =>
              setLocalData(prev => ({
                ...prev,
                identityStatus: 'provisional',
                documentType: 'RUT',
                rut: '',
              }))
            }
          >
            RN provisional
          </button>
          <button
            type="button"
            className={clsx(
              'px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
              localData.identityStatus === 'official'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
            onClick={() =>
              setLocalData(prev => ({
                ...prev,
                identityStatus: 'official',
              }))
            }
          >
            Identidad oficial
          </button>
        </div>
      )}
    </>
  );
};
