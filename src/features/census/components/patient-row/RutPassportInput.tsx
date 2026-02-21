import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { DebouncedInput } from '@/components/ui/DebouncedInput';
import { isValidRut } from '@/utils/rutUtils';
import { PatientEmptyCell } from './PatientEmptyCell';

interface RutPassportInputProps {
  value: string;
  documentType: string;
  isSubRow?: boolean;
  isClinicalCribPatient?: boolean;
  isEmpty?: boolean;
  hasName?: boolean;
  patientName?: string;
  currentDateString?: string;
  admissionDate?: string;
  onChange: (value: string) => void;
  onToggleType?: () => void;
  readOnly?: boolean;
  hasError?: boolean;
}

export const RutPassportInput: React.FC<RutPassportInputProps> = ({
  value,
  documentType,
  isSubRow = false,
  isClinicalCribPatient = false,
  isEmpty = false,
  hasName = false,
  onChange,
  onToggleType,
  readOnly = false,
  hasError = false,
}) => {
  const [isRutManuallyUnlocked, setIsRutManuallyUnlocked] = useState(false);

  const isRnClinicalCribRutMode = isClinicalCribPatient && documentType === 'RUT';
  const canKeepUnlocked = isRnClinicalCribRutMode && isRutManuallyUnlocked && value.trim() !== '-';

  const isAutoLockedByRnPlaceholder =
    isRnClinicalCribRutMode && !canKeepUnlocked && (value.trim() === '-' || value.trim() === '');

  useEffect(() => {
    if (!readOnly && isRnClinicalCribRutMode && !canKeepUnlocked && value.trim() === '') {
      onChange('-');
    }
  }, [canKeepUnlocked, isRnClinicalCribRutMode, onChange, readOnly, value]);

  // Validation logic for visual feedback
  const isRutValid = documentType === 'RUT' && !!value && value !== '-' && isValidRut(value);

  // Show empty state for main row when no patient
  if (isEmpty && !isSubRow) {
    return (
      <PatientEmptyCell tdClassName="p-1 border-r border-slate-200 w-32" contentClassName="p-1" />
    );
  }

  return (
    <td className="p-1 border-r border-slate-200 w-32 relative group/rut">
      <div className="relative">
        <DebouncedInput
          type="text"
          className={clsx(
            'w-full p-0.5 h-7 border rounded focus:ring-2 focus:outline-none text-xs pr-1 group-hover/rut:pr-6 transition-all',
            isSubRow && 'h-6',
            isAutoLockedByRnPlaceholder && 'bg-slate-100 text-slate-500 cursor-not-allowed',
            documentType === 'Pasaporte'
              ? hasError && value !== '0' && value !== ''
                ? 'border-red-400 bg-red-50/50'
                : 'border-slate-300 bg-white'
              : hasError && value !== '0' && value !== ''
                ? 'border-red-400 bg-red-50/50'
                : isRutValid
                  ? 'border-emerald-500 bg-emerald-50/30 font-bold text-emerald-700'
                  : 'border-slate-300 bg-white',
            hasError && value !== '0' && value !== ''
              ? 'focus:ring-red-200 focus:border-red-500'
              : isRutValid
                ? 'focus:ring-emerald-200 focus:border-emerald-500'
                : 'focus:ring-medical-500 focus:border-medical-500'
          )}
          placeholder={
            isAutoLockedByRnPlaceholder
              ? ''
              : documentType === 'Pasaporte'
                ? 'N° Pasaporte'
                : hasName
                  ? ''
                  : '12.345.678-9'
          }
          value={isAutoLockedByRnPlaceholder ? '' : value || ''}
          disabled={readOnly || isAutoLockedByRnPlaceholder}
          onChange={val => {
            onChange(val);
          }}
        />

        {isAutoLockedByRnPlaceholder && !readOnly && (
          <button
            type="button"
            onClick={() => {
              setIsRutManuallyUnlocked(true);
              onChange('');
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-medical-600 opacity-0 group-hover/rut:opacity-100 transition-opacity"
            title="Editar RUT RN"
            aria-label="Editar RUT RN"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}

        {/* Passport indicator - only shows when in passport mode */}
        {documentType === 'Pasaporte' && !isClinicalCribPatient && (
          <span
            className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-bold cursor-pointer"
            title="Modo Pasaporte - Click para cambiar a RUT"
            onClick={!isSubRow && onToggleType && !readOnly ? onToggleType : undefined}
          >
            PAS
          </span>
        )}

        {/* Discrete toggle on hover - only for RUT mode */}
        {documentType !== 'Pasaporte' &&
          !isSubRow &&
          onToggleType &&
          !readOnly &&
          !isClinicalCribPatient &&
          !isAutoLockedByRnPlaceholder && (
            <button
              onClick={onToggleType}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-amber-500 opacity-0 group-hover/rut:opacity-100 transition-opacity"
              title="Cambiar a Pasaporte"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                <circle cx="12" cy="10" r="3" />
                <path d="M7 17a5 5 0 0 1 10 0" />
              </svg>
            </button>
          )}
      </div>
    </td>
  );
};
