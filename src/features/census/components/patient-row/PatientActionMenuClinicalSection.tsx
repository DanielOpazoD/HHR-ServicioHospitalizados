import React from 'react';
import type { ClinicalActionConfig } from '@/features/census/components/patient-row/patientActionMenuConfig';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';

interface PatientActionMenuClinicalSectionProps {
  clinicalActions: readonly ClinicalActionConfig[];
  onAction: (action: PatientRowAction) => void;
}

export const PatientActionMenuClinicalSection: React.FC<PatientActionMenuClinicalSectionProps> = ({
  clinicalActions,
  onAction,
}) => (
  <div className="py-1.5">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] px-3 py-1 block">
      Gestión Clínica
    </span>
    {clinicalActions.map(({ action, icon: Icon, label, iconClassName }) => (
      <button
        key={action}
        onClick={() => onAction(action)}
        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 group"
      >
        <Icon
          size={15}
          className={`${iconClassName} group-hover:translate-x-0.5 transition-transform`}
        />
        <span className="text-[15px]">{label}</span>
      </button>
    ))}
  </div>
);
