import type { Dispatch, SetStateAction } from 'react';

import { applyDischargePatch } from '@/features/census/controllers/censusModalStateController';
import { buildDischargeRuntimeActions } from '@/features/census/controllers/censusActionRuntimeAdapterController';
import { executeDischargeController } from '@/features/census/controllers/censusActionRuntimeController';
import {
  buildDischargeErrorNotification,
  type CensusActionNotification,
} from '@/features/census/controllers/censusActionNotificationController';
import { runDischargeWithTransferGuard } from '@/features/census/controllers/censusDischargeTransferGuardController';
import {
  dispatchCanonicalDischarge,
  type DischargeCanonicalAuditEntry,
} from '@/features/census/controllers/dischargeCanonicalAdoptionController';
/**
 * Canonical episode-key format used to group clinical documents by
 * hospitalization. Inlined here (instead of importing from clinical-documents)
 * to keep this hook free of cross-feature imports — the format is small,
 * stable, and tested in `clinicalDocumentEpisodeKey.test.ts`.
 */
const buildClinicalDocumentEpisodeKey = (
  rut: string | undefined,
  admissionDate: string | undefined
): string | undefined => {
  const trimmedRut = (rut ?? '').trim();
  const trimmedDate = (admissionDate ?? '').trim();
  if (!trimmedRut || !trimmedDate) return undefined;
  return `${trimmedRut}__${trimmedDate}`;
};
import type { CensusActionRuntimeRefs } from '@/features/census/hooks/useCensusActionRuntimeRefs';
import { useCensusModalCommand } from '@/features/census/hooks/useCensusModalCommand';
import { useConfirmedMovementAction } from '@/features/census/hooks/useConfirmedMovementAction';
import type { DischargeExecutionInput } from '@/features/census/domain/movements/contracts';
import type { DischargeState } from '@/features/census/types/censusActionTypes';
import { getLatestOpenTransferRequestByBedId } from '@/services/transfers/transferService';
import { recordCriticalClinicalAction } from '@/services/observability/criticalClinicalActionRecorder';
import { createScopedLogger } from '@/services/utils/loggerScope';
import { isFeatureEnabled } from '@/services/utils/featureFlags';
import { useAuth } from '@/context/AuthContext';
import { resolveAuditActor } from '@/context/AuditContext';

const censusDischargeCommandLogger = createScopedLogger('CensusDischargeCommand');

interface UseCensusDischargeCommandParams extends Pick<
  CensusActionRuntimeRefs,
  | 'dischargeStateRef'
  | 'recordRef'
  | 'stabilityRulesRef'
  | 'addDischargeRef'
  | 'updateDischargeRef'
  | 'confirmRef'
> {
  setDischargeState: Dispatch<SetStateAction<DischargeState>>;
  getCurrentTime: () => string;
  notifyError: (notification: CensusActionNotification) => void;
}

