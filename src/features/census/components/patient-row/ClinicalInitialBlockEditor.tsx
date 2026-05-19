import React, { useState } from 'react';
import clsx from 'clsx';
import { Check, SquarePen, X } from 'lucide-react';
import { SPECIALTY_OPTIONS, STATUS_OPTIONS } from '@/constants/clinicalSpecialtyConstants';
import type {
  PatientData,
  PatientRowPatientPatch,
} from '@/features/census/components/patient-row/patientRowContracts';
import type { DebouncedTextHandler } from '@/features/census/components/patient-row/inputCellTypes';

interface ClinicalInitialBlockDraft {
  pathology: string;
  specialty: string;
  status: string;
}

interface ClinicalInitialBlockEditorProps {
  data: PatientData;
  disabled?: boolean;
  alignRightClassName?: string;
  onChange: DebouncedTextHandler;
  onMultipleUpdate?: (fields: PatientRowPatientPatch) => void;
}

const buildClinicalInitialBlockDraft = (data: PatientData): ClinicalInitialBlockDraft => ({
  pathology: data.pathology || '',
  specialty: data.specialty || '',
  status: data.status || '',
});

const buildClinicalInitialBlockPatch = (
  draft: ClinicalInitialBlockDraft
): PatientRowPatientPatch => ({
  pathology: draft.pathology,
  specialty: draft.specialty as PatientData['specialty'],
  status: draft.status as PatientData['status'],
});

export const ClinicalInitialBlockEditor: React.FC<ClinicalInitialBlockEditorProps> = ({
  data,
  disabled = false,
  alignRightClassName = 'right-1',
  onChange,
  onMultipleUpdate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<ClinicalInitialBlockDraft>(() =>
    buildClinicalInitialBlockDraft(data)
  );

  const openEditor = () => {
    setDraft(buildClinicalInitialBlockDraft(data));
    setIsOpen(true);
  };

  const closeEditor = () => {
    setIsOpen(false);
  };

  const saveDraft = () => {
    const patch = buildClinicalInitialBlockPatch(draft);
    if (onMultipleUpdate) {
      onMultipleUpdate(patch);
    } else {
      onChange('pathology')(draft.pathology);
      onChange('specialty')(draft.specialty);
      onChange('status')(draft.status);
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition-colors',
          'hover:border-medical-300 hover:text-medical-700 focus:outline-none focus:ring-2 focus:ring-medical-500/20',
          disabled && 'cursor-not-allowed opacity-50',
          alignRightClassName
        )}
        title="Editar bloque clínico"
        aria-label="Editar bloque clínico"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) {
            openEditor();
          }
        }}
        disabled={disabled}
      >
        <SquarePen size={12} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-[1000] w-80 rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Bloque clínico
            </p>
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:text-slate-600"
              title="Cerrar"
              aria-label="Cerrar bloque clínico"
              onClick={closeEditor}
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-2 p-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                Diagnóstico
              </span>
              <input
                id={`clinical-block-pathology-${data.bedId}`}
                name={`clinical-block-pathology-${data.bedId}`}
                className="h-8 w-full rounded border border-slate-200 px-2 text-[13px] focus:border-medical-500 focus:outline-none focus:ring-2 focus:ring-medical-500/20"
                value={draft.pathology}
                onChange={event =>
                  setDraft(current => ({ ...current, pathology: event.target.value }))
                }
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                  Especialidad
                </span>
                <select
                  id={`clinical-block-specialty-${data.bedId}`}
                  name={`clinical-block-specialty-${data.bedId}`}
                  className="h-8 w-full rounded border border-slate-200 px-2 text-[12px] focus:border-medical-500 focus:outline-none focus:ring-2 focus:ring-medical-500/20"
                  value={draft.specialty}
                  onChange={event =>
                    setDraft(current => ({ ...current, specialty: event.target.value }))
                  }
                >
                  <option value="">-- Esp --</option>
                  {SPECIALTY_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-600">Estado</span>
                <select
                  id={`clinical-block-status-${data.bedId}`}
                  name={`clinical-block-status-${data.bedId}`}
                  className="h-8 w-full rounded border border-slate-200 px-2 text-[12px] focus:border-medical-500 focus:outline-none focus:ring-2 focus:ring-medical-500/20"
                  value={draft.status}
                  onChange={event =>
                    setDraft(current => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="">-- Est --</option>
                  {STATUS_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                onClick={closeEditor}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-medical-600 bg-medical-600 px-2 py-1 text-[12px] font-semibold text-white hover:bg-medical-700"
                onClick={saveDraft}
              >
                <Check size={13} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
