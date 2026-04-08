import React from 'react';
import { FlaskConical, Lock, Radio } from 'lucide-react';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';
import { RadiologyViewerModal } from '@/components/modals/RadiologyViewerModal';
import { LabResultsViewerModal } from '@/features/laboratory/public';

interface DateStripQuickActionsProps {
  onOpenBedManager?: () => void;
  localViewMode: 'TABLE' | '3D';
  setLocalViewMode: (v: 'TABLE' | '3D') => void;
  hide3DToggle?: boolean;
  medicalIndicationsPatients?: MedicalIndicationsPatientOption[];
}

export const DateStripQuickActions: React.FC<DateStripQuickActionsProps> = ({
  onOpenBedManager,
  localViewMode: _localViewMode,
  setLocalViewMode: _setLocalViewMode,
  hide3DToggle: _hide3DToggle = false,
  medicalIndicationsPatients = [],
}) => {
  const [isRadiologyOpen, setIsRadiologyOpen] = React.useState(false);
  const [isLabOpen, setIsLabOpen] = React.useState(false);

  const radiologyPatients = React.useMemo(
    () =>
      medicalIndicationsPatients
        .filter(p => p.rut && p.patientName)
        .map(p => ({
          bedId: p.bedId,
          label: p.label,
          patientName: p.patientName,
          rut: p.rut,
          diagnosis: p.diagnosis,
        })),
    [medicalIndicationsPatients]
  );

  const labPatients = React.useMemo(
    () =>
      medicalIndicationsPatients
        .filter(p => p.rut && p.patientName)
        .map(p => ({
          bedId: p.bedId,
          label: p.label,
          patientName: p.patientName,
          rut: p.rut,
          diagnosis: p.diagnosis,
        })),
    [medicalIndicationsPatients]
  );

  return (
    <div className="flex items-center gap-1">
      {onOpenBedManager && (
        <button
          onClick={onOpenBedManager}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors text-[11px] font-semibold"
          title="Bloqueo de camas"
        >
          <Lock size={14} />
          <span className="hidden sm:inline">Camas</span>
        </button>
      )}

      {radiologyPatients.length > 0 && (
        <>
          <button
            onClick={() => setIsRadiologyOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-200 transition-colors text-[11px] font-semibold"
            title="Radiología / Imagenología"
          >
            <Radio size={14} />
            <span className="hidden sm:inline">MMRAD</span>
          </button>
          <RadiologyViewerModal
            isOpen={isRadiologyOpen}
            onClose={() => setIsRadiologyOpen(false)}
            patients={radiologyPatients}
          />
        </>
      )}

      {labPatients.length > 0 && (
        <>
          <button
            onClick={() => setIsLabOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors text-[11px] font-semibold"
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
      )}
    </div>
  );
};
