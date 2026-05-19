import React from 'react';
import clsx from 'clsx';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';
import type {
  DebouncedTextHandler,
  PatientInputChangeHandlers,
} from '@/features/census/components/patient-row/inputCellTypes';
import { ClinicalInitialBlockEditor } from './ClinicalInitialBlockEditor';

interface ClinicalInitialBlockCellsProps {
  data: PatientData;
  readOnly?: boolean;
  accessProfile?: CensusAccessProfile;
  onChange: DebouncedTextHandler;
  onMultipleUpdate?: PatientInputChangeHandlers['multiple'];
}

interface ClinicalInitialBlockCellButtonProps {
  data: PatientData;
  label: string;
  value: string;
  placeholder: string;
  readOnly?: boolean;
  onChange: DebouncedTextHandler;
  onMultipleUpdate?: PatientInputChangeHandlers['multiple'];
}

const clinicalBlockButtonClassName = clsx(
  'h-7 w-full rounded border border-slate-200 bg-white px-2 text-left text-[13px] transition-colors',
  'hover:border-medical-300 hover:bg-medical-50/40 focus:outline-none focus:ring-2 focus:ring-medical-500/20',
  'disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500 disabled:hover:border-slate-200'
);

const ClinicalInitialBlockCellButton: React.FC<ClinicalInitialBlockCellButtonProps> = ({
  data,
  label,
  value,
  placeholder,
  readOnly = false,
  onChange,
  onMultipleUpdate,
}) => (
  <ClinicalInitialBlockEditor
    data={data}
    disabled={readOnly}
    triggerAriaLabel={`Editar ${label}`}
    triggerTitle={`Editar ${label}`}
    triggerClassName={clinicalBlockButtonClassName}
    triggerContent={
      <span className={clsx('block truncate', value ? 'text-slate-800' : 'text-slate-400 italic')}>
        {value || placeholder}
      </span>
    }
    onChange={onChange}
    onMultipleUpdate={onMultipleUpdate}
  />
);

export const ClinicalInitialBlockCells: React.FC<ClinicalInitialBlockCellsProps> = ({
  data,
  readOnly = false,
  accessProfile = 'default',
  onChange,
  onMultipleUpdate,
}) => {
  const showStatus = !isSpecialistCensusAccessProfile(accessProfile);

  return (
    <>
      <td className="py-0.5 px-1 border-r border-slate-200 min-w-[160px] relative">
        <ClinicalInitialBlockCellButton
          data={data}
          label="diagnóstico"
          value={data.pathology || ''}
          placeholder="Diagnóstico"
          readOnly={readOnly}
          onChange={onChange}
          onMultipleUpdate={onMultipleUpdate}
        />
      </td>
      <td className="py-0.5 px-1 border-r border-slate-200 w-28 relative">
        <ClinicalInitialBlockCellButton
          data={data}
          label="especialidad"
          value={data.specialty || ''}
          placeholder="-- Esp --"
          readOnly={readOnly}
          onChange={onChange}
          onMultipleUpdate={onMultipleUpdate}
        />
      </td>
      {showStatus && (
        <td className="py-0.5 px-1 border-r border-slate-200 w-24 relative">
          <ClinicalInitialBlockCellButton
            data={data}
            label="estado clínico"
            value={data.status || ''}
            placeholder="-- Est --"
            readOnly={readOnly}
            onChange={onChange}
            onMultipleUpdate={onMultipleUpdate}
          />
        </td>
      )}
    </>
  );
};
