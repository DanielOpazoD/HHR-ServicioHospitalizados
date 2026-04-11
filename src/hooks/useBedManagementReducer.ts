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

// ============================================================================
// Actions
// ============================================================================

export type BedAction =
  | { type: 'UPDATE_PATIENT'; bedId: string; field: keyof PatientData; value: PatientFieldValue }
  | { type: 'UPDATE_PATIENT_MULTIPLE'; bedId: string; fields: Partial<PatientData> }
  | { type: 'UPDATE_CUDYR'; bedId: string; field: keyof CudyrScore; value: number }
  | { type: 'CLEAR_PATIENT'; bedId: string }
  | { type: 'CLEAR_ALL_BEDS' }
  | { type: 'MOVE_PATIENT'; sourceBedId: string; targetBedId: string }
  | { type: 'COPY_PATIENT'; sourceBedId: string; targetBedId: string }
  | { type: 'TOGGLE_BLOCK_BED'; bedId: string; reason?: string }
  | { type: 'UPDATE_BLOCKED_REASON'; bedId: string; reason: string }
  | { type: 'TOGGLE_EXTRA_BED'; bedId: string }
  | { type: 'CREATE_CLINICAL_CRIB'; bedId: string }
  | { type: 'REMOVE_CLINICAL_CRIB'; bedId: string }
  | {
      type: 'UPDATE_CLINICAL_CRIB';
      bedId: string;
      field: keyof PatientData;
      value: PatientFieldValue;
    }
  | { type: 'UPDATE_CLINICAL_CRIB_MULTIPLE'; bedId: string; fields: Partial<PatientData> }
  | { type: 'UPDATE_CLINICAL_CRIB_CUDYR'; bedId: string; field: keyof CudyrScore; value: number }
  | { type: 'TOGGLE_BED_TYPE'; bedId: string };

// ============================================================================
// Reducer Logic (Pure Function)
// ============================================================================

/**
 * Calculates the necessary patches to apply an action to the DailyRecord.
 * This is a "Patch Reducer" - instead of returning a new state, it returns the DIFF.
 */
