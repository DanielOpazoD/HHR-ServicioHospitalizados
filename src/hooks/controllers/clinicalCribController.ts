import { createEmptyPatient } from '@/services/factories/patientFactory';
import type { DailyRecordPatch } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';

const isFutureDate = (value: string): boolean => {
  const selectedDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selectedDate > today;
};

export const resolveMotherLabel = (patient: PatientData): string => {
  const fullNameFromParts = [patient.firstName, patient.lastName, patient.secondLastName]
    .map(part => (part || '').trim())
    .filter(Boolean)
    .join(' ');
  const fallbackName = (patient.patientName || '').trim();
  return fullNameFromParts || fallbackName || 'Madre';
};

export const buildClinicalCribPatch = (
  bedId: string,
  parentPatient: PatientData
): DailyRecordPatch => {
  const newCrib = createEmptyPatient(bedId);
  newCrib.bedMode = 'Cuna';
  newCrib.identityStatus = 'provisional';
  newCrib.patientName = `RN de ${resolveMotherLabel(parentPatient)}`;
  newCrib.firstName = '';
  newCrib.lastName = '';
  newCrib.secondLastName = '';
  newCrib.rut = '';
  newCrib.documentType = 'RUT';

  return {
    [`beds.${bedId}.clinicalCrib`]: newCrib,
    [`beds.${bedId}.hasCompanionCrib`]: false,
  } as DailyRecordPatch;
};

export const buildRemoveClinicalCribPatch = (bedId: string): DailyRecordPatch =>
  ({
    [`beds.${bedId}.clinicalCrib`]: null,
  }) as DailyRecordPatch;

export const isClinicalCribFieldUpdateAllowed = (
  field: keyof PatientData,
  value: unknown
): boolean => !(field === 'admissionDate' && typeof value === 'string' && isFutureDate(value));

export const sanitizeClinicalCribUpdates = (
  updates: Partial<PatientData>
): Partial<PatientData> => {
  const nextUpdates = { ...updates };

  if (
    nextUpdates.admissionDate &&
    typeof nextUpdates.admissionDate === 'string' &&
    isFutureDate(nextUpdates.admissionDate)
  ) {
    delete nextUpdates.admissionDate;
  }

  return nextUpdates;
};

export const buildClinicalCribMultiplePatch = (
  bedId: string,
  updates: Partial<PatientData>
): DailyRecordPatch => {
  const patches: DailyRecordPatch = {};
  Object.entries(updates).forEach(([key, value]) => {
    (patches as Record<string, unknown>)[`beds.${bedId}.clinicalCrib.${key}`] = value;
  });
  return patches;
};
