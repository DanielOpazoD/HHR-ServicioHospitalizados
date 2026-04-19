import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import { PatientData } from '@/hooks/contracts/patientHookContracts';
import type { CudyrScore } from '@/types/domain/cudyr';
import { PatientFieldValue } from '@/types/valueTypes';
import {
  buildClearAllBedsPatches,
  buildClearPatientPatches,
  buildClinicalCribMultipleFieldPatches,
  buildCopyPatientPatches,
  buildCreateClinicalCribPatches,
  buildMovePatientPatches,
  buildRemoveClinicalCribPatches,
  buildToggleBedTypePatches,
  buildToggleBlockedBedPatches,
  buildToggleExtraBedPatches,
  buildUpdateBlockedReasonPatches,
  buildUpdateClinicalCribCudyrPatches,
  buildUpdateClinicalCribPatches,
  buildUpdateCudyrPatches,
  buildUpdatePatientPatches,
} from '@/hooks/controllers/bedManagementPatchController';
import { buildUpdatePatientActionPatch } from '@/hooks/controllers/bedManagementUpdatePatientController';

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
      return buildUpdatePatientActionPatch(state, action);
    }

    case 'UPDATE_PATIENT_MULTIPLE': {
      const { bedId, fields } = action;
      return buildUpdatePatientPatches(state, bedId, fields);
    }

    case 'UPDATE_CUDYR': {
      const { bedId, field, value } = action;
      return buildUpdateCudyrPatches(bedId, field, value);
    }

    case 'CLEAR_PATIENT': {
      const { bedId } = action;
      return buildClearPatientPatches(state, bedId);
    }

    case 'CLEAR_ALL_BEDS': {
      return buildClearAllBedsPatches(state);
    }

    case 'MOVE_PATIENT': {
      const { sourceBedId, targetBedId } = action;
      return buildMovePatientPatches(state, sourceBedId, targetBedId);
    }

    case 'COPY_PATIENT': {
      const { sourceBedId, targetBedId } = action;
      return buildCopyPatientPatches(state, sourceBedId, targetBedId);
    }

    case 'TOGGLE_BLOCK_BED': {
      const { bedId, reason } = action;
      return buildToggleBlockedBedPatches(state, bedId, reason);
    }

    case 'UPDATE_BLOCKED_REASON': {
      const { bedId, reason } = action;
      return buildUpdateBlockedReasonPatches(bedId, reason);
    }

    case 'TOGGLE_EXTRA_BED': {
      const { bedId } = action;
      return buildToggleExtraBedPatches(state, bedId);
    }

    case 'CREATE_CLINICAL_CRIB': {
      const { bedId } = action;
      return buildCreateClinicalCribPatches(state, bedId);
    }

    case 'REMOVE_CLINICAL_CRIB': {
      const { bedId } = action;
      return buildRemoveClinicalCribPatches(bedId);
    }

    case 'UPDATE_CLINICAL_CRIB': {
      const { bedId, field, value } = action;
      return buildUpdateClinicalCribPatches(bedId, field, value);
    }

    case 'UPDATE_CLINICAL_CRIB_MULTIPLE': {
      const { bedId, fields } = action;
      return buildClinicalCribMultipleFieldPatches(bedId, fields);
    }

    case 'UPDATE_CLINICAL_CRIB_CUDYR': {
      const { bedId, field, value } = action;
      return buildUpdateClinicalCribCudyrPatches(bedId, field, value);
    }

    case 'TOGGLE_BED_TYPE': {
      const { bedId } = action;
      return buildToggleBedTypePatches(state, bedId);
    }

    default:
      return null;
  }
};
