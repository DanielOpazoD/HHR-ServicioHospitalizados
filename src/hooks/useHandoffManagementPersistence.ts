import { useCallback } from 'react';
import type { RefObject } from 'react';
import type {
  DailyRecord,
  MedicalHandoffActor,
  MedicalSpecialty,
} from '@/types/domain/dailyRecord';
import type { AuditAction, AuditLogEntry } from '@/types/audit';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type { ConfirmMedicalSpecialtyNoChangesInput } from '@/hooks/handoffManagementTypes';
import {
  executeConfirmMedicalSpecialtyNoChanges,
  executeResetMedicalHandoffState,
  executeUpdateHandoffChecklist,
  executeUpdateHandoffNovedades,
  executeUpdateHandoffStaff,
  executeUpdateMedicalHandoffDoctor,
  executeUpdateMedicalSignature,
  executeUpdateMedicalSpecialtyNote,
} from '@/application/handoff';
import {
  buildHandoffNovedadesAuditEvent,
  buildMedicalNoChangesAuditEvent,
  buildMedicalNoChangesAuditPayload,
  buildMedicalSignatureAuditEvent,
  buildMedicalSpecialtyAuditEvent,
  buildResetMedicalHandoffAuditEvent,
} from '@/hooks/controllers/handoffManagementPersistenceController';
import { presentHandoffManagementFailure } from '@/hooks/controllers/handoffManagementOutcomeController';
import { canEditSpecialistTodayBoundRecord } from '@/shared/access/specialistAccessPolicy';

interface HandoffManagementPersistenceInput {
  recordRef: RefObject<DailyRecord | null>;
  role?: string;
  saveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>;
  logEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string
  ) => void;
  logDebouncedEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string
  ) => void;
  userId: string;
  notifyError: (title: string, message: string) => void;
}

