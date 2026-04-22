import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type { AuditAction } from '@/types/auditActionTypes';
import type { AuditLogEntry } from '@/types/auditLogTypes';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcome';
import { runHandoffMutation } from '@/hooks/controllers/handoffManagementMutationController';
import { canEditMedicalHandoffForDate } from '@/shared/access/operationalAccessPolicy';

export interface HandoffManagementPersistenceInput {
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

export interface MutationFailureOptions {
  fallbackMessage: string;
  fallbackTitle: string;
  reasonTitles?: Partial<Record<string, string>>;
}

export interface HandoffPersistenceRuntime extends HandoffManagementPersistenceInput {
  getCurrentRecord: () => DailyRecord | null;
  canMutateCurrentMedicalRecord: () => boolean;
  presentSpecialistHistoricalEditError: () => void;
  runMutation: <TData>(
    execute: (record: DailyRecord | null) => Promise<ApplicationOutcome<TData | null>>,
    failureOptions: MutationFailureOptions,
    onSuccess?: (context: { currentRecord: DailyRecord; data: TData }) => void | Promise<void>
  ) => Promise<unknown>;
}

export const useHandoffPersistenceRuntime = (
  input: HandoffManagementPersistenceInput
): HandoffPersistenceRuntime => {
  const { recordRef, role, notifyError } = input;

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

  return {
    ...input,
    getCurrentRecord,
    canMutateCurrentMedicalRecord,
    presentSpecialistHistoricalEditError,
    runMutation,
  };
};
