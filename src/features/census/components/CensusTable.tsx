import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { CensusTableHeader } from '@/features/census/components/CensusTableHeader';
import { CensusTableBody } from '@/features/census/components/CensusTableBody';
import { useCensusTableBindingsModel } from '@/features/census/hooks/useCensusTableBindingsModel';
import { DragDropConfirmation } from '@/features/census/drag-drop/DragDropConfirmation';
import { useCensusTableDragDrop } from '@/features/census/drag-drop/useCensusTableDragDrop';
import { useDailyRecordBeds } from '@/context/DailyRecordContext';
import { useDailyRecordBedActions } from '@/context/useDailyRecordScopedActions';
import { ViewLoader } from '@/components/ui/ViewLoader';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { resolveEmptyBedSaveAction } from '@/features/census/controllers/admitPatientGate';
import { useAdmitPatient } from '@/hooks/useAdmitPatient';
import { useNotification } from '@/context/UIContext';
import { isFeatureEnabled } from '@/services/utils/featureFlags';
import { createScopedLogger } from '@/services/utils/loggerScope';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';
import { useDailyRecordFreshnessUi } from '@/hooks/useDailyRecordFreshnessUi';

const censusTableAdmitLogger = createScopedLogger('CensusTableAdmit');
export type { DiagnosisMode } from '@/features/census/types/censusTableTypes';

const LazyDemographicsModal = lazy(() =>
  import('@/components/modals/DemographicsModal').then(module => ({
    default: module.DemographicsModal,
  }))
);

interface CensusTableProps {
  currentDateString: string;
  readOnly?: boolean;
  accessProfile?: CensusAccessProfile;
}

export const CensusTable: React.FC<CensusTableProps> = ({
  currentDateString,
  readOnly = false,
  accessProfile = 'default',
}) => {
  const [activeEmptyBedId, setActiveEmptyBedId] = useState<string | null>(null);
  const freshnessUi = useDailyRecordFreshnessUi(currentDateString);
  const effectiveReadOnly = readOnly || freshnessUi.isClinicalEditingBlocked;
  const { isReady, bindings, clinicalDocumentInfoByBedId } = useCensusTableBindingsModel({
    currentDateString,
    readOnly: effectiveReadOnly,
    accessProfile,
  });

  const { moveOrCopyPatient, updatePatientMultiple } = useDailyRecordBedActions();
  const beds = useDailyRecordBeds();
  const admitPatient = useAdmitPatient();
  const { error: notifyError } = useNotification();

  const handleMoveToBed = useCallback(
    (sourceBedId: string, targetBedId: string) => {
      moveOrCopyPatient('move', sourceBedId, targetBedId);
    },
    [moveOrCopyPatient]
  );

  const dragDrop = useCensusTableDragDrop(handleMoveToBed, beds ?? {});

  const emptyBedData = useMemo(
    () => (activeEmptyBedId ? createEmptyPatient(activeEmptyBedId) : null),
    [activeEmptyBedId]
  );

  const closeEmptyBedDemographics = useCallback(() => {
    setActiveEmptyBedId(null);
  }, []);

  const openEmptyBedDemographics = useCallback(
    (bedId: string) => {
      if (freshnessUi.isClinicalEditingBlocked) {
        return;
      }
      setActiveEmptyBedId(bedId);
    },
    [freshnessUi.isClinicalEditingBlocked]
  );

  const saveEmptyBedDemographics = useCallback(
    async (updatedFields: Partial<PatientData>) => {
      if (!activeEmptyBedId) {
        return;
      }

      const action = resolveEmptyBedSaveAction({
        updatedFields,
        isAdmitCommandEnabled: isFeatureEnabled('USE_ADMIT_PATIENT_COMMAND'),
      });

      switch (action.kind) {
        case 'noop':
          closeEmptyBedDemographics();
          return;
        case 'admit-command': {
          const outcome = await admitPatient({
            bedId: activeEmptyBedId,
            patientName: action.input.patientName,
            rut: action.input.rut,
            admissionDate: action.input.admissionDate,
            pathology: action.input.pathology,
            recordDate: currentDateString,
          });
          if (outcome.status.status === 'ready' || outcome.status.status === 'degraded') {
            closeEmptyBedDemographics();
            return;
          }
          // Command rejected the input (blocked / failed). Surface the
          // typed userSafeMessage to the clinician; do NOT fall back to
          // the legacy dispatch, otherwise we would silently bypass the
          // command's guard (e.g., anonymous actor) the user is trying
          // to enforce.
          censusTableAdmitLogger.warn('admitPatientCommand rejected', {
            bedId: activeEmptyBedId,
            outcomeStatus: outcome.status.status,
            issues: outcome.applicationOutcome.issues,
          });
          notifyError(
            'No se pudo registrar la admisión',
            outcome.applicationOutcome.userSafeMessage ||
              outcome.applicationOutcome.issues[0]?.message ||
              'Revisa los datos e intenta nuevamente.'
          );
          return;
        }
        case 'legacy-dispatch':
          updatePatientMultiple(activeEmptyBedId, action.input);
          closeEmptyBedDemographics();
          return;
      }
    },
    [
      activeEmptyBedId,
      admitPatient,
      closeEmptyBedDemographics,
      currentDateString,
      notifyError,
      updatePatientMultiple,
    ]
  );

  if (!isReady || !bindings) return <ViewLoader />;

  const { headerProps, bodyProps, tableStyle } = bindings;

  return (
    <div className="card print:border-none print:shadow-none !overflow-visible">
      <div className="relative overflow-visible">
        {freshnessUi.userMessage ? (
          <div
            className={`mb-2 rounded-md border px-3 py-2 text-sm ${
              freshnessUi.messageLevel === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-100 bg-sky-50 text-sky-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {freshnessUi.userMessage}
          </div>
        ) : null}
        <table
          data-testid="census-table"
          className="text-left border-collapse print:text-xs relative text-[12px] leading-tight table-fixed"
          style={tableStyle}
        >
          <CensusTableHeader {...headerProps} />
          <CensusTableBody
            {...bodyProps}
            onActivateEmptyBed={openEmptyBedDemographics}
            dragDrop={effectiveReadOnly ? undefined : dragDrop}
            clinicalDocumentInfoByBedId={clinicalDocumentInfoByBedId}
          />
        </table>
      </div>

      {dragDrop.state.pendingMove && (
        <DragDropConfirmation
          move={dragDrop.state.pendingMove}
          onConfirm={dragDrop.confirmationHandlers.onConfirm}
          onCancel={dragDrop.confirmationHandlers.onCancel}
        />
      )}

      {activeEmptyBedId && emptyBedData ? (
        <Suspense fallback={null}>
          <LazyDemographicsModal
            isOpen
            onClose={closeEmptyBedDemographics}
            onCancel={closeEmptyBedDemographics}
            onEmptySave={closeEmptyBedDemographics}
            data={emptyBedData}
            onSave={saveEmptyBedDemographics}
            bedId={activeEmptyBedId}
            recordDate={currentDateString}
            requiresCompleteDemographics
          />
        </Suspense>
      ) : null}
    </div>
  );
};
