import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { DailyRecord, DailyRecordPatch } from '@/types/domain/dailyRecord';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import {
  executeEnsureMedicalHandoffSignatureLink,
  executeMarkMedicalHandoffAsSent,
  executeSendMedicalHandoff,
} from '@/application/handoff';
import { defaultDailyRecordReadPort } from '@/application/ports/dailyRecordPort';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';
import { presentHandoffManagementFailure } from '@/hooks/controllers/handoffManagementOutcomeController';
import { canEditSpecialistTodayBoundRecord } from '@/shared/access/specialistAccessPolicy';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';

interface HandoffManagementDeliveryInput {
  recordRef: RefObject<DailyRecord | null>;
  role?: string;
  patchRecord: (partial: DailyRecordPatch) => Promise<void>;
  success: (title: string, message: string) => void;
  notifyError: (title: string, message: string) => void;
}

export const useHandoffManagementDelivery = ({
  recordRef,
  role,
  patchRecord,
  success,
  notifyError,
}: HandoffManagementDeliveryInput) => {
  const getCurrentRecord = useCallback(() => recordRef.current, [recordRef]);
  const canMutateCurrentMedicalRecord = useCallback(
    () =>
      canEditSpecialistTodayBoundRecord({
        role,
        readOnly: false,
        recordDate: getCurrentRecord()?.date,
      }),
    [getCurrentRecord, role]
  );

  const presentSpecialistHistoricalEditError = useCallback(() => {
    notifyError(
      'Edición no permitida',
      'El médico especialista solo puede editar la entrega médica del día actual.'
    );
  }, [notifyError]);

  const markMedicalHandoffAsSent = useCallback(
    async (doctorName?: string, scope: MedicalHandoffScope = 'all') => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      const currentRecord = getCurrentRecord();
      const outcome = await executeMarkMedicalHandoffAsSent({
        doctorName,
        patchRecord,
        record: currentRecord,
        scope,
      });
      if (outcome.status === 'failed' || !outcome.data) {
        return;
      }
      recordRef.current = outcome.data.nextRecord;
    },
    [
      canMutateCurrentMedicalRecord,
      getCurrentRecord,
      patchRecord,
      presentSpecialistHistoricalEditError,
      recordRef,
    ]
  );

  const ensureMedicalHandoffSignatureLink = useCallback(
    async (
      scope: MedicalHandoffScope = 'all'
    ): Promise<ApplicationOutcome<{ handoffUrl: string } | null>> => {
      if (!canMutateCurrentMedicalRecord()) {
        return createApplicationFailed(null, [
          {
            kind: 'permission',
            message: 'El médico especialista solo puede editar la entrega médica del día actual.',
            userSafeMessage:
              'El médico especialista solo puede editar la entrega médica del día actual.',
          },
        ]);
      }

      const outcome = await executeEnsureMedicalHandoffSignatureLink({
        patchRecord,
        record: getCurrentRecord(),
        scope,
      });
      if (outcome.status === 'failed' || !outcome.data) {
        return createApplicationFailed(null, outcome.issues, {
          userSafeMessage:
            outcome.userSafeMessage || 'No se pudo copiar el enlace de firma médica.',
        });
      }

      recordRef.current = outcome.data.nextRecord;
      return createApplicationSuccess({ handoffUrl: outcome.data.handoffUrl });
    },
    [canMutateCurrentMedicalRecord, getCurrentRecord, patchRecord, recordRef]
  );

  const sendMedicalHandoff = useCallback(
    async (templateContent: string, targetGroupId: string) => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      const currentRecord = getCurrentRecord();
      if (!currentRecord) {
        recordOperationalTelemetry({
          category: 'handoff',
          status: 'failed',
          operation: 'send_medical_handoff',
          issues: ['No hay entrega médica disponible para enviar.'],
          context: { targetGroupId, scope: 'all' },
        });
        notifyError('Error al enviar', 'No hay entrega médica disponible para enviar.');
        return;
      }

      const outcome = await executeSendMedicalHandoff({
        record: currentRecord,
        templateContent,
        targetGroupId,
        patchRecord,
        getPreviousDay: defaultDailyRecordReadPort.getPreviousDay,
        scope: 'all',
      });
      recordOperationalOutcome('handoff', 'send_medical_handoff', outcome, {
        date: currentRecord.date,
        context: { targetGroupId, scope: 'all' },
      });

      if (outcome.status === 'failed' || !outcome.data) {
        const notice = presentHandoffManagementFailure(outcome, {
          fallbackMessage: 'No se pudo enviar la entrega médica.',
          fallbackTitle: 'Error al enviar',
        });
        notifyError(notice.title, notice.message);
        return;
      }
      recordRef.current = outcome.data.nextRecord;
      success('WhatsApp Enviado', 'Entrega médica enviada correctamente.');
    },
    [
      canMutateCurrentMedicalRecord,
      getCurrentRecord,
      notifyError,
      patchRecord,
      presentSpecialistHistoricalEditError,
      success,
    ]
  );

  return {
    markMedicalHandoffAsSent,
    ensureMedicalHandoffSignatureLink,
    sendMedicalHandoff,
  };
};