export const bedManagementReducer = (
  state: DailyRecord | null,
  action: BedAction
): DailyRecordPatch | null => {
  if (!state) return null;

  switch (action.type) {
    case 'UPDATE_PATIENT': {
      const { bedId, field, value } = action;
      const oldPatient = state.beds[bedId];
      const patches: Record<string, unknown> = {
        [`beds.${bedId}.${field}`]:
          field === 'isUPC' ? resolveNormalizedUpcFlag(bedId, Boolean(value)) : value,
      };

      // Identity logic side-effects
      const isIdentityChange =
        (field === 'rut' || field === 'patientName') && value !== oldPatient[field];

      if (isIdentityChange) {
        Object.assign(patches, getClearClinicalDataPatches(bedId));
      }

      const nextPatientName =
        field === 'patientName' ? String(value ?? '') : String(oldPatient.patientName ?? '');
      const nextRut = field === 'rut' ? String(value ?? '') : String(oldPatient.rut ?? '');

      if (
        shouldAnchorFirstSeenDate({
          currentPatientName: oldPatient.patientName,
          currentRut: oldPatient.rut,
          nextPatientName,
          nextRut,
          currentFirstSeenDate: oldPatient.firstSeenDate,
        })
      ) {
        patches[`beds.${bedId}.firstSeenDate`] = state.date;
      }

      if (field === 'pathology' && value !== oldPatient.pathology) {
        patches[`beds.${bedId}.cie10Code`] = undefined;
        patches[`beds.${bedId}.cie10Description`] = undefined;
      }

      if (field === 'specialty' && !isGinecobstetriciaSpecialty(String(value ?? ''))) {
        Object.entries(clearGinecobstetriciaFields()).forEach(([key, fieldValue]) => {
          patches[`beds.${bedId}.${key}`] = fieldValue;
        });
      }

      if (field === 'ginecobstetriciaType' && !isObstetricGinecobstetricia(value as never)) {
        Object.entries(clearDeliveryRouteFields()).forEach(([key, fieldValue]) => {
          patches[`beds.${bedId}.${key}`] = fieldValue;
        });
      }

      if (field === 'deliveryRoute' && value !== 'Cesárea') {
        patches[`beds.${bedId}.deliveryCesareanLabor`] = undefined;
      }

      return patches as DailyRecordPatch;
    }

    case 'UPDATE_PATIENT_MULTIPLE': {
      const { bedId, fields } = action;
      const patches: Record<string, unknown> = {};
      const oldPatient = state.beds[bedId];
      let hasIdentityChange = false;
      const updatesSpecialty = Object.prototype.hasOwnProperty.call(fields, 'specialty');
      const updatesGinecobstetriciaType = Object.prototype.hasOwnProperty.call(
        fields,
        'ginecobstetriciaType'
      );
      const updatesDeliveryRoute = Object.prototype.hasOwnProperty.call(fields, 'deliveryRoute');

      Object.entries(fields).forEach(([key, value]) => {
        patches[`beds.${bedId}.${key}`] =
          key === 'isUPC' ? resolveNormalizedUpcFlag(bedId, Boolean(value)) : value;
        if (
          (key === 'rut' || key === 'patientName') &&
          value !== oldPatient[key as keyof PatientData]
        ) {
          hasIdentityChange = true;
        }
      });

      const nextPatientName = String(fields.patientName ?? oldPatient.patientName ?? '');
      const nextRut = String(fields.rut ?? oldPatient.rut ?? '');

      if (hasIdentityChange) {
        Object.assign(patches, getClearClinicalDataPatches(bedId));
      }

      if (
        shouldAnchorFirstSeenDate({
          currentPatientName: oldPatient.patientName,
          currentRut: oldPatient.rut,
          nextPatientName,
          nextRut,
          currentFirstSeenDate: oldPatient.firstSeenDate,
        })
      ) {
        patches[`beds.${bedId}.firstSeenDate`] = state.date;
      }

      const nextSpecialty = String(fields.specialty ?? oldPatient.specialty ?? '');
      const nextGinecobstetriciaType =
        fields.ginecobstetriciaType ?? oldPatient.ginecobstetriciaType;
      const nextDeliveryRoute = fields.deliveryRoute ?? oldPatient.deliveryRoute;

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

      return patches as DailyRecordPatch;
    }

    case 'UPDATE_CUDYR': {
      const { bedId, field, value } = action;
      return {
        [`beds.${bedId}.cudyr.${field}`]: value,
        ...getCudyrTimestampPatch(),
      } as DailyRecordPatch;
    }

    case 'CLEAR_PATIENT': {
      const { bedId } = action;
      const cleanPatient = createEmptyPatient(bedId);
      cleanPatient.location = state.beds[bedId].location;
      return {
        [`beds.${bedId}`]: cleanPatient,
      } as DailyRecordPatch;
    }

    case 'CLEAR_ALL_BEDS': {
      const patches: Record<string, unknown> = {};
      // Iterate over all beds in current state and clear them
      Object.keys(state.beds).forEach(bedId => {
        const cleanPatient = createEmptyPatient(bedId);
        cleanPatient.location = state.beds[bedId].location;
        patches[`beds.${bedId}`] = cleanPatient;
      });
      return patches as DailyRecordPatch;
    }

    case 'MOVE_PATIENT': {
      const { sourceBedId, targetBedId } = action;
      const sourceData = state.beds[sourceBedId];

      const targetPatient = {
        ...sourceData,
        bedId: targetBedId,
        location: state.beds[targetBedId].location,
      };
      const normalizedTargetPatient = normalizePatientUpcForBed(targetPatient, targetBedId);
      const cleanSource = createEmptyPatient(sourceBedId);
      cleanSource.location = state.beds[sourceBedId].location;

      return {
        [`beds.${targetBedId}`]: normalizedTargetPatient,
        [`beds.${sourceBedId}`]: cleanSource,
      } as DailyRecordPatch;
    }

    case 'COPY_PATIENT': {
      const { sourceBedId, targetBedId } = action;
      const sourceData = state.beds[sourceBedId];
      const targetPatient = normalizePatientUpcForBed(
        {
          ...deepClone(sourceData),
          bedId: targetBedId,
          location: state.beds[targetBedId].location,
        },
        targetBedId
      );

      return {
        [`beds.${targetBedId}`]: targetPatient,
      } as DailyRecordPatch;
    }

    case 'TOGGLE_BLOCK_BED': {
      const { bedId, reason } = action;
      const newIsBlocked = !state.beds[bedId].isBlocked;
      return {
        [`beds.${bedId}.isBlocked`]: newIsBlocked,
        [`beds.${bedId}.blockedReason`]: newIsBlocked ? reason || '' : '',
      } as DailyRecordPatch;
    }

    case 'UPDATE_BLOCKED_REASON': {
      const { bedId, reason } = action;
      return {
        [`beds.${bedId}.blockedReason`]: reason,
      } as DailyRecordPatch;
    }

    case 'TOGGLE_EXTRA_BED': {
      const { bedId } = action;
      const currentExtras = state.activeExtraBeds || [];
      const isActive = !currentExtras.includes(bedId);
      const newExtras = isActive
        ? [...currentExtras, bedId]
        : currentExtras.filter(id => id !== bedId);
      return {
        activeExtraBeds: newExtras,
      } as DailyRecordPatch;
    }

    case 'CREATE_CLINICAL_CRIB': {
      const { bedId } = action;
      const parentPatient = state.beds[bedId];
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
    }

    case 'REMOVE_CLINICAL_CRIB': {
      const { bedId } = action;
      return {
        [`beds.${bedId}.clinicalCrib`]: null,
      } as DailyRecordPatch;
    }

    case 'UPDATE_CLINICAL_CRIB': {
      const { bedId, field, value } = action;
      return {
        [`beds.${bedId}.clinicalCrib.${field}`]: value,
      } as DailyRecordPatch;
    }

    case 'UPDATE_CLINICAL_CRIB_MULTIPLE': {
      const { bedId, fields } = action;
      const patches: Record<string, unknown> = {};
      Object.entries(fields).forEach(([key, value]) => {
        patches[`beds.${bedId}.clinicalCrib.${key}`] = value;
      });
      return patches as DailyRecordPatch;
    }

    case 'UPDATE_CLINICAL_CRIB_CUDYR': {
      const { bedId, field, value } = action;
      return {
        [`beds.${bedId}.clinicalCrib.cudyr.${field}`]: value,
        ...getCudyrTimestampPatch(),
      } as DailyRecordPatch;
    }

    case 'TOGGLE_BED_TYPE': {
      const { bedId } = action;
      const bedDef = BEDS.find(b => b.id === bedId);
      if (!bedDef) return null;

      // Current type with overrides
      const currentType = getBedTypeForRecord(bedDef, state);

      // Cycle between UTI and UCI
      const nextType = currentType === BedType.UTI ? BedType.UCI : BedType.UTI;

      // If next type is same as base type, we set to undefined
      // so applyPatches/Firestore removes/nulls the specific override
      const patchValue = nextType === bedDef.type ? undefined : nextType;

      return {
        [`bedTypeOverrides.${bedId}`]: patchValue,
      } as DailyRecordPatch;
    }

    default:
      return null;
  }
};

// Helper: Returns patches to clear clinical data
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
