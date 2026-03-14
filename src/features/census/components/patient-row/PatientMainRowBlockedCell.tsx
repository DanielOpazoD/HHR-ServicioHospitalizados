import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { PatientMainRowBlockedCellProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';

export const PatientMainRowBlockedCell: React.FC<PatientMainRowBlockedCellProps> = ({
  blockedReason,
  accessProfile = 'default',
}) => (
  <td
    colSpan={isSpecialistCensusAccessProfile(accessProfile) ? 6 : 10}
    className="p-1 bg-slate-50/50 text-center"
  >
    <div className="text-slate-400 text-sm flex items-center justify-center gap-2 italic">
      <AlertCircle size={14} className="text-red-300/60" />
      <span>Cama Bloqueada</span>
      {blockedReason && <span className="text-xs opacity-70">({blockedReason})</span>}
    </div>
  </td>
);
