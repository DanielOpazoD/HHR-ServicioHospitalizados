import React from 'react';
import { User } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { DemographicsModalProps } from './demographics/types';
import { useDemographicsLogic } from './demographics/useDemographicsLogic';
import { DemographicsHeader } from './demographics/DemographicsHeader';
import { DemographicsPersonalSection } from './demographics/DemographicsPersonalSection';
import { DemographicsOriginSection } from './demographics/DemographicsOriginSection';

export type { DemographicSubset } from './demographics/types';

export const DemographicsModal: React.FC<DemographicsModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
  bedId,
  recordDate,
  isClinicalCribPatient = false,
}) => {
  const {
    localData,
    setLocalData,
    error,
    setError,
    isProvisionalRnMode,
    displayName,
    displayRut,
    handleSave,
  } = useDemographicsLogic({
    data,
    isClinicalCribPatient,
    isOpen,
    bedId,
    recordDate,
    onSave,
    onClose,
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Datos Demográficos"
      icon={<User size={18} />}
      size="2xl"
      headerIconColor="text-blue-600"
      variant="white"
      bodyClassName="p-4 space-y-3 max-h-[86vh] overflow-y-auto"
    >
      <div className="space-y-3">
        <DemographicsHeader
          displayName={displayName}
          displayRut={displayRut}
          age={data.age}
          isClinicalCribPatient={isClinicalCribPatient}
          localData={localData}
          setLocalData={setLocalData}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemographicsPersonalSection
            localData={localData}
            setLocalData={setLocalData}
            isProvisionalRnMode={isProvisionalRnMode}
            error={error}
            setError={setError}
          />
          <DemographicsOriginSection localData={localData} setLocalData={setLocalData} />
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur pt-2 mt-1 flex justify-end items-center gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-[13px] font-bold transition-colors px-2"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all active:scale-95 active:translate-y-0 flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Guardar Cambios
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
