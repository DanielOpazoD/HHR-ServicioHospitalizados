import type { HandoffDailyRecordContract } from '@/domain/handoff/recordContracts';
import type {
  MedicalHandoffAudit,
  MedicalHandoffEntry,
  PatientData,
} from '@/services/contracts/patientServiceContracts';

export const inheritPatientHandoffNotes = (
  targetPatient: PatientData,
  sourcePatient: PatientData | undefined
): void => {
  if (!sourcePatient) {
    return;
  }

  const prevNightNote = sourcePatient.handoffNoteNightShift || sourcePatient.handoffNote || '';
  targetPatient.handoffNoteDayShift = prevNightNote;
  targetPatient.handoffNoteNightShift = prevNightNote;
};

const resetCarriedMedicalHandoffEntryValidity = (
  entry: MedicalHandoffEntry
): MedicalHandoffEntry => ({
  ...entry,
  originalNoteBy: entry.originalNoteBy ? { ...entry.originalNoteBy } : undefined,
  updatedBy: entry.updatedBy ? { ...entry.updatedBy } : undefined,
  currentStatus: undefined,
  currentStatusDate: undefined,
  currentStatusAt: undefined,
  currentStatusBy: undefined,
});

const cloneMedicalHandoffEntries = (
  entries: MedicalHandoffEntry[] | undefined
): MedicalHandoffEntry[] | undefined => entries?.map(resetCarriedMedicalHandoffEntryValidity);

const resetCarriedMedicalHandoffAuditValidity = (
  audit: MedicalHandoffAudit | undefined
): MedicalHandoffAudit | undefined => {
  if (!audit) {
    return undefined;
  }

  return {
    ...audit,
    originalNoteBy: audit.originalNoteBy ? { ...audit.originalNoteBy } : undefined,
    lastSpecialistUpdateBy: audit.lastSpecialistUpdateBy
      ? { ...audit.lastSpecialistUpdateBy }
      : undefined,
    currentStatus: undefined,
    currentStatusDate: undefined,
    currentStatusAt: undefined,
    currentStatusBy: undefined,
    currentStatusSpecialty: undefined,
  };
};

export const inheritPatientMedicalHandoff = (
  targetPatient: PatientData,
  sourcePatient: PatientData | undefined
): void => {
  if (!sourcePatient) {
    return;
  }

  targetPatient.medicalHandoffNote = sourcePatient.medicalHandoffNote || '';
  targetPatient.medicalHandoffEntries = cloneMedicalHandoffEntries(
    sourcePatient.medicalHandoffEntries
  );
  targetPatient.medicalHandoffAudit = resetCarriedMedicalHandoffAuditValidity(
    sourcePatient.medicalHandoffAudit
  );
};

export const resolveInitialDayHandoff = (prevRecord: HandoffDailyRecordContract | null): string => {
  if (!prevRecord) {
    return '';
  }

  return prevRecord.handoffNovedadesNightShift || prevRecord.handoffNovedadesDayShift || '';
};
