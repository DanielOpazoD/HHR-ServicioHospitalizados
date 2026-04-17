import { useCallback } from 'react';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcome';
import {
  executeAddMedicalEntry,
  executeCreateMedicalPrimaryEntry,
  executeDeleteMedicalEntry,
  executeRefreshMedicalEntryAsCurrent,
  executeUpdateMedicalEntryNote,
  executeUpdateMedicalEntrySpecialty,
  executeUpdateMedicalPrimaryNote,
} from '@/application/handoff';
import type { AuditAction, AuditLogEntry } from '@/types/audit';
import type { MedicalHandoffAuditActor, PatientData } from '@/hooks/contracts/patientHookContracts';
import { canEditMedicalHandoffForDate } from '@/shared/access/operationalAccessPolicy';
import {
  createMedicalFieldsPersister,
  isSuccessfulMedicalHandoffOutcome,
  resolveMedicalHandoffMutationContext,
  resolveRefreshableMedicalEntry,
  shouldLogMedicalHandoffOutcome,
} from '@/hooks/controllers/medicalHandoffHandlersController';
import { medicalHandoffHandlersLogger } from './hookLoggers';

type MedicalPatientFields = Pick<
  PatientData,
  'medicalHandoffEntries' | 'medicalHandoffNote' | 'medicalHandoffAudit'
>;

interface UseMedicalHandoffHandlersParams {
  isMedical: boolean;
  record: { date: string; beds: Record<string, PatientData> } | null;
  role?: string;
  medicalAuditActor: MedicalHandoffAuditActor | null;
  persistMedicalFields: (
    bedId: string,
    fields: MedicalPatientFields,
    isNested: boolean
  ) => Promise<void>;
  logDebouncedEvent: (
    action: AuditAction,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: Record<string, unknown>,
    patientRut?: string,
    recordDate?: string,
    authors?: string,
    waitMs?: number
  ) => void;
}

