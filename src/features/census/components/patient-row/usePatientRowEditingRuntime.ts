import { usePatientRowHandlersModel } from './usePatientRowHandlersModel';
import type {
  PatientRowPatientDocumentType,
  PatientRowPatientField,
  PatientRowPatientPatch,
} from '@/features/census/components/patient-row/patientRowDataContracts';
import type { PatientFieldValue } from '@/types/valueTypes';

interface UsePatientRowEditingRuntimeParams {
  bedId: string;
  documentType?: PatientRowPatientDocumentType;
  updatePatient: (bedId: string, field: PatientRowPatientField, value: PatientFieldValue) => void;
  updatePatientMultiple: (bedId: string, fields: PatientRowPatientPatch) => void;
  updateClinicalCrib: (
    bedId: string,
    field: PatientRowPatientField,
    value: PatientFieldValue
  ) => void;
  updateClinicalCribMultiple: (bedId: string, fields: PatientRowPatientPatch) => void;
}

export const usePatientRowEditingRuntime = ({
  bedId,
  documentType,
  updatePatient,
  updatePatientMultiple,
  updateClinicalCrib,
  updateClinicalCribMultiple,
}: UsePatientRowEditingRuntimeParams) =>
  usePatientRowHandlersModel({
    bedId,
    documentType,
    updatePatient,
    updatePatientMultiple,
    updateClinicalCrib,
    updateClinicalCribMultiple,
  });
