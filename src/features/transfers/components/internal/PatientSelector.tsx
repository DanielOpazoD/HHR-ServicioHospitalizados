/**
 * Patient Selector Component
 * Dropdown to select a hospitalized patient for transfer request
 */

import React from 'react';
import { TRANSFER_FORM_FIELD_CLASSNAME } from '../transferFormStyles';

interface Patient {
  id: string;
  name: string;
  bedId: string;
  diagnosis: string;
}

interface PatientSelectorProps {
  patients: Patient[];
  selectedPatientId: string;
  onChange: (patientId: string) => void;
  disabled?: boolean;
}

export const PatientSelector: React.FC<PatientSelectorProps> = ({
  patients,
  selectedPatientId,
  onChange,
  disabled = false,
}) => {
  if (patients.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic p-2 bg-gray-50 rounded">
        No hay pacientes hospitalizados disponibles
      </div>
    );
  }

  return (
    <select
      className={`${TRANSFER_FORM_FIELD_CLASSNAME} font-medium text-slate-700 disabled:bg-slate-100`}
      value={selectedPatientId}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Seleccionar paciente...</option>
      {patients.map(patient => (
        <option key={patient.id} value={patient.id}>
          Cama {patient.bedId.replace('BED_', '')} - {patient.name} ({patient.diagnosis})
        </option>
      ))}
    </select>
  );
};
