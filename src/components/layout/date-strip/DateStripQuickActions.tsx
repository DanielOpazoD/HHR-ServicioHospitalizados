import React, { Suspense, lazy } from 'react';
import { Lock, Radio } from 'lucide-react';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

const LazyRadiologyViewerModal = lazy(() =>
  import('@/components/modals/RadiologyViewerModal').then(module => ({
    default: module.RadiologyViewerModal,
  }))
);

interface DateStripQuickActionsProps {
  onOpenBedManager?: () => void;
  medicalIndicationsPatients?: MedicalIndicationsPatientOption[];
  renderFeatureQuickActions?: (patients: MedicalIndicationsPatientOption[]) => React.ReactNode;
}

export const DateStripQuickActions: React.FC<DateStripQuickActionsProps> = ({
  onOpenBedManager,
  medicalIndicationsPatients = [],
  renderFeatureQuickActions,
}) => {
  const [isRadiologyOpen, setIsRadiologyOpen] = React.useState(false);

  const quickActionPatients = React.useMemo(
    () => medicalIndicationsPatients.filter(p => p.rut && p.patientName),
    [medicalIndicationsPatients]
  );

  const radiologyPatients = React.useMemo(
    () =>
      quickActionPatients.map(p => ({
        bedId: p.bedId,
        label: p.label,
        patientName: p.patientName,
        rut: p.rut,
        diagnosis: p.diagnosis,
      })),
    [quickActionPatients]
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
          {isRadiologyOpen ? (
            <Suspense fallback={null}>
              <LazyRadiologyViewerModal
                isOpen={isRadiologyOpen}
                onClose={() => setIsRadiologyOpen(false)}
                patients={radiologyPatients}
              />
            </Suspense>
          ) : null}
        </>
      )}

      {renderFeatureQuickActions?.(quickActionPatients)}
    </div>
  );
};
