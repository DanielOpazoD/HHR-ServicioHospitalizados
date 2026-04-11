/**
 * DemographicsCard
 *
 * Displays patient demographic information: name, RUT, birth date,
 * gender, forecast, and commune.
 */

import React from 'react';
import { User } from 'lucide-react';
import type { MasterPatient } from '@/types/domain/patientMaster';
import { formatDateToCL } from '@/utils/clinicalUtils';

interface DemographicsCardProps {
  patient: MasterPatient;
}

export const DemographicsCard: React.FC<DemographicsCardProps> = ({ patient }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-medical-100 flex items-center justify-center">
        <User size={20} className="text-medical-600" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">{patient.fullName}</h3>
        <span className="text-xs font-mono text-slate-500">{patient.rut}</span>
      </div>
      {patient.vitalStatus === 'Fallecido' && (
        <span className="ml-auto text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
          Fallecido
        </span>
      )}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      {patient.birthDate && (
        <div>
          <span className="text-slate-400 block">Nacimiento</span>
          <span className="text-slate-700 font-medium">{formatDateToCL(patient.birthDate)}</span>
        </div>
      )}
      {patient.gender && (
        <div>
          <span className="text-slate-400 block">Sexo</span>
          <span className="text-slate-700 font-medium">{patient.gender}</span>
        </div>
      )}
      {patient.forecast && (
        <div>
          <span className="text-slate-400 block">Prevision</span>
          <span className="text-slate-700 font-medium">{patient.forecast}</span>
        </div>
      )}
      {patient.commune && (
        <div>
          <span className="text-slate-400 block">Comuna</span>
          <span className="text-slate-700 font-medium">{patient.commune}</span>
        </div>
      )}
    </div>
  </div>
);
