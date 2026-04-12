import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcome';
import type { MedicalHandoffEntry, PatientData } from '@/domain/handoff/patientContracts';

type MedicalHandoffRecord = {
  date: string;
  beds: Record<string, PatientData>;
} | null;

const SILENT_MEDICAL_PATIENT_OUTCOME_REASONS = new Set([
  'missing_patient',
  'missing_audit_actor',
  'missing_entry',
  'empty_entry_note',
  'no_effect',
]);

export interface ResolveMedicalHandoffMutationContextInput {
  bedId: string;
  isNested: boolean;
  isMedical: boolean;
  canMutateCurrentMedicalRecord: boolean;
  record: MedicalHandoffRecord;
}

export interface MedicalHandoffMutationContext {
  bedId: string;
  isNested: boolean;
  patient: PatientData | undefined;
  recordDate: string;
}

export const resolveMedicalHandoffMutationContext = ({
  bedId,
  isNested,
  isMedical,
  canMutateCurrentMedicalRecord,
  record,
}: ResolveMedicalHandoffMutationContextInput): MedicalHandoffMutationContext | null => {
  if (!record || !isMedical || !canMutateCurrentMedicalRecord) {
    return null;
  }

  const bed = record.beds[bedId];
  return {
    bedId,
    isNested,
    patient: isNested ? bed?.clinicalCrib : bed,
    recordDate: record.date,
  };
};

export const shouldLogMedicalHandoffOutcome = <T>(outcome: ApplicationOutcome<T>): boolean =>
  !(outcome.reason && SILENT_MEDICAL_PATIENT_OUTCOME_REASONS.has(outcome.reason));

export const isSuccessfulMedicalHandoffOutcome = <T>(
  outcome: ApplicationOutcome<T>
): outcome is ApplicationOutcome<NonNullable<T>> & { status: 'success'; data: NonNullable<T> } =>
  outcome.status === 'success' && Boolean(outcome.data);

export const createMedicalFieldsPersister =
  <TFields>(
    persistMedicalFields: (bedId: string, fields: TFields, isNested: boolean) => Promise<void>,
    bedId: string,
    isNested: boolean
  ) =>
  (fields: TFields) =>
    persistMedicalFields(bedId, fields, isNested);

export const resolveRefreshableMedicalEntry = (
  patient: PatientData | null | undefined,
  entryId: string
): MedicalHandoffEntry | null => {
  const entry =
    patient?.medicalHandoffEntries?.find(currentEntry => currentEntry.id === entryId) || null;
  if (!entry?.note.trim()) {
    return null;
  }

  return entry;
};
