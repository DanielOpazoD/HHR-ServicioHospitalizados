import React from 'react';
import { FlaskConical } from 'lucide-react';
import { LabResultsViewerModal } from './LabResultsViewerModal';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

interface LaboratoryQuickActionProps {
  patients: MedicalIndicationsPatientOption[];
}

export const LaboratoryQuickAction: React.FC<LaboratoryQuickActionProps> = ({ patients }) => {
  const [isLabOpen, setIsLabOpen] = React.useState(false);

  const labPatients = React.useMemo(
    () =>
      patients
        .filter(patient => patient.rut && patient.patientName)
        .map(patient => ({
          bedId: patient.bedId,
          label: patient.label,
          patientName: patient.patientName,
          rut: patient.rut,
          diagnosis: patient.diagnosis,
        })),
    [patients]
  );

  if (labPatients.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsLabOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
        title="Laboratorio / Exámenes Syslab"
      >
        <FlaskConical size={14} />
        <span className="hidden sm:inline">Lab</span>
      </button>
      <LabResultsViewerModal
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        patients={labPatients}
      />
    </>
  );
};
