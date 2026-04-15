import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import { PatientData } from '@/hooks/contracts/patientHookContracts';
import type { CudyrScore } from '@/types/domain/cudyr';
import { BedType } from '@/types/domain/beds';
import { PatientFieldValue } from '@/types/valueTypes';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { BEDS } from '@/constants/beds';
import { getBedTypeForRecord } from '@/utils/bedTypeUtils';
import { deepClone } from '@/utils/deepClone';
import {
  clearDeliveryRouteFields,
  clearGinecobstetriciaFields,
  isGinecobstetriciaSpecialty,
  isObstetricGinecobstetricia,
} from '@/shared/census/ginecobstetriciaClassification';
import { normalizePatientUpcForBed, resolveNormalizedUpcFlag } from '@/shared/census/upcBedPolicy';

const getCudyrTimestampPatch = () => ({
  cudyrUpdatedAt: new Date().toISOString(),
});

const hasMeaningfulIdentityValue = (value?: string): boolean => Boolean(value?.trim());

const shouldAnchorFirstSeenDate = ({
  currentPatientName,
  currentRut,
  nextPatientName,
  nextRut,
  currentFirstSeenDate,
}: {
  currentPatientName?: string;
  currentRut?: string;
  nextPatientName?: string;
  nextRut?: string;
  currentFirstSeenDate?: string;
}): boolean => {
  if (hasMeaningfulIdentityValue(currentFirstSeenDate)) {
    return false;
  }

  const hadIdentity =
    hasMeaningfulIdentityValue(currentPatientName) || hasMeaningfulIdentityValue(currentRut);
  const hasIdentityNow =
    hasMeaningfulIdentityValue(nextPatientName) || hasMeaningfulIdentityValue(nextRut);

  return !hadIdentity && hasIdentityNow;
};

const getClearClinicalDataPatches = (bedId: string) => ({
  [`beds.${bedId}.cie10Code`]: undefined,
  [`beds.${bedId}.cie10Description`]: undefined,
  [`beds.${bedId}.pathology`]: '',
  [`beds.${bedId}.clinicalEvents`]: [],
  [`beds.${bedId}.cudyr`]: undefined,
  [`beds.${bedId}.deviceDetails`]: {},
  [`beds.${bedId}.devices`]: [],
  [`beds.${bedId}.handoffNoteDayShift`]: '',
  [`beds.${bedId}.handoffNoteNightShift`]: '',
  [`beds.${bedId}.medicalHandoffNote`]: '',
  [`beds.${bedId}.medicalHandoffAudit`]: undefined,
  [`beds.${bedId}.medicalHandoffEntries`]: [],
  [`beds.${bedId}.ginecobstetriciaType`]: undefined,
  [`beds.${bedId}.deliveryRoute`]: undefined,
  [`beds.${bedId}.deliveryDate`]: undefined,
  [`beds.${bedId}.deliveryCesareanLabor`]: undefined,
});

const resolveMotherLabel = (patient: PatientData): string => {
  const fullNameFromParts = [patient.firstName, patient.lastName, patient.secondLastName]
    .map(part => (part || '').trim())
    .filter(Boolean)
    .join(' ');
  const fallbackName = (patient.patientName || '').trim();
  return fullNameFromParts || fallbackName || 'Madre';
};

