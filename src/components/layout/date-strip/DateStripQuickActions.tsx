import React, { Suspense, lazy } from 'react';
import { FlaskConical, Lock, Radio } from 'lucide-react';
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
  hideClinicalQuickActions?: boolean;
}

export const DateStripQuickActions: React.FC<DateStripQuickActionsProps> = ({
  onOpenBedManager,
  medicalIndicationsPatients = [],
  renderFeatureQuickActions,
  hideClinicalQuickActions = false,
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

  const renderPlaceholderAction = (label: string, Icon: React.ComponentType<{ size?: number }>) => (
    <button
      type="button"
      disabled
      aria-disabled="true"
      tabIndex={-1}
      className="flex h-[30px] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0 text-[10px] font-semibold text-slate-400 opacity-70 min-w-[76px]"
      title={`${label} (cargando...)`}
    >
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex items-center justify-end gap-1 min-h-[30px] min-w-0">
      {onOpenBedManager && (
        <button
          onClick={onOpenBedManager}
          className="flex h-[30px] items-center justify-center gap-1 px-2.5 py-0 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors text-[10px] font-semibold min-w-[76px]"
          title="Bloqueo de camas"
        >
          <Lock size={13} />
          <span className="hidden sm:inline">Camas</span>
        </button>
      )}

      <div className="flex items-center gap-1">
        {!hideClinicalQuickActions &&
          (radiologyPatients.length > 0 ? (
            <>
              <button
                onClick={() => setIsRadiologyOpen(true)}
                className="flex h-[30px] items-center justify-center gap-1 px-2.5 py-0 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-200 transition-colors text-[10px] font-semibold min-w-[76px]"
                title="Radiología / Imagenología"
              >
                <Radio size={13} />
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
          ) : (
            renderPlaceholderAction('MMRAD', Radio)
          ))}

        {!hideClinicalQuickActions &&
          (renderFeatureQuickActions?.(quickActionPatients) ??
            renderPlaceholderAction('Lab', FlaskConical))}
      </div>
    </div>
  );
};
