import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { MedicalHandoffEntry, PatientData } from '@/domain/handoff/patientContracts';
import { Info, Plus, Trash2 } from 'lucide-react';
import { DebouncedTextarea } from '@/components/ui/DebouncedTextarea';
import {
  resolveMedicalEntryMetadataViewModel,
  resolveMedicalHandoffValidityViewModel,
} from '@/domain/handoff/patientView';

interface MedicalHandoffObservationEntryProps {
  entry: MedicalHandoffEntry;
  patient: PatientData;
  reportDate: string;
  index: number;
  entriesCount: number;
  isFieldReadOnly: boolean;
  specialtyOptions: string[];
  canEditSpecialty?: boolean;
  onEntryNoteChange: (entryId: string, value: string) => void;
  onEntrySpecialtyChange?: (entryId: string, specialty: string) => void;
  onAddEntry?: () => void;
  onDeleteEntry?: (entryId: string) => void;
  onRefreshAsCurrent?: (entryId: string) => void;
}

const MedicalEntryInfoTooltip: React.FC<{ detailLines: string[] }> = ({ detailLines }) => {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 260;
    const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    const left = Math.max(12, Math.min(centeredLeft, window.innerWidth - tooltipWidth - 12));
    const top = rect.bottom + 8;
    setPosition({ top, left });
  }, []);

  const openTooltip = React.useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const closeTooltip = React.useCallback(() => setIsOpen(false), []);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleWindowChange = () => updatePosition();
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('resize', handleWindowChange);
    return () => {
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
        aria-label="Ver detalle de nota actual"
        title="Ver detalle de nota actual"
      >
        <Info size={10} />
      </button>
      {isOpen &&
        position &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1000] w-[260px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] leading-tight text-slate-600 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            {detailLines.map(line => (
              <div key={line}>{line}</div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export const MedicalHandoffObservationEntry: React.FC<MedicalHandoffObservationEntryProps> = ({
  entry,
  patient,
  reportDate,
  index,
  entriesCount,
  isFieldReadOnly,
  specialtyOptions,
  canEditSpecialty = true,
  onEntryNoteChange,
  onEntrySpecialtyChange,
  onAddEntry,
  onDeleteEntry,
  onRefreshAsCurrent,
}) => {
  const validity = resolveMedicalHandoffValidityViewModel(entry, reportDate);
  const metadata = resolveMedicalEntryMetadataViewModel(entry, reportDate);
  const specialtyLabel = entry.specialty || 'Especialidad sin definir';
  const specialtyWidth = `${Math.max(String(specialtyLabel).length + 4, 14)}ch`;
  const inlineStatusLabel = validity.isActiveToday ? '' : validity.statusLabel;
  const inlinePrintSummary = [specialtyLabel, inlineStatusLabel, metadata.printLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={clsx(
        'space-y-1',
        index > 0 && 'border-t border-slate-100 pt-2 print:border-t-0 print:pt-1'
      )}
    >
      <div className="hidden print:block text-[7px] leading-tight text-slate-500">
        {inlinePrintSummary}
      </div>
      {isFieldReadOnly ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-tight text-slate-500 print:hidden">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
            {specialtyLabel}
          </span>
          {inlineStatusLabel && (
            <span
              className={clsx(
                'font-medium',
                validity.isMuted ? 'text-slate-400' : 'text-emerald-700'
              )}
            >
              {inlineStatusLabel}
            </span>
          )}
          {metadata.primaryLabel && <span>{metadata.primaryLabel}</span>}
          {metadata.showInfoButton && (
            <MedicalEntryInfoTooltip detailLines={metadata.detailLines} />
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-tight text-slate-500 print:hidden">
          {canEditSpecialty && onEntrySpecialtyChange ? (
            <>
              <label className="sr-only" htmlFor={`medical-specialty-${patient.bedId}-${entry.id}`}>
                Especialidad {index + 1}
              </label>
              <select
                id={`medical-specialty-${patient.bedId}-${entry.id}`}
                aria-label={`Especialidad ${index + 1}`}
                value={entry.specialty}
                onChange={event => onEntrySpecialtyChange(entry.id, event.target.value)}
                className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                style={{ width: specialtyWidth }}
              >
                {specialtyOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
              {specialtyLabel}
            </span>
          )}
          {inlineStatusLabel && (
            <span
              className={clsx(
                'font-medium',
                validity.isMuted ? 'text-slate-400' : 'text-emerald-700'
              )}
            >
              {inlineStatusLabel}
            </span>
          )}
          {metadata.primaryLabel && <span>{metadata.primaryLabel}</span>}
          {metadata.showInfoButton && (
            <MedicalEntryInfoTooltip detailLines={metadata.detailLines} />
          )}
          <div className="ml-auto flex items-center gap-1">
            {onRefreshAsCurrent && (
              <button
                type="button"
                onClick={() => onRefreshAsCurrent(entry.id)}
                disabled={!validity.canRefreshAsCurrent}
                className={clsx(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                  !validity.canRefreshAsCurrent
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : validity.isActiveToday
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                )}
                aria-label="Actualizar como nota actual"
                title="Actualizar como nota actual"
              >
                Actualizar como nota actual
              </button>
            )}
            {!isFieldReadOnly && onAddEntry && index === entriesCount - 1 && (
              <button
                type="button"
                onClick={onAddEntry}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Agregar otra especialidad"
                title="Agregar otra especialidad"
              >
                <Plus size={11} />
              </button>
            )}
            {onDeleteEntry && (
              <button
                type="button"
                onClick={() => onDeleteEntry(entry.id)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Eliminar entrega ${index + 1}`}
                title="Eliminar entrega de turno"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      {isFieldReadOnly ? (
        <div className="whitespace-pre-wrap break-words text-[13px] leading-snug text-slate-800 print:text-[8px] print:leading-tight">
          {entry.note || <span className="text-slate-400 italic">Sin entrega registrada</span>}
        </div>
      ) : (
        <>
          <div className="print:hidden">
            <DebouncedTextarea
              value={entry.note}
              onChangeValue={value => onEntryNoteChange(entry.id, value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-[13px] leading-snug focus:ring-2 focus:ring-medical-500 focus:outline-none"
              minRows={1}
              debounceMs={1500}
            />
          </div>
          <div className="hidden print:block whitespace-pre-wrap break-words text-slate-800 print:text-[8px] print:leading-tight">
            {entry.note}
          </div>
        </>
      )}
    </div>
  );
};
