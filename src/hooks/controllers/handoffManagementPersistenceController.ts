import type { DailyRecord, MedicalHandoffActor, MedicalSpecialty } from '@/types';
import type { MedicalHandoffScope } from '@/features/handoff/controllers';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import { normalizeMedicalHandoffActor } from '@/features/handoff/controllers/handoffManagementController';

type HandoffShift = 'day' | 'night' | 'medical';
type StaffShift = 'day' | 'night';
type StaffType = 'delivers' | 'receives' | 'tens';

export const buildHandoffNovedadesAuditPayload = (
  record: DailyRecord,
  shift: HandoffShift,
  value: string,
  userId: string
): { authors: string; details: Record<string, unknown> } => {
  const authors = getAttributedAuthors(
    userId,
    record,
    shift === 'medical' ? undefined : (shift as 'day' | 'night')
  );
  const previousValue =
    shift === 'day'
      ? record.handoffNovedadesDayShift
      : shift === 'night'
        ? record.handoffNovedadesNightShift
        : record.medicalHandoffNovedades;

  return {
    authors: authors ?? '',
    details: {
      shift,
      value,
      changes: {
        novedades: { old: previousValue || '', new: value },
      },
    },
  };
};

export const buildMedicalSpecialtyNoteAuditPayload = (
  record: DailyRecord,
  specialty: MedicalSpecialty,
  value: string
): Record<string, unknown> => ({
  shift: 'medical',
  specialty,
  value,
  operation: 'specialty_note_update',
  changes: {
    novedades: { old: record.medicalHandoffBySpecialty?.[specialty]?.note || '', new: value },
  },
});

export const buildMedicalNoChangesAuditPayload = (
  updatedRecord: DailyRecord,
  specialty: MedicalSpecialty,
  actor: Partial<MedicalHandoffActor>,
  effectiveDateKey: string,
  confirmedAt: string
): Record<string, unknown> => {
  const normalizedActor = normalizeMedicalHandoffActor(actor, specialty);

  return {
    shift: 'medical',
    specialty,
    operation: 'confirm_no_changes',
    comment:
      updatedRecord.medicalHandoffBySpecialty?.[specialty]?.dailyContinuity?.[effectiveDateKey]
        ?.comment,
    confirmedAt,
    confirmedBy: normalizedActor.displayName,
  };
};

export const buildUpdatedHandoffStaffRecord = (
  currentRecord: DailyRecord,
  shift: StaffShift,
  type: StaffType,
  staffList: string[]
): DailyRecord => {
  const updatedRecord = { ...currentRecord };

  if (shift === 'day') {
    if (type === 'delivers') {
      updatedRecord.nursesDayShift = staffList;
    } else if (type === 'receives') {
      updatedRecord.nursesNightShift = staffList;
    } else {
      updatedRecord.tensDayShift = staffList;
    }
  } else if (type === 'delivers') {
    updatedRecord.nursesNightShift = staffList;
  } else if (type === 'receives') {
    updatedRecord.handoffNightReceives = staffList;
  } else {
    updatedRecord.tensNightShift = staffList;
  }

  updatedRecord.lastUpdated = new Date().toISOString();
  return updatedRecord;
};

export const buildMedicalSignatureAuditPayload = (
  updatedRecord: DailyRecord,
  doctorName: string,
  scope: MedicalHandoffScope
): Record<string, unknown> => ({
  doctorName,
  signedAt: updatedRecord.medicalSignatureByScope?.[scope]?.signedAt,
  scope,
});

export const buildResetMedicalHandoffAuditPayload = (
  record: DailyRecord
): Record<string, unknown> => {
  const clearedFields: string[] = [];

  if (record.medicalHandoffSentAt) {
    clearedFields.push('entrega');
  }

  if (record.medicalSignature) {
    clearedFields.push('firma');
  }

  return {
    clearedFields,
    hadMedicalHandoffSentAt: Boolean(record.medicalHandoffSentAt),
    hadMedicalSignature: Boolean(record.medicalSignature),
    hadScopedMedicalHandoffSentAt: Boolean(
      record.medicalHandoffSentAtByScope &&
      Object.keys(record.medicalHandoffSentAtByScope).length > 0
    ),
    hadScopedMedicalSignature: Boolean(
      record.medicalSignatureByScope && Object.keys(record.medicalSignatureByScope).length > 0
    ),
    doctorName: record.medicalHandoffDoctor || '',
  };
};