const buildPatientFieldPatches = ({
  bedId,
  currentPatient,
  updates,
  recordDate,
}: {
  bedId: string;
  currentPatient: PatientData;
  updates: Partial<PatientData>;
  recordDate: string;
}): Record<string, unknown> => {
  const patches: Record<string, unknown> = {};
  let hasIdentityChange = false;
  const updatesSpecialty = Object.prototype.hasOwnProperty.call(updates, 'specialty');
  const updatesGinecobstetriciaType = Object.prototype.hasOwnProperty.call(
    updates,
    'ginecobstetriciaType'
  );
  const updatesDeliveryRoute = Object.prototype.hasOwnProperty.call(updates, 'deliveryRoute');

  Object.entries(updates).forEach(([key, value]) => {
    patches[`beds.${bedId}.${key}`] =
      key === 'isUPC' ? resolveNormalizedUpcFlag(bedId, Boolean(value)) : value;

    if (
      (key === 'rut' || key === 'patientName') &&
      value !== currentPatient[key as keyof PatientData]
    ) {
      hasIdentityChange = true;
    }
  });

  const nextPatientName = String(updates.patientName ?? currentPatient.patientName ?? '');
  const nextRut = String(updates.rut ?? currentPatient.rut ?? '');

  if (hasIdentityChange) {
    Object.assign(patches, getClearClinicalDataPatches(bedId));
  }

  if (
    shouldAnchorFirstSeenDate({
      currentPatientName: currentPatient.patientName,
      currentRut: currentPatient.rut,
      nextPatientName,
      nextRut,
      currentFirstSeenDate: currentPatient.firstSeenDate,
    })
  ) {
    patches[`beds.${bedId}.firstSeenDate`] = recordDate;
  }

  const nextSpecialty = String(updates.specialty ?? currentPatient.specialty ?? '');
  const nextGinecobstetriciaType =
    updates.ginecobstetriciaType ?? currentPatient.ginecobstetriciaType;
  const nextDeliveryRoute = updates.deliveryRoute ?? currentPatient.deliveryRoute;

  if (updatesSpecialty && !isGinecobstetriciaSpecialty(nextSpecialty)) {
    Object.entries(clearGinecobstetriciaFields()).forEach(([key, value]) => {
      patches[`beds.${bedId}.${key}`] = value;
    });
  } else if (
    updatesGinecobstetriciaType &&
    !isObstetricGinecobstetricia(nextGinecobstetriciaType)
  ) {
    Object.entries(clearDeliveryRouteFields()).forEach(([key, value]) => {
      patches[`beds.${bedId}.${key}`] = value;
    });
  } else if (updatesDeliveryRoute && nextDeliveryRoute !== 'Cesárea') {
    patches[`beds.${bedId}.deliveryCesareanLabor`] = undefined;
  }

  return patches;
};

const buildTargetBedPatient = ({
  patient,
  targetBedId,
  targetLocation,
}: {
  patient: PatientData;
  targetBedId: string;
  targetLocation: PatientData['location'];
}): PatientData =>
  normalizePatientUpcForBed(
    {
      ...patient,
      bedId: targetBedId,
      location: targetLocation,
    },
    targetBedId
  );

const buildClearedBedPatient = ({
  bedId,
  location,
}: {
  bedId: string;
  location: PatientData['location'];
}): PatientData => {
  const cleanPatient = createEmptyPatient(bedId);
  cleanPatient.location = location;
  return cleanPatient;
};

const buildClinicalCribDraft = (bedId: string, parentPatient: PatientData): PatientData => {
  const clinicalCrib = createEmptyPatient(bedId);
  clinicalCrib.bedMode = 'Cuna';
  clinicalCrib.identityStatus = 'provisional';
  clinicalCrib.patientName = `RN de ${resolveMotherLabel(parentPatient)}`;
  clinicalCrib.firstName = '';
  clinicalCrib.lastName = '';
  clinicalCrib.secondLastName = '';
  clinicalCrib.rut = '';
  clinicalCrib.documentType = 'RUT';
  return clinicalCrib;
};

export const buildClearAllBedsPatches = (state: DailyRecord): DailyRecordPatch => {
  const patches: Record<string, unknown> = {};
  Object.keys(state.beds).forEach(bedId => {
    patches[`beds.${bedId}`] = buildClearedBedPatient({
      bedId,
      location: state.beds[bedId].location,
    });
  });
  return patches as DailyRecordPatch;
};

export const buildMovePatientPatches = (
  state: DailyRecord,
  sourceBedId: string,
  targetBedId: string
): DailyRecordPatch => {
  const sourceData = state.beds[sourceBedId];

  return {
    [`beds.${targetBedId}`]: buildTargetBedPatient({
      patient: sourceData,
      targetBedId,
      targetLocation: state.beds[targetBedId].location,
    }),
    [`beds.${sourceBedId}`]: buildClearedBedPatient({
      bedId: sourceBedId,
      location: state.beds[sourceBedId].location,
    }),
  } as DailyRecordPatch;
};

export const buildCopyPatientPatches = (
  state: DailyRecord,
  sourceBedId: string,
  targetBedId: string
): DailyRecordPatch =>
  ({
    [`beds.${targetBedId}`]: buildTargetBedPatient({
      patient: deepClone(state.beds[sourceBedId]),
      targetBedId,
      targetLocation: state.beds[targetBedId].location,
    }),
  }) as DailyRecordPatch;

