/**
 * AdmissionInput — Admission date/time input cell for the census table.
 *
 * Behaviour summary:
 *  - **Editable** on the patient's first observed day (`firstSeenDate`)
 *    or when `admissionDate` matches `recordDate` (legacy fallback).
 *  - **Read-only** on all subsequent days.
 *  - **Tooltip** on hover shows the admission time (e.g. "Hora de ingreso: 14:30")
 *    or "Hora de ingreso: no registrada" if the time was never set.
 *  - **Popover editor** (when editable) renders via React Portal to
 *    `document.body`, escaping the table's overflow container entirely.
 *  - Uses `cursor-default` to override the drag-and-drop grab cursor,
 *    ensuring the native tooltip is visible on hover.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { AlertCircle, Clock3, Pencil } from 'lucide-react';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';
import { BaseCellProps, DebouncedTextHandler } from './inputCellTypes';
import { PatientEmptyCell } from './PatientEmptyCell';
import { usePortalPopoverRuntime } from '@/hooks/usePortalPopoverRuntime';
import {
  resolveAdmissionDateAudit,
  resolveAdmissionDateOptions,
  resolveAdmissionDateIsEditable,
  resolveAdmissionTimePickerModel,
  resolveAdmissionTimeValue,
  resolveAdmissionDateUpdatePlan,
  resolveAdmissionTooltip,
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
  const [editorOpenedAt, setEditorOpenedAt] = useState(() => new Date());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const POPOVER_WIDTH = 180;

  const closeEditor = useCallback(() => setIsEditorOpen(false), []);

  const resolvePopoverPosition = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 220 ? rect.bottom + 4 : rect.top - 220;
    const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8);
    return { top, left };
  }, []);

  const { position: popoverPos, updatePosition } = usePortalPopoverRuntime({
    isOpen: isEditorOpen,
    anchorRef: buttonRef,
    popoverRef,
    initialPosition: { top: 0, left: 0 },
    resolvePosition: resolvePopoverPosition,
    onClose: closeEditor,
    closeOnScroll: true,
    closeOnOutsideClick: true,
    closeOnEscape: true,
  });

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
  const timePickerModel = useMemo(
    () =>
      resolveAdmissionTimePickerModel({ admissionTime: data.admissionTime, now: editorOpenedAt }),
    [data.admissionTime, editorOpenedAt]
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

    const plan = resolveAdmissionDateUpdatePlan({
      nextDate: val,
      currentAdmissionTime: data.admissionTime,
      currentDateString,
      firstSeenDate: data.firstSeenDate,
    });

    if (plan.shouldUseMultipleUpdate && onMultipleUpdate) {
      onMultipleUpdate(plan.nextPatch);
      return;
    }

    onChange('admissionDate')(plan.nextPatch.admissionDate);
  };

  const handleApplySuggestedDate = () => {
    if (!isAdmissionDateEditable || !audit.suggestedAdmissionDate) {
      return;
    }

    const plan = resolveAdmissionDateUpdatePlan({
      nextDate: audit.suggestedAdmissionDate,
      currentAdmissionTime: data.admissionTime,
      currentDateString,
      firstSeenDate: data.firstSeenDate,
    });

    if (plan.shouldUseMultipleUpdate && onMultipleUpdate) {
      onMultipleUpdate(plan.nextPatch);
      return;
    }

    onChange('admissionDate')(plan.nextPatch.admissionDate);
  };

  const handleTimePartChange =
    (part: 'hour' | 'minute') => (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextHour = part === 'hour' ? event.target.value : timePickerModel.selectedHour;
      const nextMinute = part === 'minute' ? event.target.value : timePickerModel.selectedMinute;
      onChange('admissionTime')(
        resolveAdmissionTimeValue({
          hour: nextHour,
          minute: nextMinute,
        })
      );
    };

  return (
    <td
      className="py-0.5 px-1 border-r border-slate-200 w-32"
      title={
        !showEditButton && !isCriticalEmpty
          ? resolveAdmissionTooltip(data.admissionTime)
          : undefined
      }
    >
      <div className="w-full relative">
        {showEditButton ? (
          <>
            <button
              ref={buttonRef}
              type="button"
              aria-label="Editar fecha y hora de ingreso"
              aria-haspopup="dialog"
              aria-expanded={isEditorOpen}
              onClick={e => {
                e.stopPropagation();
                if (!isEditorOpen) {
                  setEditorOpenedAt(new Date());
                  updatePosition();
                }
                setIsEditorOpen(current => !current);
              }}
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
                    : resolveAdmissionTooltip(data.admissionTime)
              }
            >
              <span className="truncate block w-full pr-4">{selectedAdmissionLabel}</span>
              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400">
                <Pencil size={9} />
              </span>
            </button>
            {isEditorOpen &&
              createPortal(
                <div
                  ref={popoverRef}
                  role="dialog"
                  aria-label="Configurar fecha y hora de ingreso"
                  className="fixed z-[10000] min-w-[11rem] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                  style={{ top: popoverPos.top, left: popoverPos.left }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    {admissionDateOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-slate-500">
                        Sin fechas disponibles
                      </div>
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
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <select
                        aria-label="Hora de ingreso - horas"
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs focus:ring-2 focus:ring-medical-500 focus:outline-none"
                        value={timePickerModel.selectedHour}
                        onChange={handleTimePartChange('hour')}
                        disabled={readOnly}
                      >
                        {timePickerModel.hourOptions.map(hour => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Hora de ingreso - minutos"
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs focus:ring-2 focus:ring-medical-500 focus:outline-none"
                        value={timePickerModel.selectedMinute}
                        onChange={handleTimePartChange('minute')}
                        disabled={readOnly}
                      >
                        {timePickerModel.minuteOptions.map(minute => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>,
                document.body
              )}
          </>
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
                : resolveAdmissionTooltip(data.admissionTime)
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
