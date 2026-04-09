import { useCallback } from 'react';
import {
  executeResetMedicalHandoffState,
  executeUpdateHandoffChecklist,
  executeUpdateHandoffNovedades,
  executeUpdateHandoffStaff,
  type PersistedHandoffRecordOutput,
} from '@/application/handoff';
import {
  buildHandoffNovedadesAuditEvent,
  buildResetMedicalHandoffAuditEvent,
} from '@/hooks/controllers/handoffManagementPersistenceController';
import type { HandoffPersistenceRuntime } from '@/hooks/useHandoffPersistenceRuntime';

export const useHandoffGeneralPersistenceActions = (runtime: HandoffPersistenceRuntime) => {
  const { logDebouncedEvent, logEvent, patchRecord, runMutation, saveAndUpdate, userId } = runtime;

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
    [patchRecord, runMutation, saveAndUpdate]
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
    [logDebouncedEvent, patchRecord, runMutation, saveAndUpdate, userId]
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
    [patchRecord, runMutation, saveAndUpdate]
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
    updateHandoffStaff,
    resetMedicalHandoffState,
  };
};
