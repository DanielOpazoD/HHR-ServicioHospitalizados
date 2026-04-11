/**
 * PatientSearchResultItem
 *
 * Renders a single patient result in the global search list.
 */

import React from 'react';
import { User, Calendar, Activity } from 'lucide-react';
import type { MasterPatient } from '@/types/domain/patientMaster';
import { formatDateToCL } from '@/utils/clinicalUtils';

interface PatientSearchResultItemProps {
  patient: MasterPatient;
  isSelected: boolean;
  onClick: () => void;
  searchQuery: string;
}

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query || query.length < 2) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200/60 text-inherit rounded-sm px-0.5">
        {text.slice(idx, idx + lowerQuery.length)}
      </mark>
      {text.slice(idx + lowerQuery.length)}
    </>
  );
};

export const PatientSearchResultItem: React.FC<PatientSearchResultItemProps> = ({
  patient,
  isSelected,
  onClick,
  searchQuery,
}) => {
  const hospitalizationCount = patient.hospitalizations?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer group ${
        isSelected
          ? 'bg-medical-50 border-l-2 border-medical-500'
          : 'border-l-2 border-transparent hover:bg-slate-50'
      }`}
    >
      {/* Avatar circle */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
        <User size={16} className="text-slate-400" />
      </div>

      {/* Patient info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {highlightMatch(patient.fullName, searchQuery)}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs font-mono text-slate-500">
            {highlightMatch(patient.rut, searchQuery)}
          </span>
          {patient.lastAdmission && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Calendar size={10} />
              {formatDateToCL(patient.lastAdmission)}
            </span>
          )}
        </div>
      </div>

      {/* Right badges */}
      <div className="shrink-0 flex items-center gap-2">
        {hospitalizationCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
            <Activity size={10} />
            {hospitalizationCount}
          </span>
        )}
        {patient.vitalStatus === 'Fallecido' && (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
            Fallecido
          </span>
        )}
      </div>
    </button>
  );
};
