import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
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
  contentClassName?: string;
  contentSuffix?: React.ReactNode;
  triggerClassName?: string;
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
  contentClassName,
  contentSuffix,
  triggerClassName,
  readOnly = false,
  onChange,
  onMultipleUpdate,
}) => (
  <ClinicalInitialBlockEditor
    data={data}
    disabled={readOnly}
    triggerAriaLabel={`Editar ${label}`}
    triggerTitle={`Editar ${label}`}
    triggerClassName={triggerClassName || clinicalBlockButtonClassName}
    triggerContent={
      <>
        <span
          className={clsx(
            'block truncate',
            contentClassName || (value ? 'text-slate-800' : 'text-slate-400 italic')
          )}
        >
          {value || placeholder}
        </span>
        {contentSuffix}
      </>
    }
    onChange={onChange}
    onMultipleUpdate={onMultipleUpdate}
  />
);

const getClinicalStatusButtonClassName = (status?: string): string =>
  clsx(
    'inline-flex h-7 w-full cursor-pointer items-center justify-between gap-0.5 rounded-md border px-1.5 text-left text-[10px] font-bold uppercase tracking-tight shadow-sm transition-all duration-200',
    'hover:border-medical-300 focus:outline-none focus:ring-2',
    'disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500 disabled:hover:border-slate-200',
    status === 'Grave'
      ? 'text-red-700 bg-red-50 border-red-200/80 focus:ring-medical-500/20 focus:border-medical-500'
      : status === 'De cuidado'
        ? 'text-amber-700 bg-amber-50 border-amber-200/80 focus:ring-medical-500/20 focus:border-medical-500'
        : status
          ? 'text-emerald-700 bg-emerald-50/60 border-emerald-200/80 font-semibold focus:ring-medical-500/20 focus:border-medical-500'
          : 'border-slate-200 text-slate-400 focus:ring-medical-500/20 focus:border-medical-500'
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
        <td className="py-0.5 px-1 border-r border-slate-200 w-28 relative">
          <ClinicalInitialBlockCellButton
            data={data}
            label="estado clínico"
            value={data.status || ''}
            placeholder="-- Est --"
            contentClassName={data.status ? 'min-w-0 flex-1 text-current' : 'text-slate-400 italic'}
            contentSuffix={<ChevronDown size={12} className="shrink-0 text-current" />}
            triggerClassName={getClinicalStatusButtonClassName(data.status)}
            readOnly={readOnly}
            onChange={onChange}
            onMultipleUpdate={onMultipleUpdate}
          />
        </td>
      )}
    </>
  );
};
