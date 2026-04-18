import React from 'react';
import { Clock3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { getShiftSchedule } from '@/utils/clinicalDayUtils';
import type {
  DailyRecordStaffingDetailsV1,
  DetailedStaffAssignment,
  DetailedStaffingRole,
  DetailedStaffingShift,
} from '@/types/domain/dailyRecordStaffingDetails';
import {
  addDetailedStaffingExtra,
  removeDetailedStaffingExtra,
  resetDetailedStaffingAssignmentToStandard,
  updateDetailedStaffingAssignment,
} from '@/services/staff/dailyRecordDetailedStaffing';
import {
  normalizeStaffSelectionValue,
  VACANCY_LABEL,
} from '@/services/staff/staffSelectionPresentation';

interface StaffShiftDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DetailedStaffingShift;
  recordDate: string;
  detail: DailyRecordStaffingDetailsV1;
  nursesList: string[];
  tensList: string[];
  onSave: (detail: DailyRecordStaffingDetailsV1) => Promise<void> | void;
}

const SHIFT_LABELS: Record<DetailedStaffingShift, string> = {
  day: 'Turno Largo',
  night: 'Turno Noche',
};

const ROLE_LABELS: Record<DetailedStaffingRole, string> = {
  nurse: 'Enfermería',
  tens: 'TENS',
};

const buildResolvedStaffOptions = (catalog: string[], assignments: DetailedStaffAssignment[]) => {
  const uniqueOptions = new Set<string>([VACANCY_LABEL]);

  assignments.forEach(assignment => {
    if (assignment.name) {
      uniqueOptions.add(normalizeStaffSelectionValue(assignment.name));
    }
  });

  catalog.filter(Boolean).forEach(option => {
    uniqueOptions.add(normalizeStaffSelectionValue(option));
  });

  return Array.from(uniqueOptions);
};

const resolveAssignmentLabel = (assignment: DetailedStaffAssignment, extraIndex: number) => {
  if (assignment.slotType === 'standard') {
    return `Base ${(assignment.standardSlotIndex ?? 0) + 1}`;
  }

  return `Refuerzo ${extraIndex}`;
};

const StaffRoleSection: React.FC<{
  draft: DailyRecordStaffingDetailsV1;
  shift: DetailedStaffingShift;
  role: DetailedStaffingRole;
  recordDate: string;
  catalog: string[];
  onChange: (detail: DailyRecordStaffingDetailsV1) => void;
}> = ({ draft, shift, role, recordDate, catalog, onChange }) => {
  const assignments = draft[shift][role === 'nurse' ? 'nurses' : 'tens'];
  const options = React.useMemo(
    () => buildResolvedStaffOptions(catalog, assignments),
    [assignments, catalog]
  );
  let extraIndex = 0;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{ROLE_LABELS[role]}</h4>
          <p className="text-xs text-slate-500">
            Configura horarios individuales y agrega refuerzos si hace falta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(addDetailedStaffingExtra(draft, recordDate, shift, role))}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>

      <div className="space-y-2">
        {assignments.map(assignment => {
          const currentExtraIndex = assignment.slotType === 'extra' ? ++extraIndex : extraIndex;

          return (
            <div
              key={assignment.id}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/90 p-3 md:grid-cols-[88px_minmax(0,1fr)_110px_110px_auto]"
            >
              <div className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {resolveAssignmentLabel(assignment, currentExtraIndex)}
              </div>
              <select
                value={normalizeStaffSelectionValue(assignment.name)}
                onChange={event =>
                  onChange(
                    updateDetailedStaffingAssignment(draft, shift, role, assignment.id, {
                      name: event.target.value,
                    })
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-medical-400 focus:outline-none"
              >
                {options.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={assignment.startTime}
                onChange={event =>
                  onChange(
                    updateDetailedStaffingAssignment(draft, shift, role, assignment.id, {
                      startTime: event.target.value,
                    })
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-medical-400 focus:outline-none"
              />
              <input
                type="time"
                value={assignment.endTime}
                onChange={event =>
                  onChange(
                    updateDetailedStaffingAssignment(draft, shift, role, assignment.id, {
                      endTime: event.target.value,
                    })
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-medical-400 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      resetDetailedStaffingAssignmentToStandard(
                        draft,
                        recordDate,
                        shift,
                        role,
                        assignment.id
                      )
                    )
                  }
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                  aria-label={`Restablecer horario estándar de ${ROLE_LABELS[role]}`}
                >
                  <RotateCcw size={14} />
                </button>
                {assignment.slotType === 'extra' && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(removeDetailedStaffingExtra(draft, shift, role, assignment.id))
                    }
                    className="rounded-full p-2 text-rose-400 transition-colors hover:bg-white hover:text-rose-600"
                    aria-label={`Eliminar refuerzo de ${ROLE_LABELS[role]}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const StaffShiftDetailsModal: React.FC<StaffShiftDetailsModalProps> = ({
  isOpen,
  onClose,
  shift,
  recordDate,
  detail,
  nursesList,
  tensList,
  onSave,
}) => {
  const [draft, setDraft] = React.useState(detail);
  const [isSaving, setIsSaving] = React.useState(false);
  const schedule = React.useMemo(() => getShiftSchedule(recordDate), [recordDate]);
  const scheduleText =
    shift === 'day'
      ? `${schedule.dayStart} - ${schedule.dayEnd}`
      : `${schedule.nightStart} - ${schedule.nightEnd}`;

  React.useEffect(() => {
    if (isOpen) {
      setDraft(detail);
      setIsSaving(false);
    }
  }, [detail, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configuración detallada ${SHIFT_LABELS[shift]}`}
      icon={<Clock3 size={18} />}
      size="3xl"
      variant="white"
      bodyClassName="space-y-4 bg-slate-50 p-4"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">Horario estándar</p>
        <p className="mt-1 text-sm text-slate-600">
          {SHIFT_LABELS[shift]}: {scheduleText}
        </p>
        <p className="mt-1 text-xs text-slate-500">{schedule.description}</p>
      </section>

      <StaffRoleSection
        draft={draft}
        shift={shift}
        role="nurse"
        recordDate={recordDate}
        catalog={nursesList}
        onChange={setDraft}
      />

      <StaffRoleSection
        draft={draft}
        shift={shift}
        role="tens"
        recordDate={recordDate}
        catalog={tensList}
        onChange={setDraft}
      />

      <div className="flex justify-end gap-2 px-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-medical-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </BaseModal>
  );
};
