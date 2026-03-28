import { useCallback } from 'react';
import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';
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
import { createScopedLogger } from '@/services/utils/loggerScope';
import { canEditMedicalHandoffForDate } from '@/shared/access/operationalAccessPolicy';

type MedicalPatientFields = Pick<
  PatientData,
  'medicalHandoffEntries' | 'medicalHandoffNote' | 'medicalHandoffAudit'
>;

const medicalHandoffHandlersLogger = createScopedLogger('useMedicalHandoffHandlers');
const SILENT_MEDICAL_PATIENT_OUTCOME_REASONS = new Set([
  'missing_patient',
  'missing_audit_actor',
  'missing_entry',
  'empty_entry_note',
  'no_effect',
]);

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

  const resolveMedicalPatient = useCallback(
    (bedId: string, isNested: boolean) => {
      const bed = record?.beds[bedId];
      return {
        bed,
        patient: isNested ? bed?.clinicalCrib : bed,
      };
    },
    [record]
  );

  const logUnexpectedOutcome = useCallback(
    <T>(operation: string, outcome: ApplicationOutcome<T>) => {
      if (outcome.reason && SILENT_MEDICAL_PATIENT_OUTCOME_REASONS.has(outcome.reason)) {
        return;
      }

      medicalHandoffHandlersLogger.error('Unexpected medical patient handoff outcome', {
        operation,
        outcome,
      });
    },
    []
  );

  const handleMedicalPrimaryNoteChange = useCallback(
    async (bedId: string, value: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const outcome = await executeUpdateMedicalPrimaryNote({
        medicalAuditActor,
        patient,
        persistMedicalFields: (fields: MedicalPatientFields) =>
          persistMedicalFields(bedId, fields, isNested),
        recordDate: record.date,
        value,
      });
      if (outcome.status !== 'success' || !outcome.data) {
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
        record.date,
        undefined,
        30000
      );
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logDebouncedEvent,
      logUnexpectedOutcome,
      medicalAuditActor,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
    ]
  );

  const handleMedicalEntryNoteChange = useCallback(
    async (bedId: string, entryId: string, value: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const outcome = await executeUpdateMedicalEntryNote({
        entryId,
        medicalAuditActor,
        patient,
        persistMedicalFields: (fields: MedicalPatientFields) =>
          persistMedicalFields(bedId, fields, isNested),
        recordDate: record.date,
        value,
      });
      if (outcome.status !== 'success' || !outcome.data) {
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
        record.date,
        undefined,
        30000
      );
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logDebouncedEvent,
      logUnexpectedOutcome,
      medicalAuditActor,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
    ]
  );

  const handleMedicalEntrySpecialtyChange = useCallback(
    async (bedId: string, entryId: string, specialty: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const outcome = await executeUpdateMedicalEntrySpecialty({
        entryId,
        patient,
        persistMedicalFields: (fields: MedicalPatientFields) =>
          persistMedicalFields(bedId, fields, isNested),
        specialty,
      });
      if (outcome.status !== 'success' || !outcome.data) {
        logUnexpectedOutcome('handleMedicalEntrySpecialtyChange', outcome);
      }
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logUnexpectedOutcome,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
    ]
  );

  const handleMedicalEntryAdd = useCallback(
    async (bedId: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const outcome = await executeAddMedicalEntry({
        patient,
        persistMedicalFields: (fields: MedicalPatientFields) =>
          persistMedicalFields(bedId, fields, isNested),
      });
      if (outcome.status !== 'success' || !outcome.data) {
        logUnexpectedOutcome('handleMedicalEntryAdd', outcome);
      }
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logUnexpectedOutcome,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
    ]
  );

  const handleMedicalPrimaryEntryCreate = useCallback(
    async (bedId: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const outcome = await executeCreateMedicalPrimaryEntry({
        patient,
        persistMedicalFields: (fields: MedicalPatientFields) =>
          persistMedicalFields(bedId, fields, isNested),
      });
      if (outcome.status !== 'success' || !outcome.data) {
        logUnexpectedOutcome('handleMedicalPrimaryEntryCreate', outcome);
      }
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logUnexpectedOutcome,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
    ]
  );

  const handleMedicalEntryDelete = useCallback(
    async (bedId: string, entryId: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const outcome = await executeDeleteMedicalEntry({
        entryId,
        patient,
        persistMedicalFields: (fields: MedicalPatientFields) =>
          persistMedicalFields(bedId, fields, isNested),
      });
      if (outcome.status !== 'success' || !outcome.data) {
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
        record.date,
        undefined,
        10000
      );
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logDebouncedEvent,
      logUnexpectedOutcome,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
    ]
  );

  const handleMedicalRefreshAsCurrent = useCallback(
    (bedId: string, entryId: string, isNested: boolean = false) => {
      if (!record || !isMedical || !canMutateCurrentMedicalRecord) return;

      const { patient } = resolveMedicalPatient(bedId, isNested);
      const previousEntry =
        patient?.medicalHandoffEntries?.find(currentEntry => currentEntry.id === entryId) || null;
      if (!previousEntry?.note.trim()) {
        return;
      }
      void (async () => {
        const outcome = await executeRefreshMedicalEntryAsCurrent({
          entryId,
          medicalAuditActor,
          patient,
          persistMedicalFields: (fields: MedicalPatientFields) =>
            persistMedicalFields(bedId, fields, isNested),
          recordDate: record.date,
        });
        if (outcome.status !== 'success' || !outcome.data) {
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
          record.date,
          undefined,
          10000
        );
      })();
    },
    [
      canMutateCurrentMedicalRecord,
      isMedical,
      logDebouncedEvent,
      logUnexpectedOutcome,
      medicalAuditActor,
      persistMedicalFields,
      record,
      resolveMedicalPatient,
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