export const useMedicalHandoffHandlers = ({
  isMedical,
  record,
  role,
  medicalAuditActor,
  persistMedicalFields,
  logDebouncedEvent,
}: UseMedicalHandoffHandlersParams) => {
  const canMutateCurrentMedicalRecord = canEditMedicalHandoffForDate({
    role,
    readOnly: false,
    recordDate: record?.date,
  });

  const resolveMutationContext = useCallback(
    (bedId: string, isNested: boolean) =>
      resolveMedicalHandoffMutationContext({
        bedId,
        isNested,
        isMedical,
        canMutateCurrentMedicalRecord,
        record,
      }),
    [canMutateCurrentMedicalRecord, isMedical, record]
  );

  const logUnexpectedOutcome = useCallback(
    <T>(operation: string, outcome: ApplicationOutcome<T>) => {
      if (!shouldLogMedicalHandoffOutcome(outcome)) {
        return;
      }

      medicalHandoffHandlersLogger.error('Unexpected medical patient handoff outcome', {
        operation,
        outcome,
      });
    },
    []
  );

  const resolveFieldsPersister = useCallback(
    (bedId: string, isNested: boolean) =>
      createMedicalFieldsPersister(persistMedicalFields, bedId, isNested),
    [persistMedicalFields]
  );

  const handleMedicalPrimaryNoteChange = useCallback(
    async (bedId: string, value: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient, recordDate } = context;
      const outcome = await executeUpdateMedicalPrimaryNote({
        medicalAuditActor,
        patient,
        persistMedicalFields: resolveFieldsPersister(bedId, isNested),
        recordDate,
        value,
      });
      if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
        logUnexpectedOutcome('handleMedicalPrimaryNoteChange', outcome);
        return;
      }

      logDebouncedEvent(
        'MEDICAL_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient?.patientName || (isNested ? 'Cuna' : 'ANONYMOUS'),
          note: value,
          changes: {
            medicalHandoffNote: {
              old: outcome.data.previousEntry?.note || '',
              new: value,
            },
          },
        },
        patient?.rut,
        recordDate,
        undefined,
        30000
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveFieldsPersister is a stable selector over persistMedicalFields; adding it would cause needless recreations
    [
      logDebouncedEvent,
      logUnexpectedOutcome,
      medicalAuditActor,
      persistMedicalFields,
      resolveMutationContext,
    ]
  );

  const handleMedicalEntryNoteChange = useCallback(
    async (bedId: string, entryId: string, value: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient, recordDate } = context;
      const outcome = await executeUpdateMedicalEntryNote({
        entryId,
        medicalAuditActor,
        patient,
        persistMedicalFields: resolveFieldsPersister(bedId, isNested),
        recordDate,
        value,
      });
      if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
        logUnexpectedOutcome('handleMedicalEntryNoteChange', outcome);
        return;
      }

      logDebouncedEvent(
        'MEDICAL_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient?.patientName || '',
          specialty: outcome.data.entry?.specialty,
          note: value,
          changes: {
            medicalHandoffNote: {
              old: outcome.data.previousEntry?.note || '',
              new: value,
            },
          },
        },
        patient?.rut,
        recordDate,
        undefined,
        30000
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveFieldsPersister is a stable selector over persistMedicalFields; adding it would cause needless recreations
    [
      logDebouncedEvent,
      logUnexpectedOutcome,
      medicalAuditActor,
      persistMedicalFields,
      resolveMutationContext,
    ]
  );

  const handleMedicalEntrySpecialtyChange = useCallback(
    async (bedId: string, entryId: string, specialty: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient } = context;
      const outcome = await executeUpdateMedicalEntrySpecialty({
        entryId,
        patient,
        persistMedicalFields: resolveFieldsPersister(bedId, isNested),
        specialty,
      });
      if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
        logUnexpectedOutcome('handleMedicalEntrySpecialtyChange', outcome);
      }
    },
    [logUnexpectedOutcome, resolveFieldsPersister, resolveMutationContext]
  );

  const handleMedicalEntryAdd = useCallback(
    async (bedId: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient } = context;
      const outcome = await executeAddMedicalEntry({
        patient,
        persistMedicalFields: resolveFieldsPersister(bedId, isNested),
      });
      if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
        logUnexpectedOutcome('handleMedicalEntryAdd', outcome);
      }
    },
    [logUnexpectedOutcome, resolveFieldsPersister, resolveMutationContext]
  );

  const handleMedicalPrimaryEntryCreate = useCallback(
    async (bedId: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient } = context;
      const outcome = await executeCreateMedicalPrimaryEntry({
        patient,
        persistMedicalFields: resolveFieldsPersister(bedId, isNested),
      });
      if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
        logUnexpectedOutcome('handleMedicalPrimaryEntryCreate', outcome);
      }
    },
    [logUnexpectedOutcome, resolveFieldsPersister, resolveMutationContext]
  );

  const handleMedicalEntryDelete = useCallback(
    async (bedId: string, entryId: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient, recordDate } = context;
      const outcome = await executeDeleteMedicalEntry({
        entryId,
        patient,
        persistMedicalFields: resolveFieldsPersister(bedId, isNested),
      });
      if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
        logUnexpectedOutcome('handleMedicalEntryDelete', outcome);
        return;
      }

      logDebouncedEvent(
        'MEDICAL_HANDOFF_MODIFIED',
        'patient',
        bedId,
        {
          patientName: patient?.patientName || '',
          specialty: outcome.data.entry?.specialty,
          operation: 'delete_medical_handoff_entry',
          changes: {
            medicalHandoffNote: {
              old: outcome.data.previousEntry?.note || '',
              new: '',
            },
          },
        },
        patient?.rut,
        recordDate,
        undefined,
        10000
      );
    },
    [logDebouncedEvent, logUnexpectedOutcome, resolveFieldsPersister, resolveMutationContext]
  );

  const handleMedicalRefreshAsCurrent = useCallback(
    (bedId: string, entryId: string, isNested: boolean = false) => {
      const context = resolveMutationContext(bedId, isNested);
      if (!context) return;

      const { patient, recordDate } = context;
      if (!resolveRefreshableMedicalEntry(patient, entryId)) {
        return;
      }
      void (async () => {
        const outcome = await executeRefreshMedicalEntryAsCurrent({
          entryId,
          medicalAuditActor,
          patient,
          persistMedicalFields: resolveFieldsPersister(bedId, isNested),
          recordDate,
        });
        if (!isSuccessfulMedicalHandoffOutcome(outcome)) {
          logUnexpectedOutcome('handleMedicalRefreshAsCurrent', outcome);
          return;
        }

        logDebouncedEvent(
          'MEDICAL_HANDOFF_MODIFIED',
          'patient',
          bedId,
          {
            patientName: patient?.patientName || '',
            specialty: outcome.data.entry?.specialty,
            operation: 'refresh_medical_entry_as_current',
            changes: {
              medicalHandoffNoteTimestamp: {
                old: outcome.data.previousEntry?.updatedAt || '',
                new: outcome.data.entry?.updatedAt || '',
              },
            },
          },
          patient?.rut,
          recordDate,
          undefined,
          10000
        );
      })();
    },
    [
      logDebouncedEvent,
      logUnexpectedOutcome,
      medicalAuditActor,
      resolveFieldsPersister,
      resolveMutationContext,
    ]
  );

  return {
    handleMedicalPrimaryEntryCreate,
    handleMedicalPrimaryNoteChange,
    handleMedicalEntryNoteChange,
    handleMedicalEntrySpecialtyChange,
    handleMedicalEntryAdd,
    handleMedicalEntryDelete,
    handleMedicalRefreshAsCurrent,
  };
};
