import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type { PatientData } from '@/hooks/contracts/patientHookContracts';
import type { PatientFieldValue } from '@/types/valueTypes';
import { buildUpdatePatientPatches } from '@/hooks/controllers/bedManagementPatchController';

interface UpdatePatientActionInput {
  bedId: string;
  field: keyof PatientData;
  value: PatientFieldValue;
}

export const buildUpdatePatientActionPatch = (
  state: DailyRecord,
  { bedId, field, value }: UpdatePatientActionInput
): DailyRecordPatch => {
  const patches = buildUpdatePatientPatches(state, bedId, {
    [field]: value,
  } as Partial<PatientData>);

  if (field === 'pathology' && value !== state.beds[bedId].pathology) {
    patches[`beds.${bedId}.cie10Code`] = undefined;
    patches[`beds.${bedId}.cie10Description`] = undefined;
  }

  return patches as DailyRecordPatch;
};
