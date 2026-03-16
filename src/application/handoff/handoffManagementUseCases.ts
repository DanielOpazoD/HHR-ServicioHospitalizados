import {
  buildChecklistUpdateRecord,
  buildMedicalSignatureRecord,
  buildNovedadesUpdateRecord,
  buildResetMedicalHandoffRecord,
  buildUpdatedHandoffStaffRecord,
} from '@/domain/handoff/management';
import {
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';
import type {
  DailyRecord,
  DailyRecordPatch,
  MedicalHandoffActor,
  MedicalSpecialty,
} from '@/types/domain/dailyRecord';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import {
  buildMedicalNoChangesRecord,
  buildMedicalSpecialtyNoteRecord,
} from '@/domain/handoff/management';
import { createMissingRecordOutcome, createValidationOutcome } from './handoffUseCaseSupport';

export interface PersistedHandoffRecordOutput {
  updatedRecord: DailyRecord;
}

export interface ConfirmMedicalSpecialtyNoChangesOutput extends PersistedHandoffRecordOutput {
  confirmedAt: string;
  effectiveDateKey: string;
}

interface PersistRecordInput {
  record: DailyRecord | null;
  saveRecord: (updatedRecord: DailyRecord) => Promise<void>;
}

interface UpdateHandoffChecklistInput extends PersistRecordInput {
  field: string;
  shift: 'day' | 'night';
  value: boolean | string;
}

interface UpdateHandoffNovedadesInput extends PersistRecordInput {
  shift: 'day' | 'night' | 'medical';
  value: string;
}

interface UpdateMedicalSpecialtyNoteInput extends PersistRecordInput {
  actor: Partial<MedicalHandoffActor>;
  specialty: MedicalSpecialty;
  value: string;
}

interface ConfirmMedicalSpecialtyNoChangesInput extends PersistRecordInput {
  actor: Partial<MedicalHandoffActor>;
  comment?: string;
  dateKey?: string;
  specialty: MedicalSpecialty;
}

interface UpdateHandoffStaffInput extends PersistRecordInput {
  shift: 'day' | 'night';
  staffList: string[];
  type: 'delivers' | 'receives' | 'tens';
}

interface UpdateMedicalSignatureInput extends PersistRecordInput {
  doctorName: string;
  scope?: MedicalHandoffScope;
}

interface UpdateMedicalHandoffDoctorInput extends PersistRecordInput {
  doctorName: string;
}

export const executeUpdateHandoffChecklist = async (
  input: UpdateHandoffChecklistInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(null, 'update_handoff_checklist', 'No hay entrega activa.');
  }

  const updatedRecord = buildChecklistUpdateRecord(
    input.record,
    input.shift,
    input.field,
    input.value
  );
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};

export const executeUpdateHandoffNovedades = async (
  input: UpdateHandoffNovedadesInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(null, 'update_handoff_novedades', 'No hay entrega activa.');
  }

  const updatedRecord = buildNovedadesUpdateRecord(input.record, input.shift, input.value);
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};

export const executeUpdateMedicalSpecialtyNote = async (
  input: UpdateMedicalSpecialtyNoteInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(
      null,
      'update_medical_specialty_note',
      'No hay entrega médica disponible.'
    );
  }

  const updatedRecord = buildMedicalSpecialtyNoteRecord(
    input.record,
    input.specialty,
    input.value,
    input.actor
  );
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};

export const executeConfirmMedicalSpecialtyNoChanges = async (
  input: ConfirmMedicalSpecialtyNoChangesInput
): Promise<ApplicationOutcome<ConfirmMedicalSpecialtyNoChangesOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(
      null,
      'confirm_medical_specialty_no_changes',
      'No hay entrega médica disponible.'
    );
  }

  const currentNote = input.record.medicalHandoffBySpecialty?.[input.specialty];
  if (!currentNote?.note?.trim()) {
    return createValidationOutcome(
      null,
      'confirm_medical_specialty_no_changes',
      'missing_base_note',
      'Primero debe existir una entrega del especialista para confirmar continuidad.'
    );
  }

  const effectiveDateKey = input.dateKey || input.record.date;
  if (currentNote.updatedAt?.slice(0, 10) === effectiveDateKey) {
    return createValidationOutcome(
      null,
      'confirm_medical_specialty_no_changes',
      'already_updated_today',
      'Esta especialidad ya fue actualizada hoy por un especialista.'
    );
  }

  const updatedRecord = buildMedicalNoChangesRecord(
    input.record,
    input.specialty,
    input.actor,
    input.comment,
    effectiveDateKey
  );
  const confirmedAt =
    updatedRecord.medicalHandoffBySpecialty?.[input.specialty]?.dailyContinuity?.[effectiveDateKey]
      ?.confirmedAt || new Date().toISOString();

  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({
    updatedRecord,
    confirmedAt,
    effectiveDateKey,
  });
};

export const executeUpdateHandoffStaff = async (
  input: UpdateHandoffStaffInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(null, 'update_handoff_staff', 'No hay entrega activa.');
  }

  const updatedRecord = buildUpdatedHandoffStaffRecord(
    input.record,
    input.shift,
    input.type,
    input.staffList
  );
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};

export const executeUpdateMedicalSignature = async (
  input: UpdateMedicalSignatureInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(
      null,
      'update_medical_signature',
      'No hay entrega médica disponible.'
    );
  }

  const scope = input.scope || 'all';
  const updatedRecord = buildMedicalSignatureRecord(input.record, input.doctorName, scope);
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};

export const executeUpdateMedicalHandoffDoctor = async (
  input: UpdateMedicalHandoffDoctorInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(
      null,
      'update_medical_handoff_doctor',
      'No hay entrega médica disponible.'
    );
  }

  const updatedRecord: DailyRecord = {
    ...input.record,
    medicalHandoffDoctor: input.doctorName,
    lastUpdated: new Date().toISOString(),
  };
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};

export const executeResetMedicalHandoffState = async (
  input: PersistRecordInput
): Promise<ApplicationOutcome<PersistedHandoffRecordOutput | null>> => {
  if (!input.record) {
    return createMissingRecordOutcome(
      null,
      'reset_medical_handoff_state',
      'No hay entrega médica disponible.'
    );
  }

  const updatedRecord = buildResetMedicalHandoffRecord(input.record);
  await input.saveRecord(updatedRecord);
  return createApplicationSuccess({ updatedRecord });
};
