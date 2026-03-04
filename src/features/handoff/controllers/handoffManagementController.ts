import type { DailyRecord, DailyRecordPatch, MedicalHandoffActor, MedicalSpecialty } from '@/types';
import {
  buildMedicalHandoffSummary,
  DEFAULT_NO_CHANGES_COMMENT,
} from '@/features/handoff/controllers';

export const normalizeMedicalHandoffActor = (
  actor: Partial<MedicalHandoffActor>,
  specialty?: MedicalSpecialty
): MedicalHandoffActor => ({
  uid: actor.uid || 'unknown-user',
  displayName: actor.displayName || actor.email || 'Usuario sin nombre',
  email: actor.email || 'unknown@hospitalhangaroa.cl',
  role: actor.role,
  specialty: specialty || actor.specialty,
});

export const buildChecklistUpdateRecord = (
  record: DailyRecord,
  shift: 'day' | 'night',
  field: string,
  value: boolean | string
): DailyRecord => {
  const updatedRecord = { ...record };
  if (shift === 'day') {
    updatedRecord.handoffDayChecklist = {
      ...updatedRecord.handoffDayChecklist,
      [field]: value,
    };
  } else {
    updatedRecord.handoffNightChecklist = {
      ...updatedRecord.handoffNightChecklist,
      [field]: value,
    };
  }
  updatedRecord.lastUpdated = new Date().toISOString();
  return updatedRecord;
};

export const buildNovedadesUpdateRecord = (
  record: DailyRecord,
  shift: 'day' | 'night' | 'medical',
  value: string
): DailyRecord => {
  const updatedRecord = { ...record };
  if (shift === 'day') updatedRecord.handoffNovedadesDayShift = value;
  if (shift === 'night') updatedRecord.handoffNovedadesNightShift = value;
  if (shift === 'medical') updatedRecord.medicalHandoffNovedades = value;
  updatedRecord.lastUpdated = new Date().toISOString();
  return updatedRecord;
};

export const buildMedicalSpecialtyNoteRecord = (
  record: DailyRecord,
  specialty: MedicalSpecialty,
  value: string,
  actor: Partial<MedicalHandoffActor>
): DailyRecord => {
  const now = new Date().toISOString();
  const normalizedActor = normalizeMedicalHandoffActor(actor, specialty);
  const currentNote = record.medicalHandoffBySpecialty?.[specialty];
  const updatedRecord: DailyRecord = {
    ...record,
    medicalHandoffBySpecialty: {
      ...(record.medicalHandoffBySpecialty || {}),
      [specialty]: {
        note: value,
        createdAt: currentNote?.createdAt || now,
        updatedAt: now,
        author: currentNote?.author || normalizedActor,
        lastEditor: normalizedActor,
        version: (currentNote?.version || 0) + 1,
        dailyContinuity: {
          ...(currentNote?.dailyContinuity || {}),
          [record.date]: { status: 'updated_by_specialist' },
        },
      },
    },
    lastUpdated: now,
  };
  updatedRecord.medicalHandoffNovedades = buildMedicalHandoffSummary(updatedRecord);
  return updatedRecord;
};

export const buildMedicalNoChangesRecord = (
  record: DailyRecord,
  specialty: MedicalSpecialty,
  actor: Partial<MedicalHandoffActor>,
  comment?: string,
  dateKey?: string
): DailyRecord => {
  const currentNote = record.medicalHandoffBySpecialty?.[specialty];
  if (!currentNote) return record;
  const effectiveDateKey = dateKey || record.date;
  const now = new Date().toISOString();
  const normalizedActor = normalizeMedicalHandoffActor(actor, specialty);
  const nextComment = comment?.trim() || DEFAULT_NO_CHANGES_COMMENT;
  const updatedRecord: DailyRecord = {
    ...record,
    medicalHandoffBySpecialty: {
      ...(record.medicalHandoffBySpecialty || {}),
      [specialty]: {
        ...currentNote,
        dailyContinuity: {
          ...(currentNote.dailyContinuity || {}),
          [effectiveDateKey]: {
            status: 'confirmed_no_changes',
            confirmedAt: now,
            confirmedBy: normalizedActor,
            comment: nextComment,
          },
        },
      },
    },
    lastUpdated: now,
  };
  updatedRecord.medicalHandoffNovedades = buildMedicalHandoffSummary(updatedRecord);
  return updatedRecord;
};

export const buildMedicalSignatureRecord = (
  record: DailyRecord,
  doctorName: string,
  scope: 'all' | 'upc' | 'no-upc'
): DailyRecord => {
  const signedAt = new Date().toISOString();
  const signature = { doctorName, signedAt };
  const updatedRecord = { ...record };
  updatedRecord.medicalSignatureByScope = {
    ...(updatedRecord.medicalSignatureByScope || {}),
    [scope]: signature,
  };
  if (scope === 'all') updatedRecord.medicalSignature = signature;
  updatedRecord.lastUpdated = new Date().toISOString();
  return updatedRecord;
};

export const buildMedicalSentPatch = (
  record: DailyRecord,
  doctorName?: string,
  scope: 'all' | 'upc' | 'no-upc' = 'all'
): DailyRecordPatch => {
  const sentAt = new Date().toISOString();
  const updates: Partial<DailyRecord> = {
    medicalHandoffSentAtByScope: {
      ...(record.medicalHandoffSentAtByScope || {}),
      [scope]: sentAt,
    },
  };
  if (scope === 'all') updates.medicalHandoffSentAt = sentAt;
  if (doctorName) updates.medicalHandoffDoctor = doctorName;
  return updates;
};

export const buildResetMedicalHandoffRecord = (record: DailyRecord): DailyRecord => {
  const updatedRecord = { ...record };
  updatedRecord.medicalHandoffSentAt = undefined;
  updatedRecord.medicalSignature = undefined;
  updatedRecord.medicalHandoffSentAtByScope = {};
  updatedRecord.medicalSignatureByScope = {};
  updatedRecord.lastUpdated = new Date().toISOString();
  return updatedRecord;
};
