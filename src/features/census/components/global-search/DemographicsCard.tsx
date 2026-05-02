/**
 * DemographicsCard
 *
 * Displays the patient identity header for global search details.
 */

import React from 'react';
import { User } from 'lucide-react';
import type { MasterPatient } from '@/types/domain/patientMaster';

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
  </div>
);