export const useHandoffManagementPersistence = ({
  recordRef,
  role,
  saveAndUpdate,
  logEvent,
  logDebouncedEvent,
  userId,
  notifyError,
}: HandoffManagementPersistenceInput) => {
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

  const updateHandoffChecklist = useCallback(
    (shift: 'day' | 'night', field: string, value: boolean | string) => {
      void (async () => {
        const outcome = await executeUpdateHandoffChecklist({
          field,
          record: getCurrentRecord(),
          saveRecord: saveAndUpdate,
          shift,
          value,
        });
        if (outcome.status === 'failed' && outcome.reason !== 'missing_record') {
          const notice = presentHandoffManagementFailure(outcome, {
            fallbackMessage: 'No se pudo actualizar el checklist de entrega.',
            fallbackTitle: 'Error al guardar',
          });
          notifyError(notice.title, notice.message);
        }
      })();
    },
    [getCurrentRecord, notifyError, saveAndUpdate]
  );

  const updateHandoffNovedades = useCallback(
    (shift: 'day' | 'night' | 'medical', value: string) => {
      const currentRecord = getCurrentRecord();
      void (async () => {
        const outcome = await executeUpdateHandoffNovedades({
          record: currentRecord,
          saveRecord: saveAndUpdate,
          shift,
          value,
        });
        if (outcome.status === 'failed' || !currentRecord) {
          if (outcome.reason !== 'missing_record') {
            const notice = presentHandoffManagementFailure(outcome, {
              fallbackMessage: 'No se pudo actualizar las novedades.',
              fallbackTitle: 'Error al guardar',
            });
            notifyError(notice.title, notice.message);
          }
          return;
        }

        const auditEvent = buildHandoffNovedadesAuditEvent(currentRecord, shift, value, userId);

        logDebouncedEvent(
          auditEvent.action,
          auditEvent.entityType,
          auditEvent.entityId,
          auditEvent.details,
          undefined,
          auditEvent.recordDate,
          auditEvent.authors
        );
      })();
    },
    [getCurrentRecord, logDebouncedEvent, notifyError, saveAndUpdate, userId]
  );

  const updateMedicalSpecialtyNote = useCallback(
    async (specialty: MedicalSpecialty, value: string, actor: Partial<MedicalHandoffActor>) => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      const currentRecord = getCurrentRecord();
      const outcome = await executeUpdateMedicalSpecialtyNote({
        actor,
        record: currentRecord,
        saveRecord: saveAndUpdate,
        specialty,
        value,
      });
      if (outcome.status === 'failed' || !currentRecord) {
        if (outcome.reason !== 'missing_record') {
          const notice = presentHandoffManagementFailure(outcome, {
            fallbackMessage: 'No se pudo actualizar la nota médica.',
            fallbackTitle: 'Error al guardar',
          });
          notifyError(notice.title, notice.message);
        }
        return;
      }
      const auditEvent = buildMedicalSpecialtyAuditEvent(currentRecord, specialty, value);

      logDebouncedEvent(
        auditEvent.action,
        auditEvent.entityType,
        auditEvent.entityId,
        auditEvent.details,
        undefined,
        auditEvent.recordDate
      );
    },
    [
      canMutateCurrentMedicalRecord,
      getCurrentRecord,
      logDebouncedEvent,
      notifyError,
      presentSpecialistHistoricalEditError,
      saveAndUpdate,
    ]
  );

  const confirmMedicalSpecialtyNoChanges = useCallback(
    async ({ specialty, actor, comment, dateKey }: ConfirmMedicalSpecialtyNoChangesInput) => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      const currentRecord = getCurrentRecord();
      const outcome = await executeConfirmMedicalSpecialtyNoChanges({
        actor,
        comment,
        dateKey,
        record: currentRecord,
        saveRecord: saveAndUpdate,
        specialty,
      });
      if (outcome.status === 'failed' || !currentRecord || !outcome.data) {
        if (outcome.reason !== 'missing_record') {
          const notice = presentHandoffManagementFailure(outcome, {
            fallbackMessage: 'No se pudo confirmar continuidad de la especialidad.',
            fallbackTitle: 'Error al guardar',
            reasonTitles: {
              missing_base_note: 'Sin nota base',
              already_updated_today: 'Ya actualizado hoy',
            },
          });
          notifyError(notice.title, notice.message);
        }
        return;
      }

      const auditDetails = buildMedicalNoChangesAuditPayload(
        outcome.data.updatedRecord,
        specialty,
        actor,
        outcome.data.effectiveDateKey,
        outcome.data.confirmedAt
      );
      const auditEvent = buildMedicalNoChangesAuditEvent(currentRecord, auditDetails);

      logEvent(
        auditEvent.action,
        auditEvent.entityType,
        auditEvent.entityId,
        auditEvent.details,
        undefined,
        auditEvent.recordDate
      );
    },
    [
      canMutateCurrentMedicalRecord,
      getCurrentRecord,
      logEvent,
      notifyError,
      presentSpecialistHistoricalEditError,
      saveAndUpdate,
    ]
  );

  const updateHandoffStaff = useCallback(
    (shift: 'day' | 'night', type: 'delivers' | 'receives' | 'tens', staffList: string[]) => {
      void (async () => {
        const outcome = await executeUpdateHandoffStaff({
          record: getCurrentRecord(),
          saveRecord: saveAndUpdate,
          shift,
          staffList,
          type,
        });
        if (outcome.status === 'failed' && outcome.reason !== 'missing_record') {
          const notice = presentHandoffManagementFailure(outcome, {
            fallbackMessage: 'No se pudo actualizar el personal de entrega.',
            fallbackTitle: 'Error al guardar',
          });
          notifyError(notice.title, notice.message);
        }
      })();
    },
    [getCurrentRecord, notifyError, saveAndUpdate]
  );

  const updateMedicalSignature = useCallback(
    async (doctorName: string, scope: MedicalHandoffScope = 'all') => {
      const currentRecord = getCurrentRecord();
      const outcome = await executeUpdateMedicalSignature({
        doctorName,
        record: currentRecord,
        saveRecord: saveAndUpdate,
        scope,
      });
      if (outcome.status === 'failed' || !currentRecord || !outcome.data) {
        if (outcome.reason !== 'missing_record') {
          const notice = presentHandoffManagementFailure(outcome, {
            fallbackMessage: 'No se pudo registrar la firma médica.',
            fallbackTitle: 'Error al guardar',
          });
          notifyError(notice.title, notice.message);
        }
        return;
      }
      const auditEvent = buildMedicalSignatureAuditEvent(
        currentRecord,
        outcome.data.updatedRecord,
        doctorName,
        scope
      );

      logEvent(
        auditEvent.action,
        auditEvent.entityType,
        auditEvent.entityId,
        auditEvent.details,
        undefined,
        auditEvent.recordDate
      );
    },
    [getCurrentRecord, logEvent, notifyError, saveAndUpdate]
  );

  const updateMedicalHandoffDoctor = useCallback(
    async (doctorName: string): Promise<void> => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      const outcome = await executeUpdateMedicalHandoffDoctor({
        doctorName,
        record: getCurrentRecord(),
        saveRecord: saveAndUpdate,
      });
      if (outcome.status === 'failed' && outcome.reason !== 'missing_record') {
        const notice = presentHandoffManagementFailure(outcome, {
          fallbackMessage: 'No se pudo actualizar el médico de entrega.',
          fallbackTitle: 'Error al guardar',
        });
        notifyError(notice.title, notice.message);
      }
    },
    [
      canMutateCurrentMedicalRecord,
      getCurrentRecord,
      notifyError,
      presentSpecialistHistoricalEditError,
      saveAndUpdate,
    ]
  );

  const resetMedicalHandoffState = useCallback(async () => {
    const currentRecord = getCurrentRecord();
    const outcome = await executeResetMedicalHandoffState({
      record: currentRecord,
      saveRecord: saveAndUpdate,
    });
    if (outcome.status === 'failed' || !currentRecord) {
      if (outcome.reason !== 'missing_record') {
        const notice = presentHandoffManagementFailure(outcome, {
          fallbackMessage: 'No se pudo restaurar la entrega médica.',
          fallbackTitle: 'Error al guardar',
        });
        notifyError(notice.title, notice.message);
      }
      return;
    }
    const auditEvent = buildResetMedicalHandoffAuditEvent(currentRecord);

    logEvent(
      auditEvent.action,
      auditEvent.entityType,
      auditEvent.entityId,
      auditEvent.details,
      undefined,
      auditEvent.recordDate
    );
  }, [getCurrentRecord, logEvent, notifyError, saveAndUpdate]);

  return {
    updateHandoffChecklist,
    updateHandoffNovedades,
    updateMedicalSpecialtyNote,
    confirmMedicalSpecialtyNoChanges,
    updateHandoffStaff,
    updateMedicalSignature,
    updateMedicalHandoffDoctor,
    resetMedicalHandoffState,
  };
};
