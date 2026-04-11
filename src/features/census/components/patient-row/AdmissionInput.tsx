/**
 * AdmissionInput - Admission date/time input (critical field)
 */

import React, { useId, useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, Pencil } from 'lucide-react';
import { DebouncedInput } from '@/components/ui/DebouncedInput';
import type { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import { BaseCellProps, DebouncedTextHandler } from './inputCellTypes';
import { PatientEmptyCell } from './PatientEmptyCell';
import {
  resolveAdmissionDateChange,
  resolveAdmissionDateAudit,
  resolveAdmissionDateOptions,
  resolveAdmissionDateIsEditable,
  resolveIsCriticalAdmissionEmpty,
} from '@/features/census/controllers/admissionInputController';

interface AdmissionInputProps extends BaseCellProps {
  currentDateString: string;
  isNewAdmission?: boolean;
  onChange: DebouncedTextHandler;
  onMultipleUpdate?: (fields: Partial<PatientData>) => void;
}

export const AdmissionInput: React.FC<AdmissionInputProps> = ({
  data,
  isSubRow = false,
  isEmpty = false,
  readOnly = false,
  currentDateString,
  isNewAdmission = false,
  onChange,
  onMultipleUpdate,
}) => {
  const [showTime, setShowTime] = useState(false);
  const admissionDateInputId = useId();
  const isCriticalEmpty = resolveIsCriticalAdmissionEmpty(data.patientName, data.admissionDate);
  const audit = resolveAdmissionDateAudit({
    recordDate: currentDateString,
    admissionDate: data.admissionDate,
    admissionTime: data.admissionTime,
    firstSeenDate: data.firstSeenDate,
  });
  const isAdmissionDateEditable =
    !readOnly &&
    resolveAdmissionDateIsEditable({
      recordDate: currentDateString,
      firstSeenDate: data.firstSeenDate,
      hasPatient: Boolean(data.patientName?.trim()),
      isNewAdmission,
    });
  const admissionDateOptions = React.useMemo(
    () => resolveAdmissionDateOptions(currentDateString, data.admissionDate),
    [currentDateString, data.admissionDate]
  );
  const isAdmissionDateSuspicious = isNewAdmission && audit.isSuspicious && !isCriticalEmpty;

  if (isEmpty && !isSubRow) {
    return <PatientEmptyCell tdClassName="py-0.5 px-1 border-r border-slate-200 w-32" />;
  }

  const handleDateChange = (val: string) => {
    if (!isAdmissionDateEditable) {
      return;
    }

    const resolution = resolveAdmissionDateChange({
      nextDate: val,
      currentAdmissionTime: data.admissionTime,
    });

    if (resolution.shouldPatchMultiple && onMultipleUpdate) {
      onMultipleUpdate({
        admissionDate: resolution.admissionDate,
        admissionTime: resolution.admissionTime,
      });
      return;
    }

    onChange('admissionDate')(resolution.admissionDate);
  };

  const handleOpenDateEditor = () => {
    if (readOnly || !isAdmissionDateEditable) {
      return;
    }

    const dateInput = document.getElementById(admissionDateInputId) as HTMLSelectElement | null;
    if (!dateInput) {
      return;
    }

    dateInput.focus();
  };

  const handleApplySuggestedDate = () => {
    if (!isAdmissionDateEditable || !audit.suggestedAdmissionDate) {
      return;
    }

    const resolution = resolveAdmissionDateChange({
      nextDate: audit.suggestedAdmissionDate,
      currentAdmissionTime: data.admissionTime,
    });

    if (resolution.shouldPatchMultiple && onMultipleUpdate) {
      onMultipleUpdate({
        admissionDate: resolution.admissionDate,
        admissionTime: resolution.admissionTime,
      });
      return;
    }

    onChange('admissionDate')(resolution.admissionDate);
  };

  return (
    <td className="py-0.5 px-1 border-r border-slate-200 w-32">
      <div
        className="w-full relative"
        onFocusCapture={() => setShowTime(true)}
        onBlur={event => {
          const next = event.relatedTarget as HTMLElement | null;
          if (next && event.currentTarget.contains(next)) return;
          setShowTime(false);
        }}
      >
        <select
          id={admissionDateInputId}
          data-admission-date-input="true"
          className={clsx(
            'w-full p-0.5 h-7 border rounded focus:ring-2 focus:outline-none text-xs pr-4',
            isCriticalEmpty
              ? 'border-red-400 border-2 bg-red-50 focus:ring-red-200 focus:border-red-500'
              : isAdmissionDateSuspicious
                ? 'border-amber-400 border-2 bg-amber-50 focus:ring-amber-200 focus:border-amber-500'
                : 'border-slate-300 focus:ring-medical-500',
            isSubRow && 'h-6'
          )}
          value={data.admissionDate || ''}
          onChange={event => {
            handleDateChange(event.target.value);
            setShowTime(true);
          }}
          disabled={readOnly || !isAdmissionDateEditable}
          title={
            isCriticalEmpty
              ? 'Campo crítico requerido para entrega'
              : !isAdmissionDateEditable
                ? 'Solo editable durante el día del censo en que apareció el paciente'
                : isAdmissionDateSuspicious
                  ? `${audit.message || 'Fecha sospechosa'} Sugerida: ${audit.suggestedAdmissionDate}`
                  : undefined
          }
        >
          <option value="">--</option>
          {admissionDateOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleOpenDateEditor}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-medical-600 transition-colors disabled:opacity-40"
          title="Editar fecha de ingreso"
          aria-label="Editar fecha de ingreso"
          disabled={readOnly || !isAdmissionDateEditable}
        >
          <Pencil size={11} />
        </button>
        {isAdmissionDateSuspicious && isAdmissionDateEditable && (
          <button
            type="button"
            onClick={handleApplySuggestedDate}
            className={clsx(
              'absolute -right-1 -top-1 w-3 h-3 rounded-full flex items-center justify-center z-20 shadow-sm',
              readOnly ? 'bg-amber-300' : 'bg-amber-500 hover:bg-amber-600'
            )}
            title={`${audit.message || 'Fecha sugerida'} ${audit.suggestedAdmissionDate ? `Aplicar ${audit.suggestedAdmissionDate}` : ''}`.trim()}
            aria-label="Corregir fecha de ingreso sugerida"
            disabled={readOnly || !isAdmissionDateEditable || !audit.suggestedAdmissionDate}
          >
            <AlertCircle size={8} className="text-white" />
          </button>
        )}
        {/* Critical field warning icon */}
        {isCriticalEmpty && (
          <div
            className="absolute -right-1 -top-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center z-20"
            title="Campo crítico vacío"
          >
            <AlertCircle size={8} className="text-white" />
          </div>
        )}
        {/* Time input popup */}
        {showTime && (
          <DebouncedInput
            type="time"
            step={300}
            className="w-24 p-0.5 h-7 border border-slate-300 rounded focus:ring-2 focus:ring-medical-500 focus:outline-none text-xs absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-white shadow-lg z-30"
            value={data.admissionTime || ''}
            onChange={onChange('admissionTime')}
            disabled={readOnly}
          />
        )}
      </div>
    </td>
  );
};