export const useCensusDischargeCommand = ({
  dischargeStateRef,
  recordRef,
  stabilityRulesRef,
  addDischargeRef,
  updateDischargeRef,
  confirmRef,
  setDischargeState,
  getCurrentTime,
  notifyError,
}: UseCensusDischargeCommandParams) => {
  const { currentUser } = useAuth();
  const runConfirmedMovementAction = useConfirmedMovementAction({
    confirm: options =>
      confirmRef.current({
        title: options.title || 'Confirmar acción',
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        variant: options.variant,
        requireInputConfirm: options.requireInputConfirm,
      }),
    notifyError: (title, message) =>
      notifyError({ title, message: message || 'No se pudo completar la confirmación del alta.' }),
  });

  return useCensusModalCommand<DischargeExecutionInput>(async data => {
    const recordDischargeCriticalAction = (
      outcome: 'success' | 'failed',
      issues?: string[],
      context?: Record<string, unknown>
    ) => {
      const bedId = dischargeStateRef.current.bedId;
      recordCriticalClinicalAction({
        category: 'daily_record',
        action: 'census_discharge_created',
        outcome,
        clinicalDate: recordRef.current?.date,
        bedId: bedId ?? undefined,
        patientRut: bedId ? recordRef.current?.beds?.[bedId]?.rut : undefined,
        issues,
        context,
      });
    };

    const buildCanonicalAuditEntries = (): DischargeCanonicalAuditEntry[] => {
      const bedId = dischargeStateRef.current.bedId;
      if (!bedId) return [];
      const bed = recordRef.current?.beds?.[bedId];
      if (!bed) return [];
      const status = dischargeStateRef.current.status;
      if (status !== 'Vivo' && status !== 'Fallecido') return [];
      const episodeKey = buildClinicalDocumentEpisodeKey(bed.rut, bed.admissionDate);
      return [
        {
          bedId,
          patientName: bed.patientName ?? '',
          rut: bed.rut ?? '',
          status,
          episodeKey,
        },
      ];
    };

    const runLegacyDischarge = (): boolean => {
      const result = executeDischargeController({
        dischargeState: dischargeStateRef.current,
        data,
        stabilityRules: stabilityRulesRef.current,
        nowTime: getCurrentTime(),
        actions: buildDischargeRuntimeActions(addDischargeRef.current, updateDischargeRef.current),
      });

      if (!result.ok) {
        recordDischargeCriticalAction('failed', [result.error.message], {
          errorCode: result.error.code,
        });
        notifyError(buildDischargeErrorNotification(result.error.code, result.error.message));
        return false;
      }

      recordDischargeCriticalAction('success');
      setDischargeState(prev => applyDischargePatch(prev, result.value.closeModalPatch));
      return true;
    };

    const executeDischarge = async () => {
      // When the canonical adoption flag is on, the legacy
      // logDischargeEntries inside addDischarge becomes a no-op (see
      // usePatientMovementAudit) and the facade owns the
      // PATIENT_DISCHARGED audit emission with anon rejection +
      // typed outcome. Persistence still goes through the legacy
      // pipeline.
      if (!isFeatureEnabled('USE_DISCHARGE_PATIENT_COMMAND')) {
        runLegacyDischarge();
        return;
      }

      const recordDate = recordRef.current?.date;
      if (!recordDate) {
        runLegacyDischarge();
        return;
      }

      const auditEntries = buildCanonicalAuditEntries();
      if (auditEntries.length === 0) {
        runLegacyDischarge();
        return;
      }

      const actor = resolveAuditActor(currentUser);
      let persistOk = false;
      const outcome = await dispatchCanonicalDischarge({
        actor,
        recordDate,
        entries: auditEntries,
        performLegacyPersist: () => {
          persistOk = runLegacyDischarge();
          if (!persistOk) {
            // Surface to the facade so it returns a `failed` outcome
            // and skips the canonical audit emission.
            throw new Error('Discharge persistence rejected by legacy pipeline.');
          }
        },
      });

      if (outcome.status.status !== 'ready' && outcome.status.status !== 'degraded' && persistOk) {
        // Persistence happened but anon/validation rejected → caller
        // already saw the modal close via runLegacyDischarge. Surface
        // the userSafeMessage as a notification so the clinician sees
        // why the canonical audit was blocked.
        notifyError({
          title: 'Alta auditoría',
          message:
            outcome.applicationOutcome.userSafeMessage ||
            outcome.applicationOutcome.issues[0]?.message ||
            'No se pudo registrar el evento canónico de auditoría.',
        });
      }
    };

    await runDischargeWithTransferGuard({
      dischargeState: dischargeStateRef.current,
      record: recordRef.current,
      executeDischarge,
      runConfirmedMovementAction,
      getLatestOpenTransferRequestByBedId,
      warn: (message, error) => censusDischargeCommandLogger.warn(message, error),
    });
  });
};
