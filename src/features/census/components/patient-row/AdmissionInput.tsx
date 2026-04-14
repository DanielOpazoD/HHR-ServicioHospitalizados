/**
 * AdmissionInput - Admission date/time input (critical field)
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, Clock3, Pencil } from 'lucide-react';
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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
      admissionDate: data.admissionDate,
      hasPatient: Boolean(data.patientName?.trim()),
      isNewAdmission,
    });
  const admissionDateOptions = React.useMemo(
    () => resolveAdmissionDateOptions(currentDateString, data.admissionDate),
    [currentDateString, data.admissionDate]
  );
  const isAdmissionDateSuspicious = isNewAdmission && audit.isSuspicious && !isCriticalEmpty;
  const showEditButton = !readOnly && isAdmissionDateEditable;
  const selectedAdmissionLabel =
    admissionDateOptions.find(option => option.value === (data.admissionDate || ''))?.label || '--';

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
    const shouldAnchorFirstSeenDate = !data.firstSeenDate;
    const nextPatch = {
      admissionDate: resolution.admissionDate,
      ...(resolution.shouldPatchMultiple ? { admissionTime: resolution.admissionTime } : {}),
      ...(shouldAnchorFirstSeenDate ? { firstSeenDate: currentDateString } : {}),
    };

    if ((resolution.shouldPatchMultiple || shouldAnchorFirstSeenDate) && onMultipleUpdate) {
      onMultipleUpdate(nextPatch);
      return;
    }

    onChange('admissionDate')(resolution.admissionDate);
  };

  const handleApplySuggestedDate = () => {
    if (!isAdmissionDateEditable || !audit.suggestedAdmissionDate) {
      return;
    }

    const resolution = resolveAdmissionDateChange({
      nextDate: audit.suggestedAdmissionDate,
      currentAdmissionTime: data.admissionTime,
    });
    const shouldAnchorFirstSeenDate = !data.firstSeenDate;
    const nextPatch = {
      admissionDate: resolution.admissionDate,
      ...(resolution.shouldPatchMultiple ? { admissionTime: resolution.admissionTime } : {}),
      ...(shouldAnchorFirstSeenDate ? { firstSeenDate: currentDateString } : {}),
    };

    if ((resolution.shouldPatchMultiple || shouldAnchorFirstSeenDate) && onMultipleUpdate) {
      onMultipleUpdate(nextPatch);
      return;
    }

    onChange('admissionDate')(resolution.admissionDate);
  };

  return (
    <td
      className="py-0.5 px-1 border-r border-slate-200 w-32"
      title={
        !showEditButton && !isCriticalEmpty
          ? data.admissionTime
            ? `Hora de ingreso: ${data.admissionTime}`
            : 'Hora de ingreso: no registrada'
          : undefined
      }
    >
      <div
        className="w-full relative"
        onFocusCapture={() => {
          if (showEditButton) {
            setIsEditorOpen(true);
          }
        }}
        onBlur={event => {
          const next = event.relatedTarget as HTMLElement | null;
          if (next && event.currentTarget.contains(next)) return;
          setIsEditorOpen(false);
        }}
      >
        {showEditButton ? (
          <div className="relative">
            <button
              type="button"
              aria-label="Editar fecha y hora de ingreso"
              aria-haspopup="dialog"
              aria-expanded={isEditorOpen}
              onClick={() => setIsEditorOpen(current => !current)}
              className={clsx(
                'w-full h-7 border rounded text-[11px] leading-none flex items-center bg-white px-1.5 text-left relative cursor-default',
                isCriticalEmpty
                  ? 'border-red-400 border-2 bg-red-50'
                  : isAdmissionDateSuspicious
                    ? 'border-amber-400 border-2 bg-amber-50'
                    : 'border-slate-300',
                isSubRow && 'h-6'
              )}
              title={
                isCriticalEmpty
                  ? 'Campo crítico requerido para entrega'
                  : isAdmissionDateSuspicious
                    ? `${audit.message || 'Fecha sospechosa'}${audit.suggestedAdmissionDate ? ` Sugerida: ${audit.suggestedAdmissionDate}` : ''}`
                    : data.admissionTime
                      ? `Hora de ingreso: ${data.admissionTime}`
                      : 'Hora de ingreso: no registrada'
              }
            >
              <span className="truncate block w-full pr-4">{selectedAdmissionLabel}</span>
              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400">
                <Pencil size={9} />
              </span>
            </button>
            {isEditorOpen && (
              <div
                role="dialog"
                aria-label="Configurar fecha y hora de ingreso"
                className="absolute left-0 top-full mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-[100]"
              >
                <div className="space-y-1">
                  {admissionDateOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Sin fechas disponibles</div>
                  ) : (
                    admissionDateOptions.map(option => {
                      const isSelected = option.value === (data.admissionDate || '');

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleDateChange(option.value)}
                          className={clsx(
                            'w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'text-slate-800 hover:bg-slate-100'
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <label className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    <Clock3 size={10} />
                    Hora de ingreso
                  </label>
                  <DebouncedInput
                    type="time"
                    step={300}
                    className="mt-1 w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs focus:ring-2 focus:ring-medical-500 focus:outline-none"
                    value={data.admissionTime || ''}
                    onChange={onChange('admissionTime')}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={clsx(
              'w-full h-7 border rounded text-[11px] leading-none flex items-center bg-white px-1.5 cursor-default',
              isCriticalEmpty
                ? 'border-red-400 border-2 bg-red-50'
                : isAdmissionDateSuspicious
                  ? 'border-amber-400 border-2 bg-amber-50'
                  : 'border-slate-300',
              isSubRow && 'h-6'
            )}
            title={
              isCriticalEmpty
                ? 'Campo crítico requerido para entrega'
                : data.admissionTime
                  ? `Hora de ingreso: ${data.admissionTime}`
                  : 'Hora de ingreso: no registrada'
            }
          >
            <span className="truncate">{selectedAdmissionLabel}</span>
          </div>
        )}
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
      </div>
    </td>
  );
};