export const buildClinicalCribMultipleFieldPatches = (
  bedId: string,
  fields: Partial<PatientData>
): DailyRecordPatch => {
  const patches: Record<string, unknown> = {};
  Object.entries(fields).forEach(([key, value]) => {
    patches[`beds.${bedId}.clinicalCrib.${key}`] = value;
  });
  return patches as DailyRecordPatch;
};

export const buildUpdatePatientPatches = (
  state: DailyRecord,
  bedId: string,
  fields: Partial<PatientData>
): DailyRecordPatch =>
  buildPatientFieldPatches({
    bedId,
    currentPatient: state.beds[bedId],
    updates: fields,
    recordDate: state.date,
  }) as DailyRecordPatch;

export const buildUpdateCudyrPatches = (
  bedId: string,
  field: keyof CudyrScore,
  value: number
): DailyRecordPatch =>
  ({
    [`beds.${bedId}.cudyr.${field}`]: value,
    ...getCudyrTimestampPatch(),
  }) as DailyRecordPatch;

export const buildClearPatientPatches = (state: DailyRecord, bedId: string): DailyRecordPatch =>
  ({
    [`beds.${bedId}`]: buildClearedBedPatient({
      bedId,
      location: state.beds[bedId].location,
    }),
  }) as DailyRecordPatch;

export const buildToggleBlockedBedPatches = (
  state: DailyRecord,
  bedId: string,
  reason?: string
): DailyRecordPatch => {
  const newIsBlocked = !state.beds[bedId].isBlocked;
  return {
    [`beds.${bedId}.isBlocked`]: newIsBlocked,
    [`beds.${bedId}.blockedReason`]: newIsBlocked ? reason || '' : '',
  } as DailyRecordPatch;
};

export const buildToggleExtraBedPatches = (state: DailyRecord, bedId: string): DailyRecordPatch => {
  const currentExtras = state.activeExtraBeds || [];
  const isActive = !currentExtras.includes(bedId);
  const newExtras = isActive ? [...currentExtras, bedId] : currentExtras.filter(id => id !== bedId);
  return {
    activeExtraBeds: newExtras,
  } as DailyRecordPatch;
};

export const buildToggleBedTypePatches = (
  state: DailyRecord,
  bedId: string
): DailyRecordPatch | null => {
  const bedDef = BEDS.find(b => b.id === bedId);
  if (!bedDef) return null;

  const currentType = getBedTypeForRecord(bedDef, state);
  const nextType = currentType === BedType.UTI ? BedType.UCI : BedType.UTI;
  const patchValue = nextType === bedDef.type ? undefined : nextType;

  return {
    [`bedTypeOverrides.${bedId}`]: patchValue,
  } as DailyRecordPatch;
};

export const buildUpdateBlockedReasonPatches = (bedId: string, reason: string): DailyRecordPatch =>
  ({
    [`beds.${bedId}.blockedReason`]: reason,
  }) as DailyRecordPatch;

export const buildCreateClinicalCribPatches = (
  state: DailyRecord,
  bedId: string
): DailyRecordPatch =>
  ({
    [`beds.${bedId}.clinicalCrib`]: buildClinicalCribDraft(bedId, state.beds[bedId]),
    [`beds.${bedId}.hasCompanionCrib`]: false,
  }) as DailyRecordPatch;

export const buildRemoveClinicalCribPatches = (bedId: string): DailyRecordPatch =>
  ({
    [`beds.${bedId}.clinicalCrib`]: null,
  }) as DailyRecordPatch;

export const buildUpdateClinicalCribPatches = (
  bedId: string,
  field: keyof PatientData,
  value: PatientFieldValue
): DailyRecordPatch =>
  ({
    [`beds.${bedId}.clinicalCrib.${field}`]: value,
  }) as DailyRecordPatch;

export const buildUpdateClinicalCribCudyrPatches = (
  bedId: string,
  field: keyof CudyrScore,
  value: number
): DailyRecordPatch =>
  ({
    [`beds.${bedId}.clinicalCrib.cudyr.${field}`]: value,
    ...getCudyrTimestampPatch(),
  }) as DailyRecordPatch;
