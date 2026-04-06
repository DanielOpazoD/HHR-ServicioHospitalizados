import { useCallback } from 'react';
import type { RefObject } from 'react';
import type {
  DailyRecord,
  DailyRecordPatch,
  MedicalHandoffActor,
  MedicalSpecialty,
} from '@/application/shared/dailyRecordContracts';
import type { AuditAction, AuditLogEntry } from '@/types/audit';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcome';
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
  type ConfirmMedicalSpecialtyNoChangesOutput,
  type PersistedHandoffRecordOutput,
} from '@/application/handoff';
import {
  buildHandoffNovedadesAuditEvent,
  buildMedicalNoChangesAuditEvent,
  buildMedicalNoChangesAuditPayload,
  buildMedicalSignatureAuditEvent,
  buildMedicalSpecialtyAuditEvent,
  buildResetMedicalHandoffAuditEvent,
} from '@/hooks/controllers/handoffManagementPersistenceController';
import { runHandoffMutation } from '@/hooks/controllers/handoffManagementMutationController';
import { canEditMedicalHandoffForDate } from '@/shared/access/operationalAccessPolicy';

interface HandoffManagementPersistenceInput {
  recordRef: RefObject<DailyRecord | null>;
  role?: string;
  saveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>;
  patchRecord: (patch: DailyRecordPatch) => Promise<void>;
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

interface MutationFailureOptions {
  fallbackMessage: string;
  fallbackTitle: string;
  reasonTitles?: Partial<Record<string, string>>;
}

export const useHandoffManagementPersistence = ({
  recordRef,
  role,
  saveAndUpdate,
  patchRecord,
  logEvent,
  logDebouncedEvent,
  userId,
  notifyError,
}: HandoffManagementPersistenceInput) => {
  const getCurrentRecord = useCallback(() => recordRef.current, [recordRef]);

  const canMutateCurrentMedicalRecord = useCallback(
    () =>
      canEditMedicalHandoffForDate({
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

  const runMutation = useCallback(
    async <TData>(
      execute: (record: DailyRecord | null) => Promise<ApplicationOutcome<TData | null>>,
      failureOptions: MutationFailureOptions,
      onSuccess?: (context: { currentRecord: DailyRecord; data: TData }) => void | Promise<void>
    ) =>
      runHandoffMutation<TData>({
        execute,
        getCurrentRecord,
        notifyError,
        failureOptions,
        onSuccess: onSuccess
          ? async ({ currentRecord, data }) => {
              await onSuccess({ currentRecord, data });
            }
          : undefined,
      }),
    [getCurrentRecord, notifyError]
  );

  const updateHandoffChecklist = useCallback(
    (shift: 'day' | 'night', field: string, value: boolean | string) => {
      void runMutation<PersistedHandoffRecordOutput>(
        record =>
          executeUpdateHandoffChecklist({
            field,
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
            shift,
            value,
          }),
        {
          fallbackMessage: 'No se pudo actualizar el checklist de entrega.',
          fallbackTitle: 'Error al guardar',
        }
      );
    },
    [runMutation, saveAndUpdate]
  );

  const updateHandoffNovedades = useCallback(
    (shift: 'day' | 'night' | 'medical', value: string) => {
      void runMutation<PersistedHandoffRecordOutput>(
        record =>
          executeUpdateHandoffNovedades({
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
            shift,
            value,
          }),
        {
          fallbackMessage: 'No se pudo actualizar las novedades.',
          fallbackTitle: 'Error al guardar',
        },
        ({ currentRecord }) => {
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
        }
      );
    },
    [logDebouncedEvent, runMutation, saveAndUpdate, userId]
  );

  const updateMedicalSpecialtyNote = useCallback(
    async (specialty: MedicalSpecialty, value: string, actor: Partial<MedicalHandoffActor>) => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      await runMutation<PersistedHandoffRecordOutput>(
        record =>
          executeUpdateMedicalSpecialtyNote({
            actor,
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
            specialty,
            value,
          }),
        {
          fallbackMessage: 'No se pudo actualizar la nota médica.',
          fallbackTitle: 'Error al guardar',
        },
        ({ currentRecord }) => {
          const auditEvent = buildMedicalSpecialtyAuditEvent(currentRecord, specialty, value);

          logDebouncedEvent(
            auditEvent.action,
            auditEvent.entityType,
            auditEvent.entityId,
            auditEvent.details,
            undefined,
            auditEvent.recordDate
          );
        }
      );
    },
    [
      canMutateCurrentMedicalRecord,
      logDebouncedEvent,
      presentSpecialistHistoricalEditError,
      runMutation,
      saveAndUpdate,
    ]
  );

  const confirmMedicalSpecialtyNoChanges = useCallback(
    async ({ specialty, actor, comment, dateKey }: ConfirmMedicalSpecialtyNoChangesInput) => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      await runMutation<ConfirmMedicalSpecialtyNoChangesOutput>(
        record =>
          executeConfirmMedicalSpecialtyNoChanges({
            actor,
            comment,
            dateKey,
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
            specialty,
          }),
        {
          fallbackMessage: 'No se pudo confirmar continuidad de la especialidad.',
          fallbackTitle: 'Error al guardar',
          reasonTitles: {
            missing_base_note: 'Sin nota base',
            already_updated_today: 'Ya actualizado hoy',
          },
        },
        ({ currentRecord, data }) => {
          const auditDetails = buildMedicalNoChangesAuditPayload(
            data.updatedRecord,
            specialty,
            actor,
            data.effectiveDateKey,
            data.confirmedAt
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
        }
      );
    },
    [
      canMutateCurrentMedicalRecord,
      logEvent,
      presentSpecialistHistoricalEditError,
      runMutation,
      saveAndUpdate,
    ]
  );

  const updateHandoffStaff = useCallback(
    (shift: 'day' | 'night', type: 'delivers' | 'receives' | 'tens', staffList: string[]) => {
      void runMutation<PersistedHandoffRecordOutput>(
        record =>
          executeUpdateHandoffStaff({
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
            shift,
            staffList,
            type,
          }),
        {
          fallbackMessage: 'No se pudo actualizar el personal de entrega.',
          fallbackTitle: 'Error al guardar',
        }
      );
    },
    [runMutation, saveAndUpdate]
  );

  const updateMedicalSignature = useCallback(
    async (doctorName: string, scope: MedicalHandoffScope = 'all') => {
      await runMutation<PersistedHandoffRecordOutput>(
        record =>
          executeUpdateMedicalSignature({
            doctorName,
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
            scope,
          }),
        {
          fallbackMessage: 'No se pudo registrar la firma médica.',
          fallbackTitle: 'Error al guardar',
        },
        ({ currentRecord, data }) => {
          const auditEvent = buildMedicalSignatureAuditEvent(
            currentRecord,
            data.updatedRecord,
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
        }
      );
    },
    [logEvent, runMutation, saveAndUpdate]
  );

  const updateMedicalHandoffDoctor = useCallback(
    async (doctorName: string): Promise<void> => {
      if (!canMutateCurrentMedicalRecord()) {
        presentSpecialistHistoricalEditError();
        return;
      }

      await runMutation<PersistedHandoffRecordOutput>(
        record =>
          executeUpdateMedicalHandoffDoctor({
            doctorName,
            record,
            saveRecord: saveAndUpdate,
            patchRecord,
          }),
        {
          fallbackMessage: 'No se pudo actualizar el médico de entrega.',
          fallbackTitle: 'Error al guardar',
        }
      );
    },
    [
      canMutateCurrentMedicalRecord,
      presentSpecialistHistoricalEditError,
      runMutation,
      saveAndUpdate,
    ]
  );

  const resetMedicalHandoffState = useCallback(async () => {
    await runMutation<PersistedHandoffRecordOutput>(
      record =>
        executeResetMedicalHandoffState({
          record,
          saveRecord: saveAndUpdate,
        }),
      {
        fallbackMessage: 'No se pudo restaurar la entrega médica.',
        fallbackTitle: 'Error al guardar',
      },
      ({ currentRecord }) => {
        const auditEvent = buildResetMedicalHandoffAuditEvent(currentRecord);

        logEvent(
          auditEvent.action,
          auditEvent.entityType,
          auditEvent.entityId,
          auditEvent.details,
          undefined,
          auditEvent.recordDate
        );
      }
    );
  }, [logEvent, runMutation, saveAndUpdate]);

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
