import type {
  PatientRowPatientField,
  PatientRowPatientPatch,
} from '@/features/census/components/patient-row/patientRowDataContracts';
import type { PatientFieldValue } from '@/types/valueTypes';

interface BuildPatientFieldUpdaterParams {
  bedId: string;
  updateSingle: (bedId: string, field: PatientRowPatientField, value: PatientFieldValue) => void;
}

interface BuildPatientMultipleUpdaterParams {
  bedId: string;
  updateMany: (bedId: string, fields: PatientRowPatientPatch) => void;
}

export const buildPatientFieldUpdater = ({
  bedId,
  updateSingle,
}: BuildPatientFieldUpdaterParams) => {
  return (field: PatientRowPatientField, value: PatientFieldValue) => {
    updateSingle(bedId, field, value);
  };
};

export const buildPatientMultipleUpdater = ({
  bedId,
  updateMany,
}: BuildPatientMultipleUpdaterParams) => {
  return (fields: PatientRowPatientPatch) => {
    updateMany(bedId, fields);
  };
};
