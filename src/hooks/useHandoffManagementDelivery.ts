import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { DailyRecord, DailyRecordPatch } from '@/types';
import type { MedicalHandoffScope } from '@/features/handoff/controllers';
import {
  buildMedicalHandoffSignatureLink,
  resolveScopedMedicalSignatureToken,
} from '@/features/handoff/controllers';
import { buildMedicalSentPatch } from '@/features/handoff/controllers/handoffManagementController';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { executeSendMedicalHandoff } from '@/application/handoff/sendMedicalHandoffUseCase';
import { defaultDailyRecordReadPort } from '@/application/ports/dailyRecordPort';
import {
  createApplicationFailed,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';

const generateMedicalSignatureLinkToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

interface HandoffManagementDeliveryInput {
  recordRef: RefObject<DailyRecord | null>;
  patchRecord: (partial: DailyRecordPatch) => Promise<void>;
  success: (title: string, message: string) => void;
  notifyError: (title: string, message: string) => void;
}

const getFailedOutcomeMessage = (outcome: ApplicationOutcome<unknown>) =>
  outcome.issues[0]?.message || 'No se pudo enviar la entrega médica.';

export const useHandoffManagementDelivery = ({
  recordRef,
  patchRecord,
  success,
  notifyError,
}: HandoffManagementDeliveryInput) => {
  const getCurrentRecord = useCallback(() => recordRef.current, [recordRef]);

  const markMedicalHandoffAsSent = useCallback(
    (doctorName?: string, scope: MedicalHandoffScope = 'all') => {
      const currentRecord = getCurrentRecord();
      if (!currentRecord) return Promise.resolve();
      return patchRecord(buildMedicalSentPatch(currentRecord, doctorName, scope));
    },
    [getCurrentRecord, patchRecord]
  );

  const ensureMedicalHandoffSignatureLink = useCallback(
    async (scope: MedicalHandoffScope = 'all'): Promise<string> => {
      const currentRecord = getCurrentRecord();
      if (!currentRecord) {
        throw new Error('No hay entrega médica disponible para compartir.');
      }

      const existingToken = resolveScopedMedicalSignatureToken(currentRecord, scope);
      if (existingToken) {
        return buildMedicalHandoffSignatureLink(
          defaultBrowserWindowRuntime.getLocationOrigin(),
          currentRecord.date,
          scope,
          existingToken
        );
      }

      const nextToken = generateMedicalSignatureLinkToken();
      await patchRecord({
        medicalSignatureLinkTokenByScope: {
          ...(currentRecord.medicalSignatureLinkTokenByScope || {}),
          [scope]: nextToken,
        },
      });

      const refreshedRecord = {
        ...currentRecord,
        medicalSignatureLinkTokenByScope: {
          ...(currentRecord.medicalSignatureLinkTokenByScope || {}),
          [scope]: nextToken,
        },
      };
      recordRef.current = refreshedRecord;

      return buildMedicalHandoffSignatureLink(
        defaultBrowserWindowRuntime.getLocationOrigin(),
        currentRecord.date,
        scope,
        nextToken
      );
    },
    [getCurrentRecord, patchRecord, recordRef]
  );

  const sendMedicalHandoff = useCallback(
    async (templateContent: string, targetGroupId: string) => {
      const currentRecord = getCurrentRecord();
      if (!currentRecord) {
        notifyError('Error al enviar', 'No hay entrega médica disponible para enviar.');
        return;
      }

      try {
        const outcome = await executeSendMedicalHandoff({
          record: currentRecord,
          templateContent,
          targetGroupId,
          patchRecord,
          getPreviousDay: defaultDailyRecordReadPort.getPreviousDay,
          scope: 'all',
        });
        if (outcome.status === 'failed') {
          throw createApplicationFailed(null, outcome.issues);
        }

        success('WhatsApp Enviado', 'Entrega médica enviada correctamente.');
      } catch (err: unknown) {
        const errorMessage =
          typeof err === 'object' && err && 'status' in err
            ? getFailedOutcomeMessage(err as ApplicationOutcome<unknown>)
            : err instanceof Error
              ? err.message
              : 'Error desconocido';
        notifyError('Error al enviar', errorMessage);
      }
    },
    [getCurrentRecord, notifyError, patchRecord, success]
  );

  return {
    markMedicalHandoffAsSent,
    ensureMedicalHandoffSignatureLink,
    sendMedicalHandoff,
  };
};
