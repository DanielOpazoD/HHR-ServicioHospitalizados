import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { MedicalHandoffEntry, PatientData } from '@/types/domain/patient';
import { createDailyRecordAggregate } from '@/services/repositories/dailyRecordAggregate';

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

const cloneMedicalHandoffEntries = (
  entries: MedicalHandoffEntry[] | undefined
): MedicalHandoffEntry[] | undefined =>
  entries?.map(entry => ({
    ...entry,
    updatedBy: entry.updatedBy ? { ...entry.updatedBy } : undefined,
    currentStatusBy: entry.currentStatusBy ? { ...entry.currentStatusBy } : undefined,
  }));

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
  targetPatient.medicalHandoffAudit = sourcePatient.medicalHandoffAudit
    ? { ...sourcePatient.medicalHandoffAudit }
    : undefined;
};

export const resolveInitialDayHandoff = (prevRecord: DailyRecord | null): string => {
  if (!prevRecord) {
    return '';
  }

  const previousAggregate = createDailyRecordAggregate(prevRecord);
  return previousAggregate.handoff.nightNovedades || previousAggregate.handoff.dayNovedades;
};
