import React from 'react';
import clsx from 'clsx';
import type { MedicalHandoffEntry, PatientData } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import { DebouncedTextarea } from '@/components/ui/DebouncedTextarea';
import { resolveMedicalEntryInlineMeta } from '@/features/handoff/controllers';

interface MedicalHandoffObservationEntryProps {
  entry: MedicalHandoffEntry;
  patient: PatientData;
  index: number;
  entriesCount: number;
  isFieldReadOnly: boolean;
  specialtyOptions: string[];
  onEntryNoteChange: (entryId: string, value: string) => void;
  onEntrySpecialtyChange: (entryId: string, specialty: string) => void;
  onAddEntry?: () => void;
  onDeleteEntry?: (entryId: string) => void;
}

export const MedicalHandoffObservationEntry: React.FC<MedicalHandoffObservationEntryProps> = ({
  entry,
  patient,
  index,
  entriesCount,
  isFieldReadOnly,
  specialtyOptions,
  onEntryNoteChange,
  onEntrySpecialtyChange,
  onAddEntry,
  onDeleteEntry,
}) => {
  const inlineMeta = resolveMedicalEntryInlineMeta(entry);
  const specialtyLabel = entry.specialty || 'Especialidad sin definir';
  const specialtyWidth = `${Math.max(String(specialtyLabel).length + 4, 14)}ch`;

  return (
    <div
      className={clsx(
        'space-y-1',
        index > 0 && 'border-t border-slate-100 pt-2 print:border-t-0 print:pt-1'
      )}
    >
      <div className="hidden print:block text-[7px] leading-tight text-slate-500">
        {[specialtyLabel, inlineMeta].filter(Boolean).join(' · ')}
      </div>
      {isFieldReadOnly ? (
        <div className="text-[10px] leading-tight text-slate-500 print:hidden">
          {[specialtyLabel, inlineMeta].filter(Boolean).join(' · ')}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-tight text-slate-500 print:hidden">
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
          {inlineMeta && <span>{inlineMeta}</span>}
          <div className="ml-auto flex items-center gap-1">
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
